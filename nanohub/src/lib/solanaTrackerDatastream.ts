/**
 * Lightweight Solana Tracker datastream client.
 * Provides real-time price, volume, trade, and holder updates via WebSocket.
 */

type Callback<T = any> = (data: T) => void
type Unsubscribe = () => void

interface Subscription {
  channel: string
  callbacks: Set<Callback>
}

class SolanaTrackerDatastream {
  private ws: WebSocket | null = null
  private wsUrl: string
  private subscriptions = new Map<string, Subscription>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl
  }

  connect() {
    if (this.ws) return
    this.ws = new WebSocket(this.wsUrl)

    this.ws.onopen = () => {
      this.connected = true
      // Re-subscribe all channels
      for (const [, sub] of this.subscriptions) {
        this.sendSubscribe(sub.channel)
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.channel && this.subscriptions.has(msg.channel)) {
          const sub = this.subscriptions.get(msg.channel)!
          for (const cb of sub.callbacks) {
            try { cb(msg.data) } catch { /* */ }
          }
        }
      } catch { /* */ }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.ws = null
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }

  private sendSubscribe(channel: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel }))
    }
  }

  private sendUnsubscribe(channel: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', channel }))
    }
  }

  subscribe(channel: string, callback: Callback): Unsubscribe {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, { channel, callbacks: new Set() })
      this.sendSubscribe(channel)
    }
    const sub = this.subscriptions.get(channel)!
    sub.callbacks.add(callback)

    return () => {
      sub.callbacks.delete(callback)
      if (sub.callbacks.size === 0) {
        this.subscriptions.delete(channel)
        this.sendUnsubscribe(channel)
      }
    }
  }

  // Convenience subscription helpers matching Solana Tracker datastream API
  get price() {
    return {
      aggregated: (token: string) => ({
        on: (cb: Callback) => this.subscribe(`price:${token}`, cb),
      }),
    }
  }

  get volume() {
    return {
      token: (token: string) => ({
        on: (cb: Callback) => this.subscribe(`volume:${token}`, cb),
      }),
    }
  }

  get tx() {
    return {
      token: (token: string) => ({
        on: (cb: Callback) => this.subscribe(`tx:${token}`, cb),
      }),
    }
  }

  get holders() {
    return (token: string) => ({
      on: (cb: Callback) => this.subscribe(`holders:${token}`, cb),
    })
  }

  // For memescope - subscribe to new token events
  get newTokens() {
    return {
      on: (cb: Callback) => this.subscribe('new_tokens', cb),
    }
  }

  get graduatingTokens() {
    return {
      on: (cb: Callback) => this.subscribe('graduating_tokens', cb),
    }
  }

  get graduatedTokens() {
    return {
      on: (cb: Callback) => this.subscribe('graduated_tokens', cb),
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.connected = false
    this.subscriptions.clear()
  }

  isConnected() {
    return this.connected
  }
}

// Singleton
let instance: SolanaTrackerDatastream | null = null

export async function getDatastream(): Promise<SolanaTrackerDatastream> {
  if (instance) return instance

  // Fetch WS URL from server (keeps API key server-side)
  try {
    const res = await fetch('/api/solana-tracker/ws')
    const { wsUrl } = await res.json()
    instance = new SolanaTrackerDatastream(wsUrl)
    instance.connect()
  } catch {
    // Fallback: construct from env var if available
    const fallback = (import.meta as any).env?.VITE_WS_URL
    if (fallback) {
      instance = new SolanaTrackerDatastream(fallback)
      instance.connect()
    } else {
      throw new Error('Cannot establish datastream connection')
    }
  }
  return instance
}

export function destroyDatastream() {
  instance?.disconnect()
  instance = null
}

export type { SolanaTrackerDatastream, Callback, Unsubscribe }
