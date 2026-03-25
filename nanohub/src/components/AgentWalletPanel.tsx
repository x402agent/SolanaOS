/**
 * AgentWalletPanel — Frontend for the NanoSolana agentic wallet vault.
 *
 * Connects to user's Phantom wallet, creates agent wallets (Solana + EVM)
 * in the Go vault, and syncs metadata to Convex for persistent storage.
 */
import { useMutation, useQuery } from 'convex/react'
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  Cloud,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Unlock,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { usePhantomState } from '../lib/phantomContext'
import {
  createVaultWallet,
  deleteVaultWallet,
  deploySandbox,
  getWalletBalance,
  pauseWallet,
  unpauseWallet,
  type DeploymentResult,
  type WalletBalance,
} from '../lib/agentWalletApi'

type AgentWallet = Doc<'agentWallets'>

function shortAddr(addr: string) {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

// ── Main Panel ───────────────────────────────────────────────────

export function AgentWalletPanel() {
  const { isConnected, address } = usePhantomState()
  const [showCreate, setShowCreate] = useState(false)

  if (!isConnected || !address) {
    return <ConnectPrompt />
  }

  return (
    <div className="agent-wallet-panel">
      <div className="agent-wallet-header">
        <div className="agent-wallet-header-left">
          <Shield size={20} />
          <h2>Agent Wallet Vault</h2>
        </div>
        <div className="agent-wallet-header-right">
          <span className="agent-wallet-owner-badge">
            <Wallet size={14} />
            {shortAddr(address)}
          </span>
          <button className="agent-wallet-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={16} />
            New Wallet
          </button>
        </div>
      </div>

      {showCreate && <CreateWalletForm ownerAddress={address} onCreated={() => setShowCreate(false)} />}

      <WalletList ownerAddress={address} />
    </div>
  )
}

// ── Connect Prompt ───────────────────────────────────────────────

function ConnectPrompt() {
  return (
    <div className="agent-wallet-connect">
      <div className="agent-wallet-connect-icon">
        <Lock size={48} />
      </div>
      <h2>Connect Phantom Wallet</h2>
      <p>Connect your Phantom wallet to create and manage agent wallets.</p>
      <p className="agent-wallet-connect-hint">
        Agent wallets are separate keypairs managed by the vault — your Phantom wallet is the owner key.
      </p>
    </div>
  )
}

// ── Create Wallet Form ───────────────────────────────────────────

function CreateWalletForm({
  ownerAddress,
  onCreated,
}: {
  ownerAddress: string
  onCreated: () => void
}) {
  const [label, setLabel] = useState('')
  const [chain, setChain] = useState<'solana' | 'evm'>('solana')
  const [chainId, setChainId] = useState(900)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const registerInConvex = useMutation(api.agentWallets.register)

  const evmChains = [
    { id: 8453, name: 'Base' },
    { id: 1, name: 'Ethereum' },
    { id: 42161, name: 'Arbitrum' },
    { id: 10, name: 'Optimism' },
    { id: 137, name: 'Polygon' },
  ]

  const handleCreate = async () => {
    if (!label.trim()) {
      setError('Label is required')
      return
    }
    setLoading(true)
    setError(null)

    try {
      // 1. Create in Go vault
      const selectedChainId = chain === 'solana' ? 900 : chainId
      const vaultWallet = await createVaultWallet(label, chain, selectedChainId)

      // 2. Register metadata in Convex
      await registerInConvex({
        ownerWalletAddress: ownerAddress,
        vaultWalletId: vaultWallet.id,
        label,
        address: vaultWallet.address,
        chainType: chain,
        chainId: selectedChainId,
      })

      setLabel('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-wallet-create-form">
      <h3>Create Agent Wallet</h3>

      <div className="agent-wallet-form-row">
        <label>Label</label>
        <input
          type="text"
          placeholder="e.g. Trading Bot, Sniper Agent..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="agent-wallet-input"
        />
      </div>

      <div className="agent-wallet-form-row">
        <label>Chain</label>
        <div className="agent-wallet-chain-select">
          <button
            className={`agent-wallet-chain-btn ${chain === 'solana' ? 'active' : ''}`}
            onClick={() => {
              setChain('solana')
              setChainId(900)
            }}
          >
            Solana
          </button>
          <button
            className={`agent-wallet-chain-btn ${chain === 'evm' ? 'active' : ''}`}
            onClick={() => {
              setChain('evm')
              setChainId(8453)
            }}
          >
            EVM
          </button>
        </div>
      </div>

      {chain === 'evm' && (
        <div className="agent-wallet-form-row">
          <label>Network</label>
          <select
            className="agent-wallet-input"
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
          >
            {evmChains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="agent-wallet-error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button className="agent-wallet-btn-primary" onClick={handleCreate} disabled={loading}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {loading ? 'Creating...' : 'Create Wallet'}
      </button>
    </div>
  )
}

// ── Wallet List ──────────────────────────────────────────────────

function WalletList({ ownerAddress }: { ownerAddress: string }) {
  const wallets = useQuery(api.agentWallets.listByOwner, { ownerWalletAddress: ownerAddress })

  if (wallets === undefined) {
    return (
      <div className="agent-wallet-loading">
        <Loader2 size={20} className="animate-spin" /> Loading wallets...
      </div>
    )
  }

  if (wallets.length === 0) {
    return (
      <div className="agent-wallet-empty">
        <Wallet size={32} />
        <p>No agent wallets yet. Create one to get started.</p>
      </div>
    )
  }

  return (
    <div className="agent-wallet-list">
      {wallets.map((w) => (
        <WalletCard key={w._id} wallet={w} />
      ))}
    </div>
  )
}

// ── Wallet Card ──────────────────────────────────────────────────

function WalletCard({ wallet }: { wallet: AgentWallet }) {
  const [expanded, setExpanded] = useState(false)
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [deployment, setDeployment] = useState<DeploymentResult | null>(null)
  const [copied, setCopied] = useState(false)

  const convexSetPaused = useMutation(api.agentWallets.setPaused)
  const convexUpdateBalance = useMutation(api.agentWallets.updateBalance)
  const convexSetDeployment = useMutation(api.agentWallets.setDeployment)
  const convexRemove = useMutation(api.agentWallets.remove)

  const chainLabel = wallet.chainType === 'solana' ? 'SOL' : chainName(wallet.chainId)

  const refreshBalance = useCallback(async () => {
    setBalanceLoading(true)
    try {
      const bal = await getWalletBalance(wallet.vaultWalletId)
      setBalance(bal)
      await convexUpdateBalance({
        vaultWalletId: wallet.vaultWalletId,
        lastBalanceSol: bal.sol,
        lastBalanceWei: bal.wei,
      })
    } catch {
      // silently fail
    } finally {
      setBalanceLoading(false)
    }
  }, [wallet.vaultWalletId, convexUpdateBalance])

  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  const handleCopy = () => {
    copyToClipboard(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTogglePause = async () => {
    setActionLoading(true)
    try {
      if (wallet.paused) {
        await unpauseWallet(wallet.vaultWalletId)
      } else {
        await pauseWallet(wallet.vaultWalletId)
      }
      await convexSetPaused({
        vaultWalletId: wallet.vaultWalletId,
        ownerWalletAddress: wallet.ownerWalletAddress,
        paused: !wallet.paused,
      })
    } catch {
      // error handling
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeploy = async () => {
    setActionLoading(true)
    try {
      const dep = await deploySandbox(wallet.vaultWalletId)
      setDeployment(dep)
      await convexSetDeployment({
        vaultWalletId: wallet.vaultWalletId,
        deploymentSandboxId: dep.sandbox_id,
        deploymentApiUrl: dep.api_url,
      })
    } catch {
      // error handling
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this agent wallet? This cannot be undone.')) return
    setActionLoading(true)
    try {
      await deleteVaultWallet(wallet.vaultWalletId)
      await convexRemove({
        vaultWalletId: wallet.vaultWalletId,
        ownerWalletAddress: wallet.ownerWalletAddress,
      })
    } catch {
      // error handling
    } finally {
      setActionLoading(false)
    }
  }

  const balanceDisplay = balance
    ? wallet.chainType === 'solana'
      ? `${(balance.sol ?? 0).toFixed(4)} SOL`
      : `${Number(balance.balance ?? '0').toFixed(6)} ${nativeToken(wallet.chainId)}`
    : wallet.lastBalanceSol != null
      ? `${wallet.lastBalanceSol.toFixed(4)} SOL`
      : '—'

  return (
    <div className={`agent-wallet-card ${wallet.paused ? 'paused' : ''}`}>
      <div className="agent-wallet-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="agent-wallet-card-left">
          <span className={`agent-wallet-chain-badge ${wallet.chainType}`}>{chainLabel}</span>
          <div className="agent-wallet-card-info">
            <span className="agent-wallet-card-label">{wallet.label}</span>
            <span className="agent-wallet-card-address">
              {shortAddr(wallet.address)}
              <button className="agent-wallet-icon-btn" onClick={(e) => { e.stopPropagation(); handleCopy() }}>
                {copied ? '✓' : <Copy size={12} />}
              </button>
            </span>
          </div>
        </div>
        <div className="agent-wallet-card-right">
          <span className="agent-wallet-card-balance">
            {balanceLoading ? <Loader2 size={14} className="animate-spin" /> : balanceDisplay}
          </span>
          {wallet.paused && (
            <span className="agent-wallet-paused-badge">
              <Pause size={12} /> Paused
            </span>
          )}
          {wallet.deploymentApiUrl && (
            <span className="agent-wallet-deployed-badge">
              <Cloud size={12} /> Deployed
            </span>
          )}
          <ChevronDown
            size={16}
            className={`agent-wallet-chevron ${expanded ? 'expanded' : ''}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="agent-wallet-card-body">
          <div className="agent-wallet-detail-grid">
            <div className="agent-wallet-detail">
              <span className="agent-wallet-detail-label">Address</span>
              <span className="agent-wallet-detail-value mono">{wallet.address}</span>
            </div>
            <div className="agent-wallet-detail">
              <span className="agent-wallet-detail-label">Vault ID</span>
              <span className="agent-wallet-detail-value mono">{wallet.vaultWalletId}</span>
            </div>
            <div className="agent-wallet-detail">
              <span className="agent-wallet-detail-label">Chain</span>
              <span className="agent-wallet-detail-value">
                {wallet.chainType === 'solana' ? 'Solana Mainnet' : `${chainName(wallet.chainId)} (${wallet.chainId})`}
              </span>
            </div>
            <div className="agent-wallet-detail">
              <span className="agent-wallet-detail-label">Created</span>
              <span className="agent-wallet-detail-value">
                {new Date(wallet.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {wallet.deploymentApiUrl && (
            <div className="agent-wallet-deployment-info">
              <Cloud size={14} />
              <span>E2B Sandbox: </span>
              <code>{wallet.deploymentApiUrl}</code>
            </div>
          )}

          <div className="agent-wallet-actions">
            <button className="agent-wallet-action-btn" onClick={refreshBalance} disabled={balanceLoading}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="agent-wallet-action-btn" onClick={handleTogglePause} disabled={actionLoading}>
              {wallet.paused ? <><Play size={14} /> Unpause</> : <><Pause size={14} /> Pause</>}
            </button>
            <button className="agent-wallet-action-btn" onClick={handleDeploy} disabled={actionLoading}>
              <Cloud size={14} /> Deploy to E2B
            </button>
            <a
              className="agent-wallet-action-btn"
              href={explorerUrl(wallet)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} /> Explorer
            </a>
            <button className="agent-wallet-action-btn danger" onClick={handleDelete} disabled={actionLoading}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function chainName(chainId: number) {
  const names: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    42161: 'Arbitrum',
    10: 'Optimism',
    137: 'Polygon',
    56: 'BSC',
    900: 'Solana',
  }
  return names[chainId] ?? `Chain ${chainId}`
}

function nativeToken(chainId: number) {
  const tokens: Record<number, string> = {
    1: 'ETH', 8453: 'ETH', 42161: 'ETH', 10: 'ETH', 137: 'POL', 56: 'BNB', 900: 'SOL',
  }
  return tokens[chainId] ?? 'ETH'
}

function explorerUrl(wallet: AgentWallet) {
  if (wallet.chainType === 'solana') {
    return `https://solscan.io/account/${wallet.address}`
  }
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com',
  }
  const base = explorers[wallet.chainId] ?? 'https://etherscan.io'
  return `${base}/address/${wallet.address}`
}
