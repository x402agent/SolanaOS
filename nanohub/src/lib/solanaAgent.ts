export type SolanaAgentRole = 'assistant' | 'user'

export type SolanaAgentMessage = {
  id: string
  role: SolanaAgentRole
  content: string
}

export type SolanaAgentPreferences = {
  autoOpen: boolean
  compactMode: boolean
  persistConversation: boolean
}

export const SOLANA_AGENT_PROVIDER = 'OpenRouter'
export const SOLANA_AGENT_DEFAULT_MODEL = 'minimax/minimax-m2.7'

const agentStorageVersion = 'v1'
const prefsChangedEvent = 'nanosolana:solana-agent:changed'

export const defaultSolanaAgentPreferences: SolanaAgentPreferences = {
  autoOpen: true,
  compactMode: false,
  persistConversation: true,
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function storageKey(userKey: string, suffix: string) {
  return `nanohub.solana-agent.${agentStorageVersion}.${userKey}.${suffix}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function emitAgentStateChange(userKey: string) {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(prefsChangedEvent, { detail: { userKey } }))
}

function parsePreferences(value: unknown): SolanaAgentPreferences {
  if (!isObject(value)) return defaultSolanaAgentPreferences
  return {
    autoOpen:
      typeof value.autoOpen === 'boolean'
        ? value.autoOpen
        : defaultSolanaAgentPreferences.autoOpen,
    compactMode:
      typeof value.compactMode === 'boolean'
        ? value.compactMode
        : defaultSolanaAgentPreferences.compactMode,
    persistConversation:
      typeof value.persistConversation === 'boolean'
        ? value.persistConversation
        : defaultSolanaAgentPreferences.persistConversation,
  }
}

function parseMessages(value: unknown): SolanaAgentMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!isObject(entry)) return null
      const id = typeof entry.id === 'string' ? entry.id : null
      const role = entry.role === 'assistant' || entry.role === 'user' ? entry.role : null
      const content = typeof entry.content === 'string' ? entry.content : null
      if (!id || !role || !content) return null
      return { id, role, content } satisfies SolanaAgentMessage
    })
    .filter((entry): entry is SolanaAgentMessage => entry !== null)
    .slice(-24)
}

function loadJson<T>(key: string, fallback: T, parser: (value: unknown) => T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return parser(JSON.parse(raw))
  } catch {
    return fallback
  }
}

export function loadSolanaAgentPreferences(userKey: string): SolanaAgentPreferences {
  return loadJson(
    storageKey(userKey, 'preferences'),
    defaultSolanaAgentPreferences,
    parsePreferences,
  )
}

export function saveSolanaAgentPreferences(userKey: string, value: SolanaAgentPreferences) {
  if (!isBrowser()) return
  window.localStorage.setItem(storageKey(userKey, 'preferences'), JSON.stringify(value))
  emitAgentStateChange(userKey)
}

export function loadSolanaAgentConversation(userKey: string): SolanaAgentMessage[] {
  return loadJson(storageKey(userKey, 'conversation'), [], parseMessages)
}

export function saveSolanaAgentConversation(userKey: string, messages: SolanaAgentMessage[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(storageKey(userKey, 'conversation'), JSON.stringify(messages.slice(-24)))
}

export function clearSolanaAgentConversation(userKey: string) {
  if (!isBrowser()) return
  window.localStorage.removeItem(storageKey(userKey, 'conversation'))
  emitAgentStateChange(userKey)
}

export function loadSolanaAgentPanelState(userKey: string) {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(storageKey(userKey, 'panel-open'))
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'boolean' ? parsed : null
  } catch {
    return null
  }
}

export function saveSolanaAgentPanelState(userKey: string, open: boolean) {
  if (!isBrowser()) return
  window.localStorage.setItem(storageKey(userKey, 'panel-open'), JSON.stringify(open))
}

export function subscribeToSolanaAgentState(
  userKey: string,
  onChange: () => void,
) {
  if (!isBrowser()) return () => {}

  const prefix = storageKey(userKey, '')

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(prefix)) onChange()
  }

  const handleCustom = (event: Event) => {
    const detail =
      event instanceof CustomEvent && isObject(event.detail) && typeof event.detail.userKey === 'string'
        ? event.detail
        : null
    if (!detail || detail.userKey === userKey) onChange()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(prefsChangedEvent, handleCustom)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(prefsChangedEvent, handleCustom)
  }
}
