/**
 * Client library for the NanoSolana Agent Wallet Go API.
 * Talks to the vault backend at VITE_WALLET_API_URL.
 */

const WALLET_API_URL =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WALLET_API_URL : '') ||
  'http://localhost:8421/v1'

const WALLET_API_KEY =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WALLET_API_KEY : '') || ''

async function walletFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }
  if (WALLET_API_KEY) {
    headers['Authorization'] = `Bearer ${WALLET_API_KEY}`
  }

  const res = await fetch(`${WALLET_API_URL}${path}`, { ...init, headers })
  const data = await res.json()

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as T
}

// ── Types ────────────────────────────────────────────────────────

export type VaultWallet = {
  id: string
  label: string
  chain: 'solana' | 'evm'
  chain_id: number
  address: string
  paused: boolean
  created_at: string
}

export type WalletBalance = {
  address: string
  chain: string
  chain_id?: number
  lamports?: number
  sol?: number
  wei?: string
  balance?: string
}

export type TransferResult = {
  signature?: string
  tx_hash?: string
  from: string
  to: string
  amount: string
  chain: string
}

export type SignResult = {
  signature: string
  address: string
}

export type ChainInfo = {
  chain_id: number
  name: string
  type: string
  native: string
  decimals: number
  active: boolean
}

export type DeploymentResult = {
  sandbox_id: string
  agent_id: string
  api_url: string
  status: string
  created_at: string
  expires_at: string
}

// ── Wallet CRUD ──────────────────────────────────────────────────

export async function createVaultWallet(
  label: string,
  chain: 'solana' | 'evm',
  chainId?: number,
): Promise<VaultWallet> {
  return walletFetch('/wallets', {
    method: 'POST',
    body: JSON.stringify({ label, chain, chain_id: chainId ?? (chain === 'solana' ? 900 : 8453) }),
  })
}

export async function listVaultWallets(): Promise<VaultWallet[]> {
  return walletFetch('/wallets')
}

export async function getVaultWallet(id: string): Promise<VaultWallet> {
  return walletFetch(`/wallets/${id}`)
}

export async function deleteVaultWallet(id: string): Promise<{ deleted: boolean }> {
  return walletFetch(`/wallets/${id}`, { method: 'DELETE' })
}

// ── Balance & Operations ─────────────────────────────────────────

export async function getWalletBalance(id: string, chainId?: number): Promise<WalletBalance> {
  const params = chainId ? `?chain_id=${chainId}` : ''
  return walletFetch(`/wallets/${id}/balance${params}`)
}

export async function transferNative(
  id: string,
  to: string,
  amount: string,
  chainId?: number,
): Promise<TransferResult> {
  return walletFetch(`/wallets/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ to, amount, chain_id: chainId }),
  })
}

export async function signMessage(id: string, message: string): Promise<SignResult> {
  return walletFetch(`/wallets/${id}/sign`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export async function pauseWallet(id: string): Promise<{ paused: boolean }> {
  return walletFetch(`/wallets/${id}/pause`, { method: 'POST' })
}

export async function unpauseWallet(id: string): Promise<{ paused: boolean }> {
  return walletFetch(`/wallets/${id}/unpause`, { method: 'POST' })
}

// ── Chain Info ───────────────────────────────────────────────────

export async function getChains(): Promise<ChainInfo[]> {
  return walletFetch('/chains')
}

// ── E2B Deployment ───────────────────────────────────────────────

export async function deploySandbox(
  agentId?: string,
  env?: Record<string, string>,
): Promise<DeploymentResult> {
  return walletFetch('/deploy', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId ?? '', env: env ?? {} }),
  })
}

export async function listDeployments(): Promise<DeploymentResult[]> {
  return walletFetch('/deployments')
}

export async function teardownSandbox(agentId: string): Promise<{ torn_down: boolean }> {
  return walletFetch(`/deployments/${agentId}`, { method: 'DELETE' })
}
