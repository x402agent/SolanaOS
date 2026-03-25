import { useOnlineCount, useTotalUsers } from '../lib/usePresence'

export function OnlineUsers({ showTotal }: { showTotal?: boolean }) {
  const online = useOnlineCount()
  const total = useTotalUsers()

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span style={{ color: 'var(--ink-soft)' }}>
          <strong style={{ color: '#14f195' }}>{online.total}</strong> online
        </span>
      </div>
      {showTotal && total.total > 0 && (
        <span style={{ color: 'var(--ink-muted)' }}>
          {total.total} total users
        </span>
      )}
    </div>
  )
}

export function OnlineBadge() {
  const online = useOnlineCount()
  return (
    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      {online.total}
    </span>
  )
}
