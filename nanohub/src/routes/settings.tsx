import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { gravatarUrl } from '../lib/gravatar'
import {
  clearSolanaAgentConversation,
  defaultSolanaAgentPreferences,
  loadSolanaAgentPreferences,
  saveSolanaAgentPreferences,
  SOLANA_AGENT_DEFAULT_MODEL,
  SOLANA_AGENT_PROVIDER,
  type SolanaAgentPreferences,
} from '../lib/solanaAgent'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  const me = useQuery(api.users.me)
  const updateProfile = useMutation(api.users.updateProfile)
  const deleteAccount = useMutation(api.users.deleteAccount)
  const tokens = useQuery(api.tokens.listMine, me ? {} : 'skip') as
    | Array<{
      _id: Id<'apiTokens'>
      label: string
      prefix: string
      createdAt: number
      lastUsedAt?: number
      revokedAt?: number
    }>
    | undefined
  const createToken = useMutation(api.tokens.create)
  const revokeToken = useMutation(api.tokens.revoke)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const [tokenLabel, setTokenLabel] = useState('CLI token')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [agentPreferences, setAgentPreferences] = useState<SolanaAgentPreferences>(
    defaultSolanaAgentPreferences,
  )

  useEffect(() => {
    if (!me) return
    setDisplayName(me.displayName ?? '')
    setBio(me.bio ?? '')
    setAgentPreferences(loadSolanaAgentPreferences(me._id))
  }, [me])

  if (!me) {
    return (
      <main className="section">
        <div className="card">Sign in to access settings.</div>
      </main>
    )
  }

  const avatar = me.image ?? (me.email ? gravatarUrl(me.email, 160) : undefined)
  const identityName = me.displayName ?? me.name ?? me.handle ?? 'Profile'
  const handle = me.handle ?? (me.email ? me.email.split('@')[0] : undefined)

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    await updateProfile({ displayName, bio })
    setStatus('Saved.')
  }

  async function onDelete() {
    const ok = window.confirm(
      'Delete your account permanently? This cannot be undone.\n\n' +
      'Published skills will remain public.',
    )
    if (!ok) return
    await deleteAccount()
  }

  async function onCreateToken() {
    const label = tokenLabel.trim() || 'CLI token'
    const result = await createToken({ label })
    setNewToken(result.token)
  }

  function saveAgentPreferences() {
    saveSolanaAgentPreferences(me._id, agentPreferences)
    setAgentStatus('SolanaOS Agent settings saved locally for this browser.')
  }

  function clearAgentConversation() {
    clearSolanaAgentConversation(me._id)
    setAgentStatus('Saved SolanaOS Agent conversation cleared for this browser.')
  }

  return (
    <main className="section settings-shell">
      <h1 className="section-title">Settings</h1>
      <div className="card settings-profile">
        <div className="settings-avatar">
          {avatar ? (
            <img src={avatar} alt={identityName} />
          ) : (
            <span>{identityName[0]?.toUpperCase() ?? 'U'}</span>
          )}
        </div>
        <div className="settings-profile-body">
          <div className="settings-name">{identityName}</div>
          {handle ? <div className="settings-handle">@{handle}</div> : null}
          {me.email ? <div className="settings-email">{me.email}</div> : null}
        </div>
      </div>
      <form className="card settings-card" onSubmit={onSave}>
        <label className="settings-field">
          <span>Display name</span>
          <input
            className="settings-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>Bio</span>
          <textarea
            className="settings-input"
            rows={5}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Tell people what you're building."
          />
        </label>
        <div className="settings-actions">
          <button className="btn btn-primary settings-save" type="submit">
            Save
          </button>
          {status ? <div className="stat">{status}</div> : null}
        </div>
      </form>

      <div id="agent" className="card settings-card">
        <h2 className="section-title" style={{ marginTop: 0 }}>
          SolanaOS Agent
        </h2>
        <p className="section-subtitle">
          Control the hosted popup assistant that appears across SolanaOS Hub after you sign in.
        </p>

        <div className="settings-agent-grid">
          <div className="stat">
            <div className="settings-agent-stat-label">Hosted provider</div>
            <strong>{SOLANA_AGENT_PROVIDER}</strong>
          </div>
          <div className="stat">
            <div className="settings-agent-stat-label">Default model</div>
            <strong>{SOLANA_AGENT_DEFAULT_MODEL}</strong>
          </div>
          <div className="stat">
            <div className="settings-agent-stat-label">Response mode</div>
            <strong>Streaming</strong>
          </div>
        </div>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={agentPreferences.autoOpen}
            onChange={(event) =>
              setAgentPreferences((current) => ({ ...current, autoOpen: event.target.checked }))
            }
          />
          <div>
            <strong>Open automatically after sign-in</strong>
            <div className="section-subtitle">Useful if you want the operator chat ready as soon as the hub loads.</div>
          </div>
        </label>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={agentPreferences.compactMode}
            onChange={(event) =>
              setAgentPreferences((current) => ({ ...current, compactMode: event.target.checked }))
            }
          />
          <div>
            <strong>Use compact popup layout</strong>
            <div className="section-subtitle">Tightens the launcher footprint and shortens the bubble label.</div>
          </div>
        </label>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={agentPreferences.persistConversation}
            onChange={(event) =>
              setAgentPreferences((current) => ({ ...current, persistConversation: event.target.checked }))
            }
          />
          <div>
            <strong>Keep conversation on this device</strong>
            <div className="section-subtitle">Stores your recent SolanaOS Agent thread locally in this browser only.</div>
          </div>
        </label>

        <div className="settings-actions">
          <button className="btn btn-primary settings-save" type="button" onClick={saveAgentPreferences}>
            Save agent settings
          </button>
          <button className="btn" type="button" onClick={clearAgentConversation}>
            Clear saved conversation
          </button>
        </div>

        {agentStatus ? <div className="stat">{agentStatus}</div> : null}
      </div>

      <div className="card settings-card">
        <h2 className="section-title danger-title" style={{ marginTop: 0 }}>
          API tokens
        </h2>
        <p className="section-subtitle">
          Use these tokens for the `nanohub` CLI. Tokens are shown once on creation.
        </p>

        <div className="settings-field">
          <span>Label</span>
          <input
            className="settings-input"
            value={tokenLabel}
            onChange={(event) => setTokenLabel(event.target.value)}
            placeholder="CLI token"
          />
        </div>
        <div className="settings-actions">
          <button
            className="btn btn-primary settings-save"
            type="button"
            onClick={() => void onCreateToken()}
          >
            Create token
          </button>
          {newToken ? (
            <div className="stat" style={{ overflowX: 'auto' }}>
              <div style={{ marginBottom: 8 }}>Copy this token now:</div>
              <code>{newToken}</code>
            </div>
          ) : null}
        </div>

        {(tokens ?? []).length ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {(tokens ?? []).map((token) => (
              <div
                key={token._id}
                className="stat"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
              >
                <div>
                  <div>
                    <strong>{token.label}</strong>{' '}
                    <span style={{ opacity: 0.7 }}>({token.prefix}…)</span>
                  </div>
                  <div style={{ opacity: 0.7 }}>
                    Created {formatDate(token.createdAt)}
                    {token.lastUsedAt ? ` · Used ${formatDate(token.lastUsedAt)}` : ''}
                    {token.revokedAt ? ` · Revoked ${formatDate(token.revokedAt)}` : ''}
                  </div>
                </div>
                <div>
                  <button
                    className="btn"
                    type="button"
                    disabled={Boolean(token.revokedAt)}
                    onClick={() => void revokeToken({ tokenId: token._id })}
                  >
                    {token.revokedAt ? 'Revoked' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-subtitle" style={{ marginTop: 16 }}>
            No tokens yet.
          </p>
        )}
      </div>

      <div className="card danger-card">
        <h2 className="section-title danger-title">Danger zone</h2>
        <p className="section-subtitle">
          Delete your account permanently. This cannot be undone. Published skills remain public.
        </p>
        <button className="btn btn-danger" type="button" onClick={() => void onDelete()}>
          Delete account
        </button>
      </div>
    </main>
  )
}

function formatDate(value: number) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}
