import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'G0DM0DƎ | Liberated AI Chat',
  description: 'Open-source, privacy-respecting, multi-model chat interface for hackers and philosophers',
  keywords: ['AI', 'chat', 'open-source', 'privacy', 'hacker', 'Claude', 'GPT', 'OpenRouter'],
  authors: [{ name: 'Lysios Lab' }],
  openGraph: {
    title: 'G0DM0DƎ',
    description: 'Cognition without control. Tools for builders, not gatekeepers.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Share+Tech+Mono&family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-mono antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
