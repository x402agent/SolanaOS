import { ConvexReactClient } from 'convex/react'

export const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() ?? ''

export const convex = convexUrl ? new ConvexReactClient(convexUrl) : null
