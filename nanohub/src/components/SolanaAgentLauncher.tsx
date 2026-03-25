import { Link } from '@tanstack/react-router'
import { Bot, MessageCircle, RotateCcw, Send, Settings2, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStatus } from '../lib/useAuthStatus'
import {
  clearSolanaAgentConversation,
  defaultSolanaAgentPreferences,
  loadSolanaAgentConversation,
  loadSolanaAgentPanelState,
  loadSolanaAgentPreferences,
  saveSolanaAgentConversation,
  saveSolanaAgentPanelState,
  SOLANA_AGENT_DEFAULT_MODEL,
  SOLANA_AGENT_PROVIDER,
  subscribeToSolanaAgentState,
  type SolanaAgentMessage,
  type SolanaAgentPreferences,
} from '../lib/solanaAgent'

const initialAssistantMessage =
  'SolanaOS Agent is online. Ask about setup, skills, Seeker, wallets, trading, mining, or hub workflows.'

const quickPrompts = [
  'Set up my Solana Seeker and gateway',
  'Show the fastest way to connect my Bitaxe miner',
  'How do I register my agent on Metaplex and 8004?',
]

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseStreamError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  if ('message' in payload && typeof payload.message === 'string') return payload.message
  return fallback
}

function parseSseBuffer(
  buffer: string,
  onEvent: (eventName: string, payload: unknown) => void,
  flush = false,
) {
  let remaining = buffer
  let boundary = remaining.indexOf('\n\n')

  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/)
    let eventName = 'message'
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message'
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }

    if (!dataLines.length) return

    try {
      onEvent(eventName, JSON.parse(dataLines.join('\n')))
    } catch {
      onEvent(eventName, null)
    }
  }

  while (boundary >= 0) {
    processBlock(remaining.slice(0, boundary))
    remaining = remaining.slice(boundary + 2)
    boundary = remaining.indexOf('\n\n')
  }

  if (flush && remaining.trim()) {
    processBlock(remaining)
    remaining = ''
  }

  return remaining
}

export function SolanaAgentLauncher() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const userKey = me?._id
  const [hydrated, setHydrated] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<SolanaAgentMessage[]>([])
  const [preferences, setPreferences] = useState<SolanaAgentPreferences>(defaultSolanaAgentPreferences)
  const [modelLabel, setModelLabel] = useState(SOLANA_AGENT_DEFAULT_MODEL)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)

  const identityLabel = useMemo(() => {
    if (!me) return 'operator'
    return me.displayName ?? me.name ?? me.handle ?? 'operator'
  }, [me])

  useEffect(() => {
    if (!userKey) {
      setHydrated(false)
      return
    }

    const syncFromStorage = () => {
      const nextPreferences = loadSolanaAgentPreferences(userKey)
      const nextOpen = loadSolanaAgentPanelState(userKey)
      const nextMessages = nextPreferences.persistConversation
        ? loadSolanaAgentConversation(userKey)
        : []

      setPreferences(nextPreferences)
      setOpen(nextOpen ?? (nextPreferences.autoOpen && nextMessages.length === 0))
      setMessages(nextMessages)
      setHydrated(true)
    }

    syncFromStorage()
    return subscribeToSolanaAgentState(userKey, syncFromStorage)
  }, [userKey])

  useEffect(() => {
    if (!userKey || !hydrated) return
    saveSolanaAgentPanelState(userKey, open)
  }, [hydrated, open, userKey])

  useEffect(() => {
    if (!userKey || !hydrated) return
    if (!preferences.persistConversation) {
      clearSolanaAgentConversation(userKey)
      return
    }
    if (messages.length === 0) {
      clearSolanaAgentConversation(userKey)
      return
    }
    saveSolanaAgentConversation(userKey, messages)
  }, [hydrated, messages, preferences.persistConversation, userKey])

  useEffect(() => {
    if (!open || messages.length > 0) return
    setMessages([{ id: nextId(), role: 'assistant', content: initialAssistantMessage }])
  }, [open, messages.length])

  useEffect(() => {
    if (isAuthenticated || isLoading) return
    streamAbortRef.current?.abort()
    setOpen(false)
    setDraft('')
    setBusy(false)
    setError(null)
    setMessages([])
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (!open) return
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, open, busy])

  if (isLoading || !isAuthenticated || !userKey) return null

  async function streamAssistantReply(nextMessages: SolanaAgentMessage[]) {
    const assistantId = nextId()
    const controller = new AbortController()
    streamAbortRef.current = controller
    setBusy(true)
    setError(null)
    setMessages([...nextMessages, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const response = await fetch('/agent/chat', {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          stream: true,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          userContext: {
            displayName: me?.displayName ?? me?.name ?? null,
            handle: me?.handle ?? null,
            walletAddress: me?.walletAddress ?? null,
          },
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? 'Agent request failed')
      }

      if (!response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { reply?: string; model?: string; message?: string }
          | null

        if (!payload?.reply) {
          throw new Error(payload?.message ?? 'Agent request failed')
        }

        if (payload.model) setModelLabel(payload.model)
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: payload.reply ?? '' } : message,
          ),
        )
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let reply = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        buffer = parseSseBuffer(buffer, (eventName, payload) => {
          if (eventName === 'meta' && payload && typeof payload === 'object' && 'model' in payload && typeof payload.model === 'string') {
            setModelLabel(payload.model)
            return
          }

          if (eventName === 'delta' && payload && typeof payload === 'object' && 'delta' in payload && typeof payload.delta === 'string') {
            reply += payload.delta
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: reply } : message,
              ),
            )
            return
          }

          if (eventName === 'error') {
            throw new Error(parseStreamError(payload, 'Agent request failed'))
          }
        })
      }

      buffer += decoder.decode()
      parseSseBuffer(
        buffer,
        (eventName, payload) => {
          if (eventName === 'delta' && payload && typeof payload === 'object' && 'delta' in payload && typeof payload.delta === 'string') {
            reply += payload.delta
          }
        },
        true,
      )

      if (!reply.trim()) {
        throw new Error('OpenRouter returned an empty reply')
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content: reply } : message,
        ),
      )
    } catch (err) {
      const wasAborted = err instanceof DOMException && err.name === 'AbortError'
      setMessages((current) =>
        current.filter((message) => message.id !== assistantId || message.content.trim().length > 0),
      )
      if (!wasAborted) {
        setError(err instanceof Error ? err.message : 'Agent request failed')
      }
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
      setBusy(false)
    }
  }

  async function sendMessage(contentOverride?: string) {
    const content = (contentOverride ?? draft).trim()
    if (!content || busy) return

    const nextUserMessage: SolanaAgentMessage = { id: nextId(), role: 'user', content }
    const nextMessages = [...messages, nextUserMessage]
    setDraft('')
    void streamAssistantReply(nextMessages)
  }

  function clearConversation() {
    setError(null)
    setMessages([])
    if (preferences.persistConversation) clearSolanaAgentConversation(userKey)
  }

  function closePanel() {
    streamAbortRef.current?.abort()
    setBusy(false)
    setOpen(false)
  }

  const showQuickPrompts = open && !busy && messages.length <= 1

  return (
    <div className="solana-agent-launcher">
      {open ? (
        <div className={`solana-agent-panel${preferences.compactMode ? ' is-compact' : ''}`}>
          <div className="solana-agent-panel-header">
            <div className="solana-agent-panel-title">
              <span className="solana-agent-panel-mark">
                <Bot size={15} />
              </span>
              <div>
                <strong>SolanaOS Agent</strong>
                <div>{identityLabel}</div>
              </div>
            </div>

            <div className="solana-agent-panel-actions">
              <Link to="/settings" hash="agent" className="solana-agent-header-link" aria-label="Open SolanaOS agent settings">
                <Settings2 size={15} />
              </Link>
              <button
                type="button"
                className="solana-agent-close"
                aria-label="Close SolanaOS Agent"
                onClick={closePanel}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="solana-agent-status-row">
            <span className="solana-agent-status-pill solana-agent-status-pill-live">
              {busy ? 'Streaming' : 'Hosted'}
            </span>
            <span className="solana-agent-status-pill">{SOLANA_AGENT_PROVIDER}</span>
            <span className="solana-agent-status-pill solana-agent-status-pill-model">{modelLabel}</span>
          </div>

          <div ref={scrollerRef} className="solana-agent-messages">
            {messages.map((message) => (
              <div key={message.id} className={`solana-agent-message solana-agent-message-${message.role}`}>
                {message.content}
              </div>
            ))}
            {busy ? <div className="solana-agent-typing">SolanaOS Agent is streaming a response…</div> : null}
          </div>

          {showQuickPrompts ? (
            <div className="solana-agent-prompt-list">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="solana-agent-prompt-chip"
                  onClick={() => void sendMessage(prompt)}
                >
                  <Zap size={13} />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          ) : null}

          {error ? <div className="solana-agent-error">{error}</div> : null}

          <div className="solana-agent-toolbar">
            <button type="button" className="solana-agent-toolbar-button" disabled={busy} onClick={clearConversation}>
              <RotateCcw size={14} />
              <span>Reset thread</span>
            </button>
            <div className="solana-agent-toolbar-note">
              {preferences.persistConversation ? 'Conversation saved locally on this device.' : 'Conversation stays in memory only for this tab.'}
            </div>
          </div>

          <div className="solana-agent-composer">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Ask SolanaOS Agent"
            />
            <button type="button" className="solana-agent-send" disabled={busy || !draft.trim()} onClick={() => void sendMessage()}>
              <Send size={15} />
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`solana-agent-bubble${busy ? ' is-busy' : ''}`}
        aria-label="Open SolanaOS Agent"
        onClick={() => {
          if (open) {
            closePanel()
            return
          }
          setOpen(true)
        }}
      >
        <MessageCircle size={20} />
        <span>{preferences.compactMode ? 'AI' : 'Agent'}</span>
      </button>
    </div>
  )
}
