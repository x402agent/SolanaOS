export const PUBLIC_PATHS = new Set([
  '/',
  '/launch',
  '/solanaos',
  '/mobile',
  '/auth/callback',
  '/pair',
  '/skills',
  '/souls',
  '/mining',
  '/strategy',
])

const PUBLIC_PREFIXES = [
  '/skills/',
  '/souls/',
  '/agents/',
  '/chart/',
]

export function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
