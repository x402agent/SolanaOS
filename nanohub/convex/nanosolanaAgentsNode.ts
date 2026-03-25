'use node'

import { create, fetchAsset, mplCore, transfer } from '@metaplex-foundation/mpl-core'
import { mplAgentIdentity, mplAgentTools } from '@metaplex-foundation/mpl-agent-registry'
import {
  findAgentIdentityV1Pda,
  registerIdentityV1,
} from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity'
import {
  delegateExecutionV1,
  findExecutionDelegateRecordV1Pda,
  findExecutiveProfileV1Pda,
  registerExecutiveV1,
  safeFetchExecutiveProfileV1FromSeeds,
} from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools'
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox'
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters'
import bs58 from 'bs58'
import { Keypair, PublicKey } from '@solana/web3.js'
import { IPFSClient, ServiceType, SolanaSDK, buildRegistrationFileJson } from '8004-solana'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { action, internalAction } from './functions'
import { requireUserFromAction } from './lib/access'

const MAX_NAME_LENGTH = 64
const MAX_SYMBOL_LENGTH = 12
const MAX_DESCRIPTION_LENGTH = 800
const MAX_LIST_ITEMS = 24
const MAX_ITEM_LENGTH = 120
const SOLANAOS_ACP_COMMAND = 'solanaos acp'

type AgentRegistryMode = '8004' | 'metaplex' | 'dual'

type AgentService = {
  type: string
  value: string
}

type AgentSocials = {
  website?: string
  x?: string
  discord?: string
}

type EightHundredFourResult = {
  assetAddress: string
  assetTxSignature?: string
  transferTxSignature?: string
  ownerVerified: boolean
}

type MetaplexResult = {
  assetAddress: string
  identityPda: string
  executiveProfilePda: string
  delegateRecordPda: string
  registrationTxSignature?: string
  delegateTxSignature?: string
  transferTxSignature?: string
  ownerVerified: boolean
}

function env(name: string) {
  return process.env[name]?.trim() || ''
}

function normalizeText(value: string | undefined, maxLength: number) {
  return (value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function normalizeOptionalUrl(value: string | undefined) {
  const trimmed = (value || '').trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('ipfs://')) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString()
    }
  } catch {}
  throw new ConvexError('Image and social links must be valid URLs or ipfs:// URIs.')
}

function normalizeOptionalValue(value: string | undefined, maxLength = MAX_ITEM_LENGTH) {
  const trimmed = normalizeText(value, maxLength)
  return trimmed || undefined
}

function normalizeList(values: string[] | undefined) {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const raw of values || []) {
    const item = normalizeText(raw, MAX_ITEM_LENGTH)
    if (!item) continue
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(item)
    if (normalized.length >= MAX_LIST_ITEMS) break
  }
  return normalized
}

function normalizeRegistryMode(value: string | undefined): AgentRegistryMode {
  const trimmed = value?.trim().toLowerCase()
  if (trimmed === '8004' || trimmed === 'metaplex') return trimmed
  return 'dual'
}

function parseSignerFromEnv() {
  const raw =
    env('NANOSOLANA_AGENT_FACTORY_PRIVATE_KEY') ||
    env('SOLANA_PRIVATE_KEY') ||
    env('AGENT_REGISTRY_PRIVATE_KEY')
  if (!raw) {
    throw new ConvexError('SOLANA_PRIVATE_KEY is not configured for the agent factory backend.')
  }
  if (!raw.startsWith('[')) {
    throw new ConvexError('SOLANA_PRIVATE_KEY must be a JSON array secret key for the agent factory backend.')
  }
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
  } catch {
    throw new ConvexError('SOLANA_PRIVATE_KEY could not be parsed as a Solana secret key array.')
  }
}

function resolveCluster() {
  const raw = env('NANOSOLANA_AGENT_FACTORY_CLUSTER') || env('AGENT_REGISTRY_CLUSTER') || 'devnet'
  return raw === 'mainnet-beta' || raw === 'localnet' ? raw : 'devnet'
}

function resolveRpcUrl(cluster: string) {
  return (
    env('NANOSOLANA_AGENT_FACTORY_RPC_URL') ||
    env('AGENT_REGISTRY_RPC_URL') ||
    (cluster === 'devnet' ? 'https://api.devnet.solana.com' : '')
  )
}

function resolveIndexerApiKey() {
  return env('NANOSOLANA_AGENT_FACTORY_INDEXER_API_KEY') || env('AGENT_REGISTRY_INDEXER_API_KEY')
}

function resolvePinataJwt() {
  return (
    env('NANOSOLANA_AGENT_FACTORY_PINATA_JWT') ||
    env('AGENT_REGISTRY_PINATA_JWT') ||
    env('PINATA_JWT') ||
    env('PINATA_JWT_SECRET')
  )
}

function resolveCollectionPointer() {
  return (
    normalizeOptionalValue(env('NANOSOLANA_AGENT_FACTORY_COLLECTION_POINTER'), 200) ||
    normalizeOptionalValue(env('AGENT_REGISTRY_COLLECTION_POINTER'), 200)
  )
}

function resolveSiteUrl() {
  return (
    env('SITE_URL') ||
    env('VITE_SITE_URL') ||
    'https://seeker.solanaos.net'
  ).replace(/\/$/, '')
}

function resolveConvexSiteUrl() {
  return (
    env('CONVEX_SITE_URL') ||
    env('VITE_CONVEX_SITE_URL') ||
    resolveSiteUrl()
  ).replace(/\/$/, '')
}

function buildPublicAgentProfileUrl(registrationId: Id<'nanosolanaAgents'>) {
  return `${resolveSiteUrl()}/agents/${registrationId}`
}

function buildPublicAgentCardUrl(registrationId: Id<'nanosolanaAgents'>) {
  const url = new URL('/nanosolana/agents/agent-card', resolveConvexSiteUrl())
  url.searchParams.set('id', String(registrationId))
  return url.toString()
}

function ensurePublicKey(value: string, label: string) {
  try {
    return new PublicKey(value.trim())
  } catch {
    throw new ConvexError(`${label} must be a valid Solana address.`)
  }
}

function toBase58Value(value: unknown) {
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array) return bs58.encode(value)
  if (Array.isArray(value)) {
    if (typeof value[0] === 'string') return value[0]
    if (value.every((entry) => typeof entry === 'number')) return bs58.encode(Uint8Array.from(value))
  }
  if (value && typeof value === 'object' && 'toBase58' in value && typeof value.toBase58 === 'function') {
    return value.toBase58()
  }
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function toExplorerUrl(kind: 'address' | 'tx', value: string, cluster: string) {
  const url = new URL(`https://explorer.solana.com/${kind}/${value}`)
  if (cluster !== 'mainnet-beta') {
    url.searchParams.set('cluster', cluster)
  }
  return url.toString()
}

function buildServices(args: {
  registrationId: Id<'nanosolanaAgents'>
  ownerWalletAddress: string
  mcpUrl?: string
  a2aUrl?: string
  snsName?: string
  ensName?: string
  did?: string
}) {
  const services: AgentService[] = [
    { type: ServiceType.WALLET, value: args.ownerWalletAddress },
    { type: 'web', value: buildPublicAgentProfileUrl(args.registrationId) },
    { type: 'ACP_COMMAND', value: SOLANAOS_ACP_COMMAND },
  ]
  services.push({
    type: ServiceType.A2A,
    value: args.a2aUrl || buildPublicAgentCardUrl(args.registrationId),
  })
  if (args.mcpUrl) services.push({ type: ServiceType.MCP, value: args.mcpUrl })
  if (args.snsName) services.push({ type: ServiceType.SNS, value: args.snsName })
  if (args.ensName) services.push({ type: ServiceType.ENS, value: args.ensName })
  if (args.did) services.push({ type: ServiceType.DID, value: args.did })
  return services
}

function buildSocials(args: { website?: string; x?: string; discord?: string }) {
  const socials: AgentSocials = {}
  if (args.website) socials.website = args.website
  if (args.x) socials.x = args.x
  if (args.discord) socials.discord = args.discord
  return Object.keys(socials).length > 0 ? socials : undefined
}

async function insertDraft(
  ctx: ActionCtx,
  payload: {
    userId: Id<'users'>
    ownerWalletAddress: string
    registryMode: AgentRegistryMode
    name: string
    symbol?: string
    description: string
    imageUri?: string
    services: AgentService[]
    skills: string[]
    domains: string[]
    socials?: AgentSocials
    atomEnabled: boolean
    cluster: string
    collectionPointer?: string
  },
): Promise<Id<'nanosolanaAgents'>> {
  return ctx.runMutation(internal.nanosolanaAgents.createDraftInternal, payload)
}

const createAgentArgs = {
  ownerWalletAddress: v.string(),
  registryMode: v.optional(v.union(v.literal('8004'), v.literal('metaplex'), v.literal('dual'))),
  name: v.string(),
  symbol: v.optional(v.string()),
  description: v.string(),
  imageUri: v.optional(v.string()),
  website: v.optional(v.string()),
  xUrl: v.optional(v.string()),
  discordUrl: v.optional(v.string()),
  mcpUrl: v.optional(v.string()),
  a2aUrl: v.optional(v.string()),
  snsName: v.optional(v.string()),
  ensName: v.optional(v.string()),
  did: v.optional(v.string()),
  skills: v.optional(v.array(v.string())),
  domains: v.optional(v.array(v.string())),
  atomEnabled: v.optional(v.boolean()),
} as const

function createMetaplexUmi(rpcUrl: string, signer: Keypair) {
  return createUmi(rpcUrl)
    .use(mplCore())
    .use(mplToolbox())
    .use(mplAgentIdentity())
    .use(mplAgentTools())
    .use(keypairIdentity(fromWeb3JsKeypair(signer)))
}

async function register8004Agent(args: {
  sdk: SolanaSDK
  metadataUri: string
  cluster: string
  ownerWalletAddress: string
  userId: Id<'users'>
  atomEnabled: boolean
  collectionPointer?: string
}): Promise<EightHundredFourResult> {
  const registerOptions: {
    atomEnabled?: boolean
    collectionPointer?: string
  } = {}
  if (args.atomEnabled) registerOptions.atomEnabled = true
  if (args.collectionPointer) registerOptions.collectionPointer = args.collectionPointer

  const result = await args.sdk.registerAgent(args.metadataUri, registerOptions)
  const assetAddress = toBase58Value(result.asset)
  if (!assetAddress) {
    throw new ConvexError('8004 registry returned no asset address.')
  }

  const assetPubkey = ensurePublicKey(assetAddress, 'Registered 8004 asset')
  const ownerPubkey = new PublicKey(args.ownerWalletAddress)

  try {
    await args.sdk.setMetadata(assetPubkey, 'convex_user', args.userId)
    await args.sdk.setMetadata(assetPubkey, 'owner_wallet', args.ownerWalletAddress)
  } catch {}

  const transferResult = await args.sdk.transferAgent(assetPubkey, ownerPubkey)

  let ownerVerified = false
  try {
    const loaded = await args.sdk.loadAgent(assetPubkey)
    ownerVerified = loaded ? loaded.getOwnerPublicKey().toBase58() === args.ownerWalletAddress : false
  } catch {}

  return {
    assetAddress,
    assetTxSignature: normalizeOptionalValue(toBase58Value((result as { signature?: unknown }).signature), 120),
    transferTxSignature: normalizeOptionalValue(
      toBase58Value((transferResult as { signature?: unknown }).signature),
      120,
    ),
    ownerVerified,
  }
}

async function registerMetaplexAgent(args: {
  rpcUrl: string
  signer: Keypair
  ownerWalletAddress: string
  name: string
  metadataUri: string
}): Promise<MetaplexResult> {
  const umi = createMetaplexUmi(args.rpcUrl, args.signer)
  const assetSigner = generateSigner(umi)
  const ownerPublicKey = fromWeb3JsPublicKey(new PublicKey(args.ownerWalletAddress))

  await create(umi, {
    asset: assetSigner,
    name: args.name,
    uri: args.metadataUri,
  }).sendAndConfirm(umi)

  const registrationResult = await registerIdentityV1(umi, {
    asset: assetSigner.publicKey,
    agentRegistrationUri: args.metadataUri,
  }).sendAndConfirm(umi)

  const executiveProfilePda = findExecutiveProfileV1Pda(umi, {
    authority: umi.identity.publicKey,
  })

  const existingExecutive = await safeFetchExecutiveProfileV1FromSeeds(umi, {
    authority: umi.identity.publicKey,
  })
  if (!existingExecutive) {
    await registerExecutiveV1(umi, {}).sendAndConfirm(umi)
  }

  const agentIdentityPda = findAgentIdentityV1Pda(umi, {
    asset: assetSigner.publicKey,
  })
  const delegateResult = await delegateExecutionV1(umi, {
    agentAsset: assetSigner.publicKey,
    agentIdentity: agentIdentityPda,
    executiveProfile: executiveProfilePda,
  }).sendAndConfirm(umi)

  const asset = await fetchAsset(umi, assetSigner.publicKey)
  const transferResult = await transfer(umi, {
    asset,
    newOwner: ownerPublicKey,
  }).sendAndConfirm(umi)

  const delegateRecordPda = findExecutionDelegateRecordV1Pda(umi, {
    executiveProfile: Array.isArray(executiveProfilePda) ? executiveProfilePda[0] : executiveProfilePda,
    agentAsset: assetSigner.publicKey,
  })
  const transferredAsset = await fetchAsset(umi, assetSigner.publicKey)
  const ownerVerified = toBase58Value(transferredAsset.owner) === args.ownerWalletAddress

  return {
    assetAddress: toBase58Value(assetSigner.publicKey),
    identityPda: toBase58Value(agentIdentityPda),
    executiveProfilePda: toBase58Value(executiveProfilePda),
    delegateRecordPda: toBase58Value(delegateRecordPda),
    registrationTxSignature: normalizeOptionalValue(
      toBase58Value((registrationResult as { signature?: unknown }).signature),
      120,
    ),
    delegateTxSignature: normalizeOptionalValue(
      toBase58Value((delegateResult as { signature?: unknown }).signature),
      120,
    ),
    transferTxSignature: normalizeOptionalValue(
      toBase58Value((transferResult as { signature?: unknown }).signature),
      120,
    ),
    ownerVerified,
  }
}

async function createAgentForUser(
  ctx: ActionCtx,
  userId: Id<'users'>,
  args: {
    ownerWalletAddress: string
    registryMode?: AgentRegistryMode
    name: string
    symbol?: string
    description: string
    imageUri?: string
    website?: string
    xUrl?: string
    discordUrl?: string
    mcpUrl?: string
    a2aUrl?: string
    snsName?: string
    ensName?: string
    did?: string
    skills?: string[]
    domains?: string[]
    atomEnabled?: boolean
  },
): Promise<{
  registrationId: Id<'nanosolanaAgents'>
  assetAddress: string
  metadataUri: string
  explorerAssetUrl: string
}> {
  const ownerWalletAddress = ensurePublicKey(args.ownerWalletAddress, 'Owner wallet').toBase58()
  const registryMode = normalizeRegistryMode(args.registryMode)
  const name = normalizeText(args.name, MAX_NAME_LENGTH)
  const symbol = normalizeOptionalValue(args.symbol, MAX_SYMBOL_LENGTH)
  const description = normalizeText(args.description, MAX_DESCRIPTION_LENGTH)
  const imageUri = normalizeOptionalUrl(args.imageUri)
  const website = normalizeOptionalUrl(args.website)
  const xUrl = normalizeOptionalUrl(args.xUrl)
  const discordUrl = normalizeOptionalUrl(args.discordUrl)
  const mcpUrl = normalizeOptionalUrl(args.mcpUrl)
  const a2aUrl = normalizeOptionalUrl(args.a2aUrl)
  const snsName = normalizeOptionalValue(args.snsName, 80)
  const ensName = normalizeOptionalValue(args.ensName, 120)
  const did = normalizeOptionalValue(args.did, 180)
  const skills = normalizeList(args.skills)
  const domains = normalizeList(args.domains)
  const atomEnabled = Boolean(args.atomEnabled)
  let socials = buildSocials({ website, x: xUrl, discord: discordUrl })

  if (!name) throw new ConvexError('Agent name is required.')
  if (!description) throw new ConvexError('Agent description is required.')

  const cluster = resolveCluster()
  const rpcUrl = resolveRpcUrl(cluster)
  const collectionPointer = resolveCollectionPointer()
  const registrationId = await insertDraft(ctx, {
    userId,
    ownerWalletAddress,
    registryMode,
    name,
    symbol,
    description,
    imageUri,
    services: [],
    skills,
    domains,
    socials,
    atomEnabled,
    cluster,
    collectionPointer,
  })

  const services = buildServices({
    registrationId,
    ownerWalletAddress,
    mcpUrl,
    a2aUrl,
    snsName,
    ensName,
    did,
  })
  if (!socials?.website) {
    socials = buildSocials({
      website: buildPublicAgentProfileUrl(registrationId),
      x: xUrl,
      discord: discordUrl,
    })
  }

  await ctx.runMutation(internal.nanosolanaAgents.updateDraftServicesInternal, {
    registrationId,
    services,
    socials,
  })

  let ipfs: IPFSClient | null = null
  try {
    const signer = parseSignerFromEnv()
    const pinataJwt = resolvePinataJwt()
    if (!pinataJwt) {
      throw new ConvexError('PINATA_JWT is not configured for the agent factory backend.')
    }

    ipfs = new IPFSClient({ pinataEnabled: true, pinataJwt })
    const metadata = buildRegistrationFileJson({
      name,
      description,
      image: imageUri,
      services: services as { type: ServiceType; value: string }[],
      skills,
      domains,
    })
    const metadataCid = await ipfs.addJson(metadata)
    const metadataUri = `ipfs://${metadataCid}`

    let eightHundredFour: EightHundredFourResult | null = null
    if (registryMode === '8004' || registryMode === 'dual') {
      const sdkConfig: ConstructorParameters<typeof SolanaSDK>[0] = {
        cluster,
        signer,
        ipfsClient: ipfs,
        useIndexer: true,
        indexerFallback: true,
      }
      if (rpcUrl) sdkConfig.rpcUrl = rpcUrl
      const indexerApiKey = resolveIndexerApiKey()
      if (indexerApiKey) sdkConfig.indexerApiKey = indexerApiKey
      const sdk = new SolanaSDK(sdkConfig)
      eightHundredFour = await register8004Agent({
        sdk,
        metadataUri,
        cluster,
        ownerWalletAddress,
        userId,
        atomEnabled,
        collectionPointer,
      })
    }

    let metaplex: MetaplexResult | null = null
    if (registryMode === 'metaplex' || registryMode === 'dual') {
      if (!rpcUrl) {
        throw new ConvexError('AGENT_REGISTRY_RPC_URL is required for Metaplex registration.')
      }
      metaplex = await registerMetaplexAgent({
        rpcUrl,
        signer,
        ownerWalletAddress,
        name,
        metadataUri,
      })
    }

    const assetAddress = eightHundredFour?.assetAddress || metaplex?.assetAddress || ''
    if (!assetAddress) {
      throw new ConvexError('No registry returned an agent asset address.')
    }

    await ctx.runMutation(internal.nanosolanaAgents.markReadyInternal, {
      registrationId,
      metadataCid,
      metadataUri,
      assetAddress,
      ownerVerified: Boolean(eightHundredFour?.ownerVerified || metaplex?.ownerVerified),
      assetTxSignature: eightHundredFour?.assetTxSignature,
      transferTxSignature: eightHundredFour?.transferTxSignature,
      metaplexAssetAddress: metaplex?.assetAddress,
      metaplexIdentityPda: metaplex?.identityPda,
      metaplexExecutiveProfilePda: metaplex?.executiveProfilePda,
      metaplexDelegateRecordPda: metaplex?.delegateRecordPda,
      metaplexRegistered: Boolean(metaplex),
      metaplexRegistrationTxSignature: metaplex?.registrationTxSignature,
      metaplexDelegateTxSignature: metaplex?.delegateTxSignature,
      metaplexTransferTxSignature: metaplex?.transferTxSignature,
    })

    return {
      registrationId,
      assetAddress,
      metadataUri,
      explorerAssetUrl: toExplorerUrl('address', assetAddress, cluster),
    }
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : error instanceof Error
          ? error.message
          : 'Agent registration failed.'
    await ctx.runMutation(internal.nanosolanaAgents.markFailedInternal, {
      registrationId,
      errorMessage: normalizeText(message, 400) || 'Agent registration failed.',
    })
    throw new ConvexError(message)
  } finally {
    if (ipfs && typeof (ipfs as { close?: () => Promise<void> }).close === 'function') {
      await (ipfs as { close: () => Promise<void> }).close()
    }
  }
}

export const createForWalletUserInternal = internalAction({
  args: {
    userId: v.id('users'),
    ...createAgentArgs,
  },
  handler: async (ctx, args) => createAgentForUser(ctx, args.userId, args),
})

export const createForCurrentUser = action({
  args: createAgentArgs,
  handler: async (ctx, args) => {
    const { userId } = await requireUserFromAction(ctx)
    return createAgentForUser(ctx, userId, args)
  },
})
