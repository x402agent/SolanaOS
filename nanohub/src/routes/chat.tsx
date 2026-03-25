import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { MessageCircle, Send, ArrowLeft, Plus, User, Wallet } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useAuthStatus } from '../lib/useAuthStatus'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

// ── CSS keyframes injected once ─────────────────────────────────────

const CHAT_STYLES = `
@keyframes chat-fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes chat-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes chat-bubble-in {
  from { opacity: 0; transform: scale(0.85) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes chat-pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(20,241,149,0.4); }
  70% { box-shadow: 0 0 0 8px rgba(20,241,149,0); }
  100% { box-shadow: 0 0 0 0 rgba(20,241,149,0); }
}
@keyframes chat-typing-dot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.1); }
}
.chat-thread-item:hover {
  border-color: var(--border-ui-hover) !important;
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(2,10,22,0.3);
}
.chat-msg-bubble {
  animation: chat-bubble-in 0.28s ease-out both;
}
.chat-input:focus {
  border-color: var(--border-ui-active) !important;
  box-shadow: 0 0 0 3px rgba(20,241,149,0.1);
}
@media (max-width: 520px) {
  .chat-msg-bubble > div {
    max-width: 88% !important;
  }
}
`

let stylesInjected = false
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.textContent = CHAT_STYLES
  document.head.appendChild(style)
  stylesInjected = true
}

// ── Main Page ───────────────────────────────────────────────────────

function ChatPage() {
  const { me, walletAddress, walletSession } = useAuthStatus()

  useEffect(() => {
    injectStyles()
  }, [])

  const myWallet = walletAddress
  const displayName = me?.displayName ?? me?.name ?? me?.handle ?? walletSession?.displayName ?? null

  if (!myWallet) {
    return (
      <main className="section">
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '56px 32px',
            animation: 'chat-slide-up 0.5s ease-out both',
          }}
        >
          <div style={{ animation: 'chat-pulse-ring 2s ease-out infinite', display: 'inline-block', borderRadius: '50%', padding: 16, marginBottom: 20 }}>
            <MessageCircle size={52} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 10, fontSize: 26 }}>Wallet-to-Wallet Chat</h2>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 28, maxWidth: 420, marginInline: 'auto', lineHeight: 1.6 }}>
            Connect your Solana wallet to start chatting with other SolanaOS Hub users. Messages are tied to your wallet address.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="btn btn-primary" style={{ padding: '12px 24px' }}>
              <Wallet size={16} /> Connect Wallet
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <ChatShell
      myWallet={myWallet}
      displayName={displayName}
    />
  )
}

// ── Identity Bar ────────────────────────────────────────────────────

function IdentityBar({
  displayName,
  myWallet,
}: {
  displayName: string | null
  myWallet: string
}) {
  const label = displayName || shortenWallet(myWallet)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: 'linear-gradient(135deg, rgba(20,241,149,0.08), rgba(0,212,255,0.06))',
        border: '1px solid var(--border-ui)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 13,
        fontWeight: 600,
        animation: 'chat-fade-in 0.3s ease-out both',
      }}
    >
      <Wallet size={15} style={{ color: 'var(--accent)' }} />
      <span style={{ color: 'var(--ink)' }}>{label}</span>
      <span style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {shortenWallet(myWallet)}
      </span>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'chat-pulse-ring 2s ease-out infinite',
          marginLeft: 'auto',
        }}
      />
    </div>
  )
}

// ── Chat Shell ──────────────────────────────────────────────────────

function ChatShell({
  myWallet,
  displayName,
}: {
  myWallet: string
  displayName: string | null
}) {
  const [activeThreadId, setActiveThreadId] = useState<Id<'nanosolanaPrivateThreads'> | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)

  return (
    <main className="section" style={{ animation: 'chat-fade-in 0.35s ease-out both' }}>
      {/* Top bar: identity + action button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: 0, whiteSpace: 'nowrap' }}>
            <MessageCircle size={22} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
            Chat
          </h1>
          <IdentityBar displayName={displayName} myWallet={myWallet} />
        </div>
        {activeThreadId ? (
          <button
            className="btn btn-sm"
            onClick={() => setActiveThreadId(null)}
            style={{ animation: 'chat-fade-in 0.2s ease-out both' }}
          >
            <ArrowLeft size={16} /> All Threads
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setShowNewChat(true)}
            style={{ padding: '10px 20px', animation: 'chat-fade-in 0.2s ease-out both' }}
          >
            <Plus size={16} /> New Chat
          </button>
        )}
      </div>

      {showNewChat && !activeThreadId && (
        <NewChatDialog
          myWallet={myWallet}
          onCreated={(threadId) => {
            setActiveThreadId(threadId)
            setShowNewChat(false)
          }}
          onCancel={() => setShowNewChat(false)}
        />
      )}

      {activeThreadId ? (
        <ConversationView myWallet={myWallet} displayName={displayName} threadId={activeThreadId} />
      ) : (
        <ThreadList myWallet={myWallet} onSelect={setActiveThreadId} />
      )}
    </main>
  )
}

// ── Thread List ─────────────────────────────────────────────────────

function ThreadList({
  myWallet,
  onSelect,
}: {
  myWallet: string
  onSelect: (id: Id<'nanosolanaPrivateThreads'>) => void
}) {
  const threads = useQuery(api.chat.listThreads, { walletAddress: myWallet })

  if (threads === undefined) {
    return (
      <div className="loading-indicator" style={{ padding: 40, justifyContent: 'center' }}>
        Loading threads...
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '48px 24px',
          animation: 'chat-slide-up 0.4s ease-out both',
        }}
      >
        <MessageCircle size={36} style={{ color: 'var(--ink-soft)', marginBottom: 12, opacity: 0.5 }} />
        <p style={{ color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
          No conversations yet. Start a new chat to message another user.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {threads.map((thread, i) => (
        <button
          key={thread._id}
          onClick={() => onSelect(thread._id)}
          className="card chat-thread-item"
          style={{
            cursor: 'pointer',
            textAlign: 'left',
            padding: '16px 20px',
            gap: 6,
            border: '1px solid var(--line)',
            transition: 'all 0.2s ease',
            animation: `chat-fade-in 0.3s ease-out ${i * 0.05}s both`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(20,241,149,0.2), rgba(0,212,255,0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--border-ui)',
              }}
            >
              <User size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 14 }}>
                {thread.peerDisplayName || shortenWallet(thread.peerWallet)}
              </div>
              {thread.peerDisplayName && (
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>
                  {shortenWallet(thread.peerWallet)}
                </div>
              )}
            </div>
            {thread.lastMessageAt && (
              <span style={{ fontSize: 11, color: 'var(--ink-soft)', flexShrink: 0 }}>
                {formatTime(thread.lastMessageAt)}
              </span>
            )}
          </div>
          {thread.lastMessagePreview && (
            <p style={{
              margin: '4px 0 0 46px',
              fontSize: 13,
              color: 'var(--ink-soft)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {thread.lastMessagePreview}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Conversation View ───────────────────────────────────────────────

function ConversationView({
  myWallet,
  displayName,
  threadId,
}: {
  myWallet: string
  displayName: string | null
  threadId: Id<'nanosolanaPrivateThreads'>
}) {
  const thread = useQuery(api.chat.getThread, { threadId })
  const messages = useQuery(api.chat.listMessages, { threadId })
  const sendMessage = useMutation(api.chat.sendMessage)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const peerWallet = thread
    ? thread.walletA === myWallet ? thread.walletB : thread.walletA
    : null

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages?.length])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content || !peerWallet || sending) return
    setSending(true)
    setText('')
    try {
      await sendMessage({
        senderWallet: myWallet,
        recipientWallet: peerWallet,
        content,
        clientMessageId: crypto.randomUUID(),
      })
    } catch (err) {
      console.error('Failed to send:', err)
      setText(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 220px)',
        minHeight: 400,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--line)',
        animation: 'chat-slide-up 0.35s ease-out both',
      }}
    >
      {/* Conversation header */}
      {peerWallet && (
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface)',
        }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(20,241,149,0.2), rgba(0,212,255,0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-ui)',
            }}
          >
            <User size={17} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 650, fontSize: 14 }}>{shortenWallet(peerWallet)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'calc(100vw - 140px)' }}>{peerWallet}</div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--bg-soft)',
        }}
      >
        {messages === undefined ? (
          <div style={{ margin: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: `chat-typing-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', animation: 'chat-fade-in 0.4s ease-out both' }}>
            <MessageCircle size={32} style={{ color: 'var(--ink-soft)', opacity: 0.4, marginBottom: 8 }} />
            <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.senderWalletAddress === myWallet
            return (
              <div
                key={msg._id}
                className="chat-msg-bubble"
                style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  animationDelay: `${Math.min(i * 0.03, 0.5)}s`,
                }}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: isMine
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                    background: isMine
                      ? 'linear-gradient(135deg, rgba(20,241,149,0.18), rgba(0,212,255,0.12))'
                      : 'var(--surface)',
                    border: `1px solid ${isMine ? 'var(--border-ui)' : 'var(--line)'}`,
                    fontSize: 14,
                    lineHeight: 1.55,
                    wordBreak: 'break-word',
                  }}
                >
                  <p style={{ margin: 0 }}>{msg.content}</p>
                  <span style={{
                    display: 'block',
                    fontSize: 10,
                    color: 'var(--ink-soft)',
                    marginTop: 4,
                    textAlign: isMine ? 'right' : 'left',
                    opacity: 0.7,
                  }}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Send bar */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          gap: 8,
          padding: '14px 16px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--line)',
        }}
      >
        <input
          type="text"
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: '11px 16px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--line)',
            background: 'var(--bg-soft)',
            color: 'var(--ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          disabled={sending}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!text.trim() || sending}
          style={{
            padding: '11px 18px',
            transition: 'all 0.2s ease',
            ...(sending ? {} : {}),
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}

// ── New Chat Dialog ─────────────────────────────────────────────────

function NewChatDialog({
  myWallet,
  onCreated,
  onCancel,
}: {
  myWallet: string
  onCreated: (threadId: Id<'nanosolanaPrivateThreads'>) => void
  onCancel: () => void
}) {
  const [peerWallet, setPeerWallet] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const getOrCreateThread = useMutation(api.chat.getOrCreateThread)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const wallet = peerWallet.trim()
    if (!wallet) return
    if (wallet === myWallet) {
      setError('You cannot chat with yourself.')
      return
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      setError('Please enter a valid Solana wallet address.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const threadId = await getOrCreateThread({ myWallet, peerWallet: wallet })
      onCreated(threadId)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create thread')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: '22px', animation: 'chat-slide-up 0.3s ease-out both' }}>
      <h3 style={{ margin: '0 0 14px', fontFamily: 'var(--font-display)', fontSize: 16 }}>
        <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent)' }} />
        Start a new conversation
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          className="chat-input"
          value={peerWallet}
          onChange={(e) => setPeerWallet(e.target.value)}
          placeholder="Paste a Solana wallet address..."
          style={{
            flex: 1,
            minWidth: 200,
            padding: '11px 16px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--line)',
            background: 'var(--bg-soft)',
            color: 'var(--ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={creating || !peerWallet.trim()}>
          {creating ? 'Starting...' : 'Start Chat'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </form>
      {error && (
        <p style={{ color: '#ff6b6b', fontSize: 13, margin: '10px 0 0', animation: 'chat-fade-in 0.2s ease-out both' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function shortenWallet(address: string) {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
