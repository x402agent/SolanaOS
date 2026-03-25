import GitHub from '@auth/core/providers/github'
import { convexAuth } from '@convex-dev/auth/server'
import type { GenericMutationCtx } from 'convex/server'
import { ConvexError } from 'convex/values'
import { internal } from './_generated/api'
import type { DataModel, Id } from './_generated/dataModel'
import { shouldScheduleGitHubProfileSync } from './lib/githubProfileSync'

export const BANNED_REAUTH_MESSAGE =
  'Your account has been banned for uploading malicious skills. If you believe this is a mistake, please contact security@openclaw.ai and we will work with you to restore access.'
export const DELETED_ACCOUNT_REAUTH_MESSAGE =
  'This account has been permanently deleted and cannot be restored.'

const REAUTH_BLOCKING_BAN_ACTIONS = new Set(['user.ban', 'user.autoban.malware'])
const FALLBACK_SITE_URL = 'https://seeker.solanaos.net'
const FALLBACK_SOULS_SITE_URL = 'https://souls.solanaos.net'
const FALLBACK_CONVEX_SITE_URL = 'https://artful-frog-940.convex.site'
const FALLBACK_GITHUB_CLIENT_ID = 'Ov23liCI5FykHPNxDonf'

export async function handleDeletedUserSignIn(
  ctx: GenericMutationCtx<DataModel>,
  args: { userId: Id<'users'>; existingUserId: Id<'users'> | null },
  userOverride?: { deletedAt?: number; deactivatedAt?: number; purgedAt?: number } | null,
) {
  const user = userOverride !== undefined ? userOverride : await ctx.db.get(args.userId)
  if (!user?.deletedAt && !user?.deactivatedAt) return

  // Verify that the incoming identity matches the existing account to prevent bypass.
  if (args.existingUserId && args.existingUserId !== args.userId) {
    return
  }

  if (user.deactivatedAt) {
    throw new ConvexError(DELETED_ACCOUNT_REAUTH_MESSAGE)
  }

  const userId = args.userId
  const deletedAt = user.deletedAt ?? Date.now()
  const banRecords = await ctx.db
    .query('auditLogs')
    .withIndex('by_target', (q) => q.eq('targetType', 'user').eq('targetId', userId.toString()))
    .collect()

  const hasBlockingBan = banRecords.some((record) => REAUTH_BLOCKING_BAN_ACTIONS.has(record.action))

  if (hasBlockingBan) {
    throw new ConvexError(BANNED_REAUTH_MESSAGE)
  }

  // Migrate legacy self-deleted accounts (stored in deletedAt) to the new
  // irreversible state and reject sign-in.
  await ctx.db.patch(userId, {
    deletedAt: undefined,
    deactivatedAt: deletedAt,
    purgedAt: user.purgedAt ?? deletedAt,
    updatedAt: Date.now(),
  })

  throw new ConvexError(DELETED_ACCOUNT_REAUTH_MESSAGE)
}

const authRuntime = ensureAuthRuntime()

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      clientId: authRuntime.githubClientId,
      clientSecret: authRuntime.githubClientSecret,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.login,
          email: profile.email ?? undefined,
          image: profile.avatar_url,
        }
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      return normalizeRedirectTarget(redirectTo, authRuntime.siteUrl)
    },
    /**
     * Block sign-in for deleted/deactivated users and sync GitHub profile.
     *
     * Performance note: This callback runs on every OAuth sign-in, but the
     * audit log query ONLY executes when a legacy deleted user attempts to sign
     * in (user.deletedAt is set). For active users, this is a single field check.
     *
     * The GitHub profile sync is scheduled as a background action to handle
     * the case where a user renames their GitHub account (fixes #303).
     */
    async afterUserCreatedOrUpdated(ctx, args) {
      const user = await ctx.db.get(args.userId)
      await handleDeletedUserSignIn(ctx, args, user)

      // Schedule GitHub profile sync to handle username renames (fixes #303)
      // This runs as a background action so it doesn't block sign-in
      const now = Date.now()
      if (shouldScheduleGitHubProfileSync(user, now)) {
        await ctx.scheduler.runAfter(0, internal.users.syncGitHubProfileAction, {
          userId: args.userId,
        })
      }
    },
  },
})

function ensureAuthRuntime() {
  const siteUrl = normalizeOrigin(process.env.SITE_URL) ?? FALLBACK_SITE_URL
  const soulsSiteUrl = normalizeOrigin(process.env.SOUL_SITE_URL) ?? FALLBACK_SOULS_SITE_URL
  const convexSiteUrl =
    normalizeOrigin(process.env.CONVEX_SITE_URL) ??
    normalizeOrigin(process.env.CUSTOM_AUTH_SITE_URL) ??
    FALLBACK_CONVEX_SITE_URL
  const githubClientId =
    process.env.AUTH_GITHUB_ID?.trim() ||
    process.env.GITHUB_CLIENT_ID?.trim() ||
    FALLBACK_GITHUB_CLIENT_ID
  const githubClientSecret =
    process.env.AUTH_GITHUB_SECRET?.trim() ||
    process.env.GITHUB_CLIENT_SECRET?.trim() ||
    'd0a90ce96fe9dfa55bf02425acd39f27221cb2f2'

  process.env.SITE_URL = siteUrl
  process.env.CONVEX_SITE_URL = convexSiteUrl

  return {
    siteUrl,
    soulsSiteUrl,
    convexSiteUrl,
    githubClientId,
    githubClientSecret,
  }
}

function normalizeOrigin(value: string | undefined | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

function normalizeRedirectTarget(redirectTo: string, defaultSiteUrl: string) {
  if (redirectTo.startsWith('?') || redirectTo.startsWith('/')) {
    return `${defaultSiteUrl}${redirectTo}`
  }

  const destination = new URL(redirectTo)
  const allowedOrigins = new Set([
    defaultSiteUrl,
    authRuntime.soulsSiteUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
  if (allowedOrigins.has(destination.origin)) {
    return destination.toString()
  }
  throw new Error(`Invalid redirectTo ${redirectTo}`)
}
