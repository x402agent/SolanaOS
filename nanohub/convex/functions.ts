import type { DataModel } from './_generated/dataModel'
import {
  mutation as rawMutation,
  internalMutation as rawInternalMutation,
  query,
  internalQuery,
  action,
  internalAction,
  httpAction,
} from './_generated/server'
import { Triggers } from 'convex-helpers/server/triggers'
import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'
import { extractDigestFields, upsertSkillSearchDigest } from './lib/skillSearchDigest'

const triggers = new Triggers<DataModel>()

triggers.register('skills', async (ctx, change) => {
  if (change.operation === 'delete') {
    const existing = await ctx.db
      .query('skillSearchDigest')
      .withIndex('by_skill', (q) => q.eq('skillId', change.id))
      .unique()
    if (existing) await ctx.db.delete(existing._id)
  } else {
    await upsertSkillSearchDigest(ctx, extractDigestFields(change.newDoc))
  }
})

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB))
export const internalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB))
export { query, internalQuery, action, internalAction, httpAction }
