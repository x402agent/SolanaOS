/**
 * SolanaOS Agent Wallet — Cloudflare Worker
 *
 * Deployable agentic wallet vault on the edge.
 * AES-256-GCM encrypted keys in KV, Solana + EVM support,
 * Privy managed wallets, E2B sandbox deployment.
 *
 * Uses raw JSON-RPC + tweetnacl (no heavy @solana/web3.js).
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

// ── Types ────────────────────────────────────────────────────────

type Env = {
  VAULT_KV: KVNamespace
  VAULT_PASSPHRASE: string
  WALLET_API_KEY: string
  SOLANA_RPC_URL: string
  PRIVY_APP_ID: string
  PRIVY_APP_SECRET: string
  PRIVY_AUTH_KEY_ID: string
  E2B_API_KEY: string
  ENVIRONMENT: string
}

type WalletEntry = {
  id: string
  label: string
  chainType: 'solana' | 'evm'
  chainId: number
  address: string
  encryptedKey: string
  iv: string
  paused: boolean
  createdAt: number
}

type WalletIndex = { walletIds: string[] }

// ── App ──────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Auth middleware
app.use('/v1/*', async (c, next) => {
  if (c.req.path === '/v1/health' || c.req.path === '/v1/chains') return next()
  const apiKey = c.env.WALLET_API_KEY
  if (apiKey) {
    const auth = c.req.header('Authorization')
    if (auth !== `Bearer ${apiKey}`) return c.json({ error: 'unauthorized' }, 401)
  }
  return next()
})

// ── Crypto ───────────────────────────────────────────────────────

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(passphrase)
  const hash = await crypto.subtle.digest('SHA-256', raw)
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptBytes(plain: Uint8Array, passphrase: string): Promise<{ ct: string; iv: string }> {
  const key = await deriveKey(passphrase)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return {
    ct: uint8ToB64(new Uint8Array(enc)),
    iv: uint8ToB64(iv),
  }
}

async function decryptBytes(ct: string, iv: string, passphrase: string): Promise<Uint8Array> {
  const key = await deriveKey(passphrase)
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToUint8(iv) },
    key,
    b64ToUint8(ct),
  )
  return new Uint8Array(dec)
}

function uint8ToB64(arr: Uint8Array): string {
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s)
}

function b64ToUint8(b64: string): Uint8Array {
  const s = atob(b64)
  const arr = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i)
  return arr
}

function genId(): string {
  const b = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
}

// ── KV ───────────────────────────────────────────────────────────

async function kvGetIndex(kv: KVNamespace): Promise<WalletIndex> {
  const r = await kv.get('wallet:index')
  return r ? JSON.parse(r) : { walletIds: [] }
}
async function kvPutIndex(kv: KVNamespace, idx: WalletIndex) {
  await kv.put('wallet:index', JSON.stringify(idx))
}
async function kvGetWallet(kv: KVNamespace, id: string): Promise<WalletEntry | null> {
  const r = await kv.get(`wallet:${id}`)
  return r ? JSON.parse(r) : null
}
async function kvPutWallet(kv: KVNamespace, w: WalletEntry) {
  await kv.put(`wallet:${w.id}`, JSON.stringify(w))
}
async function kvDelWallet(kv: KVNamespace, id: string) {
  await kv.delete(`wallet:${id}`)
}

// ── Solana RPC (raw fetch) ───────────────────────────────────────

async function solanaRpc(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const urls = [
    'https://proportionate-indulgent-panorama.solana-mainnet.quiknode.pro/b6c14422eed1274554043c319623200d332e9c1f',
    'https://mainnet.helius-rpc.com/?api-key=2a3dc9c0-6946-4116-a9eb-8b19250df9a3',
    rpcUrl,
    'https://api.mainnet-beta.solana.com',
  ]
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json() as { result?: any; error?: { message: string } }
      if (data.error) throw new Error(data.error.message)
      return data.result
    } catch (e) {
      if (url === urls[urls.length - 1]) throw e
      // fallback to next RPC
    }
  }
}

// ── Routes ───────────────────────────────────────────────────────

app.get('/', (c) => c.json({
  service: 'solanaos-agent-wallet',
  version: '1.0.0',
  runtime: 'cloudflare-workers',
  chains: ['solana', 'evm'],
}))

app.get('/v1/health', async (c) => {
  const idx = await kvGetIndex(c.env.VAULT_KV)
  return c.json({
    status: 'ok',
    wallets: idx.walletIds.length,
    runtime: 'cloudflare-workers',
    solana_rpc: !!c.env.SOLANA_RPC_URL,
    privy: !!c.env.PRIVY_APP_ID,
    e2b: !!c.env.E2B_API_KEY,
  })
})

// ── CRUD ─────────────────────────────────────────────────────────

app.post('/v1/wallets', async (c) => {
  const { label = '', chain = 'solana', chain_id } = await c.req.json<any>()
  const chainType = chain as 'solana' | 'evm'
  const chainId = chain_id ?? (chainType === 'solana' ? 900 : 8453)
  const id = genId()

  let address: string
  let privBytes: Uint8Array

  if (chainType === 'solana') {
    const kp = nacl.sign.keyPair()
    address = bs58.encode(kp.publicKey)
    privBytes = kp.secretKey // 64 bytes
  } else {
    privBytes = crypto.getRandomValues(new Uint8Array(32))
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', privBytes))
    address = '0x' + Array.from(hash.slice(12)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const { ct, iv } = await encryptBytes(privBytes, c.env.VAULT_PASSPHRASE)

  const w: WalletEntry = { id, label, chainType, chainId, address, encryptedKey: ct, iv, paused: false, createdAt: Date.now() }
  await kvPutWallet(c.env.VAULT_KV, w)

  const idx = await kvGetIndex(c.env.VAULT_KV)
  idx.walletIds.push(id)
  await kvPutIndex(c.env.VAULT_KV, idx)

  return c.json({ id, address, chain: chainType, chain_id: chainId, label })
})

app.get('/v1/wallets', async (c) => {
  const idx = await kvGetIndex(c.env.VAULT_KV)
  const wallets = (await Promise.all(idx.walletIds.map(id => kvGetWallet(c.env.VAULT_KV, id)))).filter(Boolean)
  return c.json(wallets.map(w => ({
    id: w!.id, label: w!.label, chain: w!.chainType, chain_id: w!.chainId,
    address: w!.address, paused: w!.paused, created_at: new Date(w!.createdAt).toISOString(),
  })))
})

app.get('/v1/wallets/:id', async (c) => {
  const w = await kvGetWallet(c.env.VAULT_KV, c.req.param('id'))
  if (!w) return c.json({ error: 'not found' }, 404)
  return c.json({ id: w.id, label: w.label, chain: w.chainType, chain_id: w.chainId, address: w.address, paused: w.paused, created_at: new Date(w.createdAt).toISOString() })
})

app.delete('/v1/wallets/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await kvGetWallet(c.env.VAULT_KV, id))) return c.json({ error: 'not found' }, 404)
  await kvDelWallet(c.env.VAULT_KV, id)
  const idx = await kvGetIndex(c.env.VAULT_KV)
  idx.walletIds = idx.walletIds.filter(x => x !== id)
  await kvPutIndex(c.env.VAULT_KV, idx)
  return c.json({ deleted: true })
})

// ── Balance ──────────────────────────────────────────────────────

app.get('/v1/wallets/:id/balance', async (c) => {
  const w = await kvGetWallet(c.env.VAULT_KV, c.req.param('id'))
  if (!w) return c.json({ error: 'not found' }, 404)

  if (w.chainType === 'solana') {
    try {
      const rpc = c.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
      const result = await solanaRpc(rpc, 'getBalance', [w.address, { commitment: 'confirmed' }])
      const lamports = result?.value ?? result ?? 0
      return c.json({ address: w.address, chain: 'solana', lamports, sol: lamports / 1e9 })
    } catch (e: any) {
      return c.json({ error: e.message }, 502)
    }
  } else {
    const chainId = parseInt(c.req.query('chain_id') || '') || w.chainId
    const rpcUrl = evmRpc(chainId)
    if (!rpcUrl) return c.json({ error: `no RPC for chain ${chainId}` }, 400)
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [w.address, 'latest'] }),
      })
      const data = await res.json() as { result?: string }
      const wei = BigInt(data.result || '0x0')
      return c.json({ address: w.address, chain: 'evm', chain_id: chainId, wei: wei.toString(), balance: fmtWei(wei) })
    } catch (e: any) {
      return c.json({ error: e.message }, 502)
    }
  }
})

// ── Transfer (Solana) ────────────────────────────────────────────

app.post('/v1/wallets/:id/transfer', async (c) => {
  const w = await kvGetWallet(c.env.VAULT_KV, c.req.param('id'))
  if (!w) return c.json({ error: 'not found' }, 404)
  if (w.paused) return c.json({ error: 'wallet is paused' }, 403)

  const { to, amount } = await c.req.json<{ to: string; amount: string }>()
  const privKey = await decryptBytes(w.encryptedKey, w.iv, c.env.VAULT_PASSPHRASE)

  if (w.chainType === 'solana') {
    try {
      const rpc = c.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
      const lamports = Math.round(parseFloat(amount) * 1e9)
      const fromPub = bs58.decode(w.address)
      const toPub = bs58.decode(to)

      // Get recent blockhash
      const bhResult = await solanaRpc(rpc, 'getLatestBlockhash', [{ commitment: 'confirmed' }])
      const blockhash = bhResult.value.blockhash

      // Build raw transfer instruction + transaction
      const txBytes = buildSolTransferTx(fromPub, toPub, lamports, bs58.decode(blockhash))

      // Sign
      const sig = nacl.sign.detached(txBytes, privKey)

      // Assemble signed tx: 1 signature + tx message
      const signedTx = new Uint8Array(1 + 64 + txBytes.length)
      signedTx[0] = 1 // compact-u16: 1 signature
      signedTx.set(sig, 1)
      signedTx.set(txBytes, 65)

      // Send
      const b64Tx = uint8ToB64(signedTx)
      const sendResult = await solanaRpc(rpc, 'sendTransaction', [b64Tx, { encoding: 'base64', preflightCommitment: 'confirmed' }])

      return c.json({ signature: sendResult, from: w.address, to, amount, chain: 'solana' })
    } catch (e: any) {
      return c.json({ error: e.message }, 500)
    }
  }

  return c.json({ error: 'EVM transfers: use Privy wallets at /v1/privy/wallets/:id/send' }, 501)
})

// ── Sign ─────────────────────────────────────────────────────────

app.post('/v1/wallets/:id/sign', async (c) => {
  const w = await kvGetWallet(c.env.VAULT_KV, c.req.param('id'))
  if (!w) return c.json({ error: 'not found' }, 404)
  if (w.paused) return c.json({ error: 'wallet is paused' }, 403)

  const { message } = await c.req.json<{ message: string }>()
  const privKey = await decryptBytes(w.encryptedKey, w.iv, c.env.VAULT_PASSPHRASE)

  if (w.chainType === 'solana') {
    const msgBytes = new TextEncoder().encode(message)
    const sig = nacl.sign.detached(msgBytes, privKey)
    return c.json({ signature: bs58.encode(sig), address: w.address })
  } else {
    const msgBytes = new TextEncoder().encode(message)
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', msgBytes))
    return c.json({ hash: '0x' + Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''), address: w.address })
  }
})

// ── Pause / Unpause ──────────────────────────────────────────────

app.post('/v1/wallets/:id/pause', async (c) => {
  const w = await kvGetWallet(c.env.VAULT_KV, c.req.param('id'))
  if (!w) return c.json({ error: 'not found' }, 404)
  w.paused = true
  await kvPutWallet(c.env.VAULT_KV, w)
  return c.json({ paused: true })
})

app.post('/v1/wallets/:id/unpause', async (c) => {
  const w = await kvGetWallet(c.env.VAULT_KV, c.req.param('id'))
  if (!w) return c.json({ error: 'not found' }, 404)
  w.paused = false
  await kvPutWallet(c.env.VAULT_KV, w)
  return c.json({ paused: false })
})

// ── Privy Proxy ──────────────────────────────────────────────────

function privyHeaders(env: Env): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'privy-app-id': env.PRIVY_APP_ID,
    'Authorization': 'Basic ' + btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`),
  }
}

app.post('/v1/privy/wallets', async (c) => {
  if (!c.env.PRIVY_APP_ID) return c.json({ error: 'Privy not configured' }, 503)
  const body = await c.req.json<{ chain_type?: string }>()
  const r = await fetch('https://api.privy.io/v1/wallets', { method: 'POST', headers: privyHeaders(c.env), body: JSON.stringify({ chain_type: body.chain_type || 'ethereum' }) })
  return c.json(await r.json(), r.status as any)
})

app.get('/v1/privy/wallets', async (c) => {
  if (!c.env.PRIVY_APP_ID) return c.json({ error: 'Privy not configured' }, 503)
  const ct = c.req.query('chain_type')
  const path = ct ? `/v1/wallets?chain_type=${ct}` : '/v1/wallets'
  const r = await fetch(`https://api.privy.io${path}`, { headers: privyHeaders(c.env) })
  return c.json(await r.json(), r.status as any)
})

app.post('/v1/privy/wallets/:id/sign', async (c) => {
  if (!c.env.PRIVY_APP_ID) return c.json({ error: 'Privy not configured' }, 503)
  const { message, chain_type } = await c.req.json<{ message: string; chain_type?: string }>()
  const rpcBody = chain_type === 'solana'
    ? { chain_type: 'solana', method: 'signMessage', params: { message, encoding: 'base64' } }
    : { method: 'personal_sign', params: { message } }
  const r = await fetch(`https://api.privy.io/v1/wallets/${c.req.param('id')}/rpc`, { method: 'POST', headers: privyHeaders(c.env), body: JSON.stringify(rpcBody) })
  return c.json(await r.json(), r.status as any)
})

app.post('/v1/privy/wallets/:id/send', async (c) => {
  if (!c.env.PRIVY_APP_ID) return c.json({ error: 'Privy not configured' }, 503)
  const body = await c.req.json<any>()
  let rpcBody: any
  if (body.chain_type === 'solana') {
    rpcBody = { method: 'signAndSendTransaction', caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', params: { transaction: body.data, encoding: 'base64' } }
  } else {
    rpcBody = { method: 'eth_sendTransaction', params: { transaction: { to: body.to, value: body.value || '0', data: body.data || '' } } }
    if (body.chain_id) rpcBody.caip2 = `eip155:${body.chain_id}`
  }
  const r = await fetch(`https://api.privy.io/v1/wallets/${c.req.param('id')}/rpc`, { method: 'POST', headers: privyHeaders(c.env), body: JSON.stringify(rpcBody) })
  return c.json(await r.json(), r.status as any)
})

// ── E2B Deploy ───────────────────────────────────────────────────

app.post('/v1/deploy', async (c) => {
  if (!c.env.E2B_API_KEY) return c.json({ error: 'E2B not configured' }, 503)
  const body = await c.req.json<{ agent_id?: string }>()
  const r = await fetch('https://api.e2b.dev/sandboxes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': c.env.E2B_API_KEY },
    body: JSON.stringify({ templateID: 'base', timeout: 600 }),
  })
  const sb = await r.json() as { sandboxID?: string }
  return c.json({ sandbox_id: sb.sandboxID, agent_id: body.agent_id || genId(), api_url: `https://${sb.sandboxID}-8420.e2b.dev`, status: 'running', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString() })
})

app.get('/v1/deployments', (c) => c.json([]))
app.delete('/v1/deployments/:id', (c) => c.json({ torn_down: true, agent_id: c.req.param('id') }))

// ── Chains ───────────────────────────────────────────────────────

app.get('/v1/chains', (c) => c.json([
  { chain_id: 900, name: 'Solana', type: 'solana', native: 'SOL', decimals: 9, active: true },
  { chain_id: 1, name: 'Ethereum', type: 'evm', native: 'ETH', decimals: 18, active: true },
  { chain_id: 8453, name: 'Base', type: 'evm', native: 'ETH', decimals: 18, active: true },
  { chain_id: 42161, name: 'Arbitrum', type: 'evm', native: 'ETH', decimals: 18, active: true },
  { chain_id: 10, name: 'Optimism', type: 'evm', native: 'ETH', decimals: 18, active: true },
  { chain_id: 137, name: 'Polygon', type: 'evm', native: 'POL', decimals: 18, active: true },
  { chain_id: 56, name: 'BSC', type: 'evm', native: 'BNB', decimals: 18, active: true },
]))

// ── Solana TX Builder (minimal, no web3.js) ──────────────────────

function buildSolTransferTx(from: Uint8Array, to: Uint8Array, lamports: number, blockhash: Uint8Array): Uint8Array {
  // System program transfer instruction
  // program_id = 11111111111111111111111111111111 (all zeros in 32 bytes)
  const sysProg = new Uint8Array(32) // all zeros = system program

  // Transfer instruction data: u32 index (2) + u64 lamports
  const instrData = new Uint8Array(12)
  const dv = new DataView(instrData.buffer)
  dv.setUint32(0, 2, true) // SystemInstruction::Transfer = 2
  // Write lamports as u64 LE
  dv.setUint32(4, lamports & 0xffffffff, true)
  dv.setUint32(8, Math.floor(lamports / 0x100000000), true)

  // Message: header + accounts + blockhash + instructions
  const numSigs = 1
  const numReadonlySigned = 0
  const numReadonlyUnsigned = 1 // system program

  // accounts: [from (signer+writable), to (writable), system_program (readonly)]
  const msg: number[] = []
  // Header
  msg.push(numSigs, numReadonlySigned, numReadonlyUnsigned)
  // Account keys (3 × 32 bytes)
  msg.push(...from)
  msg.push(...to)
  msg.push(...sysProg)
  // Recent blockhash (32 bytes)
  msg.push(...blockhash)
  // Instructions count (compact-u16)
  msg.push(1)
  // Instruction: program_id_index, accounts, data
  msg.push(2) // program ID index (system program is index 2)
  msg.push(2) // num account indices
  msg.push(0) // from account index
  msg.push(1) // to account index
  msg.push(instrData.length) // data length
  msg.push(...instrData)

  return new Uint8Array(msg)
}

// ── EVM Helpers ──────────────────────────────────────────────────

function evmRpc(chainId: number): string | null {
  const rpcs: Record<number, string> = {
    1: 'https://eth.llamarpc.com',
    8453: 'https://mainnet.base.org',
    42161: 'https://arb1.arbitrum.io/rpc',
    10: 'https://mainnet.optimism.io',
    137: 'https://polygon-rpc.com',
    56: 'https://bsc-dataseed.binance.org',
  }
  return rpcs[chainId] || null
}

function fmtWei(wei: bigint): string {
  const w = wei / 1000000000000000000n
  const f = (wei % 1000000000000000000n).toString().padStart(18, '0').slice(0, 6)
  return `${w}.${f}`
}

export default app
