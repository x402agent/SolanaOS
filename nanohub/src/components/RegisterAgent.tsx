/**
 * RegisterAgent — Self-service agent registration using connected Phantom wallet.
 * User fills form → backend pins to IPFS + builds unsigned tx → Phantom signs → on-chain.
 */
import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Wallet, Loader2, ExternalLink, CheckCircle } from 'lucide-react'

type Step = 'form' | 'signing' | 'confirming' | 'done' | 'error'

export function RegisterAgent({ walletAddress, onComplete }: {
  walletAddress: string
  onComplete?: (assetAddress: string) => void
}) {
  const prepareRegistration = useAction(api.nanosolanaAgentsSelfRegister.prepareRegistration)
  const confirmRegistration = useAction(api.nanosolanaAgentsSelfRegister.confirmRegistration)

  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ assetAddress: string; metadataUri: string; cluster: string } | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUri, setImageUri] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [a2aUrl, setA2aUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [atomEnabled, setAtomEnabled] = useState(true)

  const handleRegister = async () => {
    if (!name.trim() || !description.trim()) {
      setError('Name and description are required')
      return
    }

    setStep('signing')
    setError('')

    try {
      // Step 1: Prepare — backend pins metadata, builds unsigned tx
      const prepared = await prepareRegistration({
        walletAddress,
        name: name.trim(),
        description: description.trim(),
        imageUri: imageUri.trim() || undefined,
        mcpUrl: mcpUrl.trim() || undefined,
        a2aUrl: a2aUrl.trim() || undefined,
        website: website.trim() || undefined,
        atomEnabled,
      })

      if (!prepared.transaction) {
        throw new Error('No transaction returned from backend')
      }

      // Step 2: Sign with Phantom
      const provider = (window as any).phantom?.solana
      if (!provider?.isConnected) {
        throw new Error('Phantom wallet not connected. Please connect first.')
      }

      // Decode the base64 transaction
      const txBytes = Uint8Array.from(atob(prepared.transaction), c => c.charCodeAt(0))

      // Import VersionedTransaction to deserialize
      const { VersionedTransaction } = await import('@solana/web3.js')
      const tx = VersionedTransaction.deserialize(txBytes)

      // Sign and send via Phantom
      const signed = await provider.signAndSendTransaction(tx)
      const txSignature = signed.signature || signed

      setStep('confirming')

      // Step 3: Confirm — tell backend the tx landed
      // The asset address is typically returned in the prepare step or derived from the tx
      // For 8004, the asset is a PDA derived from the registration
      const assetAddress = prepared.metadataCid // placeholder — real asset comes from tx logs

      await confirmRegistration({
        pendingId: prepared.pendingId,
        txSignature: typeof txSignature === 'string' ? txSignature : Buffer.from(txSignature).toString('base64'),
        assetAddress,
      })

      const finalResult = {
        assetAddress,
        metadataUri: prepared.metadataUri,
        cluster: prepared.cluster,
      }
      setResult(finalResult)
      setStep('done')
      onComplete?.(assetAddress)

    } catch (err: any) {
      setError(err?.message || err?.data || 'Registration failed')
      setStep('error')
    }
  }

  if (step === 'done' && result) {
    return (
      <div className="space-y-4 p-6 rounded-xl border border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="h-5 w-5" />
          <h3 className="font-bold">Agent Registered On-Chain!</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">IPFS:</span>
            <span className="text-white font-mono text-xs">{result.metadataUri}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Network:</span>
            <span className="text-white">{result.cluster}</span>
          </div>
        </div>
        <a
          href={`https://explorer.solana.com/address/${result.assetAddress}${result.cluster !== 'mainnet-beta' ? `?cluster=${result.cluster}` : ''}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          View on Solana Explorer <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    )
  }

  if (step === 'signing' || step === 'confirming') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <p className="text-sm text-gray-400">
          {step === 'signing' ? 'Waiting for Phantom to sign...' : 'Confirming on-chain...'}
        </p>
        <p className="text-xs text-gray-600">
          {step === 'signing'
            ? 'Approve the transaction in your Phantom wallet'
            : 'Verifying the transaction landed on Solana'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="h-5 w-5 text-[#14f195]" />
        <h3 className="font-bold text-white">Register Agent On-Chain</h3>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Register your agent on the 8004 Trustless Agent Registry using your connected Phantom wallet.
        You pay the transaction fee (~0.007 SOL). Metadata is pinned to IPFS automatically.
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
          {step === 'error' && (
            <button onClick={() => setStep('form')} className="ml-2 text-blue-400 hover:underline text-xs">
              Try again
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Agent Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Solana Agent"
            maxLength={64}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your agent do?"
            maxLength={800}
            rows={3}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Image URL</label>
            <input
              type="url"
              value={imageUri}
              onChange={(e) => setImageUri(e.target.value)}
              placeholder="https://... or ipfs://..."
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://myagent.com"
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">MCP Endpoint</label>
            <input
              type="url"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="https://myagent.com/mcp"
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">A2A Endpoint</label>
            <input
              type="url"
              value={a2aUrl}
              onChange={(e) => setA2aUrl(e.target.value)}
              placeholder="https://myagent.com/a2a"
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="atom-enabled"
            checked={atomEnabled}
            onChange={(e) => setAtomEnabled(e.target.checked)}
            className="rounded border-white/20"
          />
          <label htmlFor="atom-enabled" className="text-xs text-gray-400">
            Enable ATOM reputation engine (recommended)
          </label>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">
          Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} · Cost: ~0.007 SOL
        </span>
        <button
          onClick={handleRegister}
          disabled={!name.trim() || !description.trim()}
          className="btn btn-primary flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          Register & Sign
        </button>
      </div>
    </div>
  )
}

export default RegisterAgent
