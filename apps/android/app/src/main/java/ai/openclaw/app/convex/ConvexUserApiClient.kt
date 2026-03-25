package ai.openclaw.app.convex

import ai.openclaw.app.solana.SolanaTrackerDatastreamEvent
import ai.openclaw.app.solana.SolanaTrackerDatastreamSnapshot
import ai.openclaw.app.solana.SolanaTrackerDexOverview
import ai.openclaw.app.solana.SolanaTrackerHolder
import ai.openclaw.app.solana.SolanaTrackerMarketToken
import ai.openclaw.app.solana.SolanaTrackerOhlcvPoint
import ai.openclaw.app.solana.SolanaTrackerTokenDetail
import ai.openclaw.app.solana.SolanaTrackerTrade
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
data class ConvexHealthSnapshot(
  val status: String,
  @SerialName("siteUrl") val siteUrl: String? = null,
  @SerialName("cloudUrl") val cloudUrl: String? = null,
  @SerialName("backend") val backend: String? = null,
)

@Serializable
data class ConvexWalletUserUpsertRequest(
  @SerialName("walletAddress") val walletAddress: String,
  @SerialName("displayName") val displayName: String? = null,
  @SerialName("appVersion") val appVersion: String,
  @SerialName("signedAtMs") val signedAtMs: Long,
  @SerialName("nonce") val nonce: String,
  @SerialName("signatureBase58") val signatureBase58: String,
)

@Serializable
data class ConvexWalletUser(
  @SerialName("walletAddress") val walletAddress: String,
  @SerialName("displayName") val displayName: String? = null,
  @SerialName("appVersion") val appVersion: String? = null,
  @SerialName("firstSeenAt") val firstSeenAt: Long,
  @SerialName("lastSeenAt") val lastSeenAt: Long,
  @SerialName("sessionToken") val sessionToken: String? = null,
  @SerialName("sessionExpiresAt") val sessionExpiresAt: Long? = null,
)

@Serializable
data class ConvexWalletUserUpsertResponse(
  val status: String,
  val user: ConvexWalletUser,
)

@Serializable
data class ConvexAgentService(
  @SerialName("type") val type: String,
  @SerialName("value") val value: String,
)

@Serializable
data class ConvexWalletAgent(
  @SerialName("_id") val id: String,
  @SerialName("ownerWalletAddress") val ownerWalletAddress: String,
  @SerialName("registryMode") val registryMode: String,
  @SerialName("name") val name: String,
  @SerialName("symbol") val symbol: String? = null,
  @SerialName("description") val description: String,
  @SerialName("metadataUri") val metadataUri: String? = null,
  @SerialName("ownerVerified") val ownerVerified: Boolean = false,
  @SerialName("cluster") val cluster: String,
  @SerialName("status") val status: String,
  @SerialName("errorMessage") val errorMessage: String? = null,
  @SerialName("metaplexAssetAddress") val metaplexAssetAddress: String? = null,
  @SerialName("metaplexIdentityPda") val metaplexIdentityPda: String? = null,
  @SerialName("metaplexExecutiveProfilePda") val metaplexExecutiveProfilePda: String? = null,
  @SerialName("metaplexDelegateRecordPda") val metaplexDelegateRecordPda: String? = null,
  @SerialName("metaplexRegistered") val metaplexRegistered: Boolean = false,
  @SerialName("services") val services: List<ConvexAgentService> = emptyList(),
  @SerialName("explorerAssetUrl") val explorerAssetUrl: String? = null,
  @SerialName("explorerRegistrationUrl") val explorerRegistrationUrl: String? = null,
  @SerialName("explorerTransferUrl") val explorerTransferUrl: String? = null,
  @SerialName("explorerMetaplexAssetUrl") val explorerMetaplexAssetUrl: String? = null,
  @SerialName("explorerMetaplexRegistrationUrl") val explorerMetaplexRegistrationUrl: String? = null,
  @SerialName("explorerMetaplexDelegateUrl") val explorerMetaplexDelegateUrl: String? = null,
  @SerialName("explorerMetaplexTransferUrl") val explorerMetaplexTransferUrl: String? = null,
) {
  fun publicProfileUrl(): String? =
    services.firstOrNull { it.type.equals("web", ignoreCase = true) }?.value?.takeIf { it.isNotBlank() }

  fun agentCardUrl(): String? =
    services.firstOrNull { it.type.equals("a2a", ignoreCase = true) }?.value?.takeIf { it.isNotBlank() }

  fun mcpUrl(): String? =
    services.firstOrNull { it.type.equals("mcp", ignoreCase = true) }?.value?.takeIf { it.isNotBlank() }

  fun acpCommand(): String? =
    services.firstOrNull { it.type.equals("ACP_COMMAND", ignoreCase = true) }?.value?.takeIf { it.isNotBlank() }
}

@Serializable
private data class ConvexWalletAgentsResponse(
  val status: String,
  val agents: List<ConvexWalletAgent>,
)

@Serializable
data class ConvexPairingClaimRequest(
  @SerialName("pairingToken") val pairingToken: String,
  @SerialName("walletAddress") val walletAddress: String,
  @SerialName("displayName") val displayName: String? = null,
  @SerialName("appVersion") val appVersion: String,
  @SerialName("signedAtMs") val signedAtMs: Long,
  @SerialName("nonce") val nonce: String,
  @SerialName("signatureBase58") val signatureBase58: String,
)

@Serializable
data class ConvexPairingClaimResponse(
  val status: String,
  val user: ConvexWalletUser,
)

@Serializable
data class ConvexGalleryArtist(
  @SerialName("_id") val id: String,
  @SerialName("handle") val handle: String? = null,
  @SerialName("name") val name: String? = null,
  @SerialName("displayName") val displayName: String? = null,
  @SerialName("image") val image: String? = null,
  @SerialName("bio") val bio: String? = null,
)

@Serializable
data class ConvexGalleryArtwork(
  @SerialName("_id") val id: String,
  @SerialName("title") val title: String? = null,
  @SerialName("caption") val caption: String? = null,
  @SerialName("source") val source: String,
  @SerialName("sourcePrompt") val sourcePrompt: String? = null,
  @SerialName("sourceModel") val sourceModel: String? = null,
  @SerialName("ratingCount") val ratingCount: Int,
  @SerialName("averageRating") val averageRating: Double,
  @SerialName("createdAt") val createdAt: Long,
)

@Serializable
data class ConvexGalleryFeedItem(
  @SerialName("artwork") val artwork: ConvexGalleryArtwork,
  @SerialName("artist") val artist: ConvexGalleryArtist,
  @SerialName("imageUrl") val imageUrl: String,
  @SerialName("viewerRating") val viewerRating: Int? = null,
)

@Serializable
private data class ConvexGalleryFeedResponse(
  val status: String,
  val feed: List<ConvexGalleryFeedItem>,
)

@Serializable
data class ConvexGalleryGenerateRequest(
  @SerialName("prompt") val prompt: String,
  @SerialName("title") val title: String? = null,
  @SerialName("caption") val caption: String? = null,
  @SerialName("aspectRatio") val aspectRatio: String? = null,
  @SerialName("resolution") val resolution: String? = null,
)

@Serializable
data class ConvexGalleryGenerateResponse(
  val status: String,
  @SerialName("artworkId") val artworkId: String,
)

@Serializable
data class ConvexGalleryRateRequest(
  @SerialName("artworkId") val artworkId: String,
  @SerialName("value") val value: Int,
)

@Serializable
data class ConvexGalleryRateResponse(
  val status: String,
  @SerialName("value") val value: Int,
  @SerialName("averageRating") val averageRating: Double,
  @SerialName("ratingCount") val ratingCount: Int,
)

@Serializable
data class ConvexAiChessMoveRequest(
  @SerialName("provider") val provider: String,
  @SerialName("systemPrompt") val systemPrompt: String,
  @SerialName("userPrompt") val userPrompt: String,
)

@Serializable
data class ConvexTokenAnalysisRequest(
  @SerialName("mint") val mint: String,
  @SerialName("systemPrompt") val systemPrompt: String,
  @SerialName("userPrompt") val userPrompt: String,
)

@Serializable
data class ConvexAiTextResponse(
  val status: String,
  @SerialName("content") val content: String,
  @SerialName("model") val model: String? = null,
  @SerialName("provider") val provider: String? = null,
  @SerialName("mint") val mint: String? = null,
)

@Serializable
private data class ConvexTrackerTokensResponse(
  val status: String,
  @SerialName("slot") val slot: Long? = null,
  @SerialName("tokens") val tokens: List<SolanaTrackerMarketToken>,
)

@Serializable
private data class ConvexTrackerOverviewResponse(
  val status: String,
  @SerialName("slot") val slot: Long? = null,
  @SerialName("latest") val latest: List<SolanaTrackerMarketToken>,
  @SerialName("graduating") val graduating: List<SolanaTrackerMarketToken>,
  @SerialName("graduated") val graduated: List<SolanaTrackerMarketToken>,
)

@Serializable
data class ConvexTrackerTokenBundle(
  @SerialName("token") val token: SolanaTrackerTokenDetail,
  @SerialName("trades") val trades: List<SolanaTrackerTrade>,
  @SerialName("holders") val holders: List<SolanaTrackerHolder>,
  @SerialName("chart") val chart: List<SolanaTrackerOhlcvPoint>,
)

@Serializable
private data class ConvexTrackerTokenBundleResponse(
  val status: String,
  @SerialName("token") val token: SolanaTrackerTokenDetail,
  @SerialName("trades") val trades: List<SolanaTrackerTrade>,
  @SerialName("holders") val holders: List<SolanaTrackerHolder>,
  @SerialName("chart") val chart: List<SolanaTrackerOhlcvPoint>,
)

@Serializable
data class ConvexTrackerLivePayload(
  @SerialName("slot") val slot: Long? = null,
  @SerialName("liveSlot") val liveSlot: Long? = null,
  @SerialName("globalEvents") val globalEvents: List<SolanaTrackerDatastreamEvent>,
  @SerialName("focusedEvents") val focusedEvents: List<SolanaTrackerDatastreamEvent>,
  @SerialName("snapshot") val snapshot: SolanaTrackerDatastreamSnapshot,
)

@Serializable
private data class ConvexTrackerLiveResponse(
  val status: String,
  @SerialName("slot") val slot: Long? = null,
  @SerialName("liveSlot") val liveSlot: Long? = null,
  @SerialName("globalEvents") val globalEvents: List<SolanaTrackerDatastreamEvent>,
  @SerialName("focusedEvents") val focusedEvents: List<SolanaTrackerDatastreamEvent>,
  @SerialName("snapshot") val snapshot: SolanaTrackerDatastreamSnapshot,
)

@Serializable
data class ConvexChessMatchSummary(
  @SerialName("matchId") val matchId: String,
  @SerialName("inviterWalletAddress") val inviterWalletAddress: String,
  @SerialName("inviterLabel") val inviterLabel: String? = null,
  @SerialName("inviterColor") val inviterColor: String,
  @SerialName("whiteWalletAddress") val whiteWalletAddress: String? = null,
  @SerialName("blackWalletAddress") val blackWalletAddress: String? = null,
  @SerialName("viewerColor") val viewerColor: String? = null,
  @SerialName("opponentWalletAddress") val opponentWalletAddress: String? = null,
  @SerialName("positionFingerprint") val positionFingerprint: String,
  @SerialName("positionStatus") val positionStatus: String,
  @SerialName("moveCount") val moveCount: Int,
  @SerialName("latestPacketKind") val latestPacketKind: String,
  @SerialName("latestSignerWalletAddress") val latestSignerWalletAddress: String,
  @SerialName("latestMove") val latestMove: String? = null,
  @SerialName("latestMoveDisplay") val latestMoveDisplay: String? = null,
  @SerialName("latestSignedAtMs") val latestSignedAtMs: Long,
  @SerialName("lastMoveAt") val lastMoveAt: Long? = null,
  @SerialName("createdAt") val createdAt: Long,
  @SerialName("updatedAt") val updatedAt: Long,
)

@Serializable
data class ConvexChessPacketEvent(
  @SerialName("packetKind") val packetKind: String,
  @SerialName("packetEncoded") val packetEncoded: String,
  @SerialName("signerWalletAddress") val signerWalletAddress: String,
  @SerialName("payloadJson") val payloadJson: String,
  @SerialName("signatureBase58") val signatureBase58: String,
  @SerialName("ply") val ply: Int? = null,
  @SerialName("move") val move: String? = null,
  @SerialName("moveDisplay") val moveDisplay: String? = null,
  @SerialName("beforeFingerprint") val beforeFingerprint: String? = null,
  @SerialName("afterFingerprint") val afterFingerprint: String? = null,
  @SerialName("signedAtMs") val signedAtMs: Long,
  @SerialName("createdAt") val createdAt: Long,
)

@Serializable
private data class ConvexChessMatchesResponse(
  val status: String,
  val matches: List<ConvexChessMatchSummary>,
)

@Serializable
data class ConvexChessMatchDetail(
  @SerialName("summary") val summary: ConvexChessMatchSummary,
  @SerialName("events") val events: List<ConvexChessPacketEvent>,
)

@Serializable
private data class ConvexChessMatchDetailResponse(
  val status: String,
  val summary: ConvexChessMatchSummary,
  val events: List<ConvexChessPacketEvent>,
)

@Serializable
data class ConvexChessSavePacketRequest(
  @SerialName("matchId") val matchId: String,
  @SerialName("packetKind") val packetKind: String,
  @SerialName("packetEncoded") val packetEncoded: String,
  @SerialName("signerWalletAddress") val signerWalletAddress: String,
  @SerialName("payloadJson") val payloadJson: String,
  @SerialName("signatureBase58") val signatureBase58: String,
  @SerialName("inviterWalletAddress") val inviterWalletAddress: String,
  @SerialName("inviterLabel") val inviterLabel: String? = null,
  @SerialName("inviterColor") val inviterColor: String,
  @SerialName("remoteWalletAddress") val remoteWalletAddress: String? = null,
  @SerialName("localColor") val localColor: String,
  @SerialName("positionFingerprint") val positionFingerprint: String,
  @SerialName("positionStatus") val positionStatus: String,
  @SerialName("moveCount") val moveCount: Int,
  @SerialName("signedAtMs") val signedAtMs: Long,
  @SerialName("ply") val ply: Int? = null,
  @SerialName("move") val move: String? = null,
  @SerialName("moveDisplay") val moveDisplay: String? = null,
  @SerialName("beforeFingerprint") val beforeFingerprint: String? = null,
  @SerialName("afterFingerprint") val afterFingerprint: String? = null,
)

@Serializable
data class ConvexChessSavePacketResponse(
  val status: String,
  @SerialName("matchId") val matchId: String,
  @SerialName("moveCount") val moveCount: Int,
  @SerialName("updatedAt") val updatedAt: Long,
  @SerialName("packetStored") val packetStored: Boolean,
)

internal class ConvexUserApiClient(
  private val cloudUrl: String,
  private val siteUrl: String,
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient = OkHttpClient(),
) {
  fun isConfigured(): Boolean = siteUrl.trim().isNotEmpty()

  suspend fun fetchHealth(): ConvexHealthSnapshot =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/health"))
          .get()
          .build()
      val payload = execute(request)
      val decoded = json.decodeFromString<ConvexHealthSnapshot>(payload)
      decoded.copy(
        siteUrl = decoded.siteUrl ?: siteUrl.takeIf { it.isNotBlank() },
        cloudUrl = decoded.cloudUrl ?: cloudUrl.takeIf { it.isNotBlank() },
      )
    }

  suspend fun upsertWalletUser(requestBody: ConvexWalletUserUpsertRequest): ConvexWalletUserUpsertResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/users/upsert"))
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexWalletUserUpsertRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexWalletUserUpsertResponse>(payload)
    }

  suspend fun claimPairingSession(requestBody: ConvexPairingClaimRequest): ConvexPairingClaimResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/pairing/claim"))
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexPairingClaimRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexPairingClaimResponse>(payload)
    }

  suspend fun listWalletAgents(sessionToken: String): List<ConvexWalletAgent> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex agent registry session is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/agents/mine"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .get()
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexWalletAgentsResponse>(payload).agents
    }

  suspend fun listGalleryFeed(
    limit: Int = 12,
    sessionToken: String? = null,
  ): List<ConvexGalleryFeedItem> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val normalizedLimit = limit.coerceIn(1, 24)
      val requestBuilder =
        Request.Builder()
          .url(resolveUrl("/nanosolana/gallery/feed?limit=$normalizedLimit"))
          .get()
      sessionToken?.trim()?.takeIf { it.isNotEmpty() }?.let { token ->
        requestBuilder.header("Authorization", "Bearer $token")
      }
      val payload = execute(requestBuilder.build())
      json.decodeFromString<ConvexGalleryFeedResponse>(payload).feed
    }

  suspend fun generateGalleryArtwork(
    sessionToken: String,
    requestBody: ConvexGalleryGenerateRequest,
  ): ConvexGalleryGenerateResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex gallery session is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/gallery/generate"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexGalleryGenerateRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexGalleryGenerateResponse>(payload)
    }

  suspend fun rateGalleryArtwork(
    sessionToken: String,
    requestBody: ConvexGalleryRateRequest,
  ): ConvexGalleryRateResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex gallery session is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/gallery/rate"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexGalleryRateRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexGalleryRateResponse>(payload)
    }

  suspend fun requestAiChessMove(
    sessionToken: String,
    requestBody: ConvexAiChessMoveRequest,
  ): ConvexAiTextResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex AI session is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/ai/chess-move"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexAiChessMoveRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexAiTextResponse>(payload)
    }

  suspend fun requestTokenAnalysis(
    sessionToken: String,
    requestBody: ConvexTokenAnalysisRequest,
  ): ConvexAiTextResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex AI session is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/ai/token-analysis"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexTokenAnalysisRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexAiTextResponse>(payload)
    }

  suspend fun fetchTrackerDexBoard(limit: Int = 12): Pair<Long?, List<SolanaTrackerMarketToken>> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val normalizedLimit = limit.coerceIn(1, 100)
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/tracker/board?limit=$normalizedLimit"))
          .get()
          .build()
      val payload = execute(request)
      val decoded = json.decodeFromString<ConvexTrackerTokensResponse>(payload)
      decoded.slot to decoded.tokens
    }

  suspend fun searchTrackerTokens(
    query: String,
    limit: Int = 12,
  ): List<SolanaTrackerMarketToken> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(query.isNotBlank()) { "Tracker search query is missing." }
      val normalizedLimit = limit.coerceIn(1, 100)
      val encodedQuery = java.net.URLEncoder.encode(query.trim(), "UTF-8")
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/tracker/search?query=$encodedQuery&limit=$normalizedLimit"))
          .get()
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexTrackerTokensResponse>(payload).tokens
    }

  suspend fun fetchTrackerTrending(
    limit: Int = 18,
    timeframe: String = "1h",
  ): List<SolanaTrackerMarketToken> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val normalizedLimit = limit.coerceIn(1, 100)
      val encodedTimeframe = java.net.URLEncoder.encode(timeframe.trim().ifBlank { "1h" }, "UTF-8")
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/tracker/trending?limit=$normalizedLimit&timeframe=$encodedTimeframe"))
          .get()
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexTrackerTokensResponse>(payload).tokens
    }

  suspend fun fetchTrackerOverview(
    limit: Int = 24,
    minCurve: Double = 40.0,
    minHolders: Int = 20,
    reduceSpam: Boolean = true,
  ): Pair<Long?, SolanaTrackerDexOverview> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val request =
        Request.Builder()
          .url(
            resolveUrl(
              "/nanosolana/tracker/overview?limit=${limit.coerceIn(1, 100)}&minCurve=$minCurve&minHolders=${minHolders.coerceAtLeast(0)}&reduceSpam=$reduceSpam",
            ),
          )
          .get()
          .build()
      val payload = execute(request)
      val decoded = json.decodeFromString<ConvexTrackerOverviewResponse>(payload)
      decoded.slot to
        SolanaTrackerDexOverview(
          latest = decoded.latest,
          graduating = decoded.graduating,
          graduated = decoded.graduated,
        )
    }

  suspend fun fetchTrackerTokenBundle(
    mint: String,
    tradeLimit: Int = 12,
    holderLimit: Int = 10,
    candleType: String = "1m",
    chartLimit: Int = 24,
  ): ConvexTrackerTokenBundle =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(mint.isNotBlank()) { "Tracker mint is missing." }
      val encodedMint = java.net.URLEncoder.encode(mint.trim(), "UTF-8")
      val encodedCandleType = java.net.URLEncoder.encode(candleType.trim().ifBlank { "1m" }, "UTF-8")
      val request =
        Request.Builder()
          .url(
            resolveUrl(
              "/nanosolana/tracker/token?mint=$encodedMint&tradeLimit=${tradeLimit.coerceIn(1, 40)}&holderLimit=${holderLimit.coerceIn(1, 40)}&candleType=$encodedCandleType&chartLimit=${chartLimit.coerceIn(1, 240)}",
            ),
          )
          .get()
          .build()
      val payload = execute(request)
      val decoded = json.decodeFromString<ConvexTrackerTokenBundleResponse>(payload)
      ConvexTrackerTokenBundle(
        token = decoded.token,
        trades = decoded.trades,
        holders = decoded.holders,
        chart = decoded.chart,
      )
    }

  suspend fun fetchTrackerLive(
    mint: String? = null,
    globalLimit: Int = 8,
    tradeLimit: Int = 8,
  ): ConvexTrackerLivePayload =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      val url =
        StringBuilder(resolveUrl("/nanosolana/tracker/live?globalLimit=${globalLimit.coerceIn(1, 20)}&tradeLimit=${tradeLimit.coerceIn(1, 20)}")).apply {
          mint?.trim()?.takeIf { it.isNotEmpty() }?.let {
            append("&mint=").append(java.net.URLEncoder.encode(it, "UTF-8"))
          }
        }.toString()
      val request =
        Request.Builder()
          .url(url)
          .get()
          .build()
      val payload = execute(request)
      val decoded = json.decodeFromString<ConvexTrackerLiveResponse>(payload)
      ConvexTrackerLivePayload(
        slot = decoded.slot,
        liveSlot = decoded.liveSlot,
        globalEvents = decoded.globalEvents,
        focusedEvents = decoded.focusedEvents,
        snapshot = decoded.snapshot,
      )
    }

  suspend fun listChessMatches(
    sessionToken: String,
    limit: Int = 12,
  ): List<ConvexChessMatchSummary> =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex chess session is missing." }
      val normalizedLimit = limit.coerceIn(1, 30)
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/chess/matches?limit=$normalizedLimit"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .get()
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexChessMatchesResponse>(payload).matches
    }

  suspend fun getChessMatch(
    sessionToken: String,
    matchId: String,
  ): ConvexChessMatchDetail =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex chess session is missing." }
      require(matchId.isNotBlank()) { "Chess match id is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/chess/match?matchId=${java.net.URLEncoder.encode(matchId.trim(), "UTF-8")}"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .get()
          .build()
      val payload = execute(request)
      val decoded = json.decodeFromString<ConvexChessMatchDetailResponse>(payload)
      ConvexChessMatchDetail(summary = decoded.summary, events = decoded.events)
    }

  suspend fun saveChessPacket(
    sessionToken: String,
    requestBody: ConvexChessSavePacketRequest,
  ): ConvexChessSavePacketResponse =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Convex site URL is not configured." }
      require(sessionToken.isNotBlank()) { "Convex chess session is missing." }
      val request =
        Request.Builder()
          .url(resolveUrl("/nanosolana/chess/save-packet"))
          .header("Authorization", "Bearer ${sessionToken.trim()}")
          .header("Content-Type", "application/json")
          .post(json.encodeToString(ConvexChessSavePacketRequest.serializer(), requestBody).toRequestBody(jsonMediaType))
          .build()
      val payload = execute(request)
      json.decodeFromString<ConvexChessSavePacketResponse>(payload)
    }

  private fun resolveUrl(path: String): String =
    siteUrl.trimEnd('/') + path

  private fun execute(request: Request): String =
    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        throw IllegalStateException(payload.ifBlank { "Convex request failed with HTTP ${response.code}." })
      }
      payload
    }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}

fun convexWalletSignableMessage(
  walletAddress: String,
  displayName: String?,
  appVersion: String,
  signedAtMs: Long,
  nonce: String,
): String =
  buildString {
    append("SolanaOS Convex Auth\n")
    append("wallet=").append(walletAddress.trim()).append('\n')
    append("display_name=").append(displayName?.trim().orEmpty()).append('\n')
    append("app_version=").append(appVersion.trim()).append('\n')
    append("signed_at_ms=").append(signedAtMs).append('\n')
    append("nonce=").append(nonce.trim())
  }
