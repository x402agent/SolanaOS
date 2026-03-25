import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { internalAction, internalMutation } from './functions'

// ── IPFS Hub Deployment Actions ─────────────────────────────────────
// Connects Pinata Private IPFS to 8004 + Metaplex on-chain registration.
// Handles the full mainnet deployment flow:
//   1. Validate metadata already pinned to Private IPFS
//   2. Register agent on-chain (8004, Metaplex, or dual)
//   3. Track deployment in Convex
//   4. Return deployment result for mesh sync

const DEPLOY_MODES = ['8004', 'metaplex', 'dual'] as const
type DeployMode = (typeof DEPLOY_MODES)[number]

// ── Deploy Agent from Pinata IPFS ───────────────────────────────────

export const deployAgentFromIPFS = internalAction({
  args: {
    // Identity
    userId: v.id('users'),
    ownerWalletAddress: v.string(),
    githubUser: v.optional(v.string()),

    // Metadata (already pinned to Private IPFS)
    metadataUri: v.string(), // ipfs://...
    metadataCid: v.string(),

    // Agent details
    name: v.string(),
    description: v.optional(v.string()),
    symbol: v.optional(v.string()),
    imageUri: v.optional(v.string()),

    // Registry config
    registryMode: v.union(v.literal('8004'), v.literal('metaplex'), v.literal('dual')),
    atomEnabled: v.optional(v.boolean()),
    collectionPointer: v.optional(v.string()),
    cluster: v.optional(v.string()),

    // Capabilities
    skills: v.optional(v.array(v.string())),
    domains: v.optional(v.array(v.string())),
    mcpUrl: v.optional(v.string()),
    a2aUrl: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    ok: boolean
    registrationId: string
    metadataUri?: string
    assetAddress?: string
    error?: string
  }> => {
    // Step 1: Create draft agent in database
    const draftId = await ctx.runMutation(
      internal.nanosolanaAgents.createDraftInternal,
      {
        userId: args.userId,
        ownerWalletAddress: args.ownerWalletAddress,
        registryMode: args.registryMode,
        name: args.name,
        description: args.description ?? '',
        symbol: args.symbol ?? '',
        imageUri: args.imageUri,
        skills: args.skills ?? [],
        domains: args.domains ?? [],
        services: buildServicesList(args),
        socials: args.website ? { website: args.website } : undefined,
        atomEnabled: args.atomEnabled ?? false,
        cluster: args.cluster ?? 'mainnet-beta',
        collectionPointer: args.collectionPointer,
      },
    )

    try {
      // Step 2: Register on-chain via the existing agent factory
      const result = await ctx.runAction(
        internal.nanosolanaAgentsNode.createForWalletUserInternal,
        {
          userId: args.userId,
          ownerWalletAddress: args.ownerWalletAddress,
          registryMode: args.registryMode,
          name: args.name,
          description: args.description ?? '',
          symbol: args.symbol ?? '',
          imageUri: args.imageUri,
          skills: args.skills ?? [],
          domains: args.domains ?? [],
          atomEnabled: args.atomEnabled ?? false,
        },
      )

      // Step 3: Track the IPFS file as an agent deployment
      await ctx.runMutation(api.ipfsHub.trackUpload, {
        pinataId: `deploy-${draftId}`,
        cid: args.metadataCid,
        name: `${args.name}-metadata.json`,
        size: 0,
        mimeType: 'application/json',
        network: 'private' as const,
        solanaWallet: args.ownerWalletAddress,
        githubUser: args.githubUser,
        keyvalues: {
          type: 'agent-deployment',
          agent_name: args.name,
          registry_mode: args.registryMode,
          asset_address: String(result?.assetAddress ?? ''),
        },
      })

      return {
        ok: true,
        registrationId: draftId,
        metadataUri: args.metadataUri,
        assetAddress: String(result?.assetAddress ?? ''),
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown deployment error'
      // Mark as failed
      await ctx.runMutation(internal.nanosolanaAgents.markFailedInternal, {
        registrationId: draftId as Id<'nanosolanaAgents'>,
        errorMessage: message,
      })

      return {
        ok: false,
        registrationId: draftId,
        error: message,
      }
    }
  },
})

// ── Bulk Deploy (for mesh nodes) ────────────────────────────────────

export const bulkTrackDeployments = internalMutation({
  args: {
    deployments: v.array(
      v.object({
        pinataId: v.string(),
        cid: v.string(),
        name: v.string(),
        solanaWallet: v.string(),
        githubUser: v.optional(v.string()),
        deviceId: v.optional(v.string()),
        assetAddress: v.optional(v.string()),
        registryMode: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const results = []

    for (const dep of args.deployments) {
      const id = await ctx.db.insert('ipfsFiles', {
        pinataId: dep.pinataId,
        cid: dep.cid,
        name: dep.name,
        size: 0,
        network: 'private',
        solanaWallet: dep.solanaWallet,
        githubUser: dep.githubUser,
        deviceId: dep.deviceId,
        keyvalues: {
          type: 'agent-deployment',
          registry_mode: dep.registryMode,
          asset_address: dep.assetAddress ?? '',
        },
        syncStatus: 'synced',
        createdAt: now,
        updatedAt: now,
      })
      results.push(id)
    }

    return results
  },
})

// ── Helpers ─────────────────────────────────────────────────────────

function buildServicesList(args: {
  mcpUrl?: string
  a2aUrl?: string
  website?: string
}) {
  const services: Array<{ type: string; value: string }> = []
  if (args.mcpUrl) services.push({ type: 'mcp', value: args.mcpUrl })
  if (args.a2aUrl) services.push({ type: 'a2a', value: args.a2aUrl })
  return services
}
