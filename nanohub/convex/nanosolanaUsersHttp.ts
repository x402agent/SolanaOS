import { api, internal } from './_generated/api'
import { httpAction } from './functions'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { corsHeaders, mergeHeaders } from './lib/httpHeaders'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(corsHeaders(), {
      'Content-Type': 'application/json',
    }),
  })
}

function options(methods: string) {
  return new Response(null, {
    status: 204,
    headers: mergeHeaders(corsHeaders(), {
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }),
  })
}

function readBearerToken(request: Request) {
  const authHeader = request.headers.get('Authorization')?.trim() || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim() || null
}

function resolveAgentSyncKey() {
  return (
    process.env.NANOSOLANA_AGENT_SYNC_KEY?.trim() ||
    process.env.CONVEX_NANOSOLANA_AGENT_SYNC_KEY?.trim() ||
    process.env.CONVEX_DEPLOY_KEY?.trim() ||
    ''
  )
}

async function requireNanosolanaSession(ctx: ActionCtx, request: Request) {
  const sessionToken = readBearerToken(request)
  if (!sessionToken) return { error: json({ error: 'missing bearer token' }, 401) }

  const session = await ctx.runQuery(internal.nanosolanaUsers.getWalletUserBySessionTokenInternal, {
    sessionToken,
  })
  if (!session) return { error: json({ error: 'invalid or expired session' }, 401) }

  const galleryUserId =
    session.galleryUserId ||
    (await ctx.runMutation(internal.gallery.ensureGalleryUserForWalletInternal, {
      walletAddress: session.walletAddress,
      displayName: session.displayName ?? undefined,
    }))

  return {
    session,
    galleryUserId,
  } as {
    session: {
      walletAddress: string
      displayName: string | null
      sessionExpiresAt: number
      galleryUserId: Id<'users'> | null
    }
    galleryUserId: Id<'users'>
  }
}

function inferCloudUrl(siteUrl: string | null) {
  if (!siteUrl) return null
  if (siteUrl.endsWith('.convex.site')) {
    return `${siteUrl.slice(0, -'.site'.length)}.cloud`
  }
  return null
}

type JsonRecord = Record<string, unknown>
type AgentService = { type: string; value: string }

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asInteger(value: unknown) {
  const parsed = asNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false
}

function nestedRecord(value: unknown, key: string) {
  return asRecord(asRecord(value)?.[key])
}

function nestedNumber(value: unknown, key: string) {
  return asNumber(asRecord(value)?.[key])
}

function shortMint(value: string) {
  if (value.length <= 12) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function parseIpfsCid(value: string | null) {
  const trimmed = value?.trim() || ''
  if (!trimmed) return null
  if (trimmed.startsWith('ipfs://')) return trimmed.slice('ipfs://'.length) || null
  const match = trimmed.match(/\/ipfs\/([^/?#]+)/i)
  return match?.[1] || null
}

function dedupeAgentServices(services: AgentService[]) {
  const deduped = new Map<string, AgentService>()
  for (const service of services) {
    const type = service.type.trim()
    const value = service.value.trim()
    if (!type || !value) continue
    deduped.set(`${type}\u0000${value}`, { type, value })
  }
  return Array.from(deduped.values())
}

function serviceVersion(type: string) {
  const normalized = type.trim().toUpperCase()
  if (normalized === 'A2A') return '0.3.0'
  if (normalized === 'MCP') return '2025-06-18'
  return undefined
}

function registrationDocumentForAgent(
  agent: {
    name: string
    description: string
    imageUri?: string | null
    services: AgentService[]
    status: 'pending' | 'ready' | 'failed'
    assetAddress?: string | null
    metaplexAssetAddress?: string | null
  },
) {
  const registrations = [
    agent.assetAddress
      ? {
          agentId: agent.assetAddress,
          agentRegistry: 'solana:101:8004',
        }
      : null,
    agent.metaplexAssetAddress
      ? {
          agentId: agent.metaplexAssetAddress,
          agentRegistry: 'solana:101:metaplex',
        }
      : null,
  ].filter(Boolean)

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.name,
    description: agent.description,
    image: agent.imageUri || undefined,
    services: agent.services.map((service) => ({
      name: service.type,
      endpoint: service.value,
      version: serviceVersion(service.type),
    })),
    active: agent.status === 'ready',
    registrations,
    supportedTrust: ['reputation', 'crypto-economic'],
  }
}

function agentCardForAgent(
  ref: string,
  agent: {
    name: string
    description: string
    ownerWalletAddress: string
    cluster: string
    metadataUri?: string | null
    services: AgentService[]
  },
) {
  return {
    version: '0.3.0',
    id: ref,
    name: agent.name,
    description: agent.description,
    provider: {
      organization: 'SolanaOS',
      website: 'https://seeker.solanaos.net',
    },
    url: agent.services.find((service) => service.type.toLowerCase() === 'web')?.value || null,
    ownerWalletAddress: agent.ownerWalletAddress,
    cluster: agent.cluster,
    metadataUri: agent.metadataUri || null,
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: agent.services
      .filter((service) => ['mcp', 'a2a', 'web', 'wallet', 'acp_command'].includes(service.type.toLowerCase()))
      .map((service) => ({
        id: service.type.toLowerCase(),
        name: service.type,
        endpoint: service.value,
        version: serviceVersion(service.type) || null,
      })),
  }
}

function parseAcpCommandService(value: unknown): AgentService | null {
  const acp = asRecord(value)
  const distribution = asRecord(acp?.distribution)
  if (asString(distribution?.type) !== 'command') return null

  const command = asString(distribution?.command)?.trim() || ''
  if (!command) return null

  const args = asArray(distribution?.args)
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return {
    type: 'ACP_COMMAND',
    value: [command, ...args].join(' '),
  }
}

function buildGitHubService(
  user:
    | {
        name?: string | null
        handle?: string | null
      }
    | null
    | undefined,
  githubProviderAccountId: string | null,
): AgentService | null {
  if (!githubProviderAccountId) return null
  const login = user?.name?.trim() || user?.handle?.trim() || ''
  if (!login) {
    return {
      type: 'GITHUB_ACCOUNT',
      value: githubProviderAccountId,
    }
  }
  return {
    type: 'GITHUB',
    value: `https://github.com/${login}`,
  }
}

function maskSecret(value: string | null | undefined) {
  const trimmed = value?.trim() || ''
  if (!trimmed) return null
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

async function verifyTelegramBotToken(botToken: string) {
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/getMe`)
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || !asBoolean(asRecord(payload)?.ok)) {
    const description = asString(asRecord(payload)?.description) || 'telegram bot verification failed'
    throw new Error(description)
  }

  const result = asRecord(asRecord(payload)?.result)
  const username = asString(result?.username)
  return {
    username,
    verifiedAt: Date.now(),
  }
}

function daemonTelegramEnvBlock(config: {
  botToken: string
  telegramUserId: string
  botUsername?: string | null
}) {
  const lines = [
    `TELEGRAM_BOT_TOKEN=${config.botToken.trim()}`,
    `TELEGRAM_ID=${config.telegramUserId.trim()}`,
    `TELEGRAM_ALLOW_FROM=${config.telegramUserId.trim()}`,
  ]
  if (config.botUsername?.trim()) {
    lines.push(`TELEGRAM_BOT_USERNAME=${config.botUsername.trim()}`)
  }
  return lines.join('\n')
}

function formatCompactNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

function formatCompactUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function trackerDataApiKey() {
  return (
    process.env.SOLANA_TRACKER_DATA_API_KEY?.trim() ||
    process.env.SOLANA_TRACKER_API_KEY?.trim() ||
    ''
  )
}

function trackerRpcUrl() {
  return process.env.SOLANA_TRACKER_RPC_URL?.trim() || ''
}

function hasTrackerDataApi() {
  return trackerDataApiKey().length > 0
}

function hasTrackerRpc() {
  return trackerRpcUrl().length > 0
}

async function fetchTrackerData(path: string, searchParams?: Record<string, string | number | boolean | undefined>) {
  const apiKey = trackerDataApiKey()
  if (!apiKey) throw new Error('Solana Tracker data API is not configured.')

  const url = new URL(path, 'https://data.solanatracker.io')
  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': apiKey,
    },
  })
  const payloadText = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(payloadText)
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(`Solana Tracker ${response.status}: ${payloadText.slice(0, 220)}`)
  }
  return payload
}

async function fetchTrackerSlot() {
  const rpcUrl = trackerRpcUrl()
  if (!rpcUrl) throw new Error('Solana Tracker RPC is not configured.')

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSlot',
      params: [{ commitment: 'processed' }],
    }),
  })
  const payloadText = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(payloadText)
  } catch {
    payload = null
  }
  if (!response.ok) {
    throw new Error(`Solana Tracker RPC ${response.status}: ${payloadText.slice(0, 220)}`)
  }
  const result = asNumber(asRecord(payload)?.result)
  if (result === null) throw new Error('Solana Tracker RPC did not return a slot.')
  return Math.trunc(result)
}

function parseTrackerPoolSnapshot(value: unknown) {
  const obj = asRecord(value)
  const poolId = asString(obj?.poolId) || ''
  if (!poolId) return null
  const txns = asRecord(obj?.txns)
  return {
    poolId,
    market: asString(obj?.market) || '',
    quoteToken: asString(obj?.quoteToken),
    liquidityUsd: nestedNumber(obj?.liquidity, 'usd'),
    priceUsd: nestedNumber(obj?.price, 'usd'),
    marketCapUsd: nestedNumber(obj?.marketCap, 'usd'),
    buys: asInteger(txns?.buys),
    sells: asInteger(txns?.sells),
    volume24h: asNumber(txns?.volume24h),
  }
}

function parseTrackerMarketToken(value: unknown) {
  const obj = asRecord(value)
  const mint = asString(obj?.mint) || ''
  if (!mint) return null
  const events24h = nestedRecord(obj?.events, '24h')
  return {
    mint,
    name: asString(obj?.name) || '',
    symbol: asString(obj?.symbol) || '',
    market: asString(obj?.market) || '',
    poolAddress: asString(obj?.poolAddress),
    image: asString(obj?.image),
    priceUsd: asNumber(obj?.priceUsd),
    liquidityUsd: asNumber(obj?.liquidityUsd),
    marketCapUsd: asNumber(obj?.marketCapUsd),
    volume24h: asNumber(obj?.volume_24h) ?? asNumber(obj?.volume),
    holders: asInteger(obj?.holders),
    riskScore: asNumber(obj?.riskScore),
    priceChange24h:
      asNumber(events24h?.priceChangePercentage) ??
      asNumber(obj?.priceChange24h) ??
      asNumber(obj?.priceChange),
  }
}

function parseTrackerTrendingToken(value: unknown) {
  const obj = asRecord(value)
  const token = asRecord(obj?.token)
  const mint = asString(token?.mint) || ''
  if (!mint) return null
  const bestPool = asArray(obj?.pools).map(parseTrackerPoolSnapshot).filter(Boolean).sort((a, b) => {
    return (b?.liquidityUsd || 0) - (a?.liquidityUsd || 0)
  })[0]
  const risk = asRecord(obj?.risk)
  const events24h = nestedRecord(obj?.events, '24h')
  return {
    mint,
    name: asString(token?.name) || '',
    symbol: asString(token?.symbol) || '',
    market: bestPool?.market || '',
    poolAddress: bestPool?.poolId || null,
    image: asString(token?.image),
    priceUsd: bestPool?.priceUsd ?? null,
    liquidityUsd: bestPool?.liquidityUsd ?? null,
    marketCapUsd: bestPool?.marketCapUsd ?? null,
    volume24h: bestPool?.volume24h ?? null,
    holders: asInteger(obj?.holders),
    riskScore: asNumber(risk?.score),
    priceChange24h: asNumber(events24h?.priceChangePercentage),
    status: asString(token?.status),
    curvePercentage: null,
    buys: asInteger(obj?.buys),
    sells: asInteger(obj?.sells),
    totalTransactions: asInteger(obj?.txns),
    createdAt: asInteger(asRecord(token?.creation)?.created_time),
  }
}

function parseTrackerOverviewToken(value: unknown) {
  const obj = asRecord(value)
  const token = asRecord(obj?.token)
  const mint = asString(token?.mint) || ''
  if (!mint) return null
  const bestPool = asArray(obj?.pools).map(parseTrackerPoolSnapshot).filter(Boolean).sort((a, b) => {
    return (b?.liquidityUsd || 0) - (a?.liquidityUsd || 0)
  })[0]
  const risk = asRecord(obj?.risk)
  const events24h = nestedRecord(obj?.events, '24h')
  const rawPools = asArray(obj?.pools).map(asRecord).filter(Boolean)
  const curvePercentage =
    rawPools
      .map((pool) => asNumber(pool?.curvePercentage) ?? nestedNumber(pool?.launchpad, 'curvePercentage'))
      .find((value) => value !== null) ?? null
  return {
    mint,
    name: asString(token?.name) || '',
    symbol: asString(token?.symbol) || '',
    market: bestPool?.market || '',
    poolAddress: bestPool?.poolId || null,
    image: asString(token?.image),
    priceUsd: bestPool?.priceUsd ?? null,
    liquidityUsd: bestPool?.liquidityUsd ?? null,
    marketCapUsd: bestPool?.marketCapUsd ?? null,
    volume24h: bestPool?.volume24h ?? null,
    holders: asInteger(obj?.holders),
    riskScore: asNumber(risk?.score),
    priceChange24h: asNumber(events24h?.priceChangePercentage),
    status: asString(token?.status),
    curvePercentage,
    buys: asInteger(obj?.buys),
    sells: asInteger(obj?.sells),
    totalTransactions: asInteger(obj?.txns),
    createdAt: asInteger(asRecord(token?.creation)?.created_time),
  }
}

function parseTrackerTokenDetail(value: unknown) {
  const root = asRecord(value)
  const token = asRecord(root?.token)
  if (!token) throw new Error('Solana Tracker returned no token payload.')
  const events = asRecord(root?.events)
  const risk = asRecord(root?.risk)
  const pools = asArray(root?.pools).map(parseTrackerPoolSnapshot).filter(Boolean).sort((a, b) => {
    return (b?.liquidityUsd || 0) - (a?.liquidityUsd || 0)
  })
  return {
    mint: asString(token.mint) || '',
    name: asString(token.name) || '',
    symbol: asString(token.symbol) || '',
    image: asString(token.image),
    description: asString(token.description),
    holders: asInteger(root?.holders),
    buys: asInteger(root?.buys),
    sells: asInteger(root?.sells),
    txns: asInteger(root?.txns),
    priceChanges: {
      m1: nestedNumber(events?.['1m'], 'priceChangePercentage'),
      m5: nestedNumber(events?.['5m'], 'priceChangePercentage'),
      h1: nestedNumber(events?.['1h'], 'priceChangePercentage'),
      h24: nestedNumber(events?.['24h'], 'priceChangePercentage'),
    },
    pools,
    risk: {
      score: asInteger(risk?.score),
      rugged: asBoolean(risk?.rugged),
      top10: asNumber(risk?.top10),
      devPercentage: nestedNumber(risk?.dev, 'percentage'),
      bundlerPercentage: nestedNumber(risk?.bundlers, 'totalPercentage'),
      sniperPercentage: nestedNumber(risk?.snipers, 'totalPercentage'),
    },
  }
}

function parseTrackerTrade(value: unknown) {
  const obj = asRecord(value)
  const tx = asString(obj?.tx) || ''
  if (!tx) return null
  return {
    tx,
    type: asString(obj?.type) || '',
    wallet: asString(obj?.wallet) || '',
    amount: asNumber(obj?.amount),
    priceUsd: asNumber(obj?.priceUsd),
    volumeUsd: asNumber(obj?.volume),
    volumeSol: asNumber(obj?.volumeSol),
    time: asInteger(obj?.time),
    program: asString(obj?.program),
  }
}

function parseTrackerHolder(value: unknown) {
  const obj = asRecord(value)
  const address = asString(obj?.address) || ''
  if (!address) return null
  return {
    address,
    amount: asNumber(obj?.amount),
    percentage: asNumber(obj?.percentage),
    valueUsd: nestedNumber(obj?.value, 'usd') ?? nestedNumber(obj?.value, 'quote'),
  }
}

function parseTrackerCandle(value: unknown) {
  const obj = asRecord(value)
  return {
    open: asNumber(obj?.open),
    close: asNumber(obj?.close),
    low: asNumber(obj?.low),
    high: asNumber(obj?.high),
    volume: asNumber(obj?.volume),
    time: asInteger(obj?.time),
  }
}

async function fetchTrackerDexBoard(limit: number) {
  const payload = await fetchTrackerData('/search', {
    page: 1,
    limit: Math.max(1, Math.min(limit, 100)),
    sortBy: 'volume_24h',
    sortOrder: 'desc',
    showPriceChanges: true,
    minLiquidity: 10_000,
  })
  return asArray(asRecord(payload)?.data).map(parseTrackerMarketToken).filter(Boolean)
}

async function fetchTrackerSearch(query: string, limit: number) {
  const payload = await fetchTrackerData('/search', {
    page: 1,
    limit: Math.max(1, Math.min(limit, 100)),
    sortBy: 'createdAt',
    sortOrder: 'desc',
    showPriceChanges: true,
    query,
  })
  return asArray(asRecord(payload)?.data).map(parseTrackerMarketToken).filter(Boolean)
}

async function fetchTrackerTrending(limit: number, timeframe: string) {
  const normalizedTimeframe = timeframe.trim() || '1h'
  const path = normalizedTimeframe === '1h' ? '/tokens/trending' : `/tokens/trending/${normalizedTimeframe}`
  const payload = await fetchTrackerData(path)
  return asArray(payload).map(parseTrackerTrendingToken).filter(Boolean).slice(0, Math.max(1, Math.min(limit, 100)))
}

async function fetchTrackerOverview(limit: number, minCurve: number, minHolders: number, reduceSpam: boolean) {
  const payload = await fetchTrackerData('/tokens/multi/all', {
    limit: Math.max(1, Math.min(limit, 100)),
    minCurve,
    minHolders,
    reduceSpam,
  })
  const root = asRecord(payload)
  return {
    latest: asArray(root?.latest).map(parseTrackerOverviewToken).filter(Boolean),
    graduating: asArray(root?.graduating).map(parseTrackerOverviewToken).filter(Boolean),
    graduated: asArray(root?.graduated).map(parseTrackerOverviewToken).filter(Boolean),
  }
}

async function fetchTrackerTokenBundle(mint: string, tradeLimit: number, holderLimit: number, candleType: string, chartLimit: number) {
  const normalizedMint = mint.trim()
  if (!normalizedMint) throw new Error('mint is required')

  const [detailPayload, tradesPayload, holdersPayload, chartPayload] = await Promise.all([
    fetchTrackerData(`/tokens/${normalizedMint}`),
    fetchTrackerData(`/trades/${normalizedMint}`, {
      sortDirection: 'DESC',
      hideArb: true,
      parseJupiter: true,
    }),
    fetchTrackerData(`/tokens/${normalizedMint}/holders/top`),
    fetchTrackerData(`/chart/${normalizedMint}`, {
      type: candleType || '1m',
      currency: 'usd',
      removeOutliers: true,
      dynamicPools: true,
      fastCache: true,
    }),
  ])

  return {
    token: parseTrackerTokenDetail(detailPayload),
    trades: asArray(asRecord(tradesPayload)?.trades).map(parseTrackerTrade).filter(Boolean).slice(0, tradeLimit),
    holders: asArray(holdersPayload).map(parseTrackerHolder).filter(Boolean).slice(0, holderLimit),
    chart: asArray(asRecord(chartPayload)?.oclhv).map(parseTrackerCandle).filter(Boolean).slice(-chartLimit),
  }
}

async function fetchTrackerLivePayload(mint: string | null, globalLimit: number, tradeLimit: number) {
  const [slot, trending, bundle] = await Promise.all([
    hasTrackerRpc() ? fetchTrackerSlot() : Promise.resolve(null),
    fetchTrackerTrending(globalLimit, '1h'),
    mint ? fetchTrackerTokenBundle(mint, tradeLimit, 10, '1m', 24) : Promise.resolve(null),
  ])
  const trendingTokens = trending.filter((token): token is NonNullable<(typeof trending)[number]> => Boolean(token))

  const globalEvents = trendingTokens.slice(0, globalLimit).map((token) => ({
    stream: 'trending',
    headline: `${token.symbol || token.name || shortMint(token.mint)} trending`,
    detail: [
      token.market ? token.market : null,
      token.priceUsd !== null ? `price ${formatCompactUsd(token.priceUsd)}` : null,
      token.volume24h !== null ? `vol ${formatCompactUsd(token.volume24h)}` : null,
      token.holders !== null ? `holders ${formatCompactNumber(token.holders)}` : null,
    ]
      .filter(Boolean)
      .join(' • '),
    channel: token.mint,
    timestampMs: Date.now(),
  }))

  const focusedBundle = bundle
  const focusedTrades = focusedBundle
    ? focusedBundle.trades.filter(
        (trade): trade is NonNullable<(typeof focusedBundle.trades)[number]> => Boolean(trade),
      )
    : []
  const focusedEvents = focusedBundle
    ? focusedTrades.slice(0, tradeLimit).map((trade) => ({
        stream: trade.program || 'trade',
        headline: `${focusedBundle.token.symbol || focusedBundle.token.name || shortMint(focusedBundle.token.mint)} ${(trade.type || 'trade').toUpperCase()}`,
        detail: [
          trade.priceUsd !== null ? `price ${formatCompactUsd(trade.priceUsd)}` : null,
          trade.volumeUsd !== null ? `vol ${formatCompactUsd(trade.volumeUsd)}` : null,
          trade.amount !== null ? `amount ${formatCompactNumber(trade.amount)}` : null,
          trade.wallet ? shortMint(trade.wallet) : null,
        ]
          .filter(Boolean)
          .join(' • '),
        channel: focusedBundle.token.mint,
        timestampMs: trade.time || Date.now(),
      }))
    : []

  const primaryPool = bundle?.token.pools[0] || null
  const snapshot = bundle
    ? {
        primaryPriceUsd: primaryPool?.priceUsd ?? null,
        aggregatedPriceUsd: primaryPool?.priceUsd ?? null,
        buys: bundle.token.buys ?? null,
        sells: bundle.token.sells ?? null,
        volumeUsd: primaryPool?.volume24h ?? null,
        holders: bundle.token.holders ?? null,
        curvePercentage: null,
        sniperPercentage: bundle.token.risk.sniperPercentage ?? null,
        insiderPercentage: bundle.token.risk.devPercentage ?? null,
      }
    : {
        primaryPriceUsd: null,
        aggregatedPriceUsd: null,
        buys: null,
        sells: null,
        volumeUsd: null,
        holders: null,
        curvePercentage: null,
        sniperPercentage: null,
        insiderPercentage: null,
      }

  return {
    slot,
    liveSlot: slot,
    globalEvents,
    focusedEvents,
    snapshot,
  }
}

export const trackerHealthHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  return json({
    status: 'ok',
    backend: 'convex',
    marketDataReady: hasTrackerDataApi(),
    rpcReady: hasTrackerRpc(),
  })
})

export const trackerBoardHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '12') || 12, 100))
  try {
    const [slot, tokens] = await Promise.all([
      hasTrackerRpc() ? fetchTrackerSlot() : Promise.resolve(null),
      fetchTrackerDexBoard(limit),
    ])
    return json({ status: 'ok', slot, tokens })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Tracker board request failed' }, 502)
  }
})

export const trackerSearchHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const query = url.searchParams.get('query')?.trim() || ''
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '12') || 12, 100))
  if (!query) return json({ error: 'query is required' }, 400)

  try {
    const tokens = await fetchTrackerSearch(query, limit)
    return json({ status: 'ok', tokens })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Tracker search failed' }, 502)
  }
})

export const trackerTrendingHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '18') || 18, 100))
  const timeframe = url.searchParams.get('timeframe')?.trim() || '1h'
  try {
    const tokens = await fetchTrackerTrending(limit, timeframe)
    return json({ status: 'ok', tokens, timeframe })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Tracker trending request failed' }, 502)
  }
})

export const trackerOverviewHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '24') || 24, 100))
  const minCurve = Math.max(0, Math.min(Number(url.searchParams.get('minCurve') || '40') || 40, 100))
  const minHolders = Math.max(0, Number(url.searchParams.get('minHolders') || '20') || 20)
  const reduceSpam = (url.searchParams.get('reduceSpam') || 'true').toLowerCase() !== 'false'

  try {
    const [slot, overview] = await Promise.all([
      hasTrackerRpc() ? fetchTrackerSlot() : Promise.resolve(null),
      fetchTrackerOverview(limit, minCurve, minHolders, reduceSpam),
    ])
    return json({ status: 'ok', slot, ...overview })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Tracker overview request failed' }, 502)
  }
})

export const trackerTokenHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const mint = url.searchParams.get('mint')?.trim() || ''
  const tradeLimit = Math.max(1, Math.min(Number(url.searchParams.get('tradeLimit') || '12') || 12, 40))
  const holderLimit = Math.max(1, Math.min(Number(url.searchParams.get('holderLimit') || '10') || 10, 40))
  const chartLimit = Math.max(1, Math.min(Number(url.searchParams.get('chartLimit') || '24') || 24, 240))
  const candleType = url.searchParams.get('candleType')?.trim() || '1m'
  if (!mint) return json({ error: 'mint is required' }, 400)

  try {
    const bundle = await fetchTrackerTokenBundle(mint, tradeLimit, holderLimit, candleType, chartLimit)
    return json({ status: 'ok', ...bundle })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Tracker token request failed' }, 502)
  }
})

export const trackerLiveHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const mint = url.searchParams.get('mint')?.trim() || null
  const globalLimit = Math.max(1, Math.min(Number(url.searchParams.get('globalLimit') || '8') || 8, 20))
  const tradeLimit = Math.max(1, Math.min(Number(url.searchParams.get('tradeLimit') || '8') || 8, 20))

  try {
    const payload = await fetchTrackerLivePayload(mint, globalLimit, tradeLimit)
    return json({ status: 'ok', ...payload, mint })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Tracker live request failed' }, 502)
  }
})

function extractOpenRouterContent(payload: unknown) {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const choices = Array.isArray(root?.choices) ? root.choices : []
  const firstChoice = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : null
  const message =
    firstChoice?.message && typeof firstChoice.message === 'object'
      ? (firstChoice.message as Record<string, unknown>)
      : null
  const content = message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        const part = item as Record<string, unknown>
        return typeof part.text === 'string' ? part.text : ''
      })
      .join('')
      .trim()
  }
  return ''
}

function extractXAiOutputText(payload: unknown) {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  if (typeof root?.output_text === 'string' && root.output_text.trim()) {
    return root.output_text.trim()
  }
  const output = Array.isArray(root?.output) ? root.output : []
  return output
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const outputItem = item as Record<string, unknown>
      const content = Array.isArray(outputItem.content) ? outputItem.content : []
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return ''
          const chunk = part as Record<string, unknown>
          return typeof chunk.text === 'string' ? chunk.text : ''
        })
        .join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

async function callOpenRouterText(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.')

  const model = process.env.OPENROUTER_OPENAI_MODEL?.trim() || 'openai/gpt-5.4-mini'
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'SolanaOS Seeker',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      reasoning: { enabled: true },
    }),
  })

  const payloadText = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(payloadText)
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object'
        ? (((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message as
            | string
            | undefined)
        : undefined
    throw new Error(message?.trim() || payloadText.trim() || 'OpenRouter request failed.')
  }

  const content = extractOpenRouterContent(payload)
  if (!content) throw new Error('OpenRouter returned an empty response.')
  return { content, model }
}

async function callXAiText(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) throw new Error('XAI_API_KEY is not configured.')

  const model = process.env.XAI_SEARCH_MODEL?.trim() || 'grok-4.20-reasoning'
  const response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: 'developer', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  const payloadText = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(payloadText)
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object'
        ? (((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message as
            | string
            | undefined)
        : undefined
    throw new Error(message?.trim() || payloadText.trim() || 'xAI request failed.')
  }

  const content = extractXAiOutputText(payload)
  if (!content) throw new Error('xAI returned an empty response.')
  return { content, model }
}

export const nanosolanaHealthHttp = httpAction(async (_ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)
  const siteUrl = process.env.CONVEX_SITE_URL?.trim() || null
  return json({
    status: 'ok',
    backend: 'convex',
    siteUrl,
    cloudUrl:
      process.env.VITE_CONVEX_URL?.trim() ||
      process.env.CONVEX_URL?.trim() ||
      inferCloudUrl(siteUrl),
  })
})

export const upsertWalletUserHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const walletAddress =
    typeof (body as { walletAddress?: unknown })?.walletAddress === 'string'
      ? (body as { walletAddress: string }).walletAddress.trim()
      : ''
  const displayName =
    typeof (body as { displayName?: unknown })?.displayName === 'string'
      ? (body as { displayName: string }).displayName
      : undefined
  const appVersion =
    typeof (body as { appVersion?: unknown })?.appVersion === 'string'
      ? (body as { appVersion: string }).appVersion.trim()
      : ''
  const signedAtMs =
    typeof (body as { signedAtMs?: unknown })?.signedAtMs === 'number'
      ? (body as { signedAtMs: number }).signedAtMs
      : 0
  const nonce =
    typeof (body as { nonce?: unknown })?.nonce === 'string'
      ? (body as { nonce: string }).nonce.trim()
      : ''
  const signatureBase58 =
    typeof (body as { signatureBase58?: unknown })?.signatureBase58 === 'string'
      ? (body as { signatureBase58: string }).signatureBase58.trim()
      : ''

  if (!walletAddress || !appVersion || !signedAtMs || !nonce || !signatureBase58) {
    return json({ error: 'walletAddress, appVersion, signedAtMs, nonce, and signatureBase58 are required' }, 400)
  }
  if (Math.abs(Date.now() - signedAtMs) > 10 * 60 * 1000) {
    return json({ error: 'signature expired' }, 401)
  }

  const verification = await ctx.runAction(internal.nanosolanaUserNode.verifyWalletAuthInternal, {
    walletAddress,
    displayName,
    appVersion,
    signedAtMs,
    nonce,
    signatureBase58,
  })
  if (!verification.ok) return json({ error: verification.error || 'invalid signature' }, 401)

  const user = await ctx.runMutation(internal.nanosolanaUsers.upsertWalletUserInternal, {
    walletAddress,
    displayName,
    appVersion,
    signedAtMs,
    nonce,
    signatureBase58,
  })
  return json({ status: 'ok', user })
})

export const getWalletUserSessionHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  return json({
    status: 'ok',
    user: {
      walletAddress: sessionResult.session.walletAddress,
      displayName: sessionResult.session.displayName,
      sessionToken: readBearerToken(request),
      sessionExpiresAt: sessionResult.session.sessionExpiresAt,
    },
  })
})

export const getWalletTelegramConfigHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  const user = await ctx.runQuery(internal.nanosolanaUsers.getWalletUserByWalletInternal, {
    walletAddress: sessionResult.session.walletAddress,
  })
  if (!user) return json({ error: 'wallet user not found' }, 404)

  const telegramBotToken = user.telegramBotToken?.trim() || ''
  const telegramUserId = user.telegramUserId?.trim() || ''
  const telegramBotUsername = user.telegramBotUsername?.trim() || null

  return json({
    status: 'ok',
    telegram: {
      walletAddress: user.walletAddress,
      telegramConfigured: Boolean(telegramBotToken && telegramUserId),
      telegramUserId: telegramUserId || null,
      telegramBotUsername,
      maskedBotToken: maskSecret(telegramBotToken),
      configuredAt: user.telegramConfiguredAt ?? null,
      verifiedAt: user.telegramVerifiedAt ?? null,
      daemonEnvBlock:
        telegramBotToken && telegramUserId
          ? daemonTelegramEnvBlock({
              botToken: telegramBotToken,
              telegramUserId,
              botUsername: telegramBotUsername,
            })
          : null,
    },
  })
})

export const setWalletTelegramConfigHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const telegramBotToken =
    typeof (body as { telegramBotToken?: unknown })?.telegramBotToken === 'string'
      ? (body as { telegramBotToken: string }).telegramBotToken.trim()
      : ''
  const telegramUserId =
    typeof (body as { telegramUserId?: unknown })?.telegramUserId === 'string'
      ? (body as { telegramUserId: string }).telegramUserId.trim()
      : ''

  if (!telegramBotToken || !telegramUserId) {
    return json({ error: 'telegramBotToken and telegramUserId are required' }, 400)
  }
  if (!/^\d+$/.test(telegramUserId)) {
    return json({ error: 'telegramUserId must be numeric' }, 400)
  }

  const verification = await verifyTelegramBotToken(telegramBotToken)
  const saved = await ctx.runMutation(internal.nanosolanaUsers.upsertTelegramConfigInternal, {
    walletAddress: sessionResult.session.walletAddress,
    telegramBotToken,
    telegramUserId,
    telegramBotUsername: verification.username ?? undefined,
    verifiedAt: verification.verifiedAt,
  })

  return json({
    status: 'ok',
    telegram: {
      walletAddress: saved.walletAddress,
      telegramConfigured: true,
      telegramUserId: saved.telegramUserId,
      telegramBotUsername: saved.telegramBotUsername,
      maskedBotToken: maskSecret(telegramBotToken),
      configuredAt: saved.telegramConfiguredAt,
      verifiedAt: saved.telegramVerifiedAt,
      daemonEnvBlock: daemonTelegramEnvBlock({
        botToken: telegramBotToken,
        telegramUserId: saved.telegramUserId,
        botUsername: saved.telegramBotUsername,
      }),
    },
  })
})

export const createPairingSessionHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const pairing = await ctx.runMutation(internal.nanosolanaUsers.createPairingSessionInternal, {})
  const deepLinkUrl = new URL('solanaos://pair')
  deepLinkUrl.searchParams.set('token', pairing.pairingToken)
  return json({
    status: 'ok',
    pairingToken: pairing.pairingToken,
    pairingSecret: pairing.pairingSecret,
    expiresAt: pairing.expiresAt,
    deepLinkUrl: deepLinkUrl.toString(),
  })
})

export const getPairingSessionStatusHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const pairingToken = url.searchParams.get('token')?.trim() || ''
  const pairingSecret = url.searchParams.get('secret')?.trim() || ''
  if (!pairingToken || !pairingSecret) {
    return json({ error: 'token and secret are required' }, 400)
  }

  const session = await ctx.runQuery(internal.nanosolanaUsers.getPairingSessionStatusInternal, {
    pairingToken,
    pairingSecret,
  })
  if (!session) return json({ error: 'pairing session not found' }, 404)

  return json({
    status: 'ok',
    pairing: session,
  })
})

export const claimPairingSessionHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const pairingToken =
    typeof (body as { pairingToken?: unknown })?.pairingToken === 'string'
      ? (body as { pairingToken: string }).pairingToken.trim()
      : ''
  const walletAddress =
    typeof (body as { walletAddress?: unknown })?.walletAddress === 'string'
      ? (body as { walletAddress: string }).walletAddress.trim()
      : ''
  const displayName =
    typeof (body as { displayName?: unknown })?.displayName === 'string'
      ? (body as { displayName: string }).displayName
      : undefined
  const appVersion =
    typeof (body as { appVersion?: unknown })?.appVersion === 'string'
      ? (body as { appVersion: string }).appVersion.trim()
      : ''
  const signedAtMs =
    typeof (body as { signedAtMs?: unknown })?.signedAtMs === 'number'
      ? (body as { signedAtMs: number }).signedAtMs
      : 0
  const nonce =
    typeof (body as { nonce?: unknown })?.nonce === 'string'
      ? (body as { nonce: string }).nonce.trim()
      : ''
  const signatureBase58 =
    typeof (body as { signatureBase58?: unknown })?.signatureBase58 === 'string'
      ? (body as { signatureBase58: string }).signatureBase58.trim()
      : ''

  if (!pairingToken || !walletAddress || !appVersion || !signedAtMs || !nonce || !signatureBase58) {
    return json(
      { error: 'pairingToken, walletAddress, appVersion, signedAtMs, nonce, and signatureBase58 are required' },
      400,
    )
  }
  if (pairingToken !== nonce) {
    return json({ error: 'pairing nonce mismatch' }, 400)
  }
  if (Math.abs(Date.now() - signedAtMs) > 10 * 60 * 1000) {
    return json({ error: 'signature expired' }, 401)
  }

  const verification = await ctx.runAction(internal.nanosolanaUserNode.verifyWalletAuthInternal, {
    walletAddress,
    displayName,
    appVersion,
    signedAtMs,
    nonce,
    signatureBase58,
  })
  if (!verification.ok) return json({ error: verification.error || 'invalid signature' }, 401)

  const user = await ctx.runMutation(internal.nanosolanaUsers.upsertWalletUserInternal, {
    walletAddress,
    displayName,
    appVersion,
    signedAtMs,
    nonce,
    signatureBase58,
  })
  const claim = await ctx.runMutation(internal.nanosolanaUsers.claimPairingSessionInternal, {
    pairingToken,
    walletAddress,
    displayName,
    appVersion,
    sessionToken: user.sessionToken || '',
    sessionExpiresAt: user.sessionExpiresAt || 0,
  })
  if (!claim.ok) {
    return json({ error: claim.error }, claim.error === 'pairing token already claimed' ? 409 : 400)
  }

  return json({ status: 'ok', user })
})

export const listWalletAgentsHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  const agents = await ctx.runQuery(internal.nanosolanaAgents.listByUserInternal, {
    userId: sessionResult.galleryUserId,
  })
  return json({ status: 'ok', agents })
})

export const getPublicAgentHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const ref = url.searchParams.get('id') || url.searchParams.get('asset') || url.searchParams.get('ref') || ''
  if (!ref.trim()) return json({ error: 'id or asset is required' }, 400)

  const agent = await ctx.runQuery(api.nanosolanaAgents.getPublicByRef, { ref })
  if (!agent) return json({ error: 'agent not found' }, 404)

  return json({ status: 'ok', agent })
})

export const getPublicAgentRegistrationHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const ref = url.searchParams.get('id') || url.searchParams.get('asset') || url.searchParams.get('ref') || ''
  if (!ref.trim()) return json({ error: 'id or asset is required' }, 400)

  const agent = await ctx.runQuery(api.nanosolanaAgents.getPublicByRef, { ref })
  if (!agent) return json({ error: 'agent not found' }, 404)

  return json(registrationDocumentForAgent(agent))
})

export const getPublicAgentCardHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const ref = url.searchParams.get('id') || url.searchParams.get('asset') || url.searchParams.get('ref') || ''
  if (!ref.trim()) return json({ error: 'id or asset is required' }, 400)

  const agent = await ctx.runQuery(api.nanosolanaAgents.getPublicByRef, { ref })
  if (!agent) return json({ error: 'agent not found' }, 404)

  return json(agentCardForAgent(ref, agent))
})

export const createWalletAgentHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const ownerWalletAddress = typeof (body as { ownerWalletAddress?: unknown })?.ownerWalletAddress === 'string'
    ? (body as { ownerWalletAddress: string }).ownerWalletAddress
    : ''
  const name = typeof (body as { name?: unknown })?.name === 'string' ? (body as { name: string }).name : ''
  const description =
    typeof (body as { description?: unknown })?.description === 'string'
      ? (body as { description: string }).description
      : ''

  if (!ownerWalletAddress.trim() || !name.trim() || !description.trim()) {
    return json({ error: 'ownerWalletAddress, name, and description are required' }, 400)
  }

  try {
    const result = await ctx.runAction(internal.nanosolanaAgentsNode.createForWalletUserInternal, {
      userId: sessionResult.galleryUserId,
      ownerWalletAddress,
      registryMode:
        typeof (body as { registryMode?: unknown })?.registryMode === 'string'
          ? (body as { registryMode: '8004' | 'metaplex' | 'dual' }).registryMode
          : undefined,
      name,
      symbol: typeof (body as { symbol?: unknown })?.symbol === 'string' ? (body as { symbol: string }).symbol : undefined,
      description,
      imageUri:
        typeof (body as { imageUri?: unknown })?.imageUri === 'string'
          ? (body as { imageUri: string }).imageUri
          : undefined,
      website:
        typeof (body as { website?: unknown })?.website === 'string'
          ? (body as { website: string }).website
          : undefined,
      xUrl: typeof (body as { xUrl?: unknown })?.xUrl === 'string' ? (body as { xUrl: string }).xUrl : undefined,
      discordUrl:
        typeof (body as { discordUrl?: unknown })?.discordUrl === 'string'
          ? (body as { discordUrl: string }).discordUrl
          : undefined,
      mcpUrl:
        typeof (body as { mcpUrl?: unknown })?.mcpUrl === 'string'
          ? (body as { mcpUrl: string }).mcpUrl
          : undefined,
      a2aUrl:
        typeof (body as { a2aUrl?: unknown })?.a2aUrl === 'string'
          ? (body as { a2aUrl: string }).a2aUrl
          : undefined,
      snsName:
        typeof (body as { snsName?: unknown })?.snsName === 'string'
          ? (body as { snsName: string }).snsName
          : undefined,
      ensName:
        typeof (body as { ensName?: unknown })?.ensName === 'string'
          ? (body as { ensName: string }).ensName
          : undefined,
      did: typeof (body as { did?: unknown })?.did === 'string' ? (body as { did: string }).did : undefined,
      skills: Array.isArray((body as { skills?: unknown })?.skills)
        ? ((body as { skills: unknown[] }).skills.filter((item): item is string => typeof item === 'string'))
        : undefined,
      domains: Array.isArray((body as { domains?: unknown })?.domains)
        ? ((body as { domains: unknown[] }).domains.filter((item): item is string => typeof item === 'string'))
        : undefined,
      atomEnabled:
        typeof (body as { atomEnabled?: unknown })?.atomEnabled === 'boolean'
          ? (body as { atomEnabled: boolean }).atomEnabled
          : undefined,
    })
    return json({ status: 'ok', ...result })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Agent registration failed' }, 400)
  }
})

export const syncWalletAgentRegistryHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const expectedKey = resolveAgentSyncKey()
  if (!expectedKey) return json({ error: 'agent sync key not configured' }, 500)
  if (readBearerToken(request) !== expectedKey) return json({ error: 'unauthorized' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const payload = asRecord(body)
  const metadata = asRecord(payload?.metadata)
  const walletAddress = asString(payload?.wallet) || asString(payload?.ownerWalletAddress) || ''
  const assetAddress = asString(payload?.asset) || ''
  const registryMode = (() => {
    const value = (asString(payload?.registryMode) ?? '').toLowerCase()
    return value === 'dual' || value === 'metaplex' ? value : '8004'
  })()
  const cluster = asString(payload?.cluster) || 'mainnet-beta'
  const name = asString(metadata?.name) || ''
  const description = asString(metadata?.description) || ''
  const imageUri = asString(metadata?.image) || undefined
  const metadataUri = asString(payload?.tokenUri) || asString(payload?.metadataUri) || undefined
  const metadataCid = parseIpfsCid(metadataUri || null) || undefined
  const appVersion =
    asString(payload?.runtimeVersion) ||
    asString(payload?.version) ||
    asString(payload?.solanaosVersion) ||
    undefined
  const ownerVerified =
    asBoolean(payload?.ownerVerified) ||
    asString(payload?.action) === 'registered' ||
    asString(payload?.action) === 'exists'

  if ((asString(payload?.status) || '').toLowerCase() !== 'ok') {
    return json({ status: 'skipped', reason: 'registry payload is not successful' }, 202)
  }
  if (!walletAddress || !assetAddress || !name || !description) {
    return json({ error: 'wallet, asset, metadata.name, and metadata.description are required' }, 400)
  }

  const services = asArray(metadata?.services)
    .map((entry) => {
      const service = asRecord(entry)
      const type = asString(service?.type)
      const value = asString(service?.value)
      if (!type || !value) return null
      return { type, value }
    })
    .filter((value): value is { type: string; value: string } => Boolean(value))
  const skills = asArray(metadata?.skills)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
  const domains = asArray(metadata?.domains)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
  const siteUrl = asString(payload?.siteUrl)
  const socials = siteUrl ? { website: siteUrl } : undefined

  await ctx.runMutation(internal.nanosolanaUsers.ensureWalletUserForSyncInternal, {
    walletAddress,
    displayName: name,
    appVersion,
  })
  const linkedHubUser = await ctx.runQuery(internal.users.getBySolanaWalletInternal, {
    walletAddress,
  })
  const resolvedHubUser =
    linkedHubUser && !linkedHubUser.deletedAt && !linkedHubUser.deactivatedAt ? linkedHubUser : null

  const galleryUserId =
    resolvedHubUser?._id ||
    (await ctx.runMutation(internal.gallery.ensureGalleryUserForWalletInternal, {
      walletAddress,
      displayName: name,
    }))

  if (resolvedHubUser?._id) {
    await ctx.runMutation(internal.nanosolanaUsers.linkWalletUserToGalleryUserInternal, {
      walletAddress,
      galleryUserId: resolvedHubUser._id,
    })
  }

  const githubProviderAccountId = resolvedHubUser?._id
    ? await ctx.runQuery(internal.githubIdentity.getGitHubProviderAccountIdInternal, {
        userId: resolvedHubUser._id,
      })
    : null
  const acpCommandService = parseAcpCommandService(payload?.acp)
  const githubService = buildGitHubService(resolvedHubUser, githubProviderAccountId)
  const mergedServices = dedupeAgentServices([
    ...services,
    ...(acpCommandService ? [acpCommandService] : []),
    ...(githubService ? [githubService] : []),
  ])

  const agent = await ctx.runMutation(internal.nanosolanaAgents.upsertRegistrySyncInternal, {
    userId: galleryUserId,
    ownerWalletAddress: walletAddress,
    registryMode,
    name,
    symbol: asString(metadata?.symbol) || undefined,
    description,
    imageUri,
    metadataCid,
    metadataUri,
    assetAddress,
    ownerVerified,
    assetTxSignature: asString(payload?.signature) || undefined,
    transferTxSignature: asString(payload?.transferTxSignature) || undefined,
    cluster,
    atomEnabled: asBoolean(payload?.atomEnabled),
    services: mergedServices,
    skills,
    domains,
    socials,
  })

  return json({ status: 'ok', agent })
})

export const listGalleryFeedHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '12') || 12, 24))
  const sessionResult = await requireNanosolanaSession(ctx, request)
  const feed = await ctx.runQuery(internal.gallery.listFeedForViewerInternal, {
    limit,
    viewerUserId: 'error' in sessionResult ? undefined : sessionResult.galleryUserId,
  })
  return json({ status: 'ok', feed })
})

export const generateGalleryArtworkHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const prompt =
    typeof (body as { prompt?: unknown })?.prompt === 'string'
      ? (body as { prompt: string }).prompt.trim()
      : ''
  const title =
    typeof (body as { title?: unknown })?.title === 'string'
      ? (body as { title: string }).title
      : undefined
  const caption =
    typeof (body as { caption?: unknown })?.caption === 'string'
      ? (body as { caption: string }).caption
      : undefined
  const aspectRatio =
    typeof (body as { aspectRatio?: unknown })?.aspectRatio === 'string'
      ? (body as { aspectRatio: string }).aspectRatio
      : undefined
  const resolution =
    typeof (body as { resolution?: unknown })?.resolution === 'string'
      ? (body as { resolution: string }).resolution
      : undefined

  if (!prompt) {
    return json({ error: 'prompt is required' }, 400)
  }

  const result = await ctx.runAction(internal.gallery.generateArtworkForUserInternal, {
    artistUserId: sessionResult.galleryUserId,
    prompt,
    title,
    caption,
    aspectRatio,
    resolution,
  })

  return json({ status: 'ok', artworkId: result.artworkId })
})

export const rateGalleryArtworkHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const artworkId =
    typeof (body as { artworkId?: unknown })?.artworkId === 'string'
      ? (body as { artworkId: string }).artworkId.trim()
      : ''
  const value =
    typeof (body as { value?: unknown })?.value === 'number'
      ? (body as { value: number }).value
      : NaN

  if (!artworkId || !Number.isFinite(value)) {
    return json({ error: 'artworkId and value are required' }, 400)
  }

  const result = await ctx.runMutation(internal.gallery.rateArtworkForUserInternal, {
    artworkId: artworkId as Id<'galleryArtworks'>,
    userId: sessionResult.galleryUserId,
    value,
  })

  return json({ status: 'ok', ...result })
})

export const chooseAiChessMoveHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const provider =
    typeof (body as { provider?: unknown })?.provider === 'string'
      ? (body as { provider: string }).provider.trim().toLowerCase()
      : ''
  const systemPrompt =
    typeof (body as { systemPrompt?: unknown })?.systemPrompt === 'string'
      ? (body as { systemPrompt: string }).systemPrompt.trim()
      : ''
  const userPrompt =
    typeof (body as { userPrompt?: unknown })?.userPrompt === 'string'
      ? (body as { userPrompt: string }).userPrompt.trim()
      : ''

  if ((provider !== 'grok' && provider !== 'openai') || !systemPrompt || !userPrompt) {
    return json({ error: 'provider, systemPrompt, and userPrompt are required' }, 400)
  }

  try {
    const result =
      provider === 'openai'
        ? await callOpenRouterText(systemPrompt, userPrompt)
        : await callXAiText(systemPrompt, userPrompt)
    return json({ status: 'ok', provider, ...result })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'AI chess move failed' }, 502)
  }
})

export const analyzeTokenWithGrokHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const mint =
    typeof (body as { mint?: unknown })?.mint === 'string'
      ? (body as { mint: string }).mint.trim()
      : ''
  const systemPrompt =
    typeof (body as { systemPrompt?: unknown })?.systemPrompt === 'string'
      ? (body as { systemPrompt: string }).systemPrompt.trim()
      : ''
  const userPrompt =
    typeof (body as { userPrompt?: unknown })?.userPrompt === 'string'
      ? (body as { userPrompt: string }).userPrompt.trim()
      : ''

  if (!mint || !systemPrompt || !userPrompt) {
    return json({ error: 'mint, systemPrompt, and userPrompt are required' }, 400)
  }

  try {
    const result = await callXAiText(systemPrompt, userPrompt)
    return json({ status: 'ok', mint, ...result })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Grok token analysis failed' }, 502)
  }
})

export const listChessMatchesHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  const url = new URL(request.url)
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || '12') || 12, 30))
  const matches = await ctx.runQuery(internal.nanosolanaChess.listMatchesForWalletInternal, {
    walletAddress: sessionResult.session.walletAddress,
    limit,
  })
  return json({ status: 'ok', matches })
})

export const getChessMatchHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  const url = new URL(request.url)
  const matchId = url.searchParams.get('matchId')?.trim() || ''
  if (!matchId) return json({ error: 'matchId is required' }, 400)

  const match = await ctx.runQuery(internal.nanosolanaChess.getMatchForWalletInternal, {
    walletAddress: sessionResult.session.walletAddress,
    matchId,
  })
  return json({ status: 'ok', ...match })
})

export const saveChessPacketHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const sessionResult = await requireNanosolanaSession(ctx, request)
  if ('error' in sessionResult) return sessionResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const matchId =
    typeof (body as { matchId?: unknown })?.matchId === 'string'
      ? (body as { matchId: string }).matchId.trim()
      : ''
  const packetKind =
    typeof (body as { packetKind?: unknown })?.packetKind === 'string'
      ? (body as { packetKind: string }).packetKind.trim()
      : ''
  const packetEncoded =
    typeof (body as { packetEncoded?: unknown })?.packetEncoded === 'string'
      ? (body as { packetEncoded: string }).packetEncoded.trim()
      : ''
  const signerWalletAddress =
    typeof (body as { signerWalletAddress?: unknown })?.signerWalletAddress === 'string'
      ? (body as { signerWalletAddress: string }).signerWalletAddress.trim()
      : ''
  const payloadJson =
    typeof (body as { payloadJson?: unknown })?.payloadJson === 'string'
      ? (body as { payloadJson: string }).payloadJson
      : ''
  const signatureBase58 =
    typeof (body as { signatureBase58?: unknown })?.signatureBase58 === 'string'
      ? (body as { signatureBase58: string }).signatureBase58.trim()
      : ''
  const inviterWalletAddress =
    typeof (body as { inviterWalletAddress?: unknown })?.inviterWalletAddress === 'string'
      ? (body as { inviterWalletAddress: string }).inviterWalletAddress.trim()
      : ''
  const inviterLabel =
    typeof (body as { inviterLabel?: unknown })?.inviterLabel === 'string'
      ? (body as { inviterLabel: string }).inviterLabel
      : undefined
  const inviterColor =
    typeof (body as { inviterColor?: unknown })?.inviterColor === 'string'
      ? (body as { inviterColor: string }).inviterColor.trim()
      : ''
  const remoteWalletAddress =
    typeof (body as { remoteWalletAddress?: unknown })?.remoteWalletAddress === 'string'
      ? (body as { remoteWalletAddress: string }).remoteWalletAddress.trim()
      : undefined
  const localColor =
    typeof (body as { localColor?: unknown })?.localColor === 'string'
      ? (body as { localColor: string }).localColor.trim()
      : ''
  const positionFingerprint =
    typeof (body as { positionFingerprint?: unknown })?.positionFingerprint === 'string'
      ? (body as { positionFingerprint: string }).positionFingerprint.trim()
      : ''
  const positionStatus =
    typeof (body as { positionStatus?: unknown })?.positionStatus === 'string'
      ? (body as { positionStatus: string }).positionStatus.trim()
      : ''
  const moveCount =
    typeof (body as { moveCount?: unknown })?.moveCount === 'number'
      ? (body as { moveCount: number }).moveCount
      : NaN
  const signedAtMs =
    typeof (body as { signedAtMs?: unknown })?.signedAtMs === 'number'
      ? (body as { signedAtMs: number }).signedAtMs
      : NaN
  const ply =
    typeof (body as { ply?: unknown })?.ply === 'number'
      ? (body as { ply: number }).ply
      : undefined
  const move =
    typeof (body as { move?: unknown })?.move === 'string'
      ? (body as { move: string }).move.trim()
      : undefined
  const moveDisplay =
    typeof (body as { moveDisplay?: unknown })?.moveDisplay === 'string'
      ? (body as { moveDisplay: string }).moveDisplay
      : undefined
  const beforeFingerprint =
    typeof (body as { beforeFingerprint?: unknown })?.beforeFingerprint === 'string'
      ? (body as { beforeFingerprint: string }).beforeFingerprint.trim()
      : undefined
  const afterFingerprint =
    typeof (body as { afterFingerprint?: unknown })?.afterFingerprint === 'string'
      ? (body as { afterFingerprint: string }).afterFingerprint.trim()
      : undefined

  if (
    !matchId ||
    !packetEncoded ||
    !signerWalletAddress ||
    !payloadJson ||
    !signatureBase58 ||
    !inviterWalletAddress ||
    !positionFingerprint ||
    !Number.isFinite(moveCount) ||
    !Number.isFinite(signedAtMs)
  ) {
    return json({ error: 'missing signed chess packet fields' }, 400)
  }
  if (packetKind !== 'invite' && packetKind !== 'move') {
    return json({ error: 'packetKind must be invite or move' }, 400)
  }
  if (inviterColor !== 'White' && inviterColor !== 'Black') {
    return json({ error: 'inviterColor must be White or Black' }, 400)
  }
  if (localColor !== 'White' && localColor !== 'Black') {
    return json({ error: 'localColor must be White or Black' }, 400)
  }
  if (!['Normal', 'Check', 'Checkmate', 'Stalemate'].includes(positionStatus)) {
    return json({ error: 'positionStatus is invalid' }, 400)
  }

  const result = await ctx.runMutation(internal.nanosolanaChess.saveSignedPacketForWalletInternal, {
    viewerWalletAddress: sessionResult.session.walletAddress,
    matchId,
    packetKind,
    packetEncoded,
    signerWalletAddress,
    payloadJson,
    signatureBase58,
    inviterWalletAddress,
    inviterLabel,
    inviterColor,
    remoteWalletAddress,
    localColor,
    positionFingerprint,
    positionStatus: positionStatus as 'Normal' | 'Check' | 'Checkmate' | 'Stalemate',
    moveCount,
    signedAtMs,
    ply,
    move,
    moveDisplay,
    beforeFingerprint,
    afterFingerprint,
  })

  return json({ status: 'ok', ...result })
})
