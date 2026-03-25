import { createFileRoute } from '@tanstack/react-router'
import { AddressType, usePhantom } from '@phantom/react-sdk'
import { CheckCircle, Hexagon, Loader2, Package, Rocket, Shield, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { solanaOsCatalog } from '../../lib/generated/solanaosCatalog'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import {
  create as createAsset,
  createCollection,
  fetchCollection,
  mplCore,
} from '@metaplex-foundation/mpl-core'
import {
  generateSigner,
  publicKey,
  signerIdentity,
  type Signer,
  type Transaction as UmiTransaction,
  type TransactionSignature as UmiTxSig,
} from '@metaplex-foundation/umi'

export const Route = createFileRoute('/setup/mint-skills')({
  component: MintSkillsPage,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkillEntry = (typeof solanaOsCatalog.skills)[number]

type MintStatus = 'idle' | 'uploading' | 'minting' | 'registering' | 'done' | 'error'

type SkillMintState = {
  status: MintStatus
  txSignature?: string
  assetAddress?: string
  eightOhFourAsset?: string
  eightOhFourTx?: string
  eightOhFourError?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Phantom → Umi signer adapter
// ---------------------------------------------------------------------------

interface PhantomSolanaProvider {
  isPhantom: boolean
  publicKey: PublicKey
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
  signAllTransactions: (txs: VersionedTransaction[]) => Promise<VersionedTransaction[]>
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>
}

function getPhantomSolanaProvider(): PhantomSolanaProvider | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { phantom?: { solana?: PhantomSolanaProvider } }
  const provider = w.phantom?.solana
  if (!provider?.isPhantom) return null
  return provider
}

function createPhantomUmiSigner(phantomPubkey: string): Signer {
  const pk = publicKey(phantomPubkey)
  return {
    publicKey: pk,
    signMessage: async (message: Uint8Array) => {
      const provider = getPhantomSolanaProvider()
      if (!provider) throw new Error('Phantom not available')
      const result = await provider.signMessage(message)
      return result.signature
    },
    signTransaction: async (tx: UmiTransaction) => {
      const provider = getPhantomSolanaProvider()
      if (!provider) throw new Error('Phantom not available')
      // Serialize Umi tx → bytes → web3.js VersionedTransaction → sign → back
      const serialized = tx.serializedMessage
      // Build a VersionedTransaction from the message bytes + empty sigs
      const web3Tx = VersionedTransaction.deserialize(
        new Uint8Array([
          // Compact array of signatures (count + empty sig slots)
          ...encodeCompactSignatures(tx.signatures),
          ...serialized,
        ]),
      )
      const signed = await provider.signTransaction(web3Tx)
      const signedBytes = signed.serialize()
      const decoded = VersionedTransaction.deserialize(signedBytes)
      // Map back to Umi format
      const umiSigs: UmiTxSig[] = decoded.signatures.map((sig, i) => ({
        publicKey: publicKey(decoded.message.staticAccountKeys[i].toBase58()),
        signature: sig,
      }))
      return { serializedMessage: serialized, signatures: umiSigs } as UmiTransaction
    },
    signAllTransactions: async (txs: UmiTransaction[]) => {
      const provider = getPhantomSolanaProvider()
      if (!provider) throw new Error('Phantom not available')
      const web3Txs = txs.map((tx) => {
        return VersionedTransaction.deserialize(
          new Uint8Array([
            ...encodeCompactSignatures(tx.signatures),
            ...tx.serializedMessage,
          ]),
        )
      })
      const signed = await provider.signAllTransactions(web3Txs)
      return signed.map((s, idx) => {
        const signedBytes = s.serialize()
        const decoded = VersionedTransaction.deserialize(signedBytes)
        const umiSigs: UmiTxSig[] = decoded.signatures.map((sig, i) => ({
          publicKey: publicKey(decoded.message.staticAccountKeys[i].toBase58()),
          signature: sig,
        }))
        return {
          serializedMessage: txs[idx].serializedMessage,
          signatures: umiSigs,
        } as UmiTransaction
      })
    },
  }
}

/** Encode Umi signatures into the compact-array prefix web3.js expects */
function encodeCompactSignatures(sigs: UmiTxSig[]): number[] {
  const count = sigs.length
  const bytes: number[] = []
  // Compact-u16 encoding for count
  if (count < 128) {
    bytes.push(count)
  } else {
    bytes.push((count & 0x7f) | 0x80, count >> 7)
  }
  for (const s of sigs) {
    bytes.push(...s.signature)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com'
const METADATA_BASE = 'https://solanaos.net/api/skills/nft-metadata'
const REGISTER_8004_URL = '/api/skills/register-8004'
const COLLECTION_STORAGE_KEY = 'solanaos-skills-collection-address'
const EXPLORER_BASE = 'https://explorer.solana.com'

// ---------------------------------------------------------------------------
// 8004 Registration helper
// ---------------------------------------------------------------------------

async function register8004(
  skillName: string,
  metaplexAssetAddress: string,
  ownerWallet: string,
): Promise<{ assetAddress: string; txSignature: string }> {
  const res = await fetch(REGISTER_8004_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillName, metaplexAssetAddress, ownerWallet }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(data?.message || `8004 registration failed (${res.status})`)
  }
  const data = await res.json()
  return { assetAddress: data.assetAddress, txSignature: data.txSignature }
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function MintSkillsPage() {
  const { isConnected, user } = usePhantom()
  const walletAddress = user?.addresses?.find((a) => a.addressType === AddressType.solana)?.address ?? null

  const [collectionAddress, setCollectionAddress] = useState<string>('')
  const [collectionInput, setCollectionInput] = useState('')
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [collectionError, setCollectionError] = useState<string | null>(null)
  const [mintStates, setMintStates] = useState<Record<string, SkillMintState>>({})
  const [batchMinting, setBatchMinting] = useState(false)
  const [enable8004, setEnable8004] = useState(true)
  const batchAbortRef = useRef(false)

  // Load saved collection address
  useEffect(() => {
    const saved = localStorage.getItem(COLLECTION_STORAGE_KEY)
    if (saved) {
      setCollectionAddress(saved)
      setCollectionInput(saved)
    }
  }, [])

  // ------- Create Collection -------
  const handleCreateCollection = useCallback(async () => {
    if (!walletAddress) return
    setCreatingCollection(true)
    setCollectionError(null)
    try {
      const umi = createUmi(MAINNET_RPC).use(mplCore())
      const signer = createPhantomUmiSigner(walletAddress)
      umi.use(signerIdentity(signer))

      const collectionSigner = generateSigner(umi)
      await createCollection(umi, {
        collection: collectionSigner,
        name: 'SolanaOS Skills',
        uri: `${METADATA_BASE}/collection`,
      }).sendAndConfirm(umi)

      const addr = collectionSigner.publicKey.toString()
      setCollectionAddress(addr)
      setCollectionInput(addr)
      localStorage.setItem(COLLECTION_STORAGE_KEY, addr)
    } catch (err: unknown) {
      setCollectionError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setCreatingCollection(false)
    }
  }, [walletAddress])

  // ------- Use existing collection -------
  const handleUseExisting = useCallback(() => {
    const trimmed = collectionInput.trim()
    if (!trimmed) return
    try {
      new PublicKey(trimmed) // validate
      setCollectionAddress(trimmed)
      localStorage.setItem(COLLECTION_STORAGE_KEY, trimmed)
    } catch {
      setCollectionError('Invalid Solana address')
    }
  }, [collectionInput])

  // ------- Mint single skill -------
  const mintSkill = useCallback(
    async (skill: SkillEntry) => {
      if (!walletAddress || !collectionAddress) return
      const name = skill.name

      setMintStates((prev) => ({
        ...prev,
        [name]: { status: 'minting' },
      }))

      let assetAddr = ''
      try {
        const umi = createUmi(MAINNET_RPC).use(mplCore())
        const signer = createPhantomUmiSigner(walletAddress)
        umi.use(signerIdentity(signer))

        const assetSigner = generateSigner(umi)
        const collectionPk = publicKey(collectionAddress)

        // Fetch collection to pass to create
        const collection = await fetchCollection(umi, collectionPk)

        const result = await createAsset(umi, {
          asset: assetSigner,
          collection,
          name: `SolanaOS: ${name}`,
          uri: `${METADATA_BASE}/${encodeURIComponent(name)}`,
        }).sendAndConfirm(umi)

        const sig = result.signature
        const sigStr =
          typeof sig === 'string'
            ? sig
            : sig instanceof Uint8Array
              ? Array.from(sig)
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('')
              : ''

        assetAddr = assetSigner.publicKey.toString()

        // Metaplex mint succeeded — update state before attempting 8004
        setMintStates((prev) => ({
          ...prev,
          [name]: {
            status: enable8004 ? 'registering' : 'done',
            txSignature: sigStr,
            assetAddress: assetAddr,
          },
        }))
      } catch (err: unknown) {
        setMintStates((prev) => ({
          ...prev,
          [name]: { status: 'error', error: err instanceof Error ? err.message : 'Mint failed' },
        }))
        return
      }

      // ------- 8004 Agent Registry -------
      if (enable8004 && assetAddr) {
        try {
          const reg = await register8004(name, assetAddr, walletAddress)
          setMintStates((prev) => ({
            ...prev,
            [name]: {
              ...prev[name],
              status: 'done',
              eightOhFourAsset: reg.assetAddress,
              eightOhFourTx: reg.txSignature,
            },
          }))
        } catch (err: unknown) {
          // 8004 failure is non-fatal — the Metaplex NFT is already minted
          setMintStates((prev) => ({
            ...prev,
            [name]: {
              ...prev[name],
              status: 'done',
              eightOhFourError: err instanceof Error ? err.message : '8004 registration failed',
            },
          }))
        }
      }
    },
    [walletAddress, collectionAddress, enable8004],
  )

  // ------- Batch mint all -------
  const handleMintAll = useCallback(async () => {
    if (!walletAddress || !collectionAddress) return
    setBatchMinting(true)
    batchAbortRef.current = false

    for (const skill of solanaOsCatalog.skills) {
      if (batchAbortRef.current) break
      const existing = mintStates[skill.name]
      if (existing?.status === 'done') continue
      await mintSkill(skill)
      // Small delay between mints to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1500))
    }
    setBatchMinting(false)
  }, [walletAddress, collectionAddress, mintSkill, mintStates])

  const handleStopBatch = useCallback(() => {
    batchAbortRef.current = true
  }, [])

  // ------- Stats -------
  const totalSkills = solanaOsCatalog.skills.length
  const mintedCount = Object.values(mintStates).filter((s) => s.status === 'done').length
  const errorCount = Object.values(mintStates).filter((s) => s.status === 'error').length

  return (
    <main className="section">
      <div className="setup-hero">
        <div className="setup-hero-copy">
          <span className="hero-badge">
            <Hexagon className="h-4 w-4" aria-hidden="true" />
            Metaplex Core + 8004 Registry
          </span>
          <h1 className="section-title">Mint Skills as NFTs</h1>
          <p className="hero-subtitle">
            Mint each SolanaOS skill as a Metaplex Core NFT on Solana mainnet
            and register it in the 8004 Trustless Agent Registry.
            Your connected wallet pays for each Metaplex mint (~0.003 SOL).
          </p>
        </div>
      </div>

      <div className="gallery-grid" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Step 1: Wallet */}
        <div className="gallery-panel">
          <h2 className="gallery-panel-title">
            <Package className="gallery-panel-icon" aria-hidden="true" />
            1. Connect Wallet
          </h2>
          {isConnected && walletAddress ? (
            <p className="gallery-copy-text" style={{ color: 'var(--color-success, #22c55e)' }}>
              Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          ) : (
            <p className="gallery-copy-text">Connect your Phantom wallet to continue.</p>
          )}
        </div>

        {/* Step 2: Collection */}
        <div className="gallery-panel">
          <h2 className="gallery-panel-title">
            <Hexagon className="gallery-panel-icon" aria-hidden="true" />
            2. Collection
          </h2>
          {collectionAddress ? (
            <div>
              <p className="gallery-copy-text" style={{ color: 'var(--color-success, #22c55e)' }}>
                Collection:{' '}
                <a
                  href={`${EXPLORER_BASE}/address/${collectionAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  {collectionAddress.slice(0, 8)}...{collectionAddress.slice(-6)}
                </a>
              </p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 8, fontSize: '0.8rem' }}
                onClick={() => {
                  setCollectionAddress('')
                  localStorage.removeItem(COLLECTION_STORAGE_KEY)
                }}
              >
                Change Collection
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!isConnected || creatingCollection}
                  onClick={handleCreateCollection}
                >
                  {creatingCollection ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create New Collection'
                  )}
                </button>
              </div>
              <p className="gallery-copy-text" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
                Or use an existing collection address:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Collection address..."
                  value={collectionInput}
                  onChange={(e) => setCollectionInput(e.target.value)}
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <button type="button" className="btn" onClick={handleUseExisting}>
                  Use
                </button>
              </div>
              {collectionError && (
                <p className="error" style={{ marginTop: 8, fontSize: '0.85rem' }}>
                  {collectionError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step 3: 8004 Registry */}
        <div className="gallery-panel">
          <h2 className="gallery-panel-title">
            <Shield className="gallery-panel-icon" aria-hidden="true" />
            3. 8004 Agent Registry
          </h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enable8004}
              onChange={(e) => setEnable8004(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#22c55e' }}
            />
            <span className="gallery-copy-text" style={{ margin: 0 }}>
              Register each skill in the 8004 Trustless Agent Registry after minting
            </span>
          </label>
          <p className="gallery-copy-text" style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 6 }}>
            {enable8004
              ? 'Each skill will be registered on-chain via a server-side factory wallet (~0.006 SOL each, paid by factory). Requires SOLANA_PRIVATE_KEY in env.'
              : '8004 registration disabled — only Metaplex Core NFTs will be minted.'}
          </p>
        </div>

        {/* Step 4: Mint */}
        <div className="gallery-panel">
          <h2 className="gallery-panel-title">
            <Rocket className="gallery-panel-icon" aria-hidden="true" />
            4. Mint Skills ({mintedCount}/{totalSkills})
          </h2>

          {errorCount > 0 && (
            <p className="gallery-copy-text" style={{ color: 'var(--color-error, #ef4444)', marginBottom: 8 }}>
              {errorCount} error{errorCount > 1 ? 's' : ''} — you can retry individual skills below.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {batchMinting ? (
              <button type="button" className="btn" onClick={handleStopBatch}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!isConnected || !collectionAddress || mintedCount === totalSkills}
                onClick={handleMintAll}
              >
                <Rocket className="h-4 w-4" aria-hidden="true" />
                Mint All ({totalSkills - mintedCount} remaining)
              </button>
            )}
          </div>

          {/* Skills list */}
          <div
            style={{
              display: 'grid',
              gap: 6,
              maxHeight: 500,
              overflowY: 'auto',
              paddingRight: 8,
            }}
          >
            {solanaOsCatalog.skills.map((skill) => {
              const state = mintStates[skill.name]
              return (
                <SkillRow
                  key={skill.name}
                  skill={skill}
                  state={state}
                  canMint={isConnected && Boolean(collectionAddress) && !batchMinting}
                  onMint={() => mintSkill(skill)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Skill Row
// ---------------------------------------------------------------------------

function SkillRow({
  skill,
  state,
  canMint,
  onMint,
}: {
  skill: SkillEntry
  state?: SkillMintState
  canMint: boolean
  onMint: () => void
}) {
  const status = state?.status ?? 'idle'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--color-surface, rgba(255,255,255,0.04))',
        fontSize: '0.9rem',
      }}
    >
      {/* Status icon */}
      {status === 'done' && <CheckCircle className="h-4 w-4" style={{ color: '#22c55e', flexShrink: 0 }} />}
      {status === 'error' && <XCircle className="h-4 w-4" style={{ color: '#ef4444', flexShrink: 0 }} />}
      {(status === 'minting' || status === 'registering') && (
        <Loader2 className="h-4 w-4 animate-spin" style={{ flexShrink: 0 }} />
      )}
      {status === 'idle' && <Package className="h-4 w-4" style={{ opacity: 0.4, flexShrink: 0 }} />}

      {/* Name */}
      <span style={{ flex: 1, fontFamily: 'monospace' }}>{skill.name}</span>

      {/* 8004 badge */}
      {state?.eightOhFourAsset && (
        <a
          href={`${EXPLORER_BASE}/address/${state.eightOhFourAsset}`}
          target="_blank"
          rel="noopener noreferrer"
          title="8004 Agent Registry"
          style={{ fontSize: '0.7rem', color: '#a78bfa', textDecoration: 'none' }}
        >
          8004
        </a>
      )}
      {state?.eightOhFourError && !state.eightOhFourAsset && (
        <span
          title={state.eightOhFourError}
          style={{ fontSize: '0.7rem', color: '#f59e0b', cursor: 'help' }}
        >
          8004!
        </span>
      )}

      {/* Size */}
      <span style={{ opacity: 0.5, fontSize: '0.8rem', minWidth: 60, textAlign: 'right' }}>
        {(skill.sizeBytes / 1024).toFixed(1)}KB
      </span>

      {/* Action */}
      {status === 'done' && state?.assetAddress ? (
        <a
          href={`${EXPLORER_BASE}/address/${state.assetAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.8rem', color: '#22c55e' }}
        >
          View
        </a>
      ) : status === 'error' ? (
        <button
          type="button"
          className="btn"
          style={{ fontSize: '0.75rem', padding: '2px 10px' }}
          disabled={!canMint}
          onClick={onMint}
          title={state?.error}
        >
          Retry
        </button>
      ) : status === 'minting' ? (
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Signing...</span>
      ) : status === 'registering' ? (
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>8004...</span>
      ) : (
        <button
          type="button"
          className="btn"
          style={{ fontSize: '0.75rem', padding: '2px 10px' }}
          disabled={!canMint}
          onClick={onMint}
        >
          Mint
        </button>
      )}
    </div>
  )
}
