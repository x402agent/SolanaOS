import { api } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import { applyRateLimit } from '../lib/httpRateLimit'
import {
  getPathSegments,
  json,
  parseJsonPayload,
  requireApiTokenUserOrResponse,
  text,
  toOptionalNumber,
} from './shared'

// ── IPFS Hub HTTP API ───────────────────────────────────────────────
// GET  /api/v1/ipfs/files?wallet=...&github=...&device=...&limit=...
// GET  /api/v1/ipfs/files/:id
// GET  /api/v1/ipfs/stats?wallet=...
// GET  /api/v1/ipfs/groups?wallet=...
// POST /api/v1/ipfs/track     — record a file upload
// POST /api/v1/ipfs/access    — log an access link request
// POST /api/v1/ipfs/delete    — remove a tracked file

export async function ipfsGetRouterV1Handler(ctx: ActionCtx, request: Request) {
  const rate = await applyRateLimit(ctx, request, 'read')
  if (!rate.ok) return rate.response

  const url = new URL(request.url)
  const segments = getPathSegments(request, '/api/v1/ipfs/')

  if (segments.length === 0) {
    return text('Not found', 404, rate.headers)
  }

  const resource = segments[0]

  // GET /api/v1/ipfs/files
  if (resource === 'files' && segments.length === 1) {
    const wallet = url.searchParams.get('wallet')?.trim()
    const github = url.searchParams.get('github')?.trim()
    const device = url.searchParams.get('device')?.trim()
    const limit = toOptionalNumber(url.searchParams.get('limit')) ?? 50

    if (wallet) {
      const files = await ctx.runQuery(api.ipfsHub.listByWallet, {
        solanaWallet: wallet,
        limit,
      })
      return json({ files }, 200, rate.headers)
    }

    if (github) {
      const files = await ctx.runQuery(api.ipfsHub.listByGithubUser, {
        githubUser: github,
        limit,
      })
      return json({ files }, 200, rate.headers)
    }

    if (device) {
      const files = await ctx.runQuery(api.ipfsHub.listByDevice, {
        deviceId: device,
        limit,
      })
      return json({ files }, 200, rate.headers)
    }

    return text('Missing wallet, github, or device param', 400, rate.headers)
  }

  // GET /api/v1/ipfs/files/:cid
  if (resource === 'files' && segments.length === 2) {
    const cid = segments[1]
    const file = await ctx.runQuery(api.ipfsHub.getByCid, { cid })
    if (!file) return text('File not found', 404, rate.headers)
    return json({ file }, 200, rate.headers)
  }

  // GET /api/v1/ipfs/stats?wallet=...
  if (resource === 'stats') {
    const wallet = url.searchParams.get('wallet')?.trim()
    if (!wallet) return text('Missing wallet param', 400, rate.headers)
    const stats = await ctx.runQuery(api.ipfsHub.getWalletStorageStats, {
      solanaWallet: wallet,
    })
    return json({ stats }, 200, rate.headers)
  }

  // GET /api/v1/ipfs/groups?wallet=...
  if (resource === 'groups') {
    const wallet = url.searchParams.get('wallet')?.trim()
    if (!wallet) return text('Missing wallet param', 400, rate.headers)
    const groups = await ctx.runQuery(api.ipfsHub.getGroupsByWallet, {
      solanaWallet: wallet,
    })
    return json({ groups }, 200, rate.headers)
  }

  return text('Not found', 404, rate.headers)
}

export async function ipfsPostRouterV1Handler(ctx: ActionCtx, request: Request) {
  const rate = await applyRateLimit(ctx, request, 'write')
  if (!rate.ok) return rate.response

  const segments = getPathSegments(request, '/api/v1/ipfs/')
  if (segments.length !== 1) {
    return text('Not found', 404, rate.headers)
  }

  const action = segments[0]
  const payloadResult = await parseJsonPayload(request, rate.headers)
  if (!payloadResult.ok) return payloadResult.response
  const payload = payloadResult.payload

  // POST /api/v1/ipfs/track — track an uploaded file
  if (action === 'track') {
    const pinataId = typeof payload.pinataId === 'string' ? payload.pinataId.trim() : ''
    const cid = typeof payload.cid === 'string' ? payload.cid.trim() : ''
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    const size = typeof payload.size === 'number' ? payload.size : 0
    const network = payload.network === 'public' ? 'public' as const : 'private' as const

    if (!pinataId || !cid || !name) {
      return text('Missing pinataId, cid, or name', 400, rate.headers)
    }

    const result = await ctx.runMutation(api.ipfsHub.trackUpload, {
      pinataId,
      cid,
      name,
      size,
      mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : undefined,
      network,
      groupId: typeof payload.groupId === 'string' ? payload.groupId : undefined,
      solanaWallet: typeof payload.solanaWallet === 'string' ? payload.solanaWallet : undefined,
      githubUser: typeof payload.githubUser === 'string' ? payload.githubUser : undefined,
      deviceId: typeof payload.deviceId === 'string' ? payload.deviceId : undefined,
      meshNodeId: typeof payload.meshNodeId === 'string' ? payload.meshNodeId : undefined,
      keyvalues: payload.keyvalues as Record<string, string> | undefined,
    })

    return json({ ok: true, ...result }, 200, rate.headers)
  }

  // POST /api/v1/ipfs/access — log access link creation
  if (action === 'access') {
    const fileId = typeof payload.fileId === 'string' ? payload.fileId.trim() : ''
    const cid = typeof payload.cid === 'string' ? payload.cid.trim() : ''
    const expiresAt = typeof payload.expiresAt === 'number' ? payload.expiresAt : 0

    if (!fileId || !cid || !expiresAt) {
      return text('Missing fileId, cid, or expiresAt', 400, rate.headers)
    }

    await ctx.runMutation(api.ipfsHub.logAccess, {
      fileId: fileId as Id<'ipfsFiles'>,
      cid,
      accessUrl: typeof payload.accessUrl === 'string' ? payload.accessUrl : undefined,
      solanaWallet: typeof payload.solanaWallet === 'string' ? payload.solanaWallet : undefined,
      deviceId: typeof payload.deviceId === 'string' ? payload.deviceId : undefined,
      expiresAt,
    })

    return json({ ok: true }, 200, rate.headers)
  }

  // POST /api/v1/ipfs/delete — delete tracked file
  if (action === 'delete') {
    const fileId = typeof payload.fileId === 'string' ? payload.fileId.trim() : ''
    if (!fileId) return text('Missing fileId', 400, rate.headers)

    const result = await ctx.runMutation(api.ipfsHub.deleteFile, {
      fileId: fileId as Id<'ipfsFiles'>,
    })

    return json({ ok: true, ...result }, 200, rate.headers)
  }

  // POST /api/v1/ipfs/deploy — deploy agent to mainnet via Pinata + 8004/Metaplex
  if (action === 'deploy') {
    const authResult = await requireApiTokenUserOrResponse(ctx, request, rate.headers)
    if (!authResult.ok) return authResult.response

    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    const metadataUri = typeof payload.metadataUri === 'string' ? payload.metadataUri.trim() : ''
    const metadataCid = typeof payload.metadataCid === 'string' ? payload.metadataCid.trim() : ''
    const ownerWallet = typeof payload.ownerWalletAddress === 'string' ? payload.ownerWalletAddress.trim() : ''
    const registryMode = payload.registryMode === '8004' || payload.registryMode === 'metaplex' || payload.registryMode === 'dual'
      ? payload.registryMode
      : '8004'

    if (!name || !metadataUri || !metadataCid || !ownerWallet) {
      return text('Missing name, metadataUri, metadataCid, or ownerWalletAddress', 400, rate.headers)
    }

    const { internal } = await import('../_generated/api')
    const result = await ctx.runAction(internal.ipfsHubDeploy.deployAgentFromIPFS, {
      userId: authResult.userId,
      ownerWalletAddress: ownerWallet,
      githubUser: typeof payload.githubUser === 'string' ? payload.githubUser : undefined,
      metadataUri,
      metadataCid,
      name,
      description: typeof payload.description === 'string' ? payload.description : undefined,
      symbol: typeof payload.symbol === 'string' ? payload.symbol : undefined,
      imageUri: typeof payload.imageUri === 'string' ? payload.imageUri : undefined,
      registryMode: registryMode as '8004' | 'metaplex' | 'dual',
      atomEnabled: payload.atomEnabled === true,
      collectionPointer: typeof payload.collectionPointer === 'string' ? payload.collectionPointer : undefined,
      skills: Array.isArray(payload.skills) ? payload.skills : undefined,
      domains: Array.isArray(payload.domains) ? payload.domains : undefined,
      mcpUrl: typeof payload.mcpUrl === 'string' ? payload.mcpUrl : undefined,
      a2aUrl: typeof payload.a2aUrl === 'string' ? payload.a2aUrl : undefined,
      website: typeof payload.website === 'string' ? payload.website : undefined,
    })

    return json(result, 200, rate.headers)
  }

  return text('Not found', 404, rate.headers)
}
