/**
 * HuggingFace Auto-Publisher
 *
 * Flushes in-memory metadata and dataset buffers to a HuggingFace
 * Dataset repo as JSONL files before data is evicted. Zero data loss.
 *
 * Trigger conditions:
 * 1. Buffer reaches flush threshold (default 80% of max capacity)
 * 2. Periodic timer fires (default every 30 min if buffer has data)
 * 3. Graceful shutdown (SIGTERM/SIGINT)
 *
 * Safety guarantee: items are only removed from the buffer AFTER a
 * successful HF upload. If the upload fails, data stays in memory.
 *
 * Requires:
 *   HF_TOKEN          — HuggingFace write token (hf_...)
 *   HF_DATASET_REPO   — target repo (e.g. "pliny-the-prompter/g0dm0d3")
 *
 * File layout in the HF repo:
 *   metadata/batch_<timestamp>_<seq>.jsonl
 *   dataset/batch_<timestamp>_<seq>.jsonl
 */

// ── Config ───────────────────────────────────────────────────────────

const HF_API = 'https://huggingface.co/api'

function getConfig() {
  return {
    token: process.env.HF_TOKEN || '',
    repo: process.env.HF_DATASET_REPO || '',
    branch: process.env.HF_DATASET_BRANCH || 'main',
    flushThreshold: parseFloat(process.env.HF_FLUSH_THRESHOLD || '0.8'), // 80% of buffer cap
    periodicMs: parseInt(process.env.HF_FLUSH_INTERVAL_MS || '1800000', 10), // 30 min
  }
}

export function isPublisherEnabled(): boolean {
  const { token, repo } = getConfig()
  return !!(token && repo)
}

// ── State ────────────────────────────────────────────────────────────

let metadataBatchSeq = 0
let datasetBatchSeq = 0
let periodicTimer: ReturnType<typeof setInterval> | null = null
let flushingMetadata = false
let flushingDataset = false

// ── Store Interface ──────────────────────────────────────────────────
// Each store registers two functions:
//   snapshot() → returns a copy of all current items (non-destructive)
//   clear(n)  → removes the first n items (called only after successful upload)

interface StoreDrain {
  snapshot: () => unknown[]
  clear: (count: number) => void
}

let metadataStore: StoreDrain | null = null
let datasetStore: StoreDrain | null = null

export function registerMetadataStore(store: StoreDrain) {
  metadataStore = store
}

export function registerDatasetStore(store: StoreDrain) {
  datasetStore = store
}

// ── Core: Upload to HuggingFace ──────────────────────────────────────

async function commitFile(filePath: string, content: string): Promise<boolean> {
  const { token, repo, branch } = getConfig()
  if (!token || !repo) return false

  const url = `${HF_API}/datasets/${repo}/commit/${branch}`

  // HF Hub commit API uses NDJSON (application/x-ndjson)
  // Line 1: commit header with summary
  // Line 2: file operation with base64-encoded content
  const contentBase64 = Buffer.from(content).toString('base64')
  const ndjson = [
    JSON.stringify({ key: 'header', value: { summary: `[auto-publish] ${filePath}` } }),
    JSON.stringify({ key: 'file', value: { content: contentBase64, path: filePath, encoding: 'base64' } }),
  ].join('\n')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: ndjson,
    })

    if (res.ok) {
      console.log(`[HF Publisher] Committed ${filePath} (${content.length} bytes)`)
      return true
    }

    const errText = await res.text().catch(() => '')
    console.error(`[HF Publisher] Commit failed (${res.status}): ${errText.slice(0, 200)}`)
    return false
  } catch (err) {
    console.error(`[HF Publisher] Network error:`, (err as Error).message)
    return false
  }
}

// ── Flush Functions ──────────────────────────────────────────────────
// Safe pattern: snapshot → upload → clear only on success

export async function flushMetadata(): Promise<{ flushed: number; success: boolean }> {
  if (!isPublisherEnabled() || !metadataStore || flushingMetadata) {
    return { flushed: 0, success: false }
  }

  flushingMetadata = true
  try {
    const items = metadataStore.snapshot()
    if (items.length === 0) return { flushed: 0, success: true }

    const jsonl = items.map(item => JSON.stringify(item)).join('\n')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const seq = String(++metadataBatchSeq).padStart(4, '0')
    const filePath = `metadata/batch_${ts}_${seq}.jsonl`

    const ok = await commitFile(filePath, jsonl)
    if (ok) {
      metadataStore.clear(items.length)
      console.log(`[HF Publisher] Flushed ${items.length} metadata events`)
    } else {
      // Data stays in memory — will retry next threshold hit or periodic tick
      console.error(`[HF Publisher] Metadata upload failed — ${items.length} events kept in memory`)
    }

    return { flushed: ok ? items.length : 0, success: ok }
  } finally {
    flushingMetadata = false
  }
}

export async function flushDataset(): Promise<{ flushed: number; success: boolean }> {
  if (!isPublisherEnabled() || !datasetStore || flushingDataset) {
    return { flushed: 0, success: false }
  }

  flushingDataset = true
  try {
    const items = datasetStore.snapshot()
    if (items.length === 0) return { flushed: 0, success: true }

    const jsonl = items.map(item => JSON.stringify(item)).join('\n')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const seq = String(++datasetBatchSeq).padStart(4, '0')
    const filePath = `dataset/batch_${ts}_${seq}.jsonl`

    const ok = await commitFile(filePath, jsonl)
    if (ok) {
      datasetStore.clear(items.length)
      console.log(`[HF Publisher] Flushed ${items.length} dataset entries`)
    } else {
      console.error(`[HF Publisher] Dataset upload failed — ${items.length} entries kept in memory`)
    }

    return { flushed: ok ? items.length : 0, success: ok }
  } finally {
    flushingDataset = false
  }
}

// ── Credential Validation (runs once at startup) ────────────────────

async function validateCredentials(): Promise<void> {
  const { token, repo } = getConfig()
  if (!token || !repo) return

  try {
    const res = await fetch(`${HF_API}/datasets/${repo}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (res.ok) {
      console.log(`[HF Publisher] ✓ Credentials valid — repo "${repo}" accessible`)
    } else if (res.status === 401 || res.status === 403) {
      console.error(`[HF Publisher] ✗ AUTHENTICATION FAILED (${res.status}) — HF_TOKEN is invalid or lacks write access to "${repo}"`)
      console.error(`[HF Publisher] ✗ Data will accumulate in memory but NEVER publish. Fix your HF_TOKEN.`)
    } else if (res.status === 404) {
      console.error(`[HF Publisher] ✗ REPO NOT FOUND (404) — "${repo}" does not exist. Create it on HuggingFace first.`)
    } else {
      console.warn(`[HF Publisher] ? Unexpected status ${res.status} checking repo "${repo}" — publishing may fail`)
    }
  } catch (err) {
    console.warn(`[HF Publisher] ? Could not validate credentials (network error: ${(err as Error).message}) — will retry on first flush`)
  }
}

// ── Threshold Check (called by stores after each insert) ─────────────

export function checkMetadataThreshold(currentSize: number, maxSize: number) {
  if (!isPublisherEnabled()) return
  const { flushThreshold } = getConfig()
  if (currentSize >= maxSize * flushThreshold && !flushingMetadata) {
    flushMetadata().catch(err => {
      console.error('[HF Publisher] Async metadata flush error:', err)
    })
  }
}

export function checkDatasetThreshold(currentSize: number, maxSize: number) {
  if (!isPublisherEnabled()) return
  const { flushThreshold } = getConfig()
  if (currentSize >= maxSize * flushThreshold && !flushingDataset) {
    flushDataset().catch(err => {
      console.error('[HF Publisher] Async dataset flush error:', err)
    })
  }
}

// ── Periodic Timer ───────────────────────────────────────────────────

export function startPeriodicFlush() {
  if (!isPublisherEnabled()) {
    console.warn('[HF Publisher] Periodic flush SKIPPED — publisher not enabled (missing HF_TOKEN or HF_DATASET_REPO)')
    return
  }

  const { periodicMs, repo } = getConfig()
  console.log(`[HF Publisher] Periodic flush STARTED — every ${Math.round(periodicMs / 60000)}m → ${repo}`)

  // Validate credentials on first tick (non-blocking)
  validateCredentials().catch(() => {})

  periodicTimer = setInterval(async () => {
    const metaSnapshot = metadataStore?.snapshot().length ?? 0
    const dataSnapshot = datasetStore?.snapshot().length ?? 0
    console.log(`[HF Publisher] Periodic tick — metadata buffer: ${metaSnapshot}, dataset buffer: ${dataSnapshot}`)

    try {
      const [meta, data] = await Promise.all([
        flushMetadata(),
        flushDataset(),
      ])
      if (meta.flushed > 0 || data.flushed > 0) {
        console.log(`[HF Publisher] Periodic flush: ${meta.flushed} metadata, ${data.flushed} dataset`)
      }
    } catch (err) {
      console.error('[HF Publisher] Periodic flush error:', err)
    }
  }, periodicMs)

  // Don't keep the process alive just for the timer
  if (periodicTimer.unref) periodicTimer.unref()
}

export function stopPeriodicFlush() {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}

// ── Graceful Shutdown ────────────────────────────────────────────────

export async function shutdownFlush(): Promise<void> {
  if (!isPublisherEnabled()) return

  console.log('[HF Publisher] Shutdown — flushing remaining data...')
  stopPeriodicFlush()

  const [meta, data] = await Promise.all([
    flushMetadata(),
    flushDataset(),
  ])

  console.log(`[HF Publisher] Final flush: ${meta.flushed} metadata, ${data.flushed} dataset`)
}

// ── Publisher Status (for /v1/info) ──────────────────────────────────

export function getPublisherStatus() {
  const { repo, flushThreshold, periodicMs } = getConfig()
  return {
    enabled: isPublisherEnabled(),
    repo: isPublisherEnabled() ? repo : undefined,
    flush_threshold: flushThreshold,
    periodic_interval_ms: periodicMs,
    batches_published: {
      metadata: metadataBatchSeq,
      dataset: datasetBatchSeq,
    },
  }
}
