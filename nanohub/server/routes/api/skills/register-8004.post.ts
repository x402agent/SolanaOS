/**
 * POST /api/skills/register-8004
 *
 * After a Metaplex Core NFT is minted client-side, this endpoint registers the
 * skill in the 8004 Trustless Agent Registry using a server-side factory wallet.
 *
 * Body: { skillName: string, metaplexAssetAddress: string, ownerWallet: string }
 * Returns: { assetAddress, txSignature, explorerUrl } or { error }
 *
 * Required env vars:
 *   SOLANA_PRIVATE_KEY  – JSON array secret key for the factory wallet
 *   HELIUS_RPC_URL      – mainnet RPC (optional, falls back to public RPC)
 */
import { defineEventHandler, readBody, createError, setHeader } from 'h3'

const METADATA_BASE = 'https://solanaos.net/api/skills/nft-metadata'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/json')

  const body = await readBody(event)
  const skillName = body?.skillName
  const metaplexAssetAddress = body?.metaplexAssetAddress
  const ownerWallet = body?.ownerWallet

  if (!skillName || typeof skillName !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing skillName' })
  }
  if (!ownerWallet || typeof ownerWallet !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing ownerWallet' })
  }

  // Parse server-side signer
  const rawKey =
    process.env.NANOSOLANA_AGENT_FACTORY_PRIVATE_KEY ||
    process.env.SOLANA_PRIVATE_KEY ||
    process.env.AGENT_REGISTRY_PRIVATE_KEY
  if (!rawKey) {
    throw createError({
      statusCode: 503,
      message:
        '8004 registration unavailable: SOLANA_PRIVATE_KEY not configured. Set it in Netlify env vars to enable.',
    })
  }

  const rpcUrl =
    process.env.HELIUS_RPC_URL ||
    process.env.NANOSOLANA_AGENT_FACTORY_RPC_URL ||
    'https://api.mainnet-beta.solana.com'

  try {
    // Dynamic imports to avoid bundling these in every route
    const { Keypair, PublicKey } = await import('@solana/web3.js')
    const { SolanaSDK, ServiceType, buildRegistrationFileJson } = await import('8004-solana')

    const signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(rawKey)))
    const ownerPubkey = new PublicKey(ownerWallet)

    const metadataUri = `${METADATA_BASE}/${encodeURIComponent(skillName)}`

    const sdk = new SolanaSDK({
      cluster: 'mainnet-beta' as any,
      signer,
      rpcUrl,
      useIndexer: true,
      indexerFallback: true,
    })

    // Build 8004 registration metadata
    const metadata = buildRegistrationFileJson({
      name: `SolanaOS: ${skillName}`,
      description: `AI agent skill "${skillName}" from the SolanaOS ecosystem.`,
      image: 'https://solanaos.net/og.png',
      services: [
        { type: ServiceType.MCP, value: `https://solanaos.net/solanaos#skill-${skillName}` },
        ...(metaplexAssetAddress
          ? [{ type: ServiceType.WALLET, value: metaplexAssetAddress }]
          : []),
        { type: ServiceType.A2A, value: ownerWallet },
      ],
      skills: [`agent_skill/${skillName}`],
      domains: ['technology_and_computing/software_development'],
    })

    // Register on 8004 — factory wallet pays (~0.006 SOL)
    const result = await sdk.registerAgent(metadataUri, {
      atomEnabled: true,
    })

    const assetAddress =
      typeof result.asset === 'string'
        ? result.asset
        : result.asset instanceof Uint8Array
          ? Array.from(result.asset)
              .map((b: number) => b.toString(16).padStart(2, '0'))
              .join('')
          : result.asset && typeof (result.asset as any).toBase58 === 'function'
            ? (result.asset as any).toBase58()
            : String(result.asset)

    // Transfer ownership to the user's wallet
    try {
      const { PublicKey: PK } = await import('@solana/web3.js')
      const assetPk = new PK(assetAddress)
      await sdk.transferAgent(assetPk, ownerPubkey)
    } catch (transferErr: any) {
      // Non-fatal: ownership transfer is best-effort
      console.warn(`8004 ownership transfer failed for ${skillName}:`, transferErr?.message)
    }

    const sig = (result as any).signature
    const txSignature =
      typeof sig === 'string'
        ? sig
        : sig instanceof Uint8Array
          ? Array.from(sig)
              .map((b: number) => b.toString(16).padStart(2, '0'))
              .join('')
          : ''

    return {
      success: true,
      assetAddress,
      txSignature,
      explorerUrl: `https://explorer.solana.com/address/${assetAddress}`,
      metadataUri,
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: `8004 registration failed for "${skillName}": ${err?.message || 'Unknown error'}`,
    })
  }
})
