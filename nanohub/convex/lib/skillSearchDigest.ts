import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { HydratableSkill } from './public'

function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>
}

/**
 * Fields shared 1:1 between `skills` and `skillSearchDigest` (same name,
 * same type).  Used by both `extractDigestFields` and `digestToHydratableSkill`
 * so adding/removing a field here keeps them in sync.
 */
const SHARED_KEYS = [
  'slug',
  'displayName',
  'summary',
  'ownerUserId',
  'canonicalSkillId',
  'forkOf',
  'latestVersionId',
  'tags',
  'badges',
  'stats',
  'statsDownloads',
  'statsStars',
  'statsInstallsCurrent',
  'statsInstallsAllTime',
  'softDeletedAt',
  'moderationStatus',
  'moderationFlags',
  'moderationReason',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Doc<'skills'> & keyof Doc<'skillSearchDigest'>)[]

/** Fields stored in the skillSearchDigest table. */
export type SkillSearchDigestFields = Pick<Doc<'skills'>, (typeof SHARED_KEYS)[number]> & {
  skillId: Id<'skills'>
  isSuspicious?: boolean
}

/** Pick the subset of fields from a full skill doc needed for the digest. */
export function extractDigestFields(skill: Doc<'skills'>): SkillSearchDigestFields {
  return {
    ...pick(skill, [...SHARED_KEYS]),
    skillId: skill._id,
    isSuspicious: skill.isSuspicious,
  }
}

/**
 * Map a digest row to the HydratableSkill shape expected by toPublicSkill /
 * isPublicSkillDoc / isSkillSuspicious.  Fully type-checked: if
 * HydratableSkill gains a field the digest doesn't carry, this will fail
 * to compile.
 */
export function digestToHydratableSkill(digest: Doc<'skillSearchDigest'>): HydratableSkill {
  return {
    ...pick(digest, [...SHARED_KEYS]),
    _id: digest.skillId,
    _creationTime: digest.createdAt,
  }
}

/** Insert or update the digest row for a skill. */
export async function upsertSkillSearchDigest(
  ctx: Pick<MutationCtx, 'db'>,
  fields: SkillSearchDigestFields,
) {
  const existing = await ctx.db
    .query('skillSearchDigest')
    .withIndex('by_skill', (q) => q.eq('skillId', fields.skillId))
    .unique()
  if (existing) {
    await ctx.db.patch(existing._id, fields)
  } else {
    await ctx.db.insert('skillSearchDigest', fields)
  }
}
