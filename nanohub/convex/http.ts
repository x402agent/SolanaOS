import { ApiRoutes, LegacyApiRoutes } from 'solanaos-hub-schema'
import { httpRouter } from 'convex/server'
import { auth } from './auth'
import { downloadZip } from './downloads'
import {
  cliPublishHttp,
  cliSkillDeleteHttp,
  cliSkillUndeleteHttp,
  cliTelemetrySyncHttp,
  cliUploadUrlHttp,
  cliWhoamiHttp,
  getSkillHttp,
  resolveSkillVersionHttp,
  searchSkillsHttp,
} from './httpApi'
import {
  listSkillsV1Http,
  listSoulsV1Http,
  publishSkillV1Http,
  publishSoulV1Http,
  resolveSkillVersionV1Http,
  searchSkillsV1Http,
  skillsDeleteRouterV1Http,
  skillsGetRouterV1Http,
  skillsPostRouterV1Http,
  soulsDeleteRouterV1Http,
  soulsGetRouterV1Http,
  soulsPostRouterV1Http,
  starsDeleteRouterV1Http,
  starsPostRouterV1Http,
  transfersGetRouterV1Http,
  usersListV1Http,
  usersPostRouterV1Http,
  whoamiV1Http,
} from './httpApiV1'
import {
  ipfsGetRouterV1Http,
  ipfsPostRouterV1Http,
} from './httpApiV1'
import { pumpIngestHttp, pumpScanHttp } from './pumpTokens'
import { preflightHandler } from './httpPreflight'
import { appendMemoryHttp } from './nanosolanaMemory'
import {
  analyzeTokenWithGrokHttp,
  chooseAiChessMoveHttp,
  claimPairingSessionHttp,
  createPairingSessionHttp,
  createWalletAgentHttp,
  generateGalleryArtworkHttp,
  getPublicAgentCardHttp,
  getPublicAgentHttp,
  getPublicAgentRegistrationHttp,
  getPairingSessionStatusHttp,
  getWalletTelegramConfigHttp,
  getWalletUserSessionHttp,
  getChessMatchHttp,
  listChessMatchesHttp,
  listGalleryFeedHttp,
  listWalletAgentsHttp,
  nanosolanaHealthHttp,
  rateGalleryArtworkHttp,
  saveChessPacketHttp,
  setWalletTelegramConfigHttp,
  syncWalletAgentRegistryHttp,
  trackerBoardHttp,
  trackerHealthHttp,
  trackerLiveHttp,
  trackerOverviewHttp,
  trackerSearchHttp,
  trackerTokenHttp,
  trackerTrendingHttp,
  upsertWalletUserHttp,
} from './nanosolanaUsersHttp'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: ApiRoutes.download,
  method: 'GET',
  handler: downloadZip,
})

http.route({
  path: ApiRoutes.search,
  method: 'GET',
  handler: searchSkillsV1Http,
})

http.route({
  path: ApiRoutes.resolve,
  method: 'GET',
  handler: resolveSkillVersionV1Http,
})

http.route({
  path: ApiRoutes.skills,
  method: 'GET',
  handler: listSkillsV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.skills}/`,
  method: 'GET',
  handler: skillsGetRouterV1Http,
})

http.route({
  path: ApiRoutes.skills,
  method: 'POST',
  handler: publishSkillV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.skills}/`,
  method: 'POST',
  handler: skillsPostRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.skills}/`,
  method: 'DELETE',
  handler: skillsDeleteRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.stars}/`,
  method: 'POST',
  handler: starsPostRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.stars}/`,
  method: 'DELETE',
  handler: starsDeleteRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.transfers}/`,
  method: 'GET',
  handler: transfersGetRouterV1Http,
})

http.route({
  path: ApiRoutes.whoami,
  method: 'GET',
  handler: whoamiV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.users}/`,
  method: 'POST',
  handler: usersPostRouterV1Http,
})

http.route({
  path: ApiRoutes.users,
  method: 'GET',
  handler: usersListV1Http,
})

http.route({
  path: ApiRoutes.souls,
  method: 'GET',
  handler: listSoulsV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.souls}/`,
  method: 'GET',
  handler: soulsGetRouterV1Http,
})

http.route({
  path: ApiRoutes.souls,
  method: 'POST',
  handler: publishSoulV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.souls}/`,
  method: 'POST',
  handler: soulsPostRouterV1Http,
})

http.route({
  pathPrefix: `${ApiRoutes.souls}/`,
  method: 'DELETE',
  handler: soulsDeleteRouterV1Http,
})

// ── IPFS Hub Routes ─────────────────────────────────────────────────
http.route({
  pathPrefix: '/api/v1/ipfs/',
  method: 'GET',
  handler: ipfsGetRouterV1Http,
})

http.route({
  pathPrefix: '/api/v1/ipfs/',
  method: 'POST',
  handler: ipfsPostRouterV1Http,
})

http.route({
  pathPrefix: '/api/',
  method: 'OPTIONS',
  handler: preflightHandler,
})

http.route({
  path: '/nanosolana/memory/append',
  method: 'POST',
  handler: appendMemoryHttp,
})

http.route({
  path: '/nanosolana/memory/append',
  method: 'OPTIONS',
  handler: appendMemoryHttp,
})

http.route({
  path: '/nanosolana/agents/sync',
  method: 'POST',
  handler: syncWalletAgentRegistryHttp,
})

http.route({
  path: '/nanosolana/agents/sync',
  method: 'OPTIONS',
  handler: syncWalletAgentRegistryHttp,
})

http.route({
  path: '/nanosolana/health',
  method: 'GET',
  handler: nanosolanaHealthHttp,
})

http.route({
  path: '/nanosolana/health',
  method: 'OPTIONS',
  handler: nanosolanaHealthHttp,
})

http.route({
  path: '/nanosolana/users/upsert',
  method: 'POST',
  handler: upsertWalletUserHttp,
})

http.route({
  path: '/nanosolana/users/upsert',
  method: 'OPTIONS',
  handler: upsertWalletUserHttp,
})

http.route({
  path: '/nanosolana/users/session',
  method: 'GET',
  handler: getWalletUserSessionHttp,
})

http.route({
  path: '/nanosolana/users/session',
  method: 'OPTIONS',
  handler: getWalletUserSessionHttp,
})

http.route({
  path: '/nanosolana/users/telegram',
  method: 'GET',
  handler: getWalletTelegramConfigHttp,
})

http.route({
  path: '/nanosolana/users/telegram',
  method: 'POST',
  handler: setWalletTelegramConfigHttp,
})

http.route({
  path: '/nanosolana/users/telegram',
  method: 'OPTIONS',
  handler: setWalletTelegramConfigHttp,
})

http.route({
  path: '/nanosolana/pairing/create',
  method: 'POST',
  handler: createPairingSessionHttp,
})

http.route({
  path: '/nanosolana/pairing/create',
  method: 'OPTIONS',
  handler: createPairingSessionHttp,
})

http.route({
  path: '/nanosolana/pairing/status',
  method: 'GET',
  handler: getPairingSessionStatusHttp,
})

http.route({
  path: '/nanosolana/pairing/status',
  method: 'OPTIONS',
  handler: getPairingSessionStatusHttp,
})

http.route({
  path: '/nanosolana/pairing/claim',
  method: 'POST',
  handler: claimPairingSessionHttp,
})

http.route({
  path: '/nanosolana/pairing/claim',
  method: 'OPTIONS',
  handler: claimPairingSessionHttp,
})

http.route({
  path: '/nanosolana/agents/mine',
  method: 'GET',
  handler: listWalletAgentsHttp,
})

http.route({
  path: '/nanosolana/agents/mine',
  method: 'OPTIONS',
  handler: listWalletAgentsHttp,
})

http.route({
  path: '/nanosolana/agents/public',
  method: 'GET',
  handler: getPublicAgentHttp,
})

http.route({
  path: '/nanosolana/agents/public',
  method: 'OPTIONS',
  handler: getPublicAgentHttp,
})

http.route({
  path: '/nanosolana/agents/registration',
  method: 'GET',
  handler: getPublicAgentRegistrationHttp,
})

http.route({
  path: '/nanosolana/agents/registration',
  method: 'OPTIONS',
  handler: getPublicAgentRegistrationHttp,
})

http.route({
  path: '/nanosolana/agents/agent-card',
  method: 'GET',
  handler: getPublicAgentCardHttp,
})

http.route({
  path: '/nanosolana/agents/agent-card',
  method: 'OPTIONS',
  handler: getPublicAgentCardHttp,
})

http.route({
  path: '/nanosolana/agents/create',
  method: 'POST',
  handler: createWalletAgentHttp,
})

http.route({
  path: '/nanosolana/agents/create',
  method: 'OPTIONS',
  handler: createWalletAgentHttp,
})

http.route({
  path: '/nanosolana/gallery/feed',
  method: 'GET',
  handler: listGalleryFeedHttp,
})

http.route({
  path: '/nanosolana/gallery/feed',
  method: 'OPTIONS',
  handler: listGalleryFeedHttp,
})

http.route({
  path: '/nanosolana/gallery/generate',
  method: 'POST',
  handler: generateGalleryArtworkHttp,
})

http.route({
  path: '/nanosolana/gallery/generate',
  method: 'OPTIONS',
  handler: generateGalleryArtworkHttp,
})

http.route({
  path: '/nanosolana/gallery/rate',
  method: 'POST',
  handler: rateGalleryArtworkHttp,
})

http.route({
  path: '/nanosolana/gallery/rate',
  method: 'OPTIONS',
  handler: rateGalleryArtworkHttp,
})

http.route({
  path: '/nanosolana/tracker/health',
  method: 'GET',
  handler: trackerHealthHttp,
})

http.route({
  path: '/nanosolana/tracker/health',
  method: 'OPTIONS',
  handler: trackerHealthHttp,
})

http.route({
  path: '/nanosolana/tracker/board',
  method: 'GET',
  handler: trackerBoardHttp,
})

http.route({
  path: '/nanosolana/tracker/board',
  method: 'OPTIONS',
  handler: trackerBoardHttp,
})

http.route({
  path: '/nanosolana/tracker/search',
  method: 'GET',
  handler: trackerSearchHttp,
})

http.route({
  path: '/nanosolana/tracker/search',
  method: 'OPTIONS',
  handler: trackerSearchHttp,
})

http.route({
  path: '/nanosolana/tracker/trending',
  method: 'GET',
  handler: trackerTrendingHttp,
})

http.route({
  path: '/nanosolana/tracker/trending',
  method: 'OPTIONS',
  handler: trackerTrendingHttp,
})

http.route({
  path: '/nanosolana/tracker/overview',
  method: 'GET',
  handler: trackerOverviewHttp,
})

http.route({
  path: '/nanosolana/tracker/overview',
  method: 'OPTIONS',
  handler: trackerOverviewHttp,
})

http.route({
  path: '/nanosolana/tracker/token',
  method: 'GET',
  handler: trackerTokenHttp,
})

http.route({
  path: '/nanosolana/tracker/token',
  method: 'OPTIONS',
  handler: trackerTokenHttp,
})

http.route({
  path: '/nanosolana/tracker/live',
  method: 'GET',
  handler: trackerLiveHttp,
})

http.route({
  path: '/nanosolana/tracker/live',
  method: 'OPTIONS',
  handler: trackerLiveHttp,
})

// ── Pump Token Scanner Ingestion ─────────────────────────────────────
http.route({
  path: '/nanosolana/tracker/pump-ingest',
  method: 'POST',
  handler: pumpIngestHttp,
})

http.route({
  path: '/nanosolana/tracker/pump-ingest',
  method: 'OPTIONS',
  handler: pumpIngestHttp,
})

http.route({
  path: '/nanosolana/tracker/pump-scan',
  method: 'GET',
  handler: pumpScanHttp,
})

http.route({
  path: '/nanosolana/tracker/pump-scan',
  method: 'OPTIONS',
  handler: pumpScanHttp,
})

http.route({
  path: '/nanosolana/ai/chess-move',
  method: 'POST',
  handler: chooseAiChessMoveHttp,
})

http.route({
  path: '/nanosolana/ai/chess-move',
  method: 'OPTIONS',
  handler: chooseAiChessMoveHttp,
})

http.route({
  path: '/nanosolana/ai/token-analysis',
  method: 'POST',
  handler: analyzeTokenWithGrokHttp,
})

http.route({
  path: '/nanosolana/ai/token-analysis',
  method: 'OPTIONS',
  handler: analyzeTokenWithGrokHttp,
})

http.route({
  path: '/nanosolana/chess/matches',
  method: 'GET',
  handler: listChessMatchesHttp,
})

http.route({
  path: '/nanosolana/chess/matches',
  method: 'OPTIONS',
  handler: listChessMatchesHttp,
})

http.route({
  path: '/nanosolana/chess/match',
  method: 'GET',
  handler: getChessMatchHttp,
})

http.route({
  path: '/nanosolana/chess/match',
  method: 'OPTIONS',
  handler: getChessMatchHttp,
})

http.route({
  path: '/nanosolana/chess/save-packet',
  method: 'POST',
  handler: saveChessPacketHttp,
})

http.route({
  path: '/nanosolana/chess/save-packet',
  method: 'OPTIONS',
  handler: saveChessPacketHttp,
})

// TODO: remove legacy /api routes after deprecation window.
http.route({
  path: LegacyApiRoutes.download,
  method: 'GET',
  handler: downloadZip,
})
http.route({
  path: LegacyApiRoutes.search,
  method: 'GET',
  handler: searchSkillsHttp,
})

http.route({
  path: LegacyApiRoutes.skill,
  method: 'GET',
  handler: getSkillHttp,
})

http.route({
  path: LegacyApiRoutes.skillResolve,
  method: 'GET',
  handler: resolveSkillVersionHttp,
})

http.route({
  path: LegacyApiRoutes.cliWhoami,
  method: 'GET',
  handler: cliWhoamiHttp,
})

http.route({
  path: LegacyApiRoutes.cliUploadUrl,
  method: 'POST',
  handler: cliUploadUrlHttp,
})

http.route({
  path: LegacyApiRoutes.cliPublish,
  method: 'POST',
  handler: cliPublishHttp,
})

http.route({
  path: LegacyApiRoutes.cliTelemetrySync,
  method: 'POST',
  handler: cliTelemetrySyncHttp,
})

http.route({
  path: LegacyApiRoutes.cliSkillDelete,
  method: 'POST',
  handler: cliSkillDeleteHttp,
})

http.route({
  path: LegacyApiRoutes.cliSkillUndelete,
  method: 'POST',
  handler: cliSkillUndeleteHttp,
})

export default http
