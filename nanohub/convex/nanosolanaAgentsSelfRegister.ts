'use node'

/**
 * Self-service agent registration — user pays with their own wallet.
 *
 * Flow:
 * 1. User fills form → calls prepareRegistration (Convex action)
 * 2. Backend pins metadata to IPFS, builds unsigned tx via 8004 SDK skipSend
 * 3. Returns serialized unsigned transaction to frontend
 * 4. Frontend signs with Phantom → sends on-chain
 * 5. Frontend calls confirmRegistration with tx signature
 * 6. Backend verifies and records in Convex
 */

import { IPFSClient, ServiceType, SolanaSDK, buildRegistrationFileJson } from '8004-solana'
import { PublicKey } from '@solana/web3.js'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action } from './functions'

const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 800

function resolveCluster(): string {
  return process.env.AGENT_REGISTRY_CLUSTER?.trim() || 'mainnet-beta'
}

function resolveRpcUrl(cluster: string): string {
  return (
    process.env.AGENT_REGISTRY_RPC_URL?.trim() ||
    process.env.HELIUS_RPC_URL?.trim() ||
    (cluster === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com')
  )
}

function resolvePinataJwt(): string {
  return (
    process.env.AGENT_REGISTRY_PINATA_JWT?.trim() ||
    process.env.PINATA_JWT?.trim() ||
    process.env.PINATA_JWT_SECRET?.trim() ||
    ''
  )
}

/**
 * Step 1: Prepare registration — pin metadata to IPFS, build unsigned transaction.
 * Returns the base64 serialized unsigned transaction for the frontend to sign.
 */
export const prepareRegistration = action({
  args: {
    walletAddress: v.string(),
    name: v.string(),
    description: v.string(),
    imageUri: v.optional(v.string()),
    mcpUrl: v.optional(v.string()),
    a2aUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    atomEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const walletAddress = args.walletAddress.trim()
    if (!walletAddress) throw new ConvexError('Wallet address is required.')

    // Validate it's a valid Solana public key
    try {
      new PublicKey(walletAddress)
    } catch {
      throw new ConvexError('Invalid Solana wallet address.')
    }

    const name = args.name.trim().slice(0, MAX_NAME_LENGTH)
    const description = args.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
    if (!name) throw new ConvexError('Agent name is required.')
    if (!description) throw new ConvexError('Agent description is required.')

    const cluster = resolveCluster()
    const rpcUrl = resolveRpcUrl(cluster)

    // Build services list
    const services: { type: ServiceType; value: string }[] = [
      { type: ServiceType.WALLET, value: walletAddress },
    ]
    if (args.mcpUrl?.trim()) services.push({ type: ServiceType.MCP, value: args.mcpUrl.trim() })
    if (args.a2aUrl?.trim()) services.push({ type: ServiceType.A2A, value: args.a2aUrl.trim() })

    // Pin metadata to IPFS
    const pinataJwt = resolvePinataJwt()
    if (!pinataJwt) throw new ConvexError('IPFS pinning is not configured on this deployment.')

    const ipfs = new IPFSClient({ pinataEnabled: true, pinataJwt })
    try {
      const metadata = buildRegistrationFileJson({
        name,
        description,
        image: args.imageUri?.trim() || undefined,
        services,
        x402Support: false,
      })

      const cid = await ipfs.addJson(metadata)
      const metadataUri = `ipfs://${cid}`

      // Build unsigned transaction via skipSend
      const sdkConfig: ConstructorParameters<typeof SolanaSDK>[0] = {
        cluster,
        useIndexer: true,
        indexerFallback: true,
      }
      if (rpcUrl) sdkConfig.rpcUrl = rpcUrl

      const sdk = new SolanaSDK(sdkConfig)

      const prepared = await sdk.registerAgent(metadataUri, {
        skipSend: true,
        signer: new PublicKey(walletAddress),
        atomEnabled: Boolean(args.atomEnabled),
      })

      if (!prepared?.transaction) {
        throw new ConvexError('Failed to build registration transaction.')
      }

      // Create a pending record in Convex
      const pendingId = await ctx.runMutation(internal.nanosolanaAgentsSelfRegisterMutations.createPending, {
        walletAddress,
        name,
        description,
        imageUri: args.imageUri?.trim(),
        metadataCid: cid,
        metadataUri,
        cluster,
        atomEnabled: Boolean(args.atomEnabled),
        services: services.map((s) => ({ type: String(s.type), value: s.value })),
        website: args.website?.trim(),
      })

      return {
        pendingId,
        transaction: prepared.transaction, // base64 serialized unsigned tx
        metadataUri,
        metadataCid: cid,
        cluster,
        estimatedCost: '~0.007 SOL',
      }
    } finally {
      if (typeof (ipfs as any).close === 'function') {
        await (ipfs as any).close()
      }
    }
  },
})

/**
 * Step 2: Confirm registration — frontend calls this after signing & sending the tx.
 */
export const confirmRegistration = action({
  args: {
    pendingId: v.string(),
    txSignature: v.string(),
    assetAddress: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.nanosolanaAgentsSelfRegisterMutations.markConfirmed, {
      pendingId: args.pendingId as Id<'nanosolanaAgents'>,
      txSignature: args.txSignature,
      assetAddress: args.assetAddress,
    })

    // Also upsert reputation record
    await ctx.runMutation(internal.nanosolanaAgentReputation.upsertInternal, {
      assetAddress: args.assetAddress,
      agentType: 'user-registered',
      atomScore: 0,
      trustTier: 'unrated',
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
    })

    return { success: true, assetAddress: args.assetAddress }
  },
})

// Internal mutations moved to nanosolanaAgentsSelfRegisterMutations.ts
// (Convex 'use node' modules can only export actions, not mutations)
