import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import { action, internalAction, internalMutation, internalQuery, mutation, query } from './functions'
import { requireUser, requireUserFromAction } from './lib/access'
import { toPublicUser, type PublicUser } from './lib/public'

const GALLERY_OPS_HANDLE = 'xai-gallery-bot'
const GALLERY_OPS_DISPLAY_NAME = 'xAI Gallery Bot'
const GALLERY_OPS_BIO = 'Server-side xAI generations published into the live gallery feed.'

type GalleryFeedRow = {
  artwork: Doc<'galleryArtworks'>
  artist: PublicUser
  imageUrl: string
  viewerRating: number | null
}

function normalizeGalleryLimit(limit?: number | null) {
  return Math.min(Math.max(limit ?? 24, 1), 60)
}

async function listFeedRows(
  ctx: QueryCtx,
  limit: number,
  viewerUserId?: Id<'users'> | null,
): Promise<GalleryFeedRow[]> {
  const artworks = await ctx.db
    .query('galleryArtworks')
    .withIndex('by_created')
    .order('desc')
    .take(limit)

  const rows = await Promise.all(
    artworks.map(async (artwork): Promise<GalleryFeedRow | null> => {
      const [artistDoc, imageUrl, viewerRatingDoc] = await Promise.all([
        ctx.db.get(artwork.artistUserId),
        ctx.storage.getUrl(artwork.storageId),
        viewerUserId
          ? ctx.db
              .query('galleryRatings')
              .withIndex('by_artwork_user', (q) =>
                q.eq('artworkId', artwork._id).eq('userId', viewerUserId),
              )
              .unique()
          : Promise.resolve(null),
      ])

      const artist = toPublicUser(artistDoc)
      if (!artist || !imageUrl) return null

      return {
        artwork,
        artist,
        imageUrl,
        viewerRating: viewerRatingDoc?.value ?? null,
      }
    }),
  )

  return rows.filter((row): row is GalleryFeedRow => row !== null)
}

export const listFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<GalleryFeedRow[]> => {
    const viewerUserId = await getAuthUserId(ctx)
    return listFeedRows(ctx, normalizeGalleryLimit(args.limit), viewerUserId)
  },
})

export const listFeedForViewerInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
    viewerUserId: v.optional(v.id('users')),
  },
  handler: async (ctx, args): Promise<GalleryFeedRow[]> =>
    listFeedRows(ctx, normalizeGalleryLimit(args.limit), args.viewerUserId ?? null),
})

export const createArtwork = mutation({
  args: {
    storageId: v.id('_storage'),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'galleryArtworks'>> => {
    const { userId } = await requireUser(ctx)
    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new Error('Uploaded image was not found.')

    const contentType = metadata.contentType ?? ''
    if (!contentType.startsWith('image/')) {
      throw new Error('Only image uploads can be added to the gallery.')
    }

    const title = args.title?.trim()
    const caption = args.caption?.trim()

    return ctx.runMutation(internal.gallery.insertArtworkInternal, {
      artistUserId: userId,
      storageId: args.storageId,
      title: title ? title.slice(0, 120) : undefined,
      caption: caption ? caption.slice(0, 800) : undefined,
      contentType,
      fileSize: metadata.size,
      source: 'upload',
    })
  },
})

export const insertArtworkInternal = internalMutation({
  args: {
    artistUserId: v.id('users'),
    storageId: v.id('_storage'),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    contentType: v.string(),
    fileSize: v.number(),
    source: v.union(v.literal('upload'), v.literal('xai')),
    sourcePrompt: v.optional(v.string()),
    sourceModel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'galleryArtworks'>> => {
    const now = Date.now()
    return ctx.db.insert('galleryArtworks', {
      artistUserId: args.artistUserId,
      title: args.title,
      caption: args.caption,
      storageId: args.storageId,
      source: args.source,
      sourcePrompt: args.sourcePrompt,
      sourceModel: args.sourceModel,
      contentType: args.contentType,
      fileSize: args.fileSize,
      ratingCount: 0,
      ratingTotal: 0,
      averageRating: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const ensureGalleryOpsUserInternal = internalMutation({
  args: {},
  handler: async (ctx): Promise<Id<'users'>> => {
    const now = Date.now()
    const existing = await ctx.db
      .query('users')
      .withIndex('handle', (q) => q.eq('handle', GALLERY_OPS_HANDLE))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: GALLERY_OPS_HANDLE,
        handle: GALLERY_OPS_HANDLE,
        displayName: GALLERY_OPS_DISPLAY_NAME,
        bio: GALLERY_OPS_BIO,
        role: existing.role ?? 'user',
        deactivatedAt: undefined,
        deletedAt: undefined,
        purgedAt: undefined,
        banReason: undefined,
        updatedAt: now,
      })
      return existing._id
    }

    return ctx.db.insert('users', {
      name: GALLERY_OPS_HANDLE,
      handle: GALLERY_OPS_HANDLE,
      displayName: GALLERY_OPS_DISPLAY_NAME,
      bio: GALLERY_OPS_BIO,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    })
  },
})

function fallbackGalleryDisplayName(walletAddress: string) {
  return `Seeker ${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
}

export const ensureGalleryUserForWalletInternal = internalMutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'users'>> => {
    const walletAddress = args.walletAddress.trim()
    if (!walletAddress) {
      throw new ConvexError('Wallet address is required.')
    }

    const nanosolanaUser = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .unique()
    if (!nanosolanaUser) {
      throw new ConvexError('Wallet must be synced to Convex before using the gallery.')
    }

    const nextDisplayName =
      args.displayName?.trim() ||
      nanosolanaUser.displayName?.trim() ||
      fallbackGalleryDisplayName(walletAddress)
    const now = Date.now()

    if (nanosolanaUser.galleryUserId) {
      const existingUser = await ctx.db.get(nanosolanaUser.galleryUserId)
      if (existingUser) {
        await ctx.db.patch(existingUser._id, {
          name: existingUser.name ?? walletAddress,
          displayName: nextDisplayName,
          bio: existingUser.bio ?? 'Seeker wallet-synced gallery user.',
          role: existingUser.role ?? 'user',
          deactivatedAt: undefined,
          deletedAt: undefined,
          purgedAt: undefined,
          banReason: undefined,
          updatedAt: now,
        })
        if (nextDisplayName != nanosolanaUser.displayName) {
          await ctx.db.patch(nanosolanaUser._id, {
            displayName: nextDisplayName,
            updatedAt: now,
          })
        }
        return existingUser._id
      }
    }

    const galleryUserId = await ctx.db.insert('users', {
      name: walletAddress,
      displayName: nextDisplayName,
      bio: 'Seeker wallet-synced gallery user.',
      role: 'user',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(nanosolanaUser._id, {
      galleryUserId,
      displayName: nextDisplayName,
      updatedAt: now,
    })

    return galleryUserId
  },
})

export const generateArtwork = action({
  args: {
    prompt: v.string(),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ artworkId: Id<'galleryArtworks'> }> => {
    const { userId } = await requireUserFromAction(ctx)
    return await generateAndStoreArtwork(ctx, {
      artistUserId: userId,
      prompt: args.prompt,
      title: args.title,
      caption: args.caption,
      aspectRatio: args.aspectRatio,
      resolution: args.resolution,
    })
  },
})

export const generateArtworkOpsInternal = internalAction({
  args: {
    prompt: v.string(),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ artworkId: Id<'galleryArtworks'>; artistUserId: Id<'users'> }> => {
    const artistUserId = await ctx.runMutation(internal.gallery.ensureGalleryOpsUserInternal, {})
    const result = await generateAndStoreArtwork(ctx, {
      artistUserId,
      prompt: args.prompt,
      title: args.title,
      caption: args.caption,
      aspectRatio: args.aspectRatio,
      resolution: args.resolution,
    })
    return { ...result, artistUserId }
  },
})

export const generateArtworkForUserInternal = internalAction({
  args: {
    artistUserId: v.id('users'),
    prompt: v.string(),
    title: v.optional(v.string()),
    caption: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ artworkId: Id<'galleryArtworks'> }> =>
    generateAndStoreArtwork(ctx, {
      artistUserId: args.artistUserId,
      prompt: args.prompt,
      title: args.title,
      caption: args.caption,
      aspectRatio: args.aspectRatio,
      resolution: args.resolution,
    }),
})

async function generateAndStoreArtwork(
  ctx: ActionCtx,
  args: {
    artistUserId: Id<'users'>
    prompt: string
    title?: string
    caption?: string
    aspectRatio?: string
    resolution?: string
  },
): Promise<{ artworkId: Id<'galleryArtworks'> }> {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    throw new ConvexError('XAI_API_KEY is not configured.')
  }

  const prompt = args.prompt.trim()
  if (!prompt) {
    throw new ConvexError('Enter a prompt before generating an image.')
  }

  const model = process.env.XAI_IMAGE_MODEL?.trim() || 'grok-imagine-image'
  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      response_format: 'b64_json',
      ...(args.aspectRatio?.trim() ? { aspect_ratio: args.aspectRatio.trim() } : {}),
      ...(args.resolution?.trim() ? { resolution: args.resolution.trim() } : {}),
    }),
  })

  const payloadText = await response.text()
  const payload = parseXaiImagePayload(payloadText)

  if (!response.ok) {
    throw new ConvexError(payload?.error?.message?.trim() || payloadText.trim() || 'xAI image generation failed.')
  }

  if (!payload) {
    throw new ConvexError('xAI returned an invalid image response.')
  }

  const imageData = payload.data?.[0]
  const base64 = imageData?.b64_json?.trim()
  if (!base64) {
    throw new ConvexError('xAI returned no image payload.')
  }

  const bytes = decodeBase64(base64)
  const contentType = imageData?.mime_type?.trim() || imageData?.content_type?.trim() || 'image/png'
  const storageId = await ctx.storage.store(new Blob([bytes], { type: contentType }))
  const title = args.title?.trim()
  const caption = args.caption?.trim()
  const artworkId: Id<'galleryArtworks'> = await ctx.runMutation(
    internal.gallery.insertArtworkInternal,
    {
      artistUserId: args.artistUserId,
      storageId,
      title: title ? title.slice(0, 120) : prompt.slice(0, 120),
      caption: caption ? caption.slice(0, 800) : undefined,
      contentType,
      fileSize: bytes.byteLength,
      source: 'xai',
      sourcePrompt: prompt.slice(0, 1_500),
      sourceModel: payload.model?.trim() || imageData?.model?.trim() || model,
    },
  )

  return { artworkId }
}

type XaiImagePayload = {
    error?: { message?: string }
    model?: string
    data?: Array<{
      b64_json?: string
      mime_type?: string
      content_type?: string
      model?: string
    }>
  }

function parseXaiImagePayload(payloadText: string): XaiImagePayload | null {
  const trimmed = payloadText.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as XaiImagePayload
  } catch {
    return null
  }
}

export const rateArtwork = mutation({
  args: {
    artworkId: v.id('galleryArtworks'),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    return saveArtworkRating(ctx, args.artworkId, userId, args.value)
  },
})

export const rateArtworkForUserInternal = internalMutation({
  args: {
    artworkId: v.id('galleryArtworks'),
    userId: v.id('users'),
    value: v.number(),
  },
  handler: async (ctx, args) => saveArtworkRating(ctx, args.artworkId, args.userId, args.value),
})

async function saveArtworkRating(
  ctx: MutationCtx,
  artworkId: Id<'galleryArtworks'>,
  userId: Id<'users'>,
  rawValue: number,
) {
  const value = Math.round(rawValue)
  if (value < 1 || value > 5) {
    throw new Error('Ratings must be between 1 and 5.')
  }

  const artwork = await ctx.db.get(artworkId)
  if (!artwork) throw new Error('Artwork not found.')

  const existing = await ctx.db
    .query('galleryRatings')
    .withIndex('by_artwork_user', (q) => q.eq('artworkId', artworkId).eq('userId', userId))
    .unique()

  const now = Date.now()

  if (existing) {
    const nextTotal = artwork.ratingTotal - existing.value + value
    const averageRating = artwork.ratingCount > 0 ? nextTotal / artwork.ratingCount : 0
    await ctx.db.patch(existing._id, {
      value,
      updatedAt: now,
    })
    await ctx.db.patch(artwork._id, {
      ratingTotal: nextTotal,
      averageRating,
      updatedAt: now,
    })
    return {
      value,
      averageRating,
      ratingCount: artwork.ratingCount,
    }
  }

  await ctx.db.insert('galleryRatings', {
    artworkId: artwork._id,
    userId,
    value,
    createdAt: now,
    updatedAt: now,
  })

  const nextCount = artwork.ratingCount + 1
  const nextTotal = artwork.ratingTotal + value
  const averageRating = nextTotal / nextCount
  await ctx.db.patch(artwork._id, {
    ratingCount: nextCount,
    ratingTotal: nextTotal,
    averageRating,
    updatedAt: now,
  })

  return { value, averageRating, ratingCount: nextCount }
}

function decodeBase64(base64: string) {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  throw new ConvexError('Base64 decoding is unavailable in this runtime.')
}
