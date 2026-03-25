const FALLBACK_CONVEX_SITE_URL = 'https://artful-frog-940.convex.site'

export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL?.trim() || FALLBACK_CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
