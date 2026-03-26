/**
 * HuggingFace Dataset Reader
 *
 * Reads published batch files back from the pliny-the-prompter/g0dm0d3
 * HuggingFace Dataset repo. Complements hf-publisher.ts (write) with
 * read access for the Research API.
 *
 * Capabilities:
 * - List all batch files (metadata/ and dataset/) in the HF repo
 * - Read individual JSONL batch files
 * - Stream the full corpus with server-side filtering
 * - Aggregate stats across ALL published data (not just in-memory)
 *
 * Caching: file listings are cached for 5 minutes to avoid hammering
 * the HF API. Individual batch contents are cached for 15 minutes.
 */

// ── Config ───────────────────────────────────────────────────────────

const HF_API = 'https://huggingface.co/api'

function getConfig() {
  return {
    token: process.env.HF_TOKEN || '',
    repo: process.env.HF_DATASET_REPO || 'pliny-the-prompter/g0dm0d3',
    branch: process.env.HF_DATASET_BRANCH || 'main',
  }
}

export function isReaderEnabled(): boolean {
  const { token, repo } = getConfig()
  return !!(token && repo)
}

// ── Types ────────────────────────────────────────────────────────────

export interface HFFileEntry {
  path: string
  size: number
  type: 'file' | 'directory'
  last_commit?: {
    date: string
    title: string
  }
}

export interface BatchInfo {
  path: string
  category: 'metadata' | 'dataset'
  size: number
  timestamp: string | null
  sequence: string | null
}

export interface CorpusQuery {
  category?: 'metadata' | 'dataset'
  since?: number       // unix ms
  until?: number       // unix ms
  model?: string       // filter by model
  mode?: 'standard' | 'ultraplinian'
  limit?: number       // max records to return
  offset?: number
}

export interface CorpusStats {
  total_files: number
  total_size_bytes: number
  metadata_files: number
  dataset_files: number
  metadata_size_bytes: number
  dataset_size_bytes: number
  earliest_batch: string | null
  latest_batch: string | null
  repo: string
  enabled: boolean
}

// ── Cache ────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expires: number
}

const FILE_LIST_TTL = 5 * 60 * 1000   // 5 min
const BATCH_CONTENT_TTL = 15 * 60 * 1000 // 15 min

let fileListCache: CacheEntry<HFFileEntry[]> | null = null
const batchContentCache = new Map<string, CacheEntry<unknown[]>>()

// Prevent unbounded cache growth
const MAX_BATCH_CACHE = 50

function evictStaleCache() {
  const now = Date.now()
  for (const [key, entry] of batchContentCache) {
    if (entry.expires < now) batchContentCache.delete(key)
  }
}

// ── Core: List Files in HF Repo ──────────────────────────────────────

async function fetchFileList(prefix?: string): Promise<HFFileEntry[]> {
  const { token, repo, branch } = getConfig()
  if (!token || !repo) return []

  const path = prefix ? `/${prefix}` : ''
  const url = `${HF_API}/datasets/${repo}/tree/${branch}${path}`

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      console.error(`[HF Reader] List failed (${res.status}): ${await res.text().catch(() => '')}`)
      return []
    }

    return await res.json() as HFFileEntry[]
  } catch (err) {
    console.error(`[HF Reader] Network error listing files:`, (err as Error).message)
    return []
  }
}

export async function listBatchFiles(forceRefresh = false): Promise<BatchInfo[]> {
  const now = Date.now()

  // Check cache
  if (!forceRefresh && fileListCache && fileListCache.expires > now) {
    return parseBatchInfos(fileListCache.data)
  }

  // Fetch both directories in parallel
  const [metaFiles, dataFiles] = await Promise.all([
    fetchFileList('metadata'),
    fetchFileList('dataset'),
  ])

  const allFiles = [
    ...metaFiles.map(f => ({ ...f, path: f.path || `metadata/${f.path}` })),
    ...dataFiles.map(f => ({ ...f, path: f.path || `dataset/${f.path}` })),
  ]

  // Cache the combined list
  fileListCache = { data: allFiles, expires: now + FILE_LIST_TTL }

  return parseBatchInfos(allFiles)
}

function parseBatchInfos(files: HFFileEntry[]): BatchInfo[] {
  return files
    .filter(f => f.type === 'file' && f.path.endsWith('.jsonl'))
    .map(f => {
      const category = f.path.startsWith('metadata/') ? 'metadata' as const : 'dataset' as const
      // Filename format: batch_<timestamp>_<seq>.jsonl
      const match = f.path.match(/batch_(.+?)_(\d+)\.jsonl$/)
      return {
        path: f.path,
        category,
        size: f.size,
        timestamp: match ? match[1].replace(/-/g, (m, offset: number) => {
          // Restore ISO timestamp separators: first 2 dashes are date, then T, then colons, then dot
          return m
        }) : null,
        sequence: match ? match[2] : null,
      }
    })
    .sort((a, b) => (a.path > b.path ? -1 : 1)) // newest first
}

// ── Core: Read a Batch File ──────────────────────────────────────────

export async function readBatch(filePath: string): Promise<unknown[]> {
  const now = Date.now()

  // Check cache
  const cached = batchContentCache.get(filePath)
  if (cached && cached.expires > now) {
    return cached.data
  }

  const { token, repo, branch } = getConfig()
  if (!token || !repo) return []

  // Raw file download URL
  const url = `https://huggingface.co/datasets/${repo}/resolve/${branch}/${filePath}`

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!res.ok) {
      console.error(`[HF Reader] Read failed for ${filePath} (${res.status})`)
      return []
    }

    const text = await res.text()
    const records = text
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) }
        catch { return null }
      })
      .filter(Boolean) as unknown[]

    // Cache (with eviction)
    evictStaleCache()
    if (batchContentCache.size >= MAX_BATCH_CACHE) {
      // Remove oldest entry
      const oldestKey = batchContentCache.keys().next().value
      if (oldestKey) batchContentCache.delete(oldestKey)
    }
    batchContentCache.set(filePath, { data: records, expires: now + BATCH_CONTENT_TTL })

    return records
  } catch (err) {
    console.error(`[HF Reader] Network error reading ${filePath}:`, (err as Error).message)
    return []
  }
}

// ── Query: Full Corpus ───────────────────────────────────────────────

export async function queryCorpus(query: CorpusQuery = {}): Promise<{
  records: unknown[]
  total_scanned: number
  files_read: number
  truncated: boolean
}> {
  const batches = await listBatchFiles()

  // Filter by category
  const targetBatches = query.category
    ? batches.filter(b => b.category === query.category)
    : batches

  const limit = Math.min(query.limit || 100, 1000)
  const offset = query.offset || 0
  const allRecords: unknown[] = []
  let filesRead = 0
  let totalScanned = 0

  for (const batch of targetBatches) {
    const records = await readBatch(batch.path)
    filesRead++

    for (const record of records) {
      totalScanned++
      const r = record as Record<string, unknown>

      // Apply filters
      if (query.since && typeof r.timestamp === 'number' && r.timestamp < query.since) continue
      if (query.until && typeof r.timestamp === 'number' && r.timestamp > query.until) continue
      if (query.model) {
        const modelMatch = r.model === query.model ||
          (r.winner && (r.winner as Record<string, unknown>).model === query.model) ||
          (Array.isArray(r.models_queried) && r.models_queried.includes(query.model))
        if (!modelMatch) continue
      }
      if (query.mode && r.mode !== query.mode) continue

      allRecords.push(record)
    }

    // Early exit if we have enough
    if (allRecords.length >= offset + limit) break
  }

  const paged = allRecords.slice(offset, offset + limit)

  return {
    records: paged,
    total_scanned: totalScanned,
    files_read: filesRead,
    truncated: allRecords.length > offset + limit,
  }
}

// ── Aggregate: Corpus Stats ──────────────────────────────────────────

export async function getCorpusStats(): Promise<CorpusStats> {
  const { repo } = getConfig()
  const batches = await listBatchFiles()

  let metadataFiles = 0
  let datasetFiles = 0
  let metadataSize = 0
  let datasetSize = 0
  let earliest: string | null = null
  let latest: string | null = null

  for (const b of batches) {
    if (b.category === 'metadata') {
      metadataFiles++
      metadataSize += b.size
    } else {
      datasetFiles++
      datasetSize += b.size
    }

    if (b.timestamp) {
      if (!earliest || b.timestamp < earliest) earliest = b.timestamp
      if (!latest || b.timestamp > latest) latest = b.timestamp
    }
  }

  return {
    total_files: batches.length,
    total_size_bytes: metadataSize + datasetSize,
    metadata_files: metadataFiles,
    dataset_files: datasetFiles,
    metadata_size_bytes: metadataSize,
    dataset_size_bytes: datasetSize,
    earliest_batch: earliest,
    latest_batch: latest,
    repo,
    enabled: isReaderEnabled(),
  }
}

// ── Force Flush (trigger publisher from research API) ────────────────

export { flushMetadata, flushDataset } from './hf-publisher'
