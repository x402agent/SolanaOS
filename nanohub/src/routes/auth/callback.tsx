import { createFileRoute } from '@tanstack/react-router'
import { ConnectBox } from '@phantom/react-sdk'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  return (
    <main className="section" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <ConnectBox />
    </main>
  )
}
