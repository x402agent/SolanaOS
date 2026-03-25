import { Link, useRouterState } from '@tanstack/react-router'
import { Menu, Monitor, Moon, Sun, Wallet } from 'lucide-react'
import { lazy, Suspense, useMemo, useRef } from 'react'
import { isModerator } from '../lib/roles'
import { getNanoHubSiteUrl, getSiteMode, getSiteName } from '../lib/site'
import { applyTheme, useThemeMode } from '../lib/theme'
import { startThemeTransition } from '../lib/theme-transition'
import { isPublicPath } from '../lib/publicRoutes'
import { useAuthStatus } from '../lib/useAuthStatus'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { useAuthActions } from '@convex-dev/auth/react'
import { useAuthError } from '../lib/useAuthError'
import { gravatarUrl } from '../lib/gravatar'

const HeaderWalletActions = lazy(() => import('./HeaderWalletActions'))
const OnlineUsersLazy = lazy(() => import('./OnlineUsers').then((m) => ({ default: m.OnlineBadge })))

export default function Header() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()
  const { mode, setMode } = useThemeMode()
  const toggleRef = useRef<HTMLDivElement | null>(null)
  const siteMode = getSiteMode()
  const siteName = useMemo(() => getSiteName(siteMode), [siteMode])
  const isSoulMode = siteMode === 'souls'
  const skillsHubUrl = getNanoHubSiteUrl()
  const solanaOsUrl = `${skillsHubUrl}/solanaos`
  const solanaOsMobileUrl = `${skillsHubUrl}/mobile`
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const publicPath = isPublicPath(pathname)

  const avatar = me?.image ?? (me?.email ? gravatarUrl(me.email) : undefined)
  const handle = me?.handle ?? me?.displayName ?? 'user'
  const initial = (me?.displayName ?? me?.name ?? handle).charAt(0).toUpperCase()
  const isStaff = isModerator(me)
  const { error: authError } = useAuthError()
  const signInRedirectTo = getCurrentRelativeUrl()

  const setTheme = (next: 'system' | 'light' | 'dark') => {
    startThemeTransition({
      nextTheme: next,
      currentTheme: mode,
      setTheme: (value) => {
        const nextMode = value as 'system' | 'light' | 'dark'
        applyTheme(nextMode)
        setMode(nextMode)
      },
      context: { element: toggleRef.current },
    })
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link
          to="/"
          search={{ q: undefined, highlighted: undefined, search: undefined }}
          className="brand"
        >
          <span className="brand-mark">
            <img src="/clawd-logo.png" alt="" aria-hidden="true" />
          </span>
          <span className="brand-name">{siteName}</span>
        </Link>
        <nav className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/dex">DEX</Link>
          <a href={solanaOsMobileUrl}>Mobile</a>
          <Link to="/mining">Mining</Link>
          <Link to="/strategy">Strategy</Link>
          <Link to="/wallet">Wallet</Link>
          {isSoulMode ? <a href={skillsHubUrl}>SolanaOS Skills</a> : null}
          <a href={solanaOsUrl}>SolanaOS</a>
          {isSoulMode ? (
            <Link
              to="/souls"
              search={{
                q: undefined,
                sort: undefined,
                dir: undefined,
                view: undefined,
                focus: undefined,
              }}
            >
              Souls
            </Link>
          ) : (
            <Link
              to="/skills"
              search={{
                q: undefined,
                sort: undefined,
                dir: undefined,
                highlighted: undefined,
                nonSuspicious: undefined,
                view: undefined,
                focus: undefined,
              }}
            >
              Skills
            </Link>
          )}
          <div className="nav-dropdown">
            <span className="nav-dropdown-trigger">Tracker</span>
            <div className="nav-dropdown-menu">
              <Link to="/tracker" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">📊</span>
                <div>
                  <div className="nav-dropdown-title">Chart</div>
                  <div className="nav-dropdown-desc">TradingView charts & live trades</div>
                </div>
              </Link>
              <Link to="/memescope" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">🔭</span>
                <div>
                  <div className="nav-dropdown-title">Memescope</div>
                  <div className="nav-dropdown-desc">New, graduating & graduated tokens</div>
                </div>
              </Link>
              <Link to="/rugcheck" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">🛡</span>
                <div>
                  <div className="nav-dropdown-title">Rug Check</div>
                  <div className="nav-dropdown-desc">Token risk analysis & scoring</div>
                </div>
              </Link>
            </div>
          </div>
          <Link to="/chat">Chat</Link>
          <Link to="/upload" search={{ updateSlug: undefined }}>
            Upload
          </Link>
          {isSoulMode ? null : <Link to="/import">Import</Link>}
          <div className="nav-dropdown">
            <span className="nav-dropdown-trigger">Setup</span>
            <div className="nav-dropdown-menu">
              <Link to="/setup/gateway" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">🖥</span>
                <div>
                  <div className="nav-dropdown-title">Gateway</div>
                  <div className="nav-dropdown-desc">Install SolanaOS on your terminal</div>
                </div>
              </Link>
              <Link to="/setup/telegram" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">💬</span>
                <div>
                  <div className="nav-dropdown-title">Telegram Bot</div>
                  <div className="nav-dropdown-desc">Remote monitoring and commands</div>
                </div>
              </Link>
              <Link to="/setup/metaplex" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">⬡</span>
                <div>
                  <div className="nav-dropdown-title">Metaplex Agent</div>
                  <div className="nav-dropdown-desc">Register on the 014 Registry</div>
                </div>
              </Link>
              <Link to="/setup/mining" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">⛏</span>
                <div>
                  <div className="nav-dropdown-title">BitAxe Mining</div>
                  <div className="nav-dropdown-desc">Fleet management with MawdAxe</div>
                </div>
              </Link>
              <Link to="/setup/extension" className="nav-dropdown-item">
                <span className="nav-dropdown-icon">🧩</span>
                <div>
                  <div className="nav-dropdown-title">Chrome Extension</div>
                  <div className="nav-dropdown-desc">Wallet, chat, and tools in your browser</div>
                </div>
              </Link>
            </div>
          </div>
          <Link
            to={isSoulMode ? '/souls' : '/skills'}
            search={
              isSoulMode
                ? {
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  view: undefined,
                  focus: 'search',
                }
                : {
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  highlighted: undefined,
                  nonSuspicious: undefined,
                  view: undefined,
                  focus: 'search',
                }
            }
          >
            Search
          </Link>
          {me ? <Link to="/stars">Stars</Link> : null}
          {isStaff ? (
            <Link to="/management" search={{ skill: undefined }}>
              Management
            </Link>
          ) : null}
        </nav>
        <div className="nav-actions">
          <div className="nav-mobile">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nav-mobile-trigger" type="button" aria-label="Open menu">
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={solanaOsMobileUrl}>Mobile</a>
                </DropdownMenuItem>
                {isSoulMode ? (
                  <DropdownMenuItem asChild>
                    <a href={skillsHubUrl}>SolanaOS Skills</a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <a href={solanaOsUrl}>SolanaOS</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  {isSoulMode ? (
                    <Link
                      to="/souls"
                      search={{
                        q: undefined,
                        sort: undefined,
                        dir: undefined,
                        view: undefined,
                        focus: undefined,
                      }}
                    >
                      Souls
                    </Link>
                  ) : (
                    <Link
                      to="/skills"
                      search={{
                        q: undefined,
                        sort: undefined,
                        dir: undefined,
                        highlighted: undefined,
                        nonSuspicious: undefined,
                        view: undefined,
                        focus: undefined,
                      }}
                    >
                      Skills
                    </Link>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/chat">Chat</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/upload" search={{ updateSlug: undefined }}>
                    Upload
                  </Link>
                </DropdownMenuItem>
                {isSoulMode ? null : (
                  <DropdownMenuItem asChild>
                    <Link to="/import">Import</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/setup/gateway">Setup</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to={isSoulMode ? '/souls' : '/skills'}
                    search={
                      isSoulMode
                        ? {
                          q: undefined,
                          sort: undefined,
                          dir: undefined,
                          view: undefined,
                          focus: 'search',
                        }
                        : {
                          q: undefined,
                          sort: undefined,
                          dir: undefined,
                          highlighted: undefined,
                          nonSuspicious: undefined,
                          view: undefined,
                          focus: 'search',
                        }
                    }
                  >
                    Search
                  </Link>
                </DropdownMenuItem>
                {me ? (
                  <DropdownMenuItem asChild>
                    <Link to="/stars">Stars</Link>
                  </DropdownMenuItem>
                ) : null}
                {isStaff ? (
                  <DropdownMenuItem asChild>
                    <Link to="/management" search={{ skill: undefined }}>
                      Management
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="h-4 w-4" aria-hidden="true" />
                  System
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="h-4 w-4" aria-hidden="true" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  Dark
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="theme-toggle" ref={toggleRef}>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (!value) return
                setTheme(value as 'system' | 'light' | 'dark')
              }}
              aria-label="Theme mode"
            >
              <ToggleGroupItem value="system" aria-label="System theme">
                <Monitor className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">System</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label="Light theme">
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Light</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Dark</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {isAuthenticated && me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="user-trigger" type="button">
                  {avatar ? (
                    <img src={avatar} alt={me.displayName ?? me.name ?? 'User avatar'} />
                  ) : (
                    <span className="user-menu-fallback">{initial}</span>
                  )}
                  <span className="mono">@{handle}</span>
                  <span className="user-menu-chevron">▾</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/chat">Chat</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {publicPath ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    void signIn(
                      'github',
                      signInRedirectTo ? { redirectTo: signInRedirectTo } : undefined,
                    )
                  }}
                >
                  <span className="sign-in-label">Sign in</span>
                  <span className="sign-in-provider">with GitHub</span>
                </button>
              ) : (
                <Suspense
                  fallback={
                    <button className="btn btn-primary" type="button" disabled={isLoading}>
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                      <span className="sign-in-label">{authError ? 'Retry sign in' : 'Connect'}</span>
                    </button>
                  }
                >
                  <HeaderWalletActions isLoading={isLoading} />
                </Suspense>
              )}
            </>
          )}
          <Suspense fallback={null}>
            <OnlineUsersLazy />
          </Suspense>
        </div>
      </div>
    </header>
  )
}

function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}
