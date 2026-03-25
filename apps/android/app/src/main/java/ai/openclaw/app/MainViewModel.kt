package ai.openclaw.app

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.camera.view.PreviewView
import androidx.core.net.toUri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.openclaw.app.bitaxe.BitaxeDeviceSnapshot
import ai.openclaw.app.chat.OpenRouterConversationTurn
import ai.openclaw.app.chat.OpenRouterDirectChatClient
import ai.openclaw.app.convex.ConvexAiChessMoveRequest
import ai.openclaw.app.convex.ConvexTokenAnalysisRequest
import ai.openclaw.app.convex.ConvexChessMatchDetail
import ai.openclaw.app.convex.ConvexChessMatchSummary
import ai.openclaw.app.convex.ConvexChessSavePacketRequest
import ai.openclaw.app.convex.ConvexHealthSnapshot
import ai.openclaw.app.convex.ConvexGalleryFeedItem
import ai.openclaw.app.convex.ConvexGalleryGenerateRequest
import ai.openclaw.app.convex.ConvexPairingClaimRequest
import ai.openclaw.app.convex.ConvexUserApiClient
import ai.openclaw.app.convex.ConvexGalleryRateRequest
import ai.openclaw.app.convex.ConvexWalletAgent
import ai.openclaw.app.convex.ConvexWalletUser
import ai.openclaw.app.convex.ConvexWalletUserUpsertRequest
import ai.openclaw.app.convex.convexWalletSignableMessage
import ai.openclaw.app.grok.GrokGeneratedImage
import ai.openclaw.app.grok.GrokSearchReply
import ai.openclaw.app.grok.GrokTextReply
import ai.openclaw.app.grok.XAiDirectClient
import ai.openclaw.app.gateway.GatewayEndpoint
import ai.openclaw.app.gateway.GatewayInvokeCatalog
import ai.openclaw.app.gateway.GatewayTransport
import ai.openclaw.app.chat.OutgoingAttachment
import ai.openclaw.app.chat.ChatTransportMode
import ai.openclaw.app.node.CameraCaptureManager
import ai.openclaw.app.node.CanvasController
import ai.openclaw.app.node.SmsManager
import ai.openclaw.app.solana.MobileWalletManager
import ai.openclaw.app.solana.MobileWalletDetachedMessagePayload
import ai.openclaw.app.solana.MobileWalletUiState
import ai.openclaw.app.solana.JupiterSwapApiClient
import ai.openclaw.app.solana.JupiterSwapQuotePreview
import ai.openclaw.app.solana.SolanaAppKitApiClient
import ai.openclaw.app.solana.SolanaControlApiClient
import ai.openclaw.app.solana.SolanaControlStatus
import ai.openclaw.app.solana.SolanaControlThreadItem
import ai.openclaw.app.solana.SolanaTrackerApiClient
import ai.openclaw.app.solana.SolanaTrackerDatastreamClient
import ai.openclaw.app.solana.SolanaTrackerDatastreamEvent
import ai.openclaw.app.solana.SolanaTrackerDatastreamSnapshot
import ai.openclaw.app.solana.SolanaTrackerDexOverview
import ai.openclaw.app.solana.SolanaTrackerHolder
import ai.openclaw.app.solana.SolanaTrackerMarketToken
import ai.openclaw.app.solana.SolanaTrackerOhlcvPoint
import ai.openclaw.app.solana.SolanaTrackerStreamClient
import ai.openclaw.app.solana.SolanaTrackerTokenDetail
import ai.openclaw.app.solana.SolanaTrackerTrade
import ai.openclaw.app.solana.SolanaNftMintResult
import ai.openclaw.app.solana.SolanaPayRequest
import ai.openclaw.app.solana.SolanaPayTransferExecutor
import ai.openclaw.app.ui.AppHomeTab
import ai.openclaw.app.ui.ChessAiProvider
import ai.openclaw.app.ui.ChessColor
import ai.openclaw.app.ui.ChessPosition
import ai.openclaw.app.ui.GrokChessMoveChoice
import ai.openclaw.app.ui.allLegalMoves
import ai.openclaw.app.ui.chessBoardAscii
import ai.openclaw.app.ui.chessMoveToken
import ai.openclaw.app.ui.parseGrokChessMoveChoice
import ai.openclaw.app.voice.VoiceConversationEntry
import com.funkatronics.encoders.Base58
import java.util.Base64
import java.util.UUID
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

data class SolanaTrackerAnalysisResult(
  val mint: String,
  val symbol: String,
  val content: String,
  val generatedAtMs: Long = System.currentTimeMillis(),
)

private data class SolanaTrackerBundle(
  val token: SolanaTrackerTokenDetail,
  val trades: List<SolanaTrackerTrade>,
  val holders: List<SolanaTrackerHolder>,
  val chart: List<SolanaTrackerOhlcvPoint>,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
  companion object {
    private const val GROK_SELF_TEST_TAG = "GrokSelfTest"
  }

  private val nodeApp: NodeApp = app as NodeApp
  private val runtime: NodeRuntime = nodeApp.runtime
  private val mobileWalletManager: MobileWalletManager = nodeApp.mobileWalletManager
  private val solanaControlApi = SolanaControlApiClient()
  private val solanaAppKitApi = SolanaAppKitApiClient()
  private val solanaPayTransferExecutor = SolanaPayTransferExecutor()
  private val jupiterSwapApi = JupiterSwapApiClient()
  private val solanaTrackerApi =
    SolanaTrackerApiClient(
      rpcUrl = BuildConfig.SOLANA_TRACKER_RPC_URL,
      dataApiKey =
        if (BuildConfig.SOLANA_TRACKER_DATA_API_KEY.isNotBlank()) {
          BuildConfig.SOLANA_TRACKER_DATA_API_KEY
        } else {
          BuildConfig.SOLANA_TRACKER_API_KEY
        },
    )
  private val solanaTrackerStream = SolanaTrackerStreamClient()
  private val solanaTrackerDatastream = SolanaTrackerDatastreamClient()
  private val convexUserApi =
    ConvexUserApiClient(
      cloudUrl = BuildConfig.CONVEX_URL,
      siteUrl = BuildConfig.CONVEX_SITE_URL,
    )
  private val xAiClient =
    XAiDirectClient(
      apiKey = BuildConfig.XAI_API_KEY,
      searchModel = BuildConfig.XAI_SEARCH_MODEL,
      imageModel = BuildConfig.XAI_IMAGE_MODEL,
    )
  private val openRouterChessClient =
    OpenRouterDirectChatClient(
      apiKeyProvider = { runtime.openRouterApiKey.value.trim().ifBlank { BuildConfig.OPENROUTER_API_KEY } },
      modelProvider = { BuildConfig.OPENROUTER_OPENAI_MODEL.trim().ifBlank { BuildConfig.OPENROUTER_MODEL } },
      json =
        Json {
          ignoreUnknownKeys = true
          explicitNulls = false
        },
    )
  private val _walletSignMessageDraft = MutableStateFlow("Authorize SolanaOS on Seeker")
  private val _walletTransactionDraft = MutableStateFlow("")
  private val _homeTabRequest = MutableStateFlow<AppHomeTab?>(null)
  private val _solanaControlBaseUrl = MutableStateFlow<String?>(null)
  private val _solanaControlStatus = MutableStateFlow<SolanaControlStatus?>(null)
  private val _solanaControlThreads = MutableStateFlow<List<SolanaControlThreadItem>>(emptyList())
  private val _solanaControlConnected = MutableStateFlow(false)
  private val _solanaControlBusy = MutableStateFlow(false)
  private val _solanaControlStatusText = MutableStateFlow("Control API idle")
  private val _solanaFeedStatusText = MutableStateFlow<String?>(null)
  private val _solanaPumpStatusText = MutableStateFlow<String?>(null)
  private val _solanaTokenMillStatusText = MutableStateFlow<String?>(null)
  private val _solanaTradeStatusText = MutableStateFlow<String?>(null)
  private val _solanaNftStatusText = MutableStateFlow<String?>(null)
  private val _solanaNftMintResult = MutableStateFlow<SolanaNftMintResult?>(null)
  private val _solanaPayUriDraft = MutableStateFlow("")
  private val _solanaPayRequest = MutableStateFlow<SolanaPayRequest?>(null)
  private val _solanaPayStatusText = MutableStateFlow<String?>(null)
  private val _dexSwapBusy = MutableStateFlow(false)
  private val _dexSwapQuote = MutableStateFlow<JupiterSwapQuotePreview?>(null)
  private val _dexSwapStatusText = MutableStateFlow(initialDexSwapStatusText())
  private val trackerProxyConfigured = BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()
  private val _solanaTrackerConfigured = MutableStateFlow(solanaTrackerApi.isConfigured() || trackerProxyConfigured)
  private val _solanaTrackerStreamAvailable =
    MutableStateFlow(BuildConfig.SOLANA_TRACKER_WS_URL.isNotBlank() || trackerProxyConfigured)
  private val _solanaTrackerStreamConnected = MutableStateFlow(false)
  private val _solanaTrackerDatastreamAvailable =
    MutableStateFlow(BuildConfig.SOLANA_TRACKER_DATASTREAM_KEY.isNotBlank() || trackerProxyConfigured)
  private val _solanaTrackerDatastreamConnected = MutableStateFlow(false)
  private val _solanaTrackerStatusText =
    MutableStateFlow(
      if (solanaTrackerApi.isConfigured()) {
        "Solana Tracker market data is ready."
      } else if (trackerProxyConfigured) {
        "Solana Tracker market data is available through Convex."
      } else {
        "Live market data is unavailable in this build."
      },
    )
  private val _solanaTrackerStreamStatusText =
    MutableStateFlow(
      if (BuildConfig.SOLANA_TRACKER_WS_URL.isNotBlank()) {
        "Live slot stream idle."
      } else if (trackerProxyConfigured) {
        "Live slot polling via Convex is idle."
      } else {
        "Add SOLANA_TRACKER_WS_URL or SOLANA_TRACKER_WSS_URL to enable live slot streaming."
      },
    )
  private val _solanaTrackerDatastreamStatusText =
    MutableStateFlow(
      if (BuildConfig.SOLANA_TRACKER_DATASTREAM_KEY.isNotBlank()) {
        "Tracker datastream idle."
      } else if (trackerProxyConfigured) {
        "Tracker live feed via Convex is idle."
      } else {
        "Add SOLANA_TRACKER_DATASTREAM_KEY to enable live market streams."
      },
    )
  private val _solanaTrackerRpcSlot = MutableStateFlow<Long?>(null)
  private val _solanaTrackerLiveSlot = MutableStateFlow<Long?>(null)
  private val _solanaTrackerTrendingTokens = MutableStateFlow<List<SolanaTrackerMarketToken>>(emptyList())
  private val _solanaTrackerDexOverview =
    MutableStateFlow(
      SolanaTrackerDexOverview(
        latest = emptyList(),
        graduating = emptyList(),
        graduated = emptyList(),
      ),
    )
  private val _solanaTrackerOverviewBusy = MutableStateFlow(false)
  private val _solanaTrackerOverviewStatusText =
    MutableStateFlow(
      if (solanaTrackerApi.hasMarketData()) {
        "DEX overview idle."
      } else if (trackerProxyConfigured) {
        "DEX overview via Convex is idle."
      } else {
        "DEX overview is unavailable in this build."
      },
    )
  private val _solanaTrackerTickerStatusText =
    MutableStateFlow(
      if (solanaTrackerApi.hasMarketData()) {
        "Trending ticker idle."
      } else if (trackerProxyConfigured) {
        "Trending ticker via Convex is idle."
      } else {
        "Add SOLANA_TRACKER_API_KEY or SOLANA_TRACKER_DATA_API_KEY to enable trending tokens."
      },
    )
  private val _solanaTrackerLiveFeed = MutableStateFlow<List<SolanaTrackerDatastreamEvent>>(emptyList())
  private val _solanaTrackerFocusedFeed = MutableStateFlow<List<SolanaTrackerDatastreamEvent>>(emptyList())
  private val _solanaTrackerLiveSnapshot = MutableStateFlow(SolanaTrackerDatastreamSnapshot())
  private val _solanaTrackerSearchBusy = MutableStateFlow(false)
  private val _solanaTrackerTokenBusy = MutableStateFlow(false)
  private val _solanaTrackerSearchResults = MutableStateFlow<List<SolanaTrackerMarketToken>>(emptyList())
  private val _solanaTrackerSelectedMint = MutableStateFlow<String?>(null)
  private val _solanaTrackerSelectedToken = MutableStateFlow<SolanaTrackerTokenDetail?>(null)
  private val _solanaTrackerSelectedTrades = MutableStateFlow<List<SolanaTrackerTrade>>(emptyList())
  private val _solanaTrackerSelectedHolders = MutableStateFlow<List<SolanaTrackerHolder>>(emptyList())
  private val _solanaTrackerSelectedChart = MutableStateFlow<List<SolanaTrackerOhlcvPoint>>(emptyList())
  private val _solanaTrackerAnalysisBusy = MutableStateFlow(false)
  private val _solanaTrackerAnalysisResult = MutableStateFlow<SolanaTrackerAnalysisResult?>(null)
  private val _solanaTrackerAnalysisStatusText =
    MutableStateFlow(
      if (BuildConfig.XAI_DIRECT_ENABLED && xAiClient.isConfigured()) {
        "Grok token analysis ready."
      } else if (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()) {
        "Grok token analysis is available through Convex after wallet sync."
      } else {
        "Add XAI_API_KEY to enable Grok token analysis."
      },
    )
  private val _grokConfigured = MutableStateFlow(BuildConfig.XAI_DIRECT_ENABLED && xAiClient.isConfigured())
  private val _openRouterChessConfigured =
    MutableStateFlow(
      (BuildConfig.OPENROUTER_DIRECT_ENABLED && openRouterChessClient.isConfigured()) ||
        (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()),
    )
  private val _convexConfigured = MutableStateFlow(BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured())
  private val _convexHealth = MutableStateFlow<ConvexHealthSnapshot?>(null)
  private val _convexRegisteredUser = MutableStateFlow<ConvexWalletUser?>(null)
  private val _convexBusy = MutableStateFlow(false)
  private val _convexWalletAgents = MutableStateFlow<List<ConvexWalletAgent>>(emptyList())
  private val _convexWalletAgentsBusy = MutableStateFlow(false)
  private val persistedConvexSession = runtime.prefs.loadConvexSession()
  private val _convexSessionToken = MutableStateFlow(persistedConvexSession?.sessionToken)
  private val _convexSessionExpiresAt = MutableStateFlow(persistedConvexSession?.sessionExpiresAt)
  private val _pendingConvexPairingToken = MutableStateFlow(runtime.prefs.getPendingConvexPairingToken())
  private val _convexStatusText =
    MutableStateFlow(
      if (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()) {
        "Convex backend ready."
      } else {
        "Convex backend is not configured in this build."
      },
    )
  private val _convexWalletAgentsStatusText =
    MutableStateFlow(
      if (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()) {
        "Agent registry is idle."
      } else {
        "Agent registry is unavailable in this build."
      },
    )
  private val _grokStatusText =
    MutableStateFlow(
      if (BuildConfig.XAI_DIRECT_ENABLED && xAiClient.isConfigured()) {
        "Grok workspace ready."
      } else {
        "Grok services are unavailable in this build."
      },
    )
  private val _openRouterChessStatusText =
    MutableStateFlow(
      if (BuildConfig.OPENROUTER_DIRECT_ENABLED && openRouterChessClient.isConfigured()) {
        "OpenAI chess via OpenRouter is ready."
      } else if (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()) {
        "OpenAI chess is available through Convex after wallet sync."
      } else {
        "Add OPENROUTER_API_KEY to enable OpenAI chess."
      },
    )
  private val _grokSearchBusy = MutableStateFlow(false)
  private val _grokSearchResult = MutableStateFlow<GrokSearchReply?>(null)
  private val _grokImageBusy = MutableStateFlow(false)
  private val _grokImageResult = MutableStateFlow<GrokGeneratedImage?>(null)
  private val _grokGalleryFeed = MutableStateFlow<List<ConvexGalleryFeedItem>>(emptyList())
  private val _grokGalleryBusy = MutableStateFlow(false)
  private val _grokGalleryRatingArtworkId = MutableStateFlow<String?>(null)
  private val _chessArchiveMatches = MutableStateFlow<List<ConvexChessMatchSummary>>(emptyList())
  private val _chessArchiveBusy = MutableStateFlow(false)
  private val _chessArchiveLoadingMatchId = MutableStateFlow<String?>(null)
  private val _chessArchiveStatusText =
    MutableStateFlow(
      if (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()) {
        "Signed chess archive idle."
      } else {
        "Signed chess archive is unavailable in this build."
      },
    )
  private val _grokGalleryStatusText =
    MutableStateFlow(
      if (BuildConfig.CONVEX_ENABLED && convexUserApi.isConfigured()) {
        "Convex gallery idle."
      } else {
        "Convex gallery is unavailable in this build."
      },
    )
  private val _grokRespondBusy = MutableStateFlow(false)
  private val _grokRespondResult = MutableStateFlow<GrokTextReply?>(null)
  private val _grokRequestedMode = MutableStateFlow<String?>(null)
  private var trackerStreamStarted = false
  private var trackerDatastreamStarted = false
  private var trackerTrendingLoopStarted = false
  private var trackerProxyPollingJob: Job? = null
  private var grokGalleryLoopStarted = false
  private var lastTrackerAutoRefreshSlot: Long? = null

  val canvas: CanvasController = runtime.canvas
  val canvasCurrentUrl: StateFlow<String?> = runtime.canvas.currentUrl
  val canvasA2uiHydrated: StateFlow<Boolean> = runtime.canvasA2uiHydrated
  val canvasRehydratePending: StateFlow<Boolean> = runtime.canvasRehydratePending
  val canvasRehydrateErrorText: StateFlow<String?> = runtime.canvasRehydrateErrorText
  val camera: CameraCaptureManager = runtime.camera
  val sms: SmsManager = runtime.sms

  val gateways: StateFlow<List<GatewayEndpoint>> = runtime.gateways
  val discoveryStatusText: StateFlow<String> = runtime.discoveryStatusText

  val isConnected: StateFlow<Boolean> = runtime.isConnected
  val isNodeConnected: StateFlow<Boolean> = runtime.nodeConnected
  val nodeBridgeOnly: StateFlow<Boolean> = runtime.nodeBridgeOnly
  val statusText: StateFlow<String> = runtime.statusText
  val serverName: StateFlow<String?> = runtime.serverName
  val remoteAddress: StateFlow<String?> = runtime.remoteAddress
  val bridgeInvokeTelemetry: StateFlow<List<ai.openclaw.app.gateway.GatewaySession.InvokeDeliveryUpdate>> = runtime.bridgeInvokeTelemetry
  val bridgeConsoleBusy: StateFlow<Boolean> = runtime.bridgeConsoleBusy
  val bridgeConsoleStatusText: StateFlow<String> = runtime.bridgeConsoleStatusText
  val bridgeConsoleResponseJson: StateFlow<String?> = runtime.bridgeConsoleResponseJson
  val pendingGatewayTrust: StateFlow<NodeRuntime.GatewayTrustPrompt?> = runtime.pendingGatewayTrust
  val isForeground: StateFlow<Boolean> = runtime.isForeground
  val seamColorArgb: StateFlow<Long> = runtime.seamColorArgb
  val mainSessionKey: StateFlow<String> = runtime.mainSessionKey

  val cameraHud: StateFlow<CameraHudState?> = runtime.cameraHud
  val cameraFlashToken: StateFlow<Long> = runtime.cameraFlashToken

  val instanceId: StateFlow<String> = runtime.instanceId
  val displayName: StateFlow<String> = runtime.displayName
  val cameraEnabled: StateFlow<Boolean> = runtime.cameraEnabled
  val locationMode: StateFlow<LocationMode> = runtime.locationMode
  val locationPreciseEnabled: StateFlow<Boolean> = runtime.locationPreciseEnabled
  val preventSleep: StateFlow<Boolean> = runtime.preventSleep
  val autoStartOnBoot: StateFlow<Boolean> = runtime.autoStartOnBoot
  val micEnabled: StateFlow<Boolean> = runtime.micEnabled
  val micCooldown: StateFlow<Boolean> = runtime.micCooldown
  val micStatusText: StateFlow<String> = runtime.micStatusText
  val micLiveTranscript: StateFlow<String?> = runtime.micLiveTranscript
  val micIsListening: StateFlow<Boolean> = runtime.micIsListening
  val micQueuedMessages: StateFlow<List<String>> = runtime.micQueuedMessages
  val micConversation: StateFlow<List<VoiceConversationEntry>> = runtime.micConversation
  val micInputLevel: StateFlow<Float> = runtime.micInputLevel
  val micIsSending: StateFlow<Boolean> = runtime.micIsSending
  val speakerEnabled: StateFlow<Boolean> = runtime.speakerEnabled
  val grokVoiceId: StateFlow<String> = runtime.grokVoiceId
  val grokVadThreshold: StateFlow<String> = runtime.grokVadThreshold
  val grokSilenceDurationMs: StateFlow<String> = runtime.grokSilenceDurationMs
  val grokSampleRate: StateFlow<String> = runtime.grokSampleRate
  val grokWebSearchEnabled: StateFlow<Boolean> = runtime.grokWebSearchEnabled
  val grokXSearchEnabled: StateFlow<Boolean> = runtime.grokXSearchEnabled
  val manualEnabled: StateFlow<Boolean> = runtime.manualEnabled
  val manualHost: StateFlow<String> = runtime.manualHost
  val manualPort: StateFlow<Int> = runtime.manualPort
  val manualTls: StateFlow<Boolean> = runtime.manualTls
  val manualTransport: StateFlow<GatewayTransport> = runtime.manualTransport
  val bitaxeApiBaseUrl: StateFlow<String> = runtime.bitaxeApiBaseUrl
  val bitaxeResolvedBaseUrl: StateFlow<String> = runtime.bitaxeResolvedBaseUrl
  val gatewayToken: StateFlow<String> = runtime.gatewayToken
  val bitaxeApiKey: StateFlow<String> = runtime.bitaxeApiKey
  val togetherApiKey: StateFlow<String> = runtime.togetherApiKey
  val togetherModel: StateFlow<String> = runtime.togetherModel
  val openRouterApiKey: StateFlow<String> = runtime.openRouterApiKey
  val openRouterModel: StateFlow<String> = runtime.openRouterModel
  val onboardingCompleted: StateFlow<Boolean> = runtime.onboardingCompleted
  val pendingConvexPairingToken: StateFlow<String?> = _pendingConvexPairingToken.asStateFlow()
  val canvasDebugStatusEnabled: StateFlow<Boolean> = runtime.canvasDebugStatusEnabled
  val rewardsWaitlistJoined: StateFlow<Boolean> = runtime.rewardsWaitlistJoined
  val mobileWalletState: StateFlow<MobileWalletUiState> = mobileWalletManager.state
  val walletSignMessageDraft: StateFlow<String> = _walletSignMessageDraft.asStateFlow()
  val walletTransactionDraft: StateFlow<String> = _walletTransactionDraft.asStateFlow()
  val homeTabRequest: StateFlow<AppHomeTab?> = _homeTabRequest.asStateFlow()
  val solanaControlBaseUrl: StateFlow<String?> = _solanaControlBaseUrl.asStateFlow()
  val solanaControlStatus: StateFlow<SolanaControlStatus?> = _solanaControlStatus.asStateFlow()
  val solanaControlThreads: StateFlow<List<SolanaControlThreadItem>> = _solanaControlThreads.asStateFlow()
  val solanaControlConnected: StateFlow<Boolean> = _solanaControlConnected.asStateFlow()
  val solanaControlBusy: StateFlow<Boolean> = _solanaControlBusy.asStateFlow()
  val solanaControlStatusText: StateFlow<String> = _solanaControlStatusText.asStateFlow()
  val solanaFeedStatusText: StateFlow<String?> = _solanaFeedStatusText.asStateFlow()
  val solanaPumpStatusText: StateFlow<String?> = _solanaPumpStatusText.asStateFlow()
  val solanaTokenMillStatusText: StateFlow<String?> = _solanaTokenMillStatusText.asStateFlow()
  val solanaTradeStatusText: StateFlow<String?> = _solanaTradeStatusText.asStateFlow()
  val solanaNftStatusText: StateFlow<String?> = _solanaNftStatusText.asStateFlow()
  val solanaNftMintResult: StateFlow<SolanaNftMintResult?> = _solanaNftMintResult.asStateFlow()
  val solanaPayUriDraft: StateFlow<String> = _solanaPayUriDraft.asStateFlow()
  val solanaPayRequest: StateFlow<SolanaPayRequest?> = _solanaPayRequest.asStateFlow()
  val solanaPayStatusText: StateFlow<String?> = _solanaPayStatusText.asStateFlow()
  val dexSwapBusy: StateFlow<Boolean> = _dexSwapBusy.asStateFlow()
  val dexSwapQuote: StateFlow<JupiterSwapQuotePreview?> = _dexSwapQuote.asStateFlow()
  val dexSwapStatusText: StateFlow<String> = _dexSwapStatusText.asStateFlow()
  val solanaTrackerConfigured: StateFlow<Boolean> = _solanaTrackerConfigured.asStateFlow()
  val solanaTrackerStreamAvailable: StateFlow<Boolean> = _solanaTrackerStreamAvailable.asStateFlow()
  val solanaTrackerStreamConnected: StateFlow<Boolean> = _solanaTrackerStreamConnected.asStateFlow()
  val solanaTrackerDatastreamAvailable: StateFlow<Boolean> = _solanaTrackerDatastreamAvailable.asStateFlow()
  val solanaTrackerDatastreamConnected: StateFlow<Boolean> = _solanaTrackerDatastreamConnected.asStateFlow()
  val solanaTrackerStatusText: StateFlow<String> = _solanaTrackerStatusText.asStateFlow()
  val solanaTrackerStreamStatusText: StateFlow<String> = _solanaTrackerStreamStatusText.asStateFlow()
  val solanaTrackerDatastreamStatusText: StateFlow<String> = _solanaTrackerDatastreamStatusText.asStateFlow()
  val solanaTrackerRpcSlot: StateFlow<Long?> = _solanaTrackerRpcSlot.asStateFlow()
  val solanaTrackerLiveSlot: StateFlow<Long?> = _solanaTrackerLiveSlot.asStateFlow()
  val solanaTrackerTrendingTokens: StateFlow<List<SolanaTrackerMarketToken>> = _solanaTrackerTrendingTokens.asStateFlow()
  val solanaTrackerDexOverview: StateFlow<SolanaTrackerDexOverview> = _solanaTrackerDexOverview.asStateFlow()
  val solanaTrackerOverviewBusy: StateFlow<Boolean> = _solanaTrackerOverviewBusy.asStateFlow()
  val solanaTrackerOverviewStatusText: StateFlow<String> = _solanaTrackerOverviewStatusText.asStateFlow()
  val solanaTrackerTickerStatusText: StateFlow<String> = _solanaTrackerTickerStatusText.asStateFlow()
  val solanaTrackerLiveFeed: StateFlow<List<SolanaTrackerDatastreamEvent>> = _solanaTrackerLiveFeed.asStateFlow()
  val solanaTrackerFocusedFeed: StateFlow<List<SolanaTrackerDatastreamEvent>> = _solanaTrackerFocusedFeed.asStateFlow()
  val solanaTrackerLiveSnapshot: StateFlow<SolanaTrackerDatastreamSnapshot> = _solanaTrackerLiveSnapshot.asStateFlow()
  val solanaTrackerSearchBusy: StateFlow<Boolean> = _solanaTrackerSearchBusy.asStateFlow()
  val solanaTrackerTokenBusy: StateFlow<Boolean> = _solanaTrackerTokenBusy.asStateFlow()
  val solanaTrackerSearchResults: StateFlow<List<SolanaTrackerMarketToken>> = _solanaTrackerSearchResults.asStateFlow()
  val solanaTrackerSelectedMint: StateFlow<String?> = _solanaTrackerSelectedMint.asStateFlow()
  val solanaTrackerSelectedToken: StateFlow<SolanaTrackerTokenDetail?> = _solanaTrackerSelectedToken.asStateFlow()
  val solanaTrackerSelectedTrades: StateFlow<List<SolanaTrackerTrade>> = _solanaTrackerSelectedTrades.asStateFlow()
  val solanaTrackerSelectedHolders: StateFlow<List<SolanaTrackerHolder>> = _solanaTrackerSelectedHolders.asStateFlow()
  val solanaTrackerSelectedChart: StateFlow<List<SolanaTrackerOhlcvPoint>> = _solanaTrackerSelectedChart.asStateFlow()
  val solanaTrackerAnalysisBusy: StateFlow<Boolean> = _solanaTrackerAnalysisBusy.asStateFlow()
  val solanaTrackerAnalysisResult: StateFlow<SolanaTrackerAnalysisResult?> = _solanaTrackerAnalysisResult.asStateFlow()
  val solanaTrackerAnalysisStatusText: StateFlow<String> = _solanaTrackerAnalysisStatusText.asStateFlow()
  val grokConfigured: StateFlow<Boolean> = _grokConfigured.asStateFlow()
  val openRouterChessConfigured: StateFlow<Boolean> = _openRouterChessConfigured.asStateFlow()
  val xAiVoiceConfigured: StateFlow<Boolean> = runtime.xAiVoiceConfigured
  val convexConfigured: StateFlow<Boolean> = _convexConfigured.asStateFlow()
  val convexHealth: StateFlow<ConvexHealthSnapshot?> = _convexHealth.asStateFlow()
  val convexRegisteredUser: StateFlow<ConvexWalletUser?> = _convexRegisteredUser.asStateFlow()
  val convexBusy: StateFlow<Boolean> = _convexBusy.asStateFlow()
  val convexStatusText: StateFlow<String> = _convexStatusText.asStateFlow()
  val convexWalletAgents: StateFlow<List<ConvexWalletAgent>> = _convexWalletAgents.asStateFlow()
  val convexWalletAgentsBusy: StateFlow<Boolean> = _convexWalletAgentsBusy.asStateFlow()
  val convexWalletAgentsStatusText: StateFlow<String> = _convexWalletAgentsStatusText.asStateFlow()
  val grokStatusText: StateFlow<String> = _grokStatusText.asStateFlow()
  val openRouterChessStatusText: StateFlow<String> = _openRouterChessStatusText.asStateFlow()
  val grokSearchBusy: StateFlow<Boolean> = _grokSearchBusy.asStateFlow()
  val grokSearchResult: StateFlow<GrokSearchReply?> = _grokSearchResult.asStateFlow()
  val grokImageBusy: StateFlow<Boolean> = _grokImageBusy.asStateFlow()
  val grokImageResult: StateFlow<GrokGeneratedImage?> = _grokImageResult.asStateFlow()
  val grokGalleryFeed: StateFlow<List<ConvexGalleryFeedItem>> = _grokGalleryFeed.asStateFlow()
  val grokGalleryBusy: StateFlow<Boolean> = _grokGalleryBusy.asStateFlow()
  val grokGalleryRatingArtworkId: StateFlow<String?> = _grokGalleryRatingArtworkId.asStateFlow()
  val chessArchiveMatches: StateFlow<List<ConvexChessMatchSummary>> = _chessArchiveMatches.asStateFlow()
  val chessArchiveBusy: StateFlow<Boolean> = _chessArchiveBusy.asStateFlow()
  val chessArchiveLoadingMatchId: StateFlow<String?> = _chessArchiveLoadingMatchId.asStateFlow()
  val chessArchiveStatusText: StateFlow<String> = _chessArchiveStatusText.asStateFlow()
  val grokGalleryStatusText: StateFlow<String> = _grokGalleryStatusText.asStateFlow()
  val grokRespondBusy: StateFlow<Boolean> = _grokRespondBusy.asStateFlow()
  val grokRespondResult: StateFlow<GrokTextReply?> = _grokRespondResult.asStateFlow()
  val grokRequestedMode: StateFlow<String?> = _grokRequestedMode.asStateFlow()
  val gatewayInvokeCatalog = GatewayInvokeCatalog.all

  val chatSessionKey: StateFlow<String> = runtime.chatSessionKey
  val chatSessionId: StateFlow<String?> = runtime.chatSessionId
  val chatMessages = runtime.chatMessages
  val chatError: StateFlow<String?> = runtime.chatError
  val chatHealthOk: StateFlow<Boolean> = runtime.chatHealthOk
  val chatTransportMode: StateFlow<ChatTransportMode> = runtime.chatTransportMode
  val chatGatewayRpcAvailable: StateFlow<Boolean> = runtime.chatGatewayRpcAvailable
  val chatOpenRouterAvailable: StateFlow<Boolean> = runtime.chatOpenRouterAvailable
  val chatStatusText: StateFlow<String> = runtime.chatStatusText
  val chatThinkingLevel: StateFlow<String> = runtime.chatThinkingLevel
  val chatStreamingAssistantText: StateFlow<String?> = runtime.chatStreamingAssistantText
  val chatPendingToolCalls = runtime.chatPendingToolCalls
  val chatToolActivity = runtime.chatToolActivity
  val chatSessions = runtime.chatSessions
  val pendingRunCount: StateFlow<Int> = runtime.pendingRunCount
  val liveCameraVisionAvailable: StateFlow<Boolean> = runtime.liveCameraVisionAvailable
  val liveCameraPreviewActive: StateFlow<Boolean> = runtime.liveCameraPreviewActive
  val liveCameraBusy: StateFlow<Boolean> = runtime.liveCameraBusy
  val liveCameraLiveEnabled: StateFlow<Boolean> = runtime.liveCameraLiveEnabled
  val liveCameraStatusText: StateFlow<String> = runtime.liveCameraStatusText
  val liveCameraLatestCommentary: StateFlow<String?> = runtime.liveCameraLatestCommentary
  val bitaxeDevices: StateFlow<List<BitaxeDeviceSnapshot>> = runtime.bitaxeDevices
  val bitaxeStatusText: StateFlow<String> = runtime.bitaxeStatusText
  val bitaxeBusy: StateFlow<Boolean> = runtime.bitaxeBusy
  val hasStartupChatAgent: Boolean = runtime.hasStartupChatAgent()

  init {
    refreshOpenRouterChessAvailability()
    if (_convexConfigured.value && activeConvexSessionToken() != null) {
      viewModelScope.launch {
        refreshConvexWalletAgentsInternal()
      }
    }
  }

  fun setForeground(value: Boolean) {
    runtime.setForeground(value)
  }

  fun setDisplayName(value: String) {
    runtime.setDisplayName(value)
  }

  fun setCameraEnabled(value: Boolean) {
    runtime.setCameraEnabled(value)
  }

  fun setLocationMode(mode: LocationMode) {
    runtime.setLocationMode(mode)
  }

  fun setLocationPreciseEnabled(value: Boolean) {
    runtime.setLocationPreciseEnabled(value)
  }

  fun setPreventSleep(value: Boolean) {
    runtime.setPreventSleep(value)
  }

  fun setAutoStartOnBoot(value: Boolean) {
    runtime.setAutoStartOnBoot(value)
  }

  fun setManualEnabled(value: Boolean) {
    runtime.setManualEnabled(value)
  }

  fun setManualHost(value: String) {
    runtime.setManualHost(value)
  }

  fun setManualPort(value: Int) {
    runtime.setManualPort(value)
  }

  fun setManualTls(value: Boolean) {
    runtime.setManualTls(value)
  }

  fun setManualTransport(value: GatewayTransport) {
    runtime.setManualTransport(value)
  }

  fun setBitaxeApiBaseUrl(value: String) {
    runtime.setBitaxeApiBaseUrl(value)
  }

  fun setBitaxeApiKey(value: String) {
    runtime.setBitaxeApiKey(value)
  }

  fun setTogetherApiKey(value: String) {
    runtime.setTogetherApiKey(value)
  }

  fun setTogetherModel(value: String) {
    runtime.setTogetherModel(value)
  }

  fun setOpenRouterApiKey(value: String) {
    runtime.setOpenRouterApiKey(value)
    refreshOpenRouterChessAvailability()
  }

  fun setOpenRouterModel(value: String) {
    runtime.setOpenRouterModel(value)
    refreshOpenRouterChessAvailability()
  }

  fun setGatewayToken(value: String) {
    runtime.setGatewayToken(value)
  }

  fun setGatewayPassword(value: String) {
    runtime.setGatewayPassword(value)
  }

  fun setOnboardingCompleted(value: Boolean) {
    runtime.setOnboardingCompleted(value)
  }

  fun setCanvasDebugStatusEnabled(value: Boolean) {
    runtime.setCanvasDebugStatusEnabled(value)
  }

  fun setVoiceScreenActive(active: Boolean) {
    runtime.setVoiceScreenActive(active)
  }

  fun setMicEnabled(enabled: Boolean) {
    runtime.setMicEnabled(enabled)
  }

  fun setSpeakerEnabled(enabled: Boolean) {
    runtime.setSpeakerEnabled(enabled)
  }

  fun setGrokVoiceId(value: String) {
    runtime.setGrokVoiceId(value)
  }

  fun setGrokVadThreshold(value: String) {
    runtime.setGrokVadThreshold(value)
  }

  fun setGrokSilenceDurationMs(value: String) {
    runtime.setGrokSilenceDurationMs(value)
  }

  fun setGrokSampleRate(value: String) {
    runtime.setGrokSampleRate(value)
  }

  fun setGrokWebSearchEnabled(value: Boolean) {
    runtime.setGrokWebSearchEnabled(value)
  }

  fun setGrokXSearchEnabled(value: Boolean) {
    runtime.setGrokXSearchEnabled(value)
  }

  private fun refreshOpenRouterChessAvailability() {
    val configured =
      (BuildConfig.OPENROUTER_DIRECT_ENABLED && openRouterChessClient.isConfigured()) ||
        _convexConfigured.value
    _openRouterChessConfigured.value = configured
    _openRouterChessStatusText.value =
      if (BuildConfig.OPENROUTER_DIRECT_ENABLED && openRouterChessClient.isConfigured()) {
        "OpenAI chess via ${BuildConfig.OPENROUTER_OPENAI_MODEL.ifBlank { "OpenRouter" }} is ready."
      } else if (_convexConfigured.value) {
        "OpenAI chess is available through Convex after wallet sync."
      } else {
        "Add OPENROUTER_API_KEY to enable OpenAI chess."
      }
  }

  fun refreshGatewayConnection() {
    runtime.refreshGatewayConnection()
  }

  fun connect(endpoint: GatewayEndpoint) {
    runtime.connect(endpoint)
  }

  fun connectManual() {
    runtime.connectManual()
  }

  fun disconnect() {
    runtime.disconnect()
  }

  fun invokeBridgeCommand(
    command: String,
    paramsJson: String?,
    viaGateway: Boolean,
  ) {
    runtime.invokeBridgeCommand(command = command, paramsJson = paramsJson, viaGateway = viaGateway)
  }

  fun clearBridgeConsoleResponse() {
    runtime.clearBridgeConsoleResponse()
  }

  fun refreshBitaxeFleet() {
    runtime.refreshBitaxeFleet()
  }

  fun restartBitaxeDevice(deviceId: String) {
    runtime.restartBitaxeDevice(deviceId)
  }

  fun identifyBitaxeDevice(deviceId: String) {
    runtime.identifyBitaxeDevice(deviceId)
  }

  fun setBitaxeFanSpeed(deviceId: String, fanSpeed: Int) {
    runtime.setBitaxeFanSpeed(deviceId, fanSpeed)
  }

  fun setBitaxePool(
    deviceId: String,
    poolUrl: String,
    poolPort: Int,
    poolUser: String,
    poolPass: String,
  ) {
    runtime.setBitaxePool(
      deviceId = deviceId,
      poolUrl = poolUrl,
      poolPort = poolPort,
      poolUser = poolUser,
      poolPass = poolPass,
    )
  }

  fun setBitaxeOverclock(deviceId: String, frequencyMHz: Int, coreVoltage: Int?) {
    runtime.setBitaxeOverclock(deviceId = deviceId, frequencyMHz = frequencyMHz, coreVoltage = coreVoltage)
  }

  fun openBitaxeDashboard() {
    runtime.openBitaxeDashboard()
  }

  fun connectSolanaWallet(activity: ComponentActivity) {
    viewModelScope.launch {
      mobileWalletManager.connect(activity)
      val pairingToken = _pendingConvexPairingToken.value?.trim().orEmpty()
      if (pairingToken.isNotBlank()) {
        claimConvexPairingSession(activity, pairingToken)
      }
    }
  }

  fun disconnectSolanaWallet(activity: ComponentActivity) {
    viewModelScope.launch {
      mobileWalletManager.disconnect(activity)
    }
  }

  fun signInWithSolana(activity: ComponentActivity) {
    viewModelScope.launch {
      mobileWalletManager.signIn(activity)
    }
  }

  fun signSolanaMessage(activity: ComponentActivity, message: String) {
    viewModelScope.launch {
      mobileWalletManager.signMessage(activity, message)
    }
  }

  suspend fun signSolanaMessageForResult(
    activity: ComponentActivity,
    message: String,
  ): Result<MobileWalletDetachedMessagePayload> = mobileWalletManager.signMessageForResult(activity, message)

  fun signSolanaTransaction(activity: ComponentActivity, encodedUnsignedTransaction: String) {
    viewModelScope.launch {
      mobileWalletManager.signTransaction(activity, encodedUnsignedTransaction)
    }
  }

  fun signAndSendSolanaTransaction(activity: ComponentActivity, encodedUnsignedTransaction: String) {
    viewModelScope.launch {
      mobileWalletManager.signAndSendTransaction(activity, encodedUnsignedTransaction)
    }
  }

  fun clearMobileWalletMessages() {
    mobileWalletManager.clearTransientMessages()
  }

  fun refreshConvexHealth() {
    if (!_convexConfigured.value) {
      _convexStatusText.value = "Convex backend is not configured in this build."
      return
    }
    viewModelScope.launch {
      _convexBusy.value = true
      _convexStatusText.value = "Checking Convex backend…"
      runCatching { convexUserApi.fetchHealth() }
        .onSuccess { health ->
          _convexHealth.value = health
          _convexStatusText.value =
            buildString {
              append(health.status.ifBlank { "ok" }.uppercase())
              health.siteUrl?.takeIf { it.isNotBlank() }?.let {
                append(" • ")
                append(it)
              }
            }
        }.onFailure { err ->
          _convexStatusText.value = err.message ?: "Convex health check failed."
        }
      _convexBusy.value = false
    }
  }

  private fun activeConvexSessionToken(): String? {
    val token = _convexSessionToken.value?.trim().orEmpty()
    val expiresAt = _convexSessionExpiresAt.value ?: 0L
    return token.takeIf { it.isNotBlank() && expiresAt > System.currentTimeMillis() }
  }

  private suspend fun refreshConvexWalletAgentsInternal() {
    if (!_convexConfigured.value) {
      _convexWalletAgents.value = emptyList()
      _convexWalletAgentsStatusText.value = "Agent registry is unavailable in this build."
      return
    }
    val sessionToken = activeConvexSessionToken()
    if (sessionToken.isNullOrBlank()) {
      _convexWalletAgents.value = emptyList()
      _convexWalletAgentsStatusText.value = "Sync your wallet to load agent registry records."
      return
    }
    _convexWalletAgentsBusy.value = true
    _convexWalletAgentsStatusText.value = "Loading registered agents…"
    runCatching {
      convexUserApi.listWalletAgents(sessionToken)
    }.fold(
      onSuccess = { agents ->
        _convexWalletAgents.value = agents
        _convexWalletAgentsStatusText.value =
          if (agents.isEmpty()) {
            "No agent registry records yet for this wallet."
          } else {
            "Loaded ${agents.size} registered ${if (agents.size == 1) "agent" else "agents"}."
          }
      },
      onFailure = { err ->
        _convexWalletAgents.value = emptyList()
        _convexWalletAgentsStatusText.value = err.message ?: "Agent registry lookup failed."
      },
    )
    _convexWalletAgentsBusy.value = false
  }

  private suspend fun ensureAuthorizedWalletAddress(
    activity: ComponentActivity,
    pendingStatus: String,
  ): String? {
    val currentAddress = mobileWalletState.value.authorizedAddress?.trim().orEmpty()
    if (mobileWalletState.value.hasStoredAuthorization && currentAddress.isNotBlank()) {
      return currentAddress
    }
    _convexStatusText.value = pendingStatus
    return mobileWalletManager.authorizeForResult(activity).fold(
      onSuccess = { payload ->
        val resolved = payload.addressBase58?.trim().orEmpty()
        if (resolved.isBlank()) {
          _convexStatusText.value = "Wallet authorized, but no address was returned."
          null
        } else {
          resolved
        }
      },
      onFailure = { err ->
        _convexStatusText.value = err.message ?: "Wallet authorization failed."
        null
      },
    )
  }

  private suspend fun syncConvexWalletUserInternal(
    activity: ComponentActivity,
    displayNameOverride: String? = null,
  ): Boolean {
    if (!_convexConfigured.value) {
      _convexStatusText.value = "Convex backend is not configured in this build."
      return false
    }
    val walletAddress =
      ensureAuthorizedWalletAddress(activity, "Opening Seeker wallet to sync Convex access…") ?: return false
    val signedAtMs = System.currentTimeMillis()
    val nonce = UUID.randomUUID().toString()
    val nextDisplayName = displayNameOverride?.trim().orEmpty().ifBlank { displayName.value.trim() }
    val message =
      convexWalletSignableMessage(
        walletAddress = walletAddress,
        displayName = nextDisplayName,
        appVersion = BuildConfig.VERSION_NAME,
        signedAtMs = signedAtMs,
        nonce = nonce,
      )
    _convexStatusText.value = "Requesting wallet signature for Convex sync…"
    return signSolanaMessageForResult(activity, message).fold(
      onSuccess = { signed ->
        val signatureBase58 = signed.signatureBase58
        if (signatureBase58.isNullOrBlank()) {
          _convexStatusText.value = "Wallet did not return a detached signature."
          false
        } else {
          runCatching {
            convexUserApi.upsertWalletUser(
              ConvexWalletUserUpsertRequest(
                walletAddress = walletAddress,
                displayName = nextDisplayName.ifBlank { null },
                appVersion = BuildConfig.VERSION_NAME,
                signedAtMs = signedAtMs,
                nonce = nonce,
                signatureBase58 = signatureBase58,
              ),
            )
          }.fold(
            onSuccess = { response ->
              _convexRegisteredUser.value = response.user
              _convexSessionToken.value = response.user.sessionToken?.trim().orEmpty().ifBlank { null }
              _convexSessionExpiresAt.value = response.user.sessionExpiresAt
              val sessionToken = response.user.sessionToken?.trim().orEmpty()
              val sessionExpiresAt = response.user.sessionExpiresAt ?: 0L
              if (sessionToken.isNotBlank() && sessionExpiresAt > 0L) {
                runtime.prefs.saveConvexSession(
                  walletAddress = response.user.walletAddress,
                  displayName = response.user.displayName,
                  sessionToken = sessionToken,
                  sessionExpiresAt = sessionExpiresAt,
                )
              }
              refreshConvexWalletAgentsInternal()
              _convexStatusText.value =
                "Convex synced ${response.user.walletAddress.take(4)}…${response.user.walletAddress.takeLast(4)}."
              true
            },
            onFailure = { err ->
              _convexStatusText.value = err.message ?: "Convex sync failed."
              false
            },
          )
        }
      },
      onFailure = { err ->
        _convexStatusText.value = err.message ?: "Wallet signature failed."
        false
      },
    )
  }

  private suspend fun claimConvexPairingSession(
    activity: ComponentActivity,
    pairingToken: String,
  ): Boolean {
    if (!_convexConfigured.value) {
      _convexStatusText.value = "Convex backend is not configured in this build."
      return false
    }
    val normalizedToken = pairingToken.trim()
    if (normalizedToken.isBlank()) {
      _convexStatusText.value = "Pairing token is missing."
      return false
    }
    _pendingConvexPairingToken.value = normalizedToken
    runtime.prefs.setPendingConvexPairingToken(normalizedToken)
    val walletAddress =
      ensureAuthorizedWalletAddress(activity, "Opening Seeker wallet to finish pairing…") ?: return false
    val signedAtMs = System.currentTimeMillis()
    val nextDisplayName = displayName.value.trim().ifBlank { null }
    val message =
      convexWalletSignableMessage(
        walletAddress = walletAddress,
        displayName = nextDisplayName,
        appVersion = BuildConfig.VERSION_NAME,
        signedAtMs = signedAtMs,
        nonce = normalizedToken,
      )
    _convexStatusText.value = "Requesting wallet signature for Seeker pairing…"
    return signSolanaMessageForResult(activity, message).fold(
      onSuccess = { signed ->
        val signatureBase58 = signed.signatureBase58
        if (signatureBase58.isNullOrBlank()) {
          _convexStatusText.value = "Wallet did not return a detached signature."
          false
        } else {
          runCatching {
            convexUserApi.claimPairingSession(
              ConvexPairingClaimRequest(
                pairingToken = normalizedToken,
                walletAddress = walletAddress,
                displayName = nextDisplayName,
                appVersion = BuildConfig.VERSION_NAME,
                signedAtMs = signedAtMs,
                nonce = normalizedToken,
                signatureBase58 = signatureBase58,
              ),
            )
          }.fold(
            onSuccess = { response ->
              _convexRegisteredUser.value = response.user
              _convexSessionToken.value = response.user.sessionToken?.trim().orEmpty().ifBlank { null }
              _convexSessionExpiresAt.value = response.user.sessionExpiresAt
              val sessionToken = response.user.sessionToken?.trim().orEmpty()
              val sessionExpiresAt = response.user.sessionExpiresAt ?: 0L
              if (sessionToken.isNotBlank() && sessionExpiresAt > 0L) {
                runtime.prefs.saveConvexSession(
                  walletAddress = response.user.walletAddress,
                  displayName = response.user.displayName,
                  sessionToken = sessionToken,
                  sessionExpiresAt = sessionExpiresAt,
                )
              }
              refreshConvexWalletAgentsInternal()
              _pendingConvexPairingToken.value = null
              runtime.prefs.setPendingConvexPairingToken(null)
              runtime.setOnboardingCompleted(true)
              _convexStatusText.value =
                "Seeker paired ${response.user.walletAddress.take(4)}…${response.user.walletAddress.takeLast(4)}."
              true
            },
            onFailure = { err ->
              _convexStatusText.value = err.message ?: "Seeker pairing failed."
              false
            },
          )
        }
      },
      onFailure = { err ->
        _convexStatusText.value = err.message ?: "Wallet signature failed."
        false
      },
    )
  }

  private fun maybeProcessPendingConvexPairingToken() {
    val pairingToken = _pendingConvexPairingToken.value?.trim().orEmpty()
    if (pairingToken.isBlank()) return
    val activity = mobileWalletManager.currentActivity()
    if (activity == null) {
      _convexStatusText.value = "Pairing token loaded. Return to the app foreground to finish wallet signing."
      return
    }
    viewModelScope.launch {
      claimConvexPairingSession(activity, pairingToken)
    }
  }

  private suspend fun ensureConvexSession(activity: ComponentActivity): Boolean {
    activeConvexSessionToken()?.let { return true }
    _grokGalleryStatusText.value = "Syncing wallet to Convex for gallery access…"
    return syncConvexWalletUserInternal(activity)
  }

  private suspend fun ensureChessArchiveSession(activity: ComponentActivity): Boolean {
    activeConvexSessionToken()?.let { return true }
    _chessArchiveStatusText.value = "Syncing wallet to Convex for saved chess access…"
    return syncConvexWalletUserInternal(activity)
  }

  private suspend fun ensureConvexAiSession(
    activity: ComponentActivity?,
    onStatus: (String) -> Unit,
  ): String? {
    activeConvexSessionToken()?.let { return it }
    if (!_convexConfigured.value) return null
    val resolvedActivity = activity ?: return null
    onStatus("Syncing wallet to Convex for AI access…")
    if (!syncConvexWalletUserInternal(resolvedActivity)) return null
    return activeConvexSessionToken()
  }

  fun syncConvexWalletUser(
    activity: ComponentActivity,
    displayNameOverride: String? = null,
  ) {
    viewModelScope.launch {
      _convexBusy.value = true
      syncConvexWalletUserInternal(activity, displayNameOverride)
      _convexBusy.value = false
    }
  }

  fun refreshConvexWalletAgents() {
    viewModelScope.launch {
      refreshConvexWalletAgentsInternal()
    }
  }

  fun refreshChessArchive(activity: ComponentActivity? = null) {
    if (!_convexConfigured.value) {
      _chessArchiveStatusText.value = "Signed chess archive is unavailable in this build."
      return
    }
    viewModelScope.launch {
      _chessArchiveBusy.value = true
      try {
        val sessionToken =
          activeConvexSessionToken()
            ?: if (activity != null && ensureChessArchiveSession(activity)) {
              activeConvexSessionToken()
            } else {
              null
            }
        if (sessionToken.isNullOrBlank()) {
          _chessArchiveStatusText.value = "Sync your wallet to load saved signed matches."
          return@launch
        }
        val matches = convexUserApi.listChessMatches(sessionToken = sessionToken, limit = 18)
        _chessArchiveMatches.value = matches
        _chessArchiveStatusText.value =
          if (matches.isEmpty()) {
            "No saved signed chess matches yet."
          } else {
            "Loaded ${matches.size} saved signed chess matches."
          }
      } catch (err: Throwable) {
        _chessArchiveStatusText.value = err.message ?: "Unable to load saved chess matches."
      } finally {
        _chessArchiveBusy.value = false
      }
    }
  }

  suspend fun saveChessArchivePacket(
    activity: ComponentActivity,
    requestBody: ConvexChessSavePacketRequest,
  ): Result<Unit> =
    runCatching {
      if (!_convexConfigured.value) {
        throw IllegalStateException("Signed chess archive is unavailable in this build.")
      }
      if (!ensureChessArchiveSession(activity)) {
        throw IllegalStateException("Sync your wallet to save signed chess matches.")
      }
      val sessionToken =
        activeConvexSessionToken()
          ?: throw IllegalStateException("Convex chess archive session is missing.")
      convexUserApi.saveChessPacket(sessionToken = sessionToken, requestBody = requestBody)
      val matches = convexUserApi.listChessMatches(sessionToken = sessionToken, limit = 18)
      _chessArchiveMatches.value = matches
      _chessArchiveStatusText.value =
        if (requestBody.packetKind == "invite") {
          "Saved the signed invite to the Convex chess archive."
        } else {
          "Saved the signed move to the Convex chess archive."
        }
    }

  suspend fun recallChessArchiveMatch(
    activity: ComponentActivity,
    matchId: String,
  ): Result<ConvexChessMatchDetail> =
    runCatching {
      if (!_convexConfigured.value) {
        throw IllegalStateException("Signed chess archive is unavailable in this build.")
      }
      if (!ensureChessArchiveSession(activity)) {
        throw IllegalStateException("Sync your wallet to recall saved signed matches.")
      }
      val sessionToken =
        activeConvexSessionToken()
          ?: throw IllegalStateException("Convex chess archive session is missing.")
      _chessArchiveLoadingMatchId.value = matchId
      convexUserApi.getChessMatch(sessionToken = sessionToken, matchId = matchId)
    }.onSuccess {
      _chessArchiveStatusText.value = "Loaded saved signed chess match ${matchId.take(8)}."
    }.onFailure { err ->
      _chessArchiveStatusText.value = err.message ?: "Unable to recall saved signed match."
    }.also {
      _chessArchiveLoadingMatchId.value = null
    }

  fun setRewardsWaitlistJoined(value: Boolean) {
    runtime.setRewardsWaitlistJoined(value)
  }

  fun setWalletSignMessageDraft(value: String) {
    _walletSignMessageDraft.value = value
  }

  fun setWalletTransactionDraft(value: String) {
    _walletTransactionDraft.value = value
  }

  fun setSolanaPayUriDraft(value: String) {
    _solanaPayUriDraft.value = value
  }

  fun parseSolanaPayUri(rawUri: String = _solanaPayUriDraft.value) {
    val trimmed = rawUri.trim()
    _solanaPayUriDraft.value = trimmed
    if (trimmed.isBlank()) {
      _solanaPayRequest.value = null
      _solanaPayStatusText.value = "Paste or open a solana: URI to preview it here."
      return
    }
    runCatching { SolanaPayRequest.parse(trimmed) }
      .onSuccess { request ->
        _solanaPayRequest.value = request
        _solanaPayStatusText.value = formatSolanaPaySummary(request)
      }
      .onFailure { err ->
        _solanaPayRequest.value = null
        _solanaPayStatusText.value = err.message ?: "Unable to parse that Solana Pay URI."
      }
  }

  fun clearSolanaPayRequest() {
    _solanaPayUriDraft.value = ""
    _solanaPayRequest.value = null
    _solanaPayStatusText.value = "Cleared Solana Pay request."
  }

  fun executeSolanaPayTransfer(activity: ComponentActivity) {
    val request = _solanaPayRequest.value as? SolanaPayRequest.Transfer
    if (request == null) {
      _solanaPayStatusText.value = "Open or paste a Solana Pay transfer request first."
      return
    }
    if (request.splTokenMint != null) {
      _solanaPayStatusText.value = "SPL token Solana Pay requests are preview-only for now."
      return
    }
    val senderAddress = mobileWalletState.value.authorizedAddress
    if (senderAddress.isNullOrBlank() || !mobileWalletState.value.hasStoredAuthorization) {
      _solanaPayStatusText.value = "Connect a Mobile Wallet Adapter wallet before executing this transfer."
      return
    }

    viewModelScope.launch {
      _solanaPayStatusText.value = "Building SOL transfer transaction…"
      solanaPayTransferExecutor.buildUnsignedTransaction(senderAddress = senderAddress, request = request).fold(
        onSuccess = { unsignedTransaction ->
          _solanaPayStatusText.value = "Requesting wallet signature and submission…"
          mobileWalletManager.signAndSendTransactionForResult(activity, unsignedTransaction).fold(
            onSuccess = { payload ->
              val signature = payload.signatureBytes?.let(Base58::encodeToString)
              _solanaPayStatusText.value =
                if (signature != null) {
                  "Submitted Solana Pay transfer ${shortSignature(signature)}."
                } else {
                  "Wallet submitted the Solana Pay transfer."
                }
            },
            onFailure = { err ->
              _solanaPayStatusText.value = err.message ?: "Solana Pay transfer failed."
            },
          )
        },
        onFailure = { err ->
          _solanaPayStatusText.value = err.message ?: "Unable to build Solana Pay transaction."
        },
      )
    }
  }

  fun clearMintedNftResult() {
    _solanaNftMintResult.value = null
    _solanaNftStatusText.value = "Cleared NFT mint result."
  }

  fun clearGrokSearchResult() {
    _grokSearchResult.value = null
    _grokStatusText.value =
      if (_grokConfigured.value) {
        "Cleared Grok search result."
      } else {
        "Grok services are unavailable in this build."
      }
  }

  fun clearGrokImageResult() {
    _grokImageResult.value = null
    _grokStatusText.value =
      if (_grokConfigured.value || _convexConfigured.value) {
        "Cleared Grok image result."
      } else {
        "Grok services are unavailable in this build."
      }
  }

  fun clearGrokRespondResult() {
    _grokRespondResult.value = null
    _grokStatusText.value =
      if (_grokConfigured.value) {
        "Cleared Grok direct response."
      } else {
        "Grok services are unavailable in this build."
      }
  }

  fun consumeGrokRequestedMode() {
    _grokRequestedMode.value = null
  }

  fun initializeGrokGallery() {
    if (!_convexConfigured.value) {
      _grokGalleryStatusText.value = "Convex gallery is unavailable in this build."
      return
    }
    if (_grokGalleryFeed.value.isEmpty() && !_grokGalleryBusy.value) {
      refreshGrokGalleryFeed()
    }
    if (grokGalleryLoopStarted) return
    grokGalleryLoopStarted = true
    viewModelScope.launch {
      while (true) {
        loadGrokGalleryFeed(announce = false)
        delay(8_000L)
      }
    }
  }

  fun refreshGrokGalleryFeed() {
    if (!_convexConfigured.value) {
      _grokGalleryStatusText.value = "Convex gallery is unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokGalleryBusy.value = true
      try {
        loadGrokGalleryFeed(announce = true)
      } finally {
        _grokGalleryBusy.value = false
      }
    }
  }

  private suspend fun loadGrokGalleryFeed(announce: Boolean) {
    runCatching {
      convexUserApi.listGalleryFeed(limit = 12, sessionToken = activeConvexSessionToken())
    }.onSuccess { feed ->
      _grokGalleryFeed.value = feed
      if (announce) {
        _grokGalleryStatusText.value =
          if (feed.isEmpty()) {
            "The Convex gallery is empty."
          } else {
            "Live gallery updated with ${feed.size} artworks."
          }
      }
    }.onFailure { err ->
      if (announce || _grokGalleryFeed.value.isEmpty()) {
        _grokGalleryStatusText.value = err.message ?: "Unable to load the Convex gallery."
      }
    }
  }

  fun rateGrokGalleryArtwork(
    activity: ComponentActivity,
    artworkId: String,
    positive: Boolean,
  ) {
    if (!_convexConfigured.value) {
      _grokGalleryStatusText.value = "Convex gallery is unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokGalleryRatingArtworkId.value = artworkId
      try {
        if (!ensureConvexSession(activity)) {
          _grokGalleryStatusText.value = "Sync your wallet to rate gallery artwork."
          return@launch
        }
        val sessionToken =
          activeConvexSessionToken()
            ?: throw IllegalStateException("Convex gallery session is missing.")
        val response =
          convexUserApi.rateGalleryArtwork(
            sessionToken = sessionToken,
            requestBody =
              ConvexGalleryRateRequest(
                artworkId = artworkId,
                value = if (positive) 5 else 1,
              ),
          )
        _grokGalleryFeed.value =
          _grokGalleryFeed.value.map { item ->
            if (item.artwork.id == artworkId) {
              item.copy(
                artwork =
                  item.artwork.copy(
                    averageRating = response.averageRating,
                    ratingCount = response.ratingCount,
                  ),
                viewerRating = response.value,
              )
            } else {
              item
            }
          }
        _grokGalleryStatusText.value =
          if (positive) {
            "Saved a thumbs-up rating to Convex."
          } else {
            "Saved a thumbs-down rating to Convex."
          }
      } catch (err: Throwable) {
        _grokGalleryStatusText.value = err.message ?: "Unable to save gallery rating."
      } finally {
        _grokGalleryRatingArtworkId.value = null
      }
    }
  }

  fun runGrokSearchSelfTest() {
    if (!_grokConfigured.value) {
      _grokStatusText.value = "Grok diagnostics are unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokStatusText.value = "Running Grok search self-test…"
      Log.i(GROK_SELF_TEST_TAG, "search:self-test:start")
      executeGrokSearchSelfTest()
        .fold(
          onSuccess = { reply ->
            Log.i(GROK_SELF_TEST_TAG, "search:self-test:ok citations=${reply.citations.size}")
            _grokStatusText.value =
              buildString {
                append("Grok search self-test passed")
                if (reply.citations.isNotEmpty()) {
                  append(" • ")
                  append(reply.citations.size)
                  append(" sources")
                }
              }
          },
          onFailure = { err ->
            Log.e(GROK_SELF_TEST_TAG, "search:self-test:failed", err)
            _grokStatusText.value = err.message ?: "Grok search self-test failed."
          },
        )
    }
  }

  fun runGrokRespondSelfTest() {
    if (!_grokConfigured.value) {
      _grokStatusText.value = "Grok diagnostics are unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokStatusText.value = "Running Grok direct-response self-test…"
      Log.i(GROK_SELF_TEST_TAG, "respond:self-test:start")
      executeGrokRespondSelfTest()
        .fold(
          onSuccess = {
            Log.i(GROK_SELF_TEST_TAG, "respond:self-test:ok")
            _grokStatusText.value = "Grok direct-response self-test passed."
          },
          onFailure = { err ->
            Log.e(GROK_SELF_TEST_TAG, "respond:self-test:failed", err)
            _grokStatusText.value = err.message ?: "Grok direct-response self-test failed."
          },
        )
    }
  }

  fun runGrokImageSelfTest() {
    if (!_grokConfigured.value) {
      _grokStatusText.value = "Grok diagnostics are unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokStatusText.value = "Running Grok image self-test…"
      Log.i(GROK_SELF_TEST_TAG, "image:self-test:start")
      executeGrokImageSelfTest()
        .fold(
          onSuccess = {
            Log.i(GROK_SELF_TEST_TAG, "image:self-test:ok")
            _grokStatusText.value = "Grok image self-test passed."
          },
          onFailure = { err ->
            Log.e(GROK_SELF_TEST_TAG, "image:self-test:failed", err)
            _grokStatusText.value = err.message ?: "Grok image self-test failed."
          },
        )
    }
  }

  fun runGrokQuickSelfTest() {
    if (!_grokConfigured.value) {
      _grokStatusText.value = "Grok diagnostics are unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokRequestedMode.value = "search"
      _grokStatusText.value = "Running Grok quick self-test…"
      Log.i(GROK_SELF_TEST_TAG, "quick:self-test:start")
      val steps = mutableListOf<String>()
      steps +=
        if (executeGrokSearchSelfTest().isSuccess) {
          "search ok"
        } else {
          "search failed"
        }
      steps +=
        if (executeGrokRespondSelfTest().isSuccess) {
          "respond ok"
        } else {
          "respond failed"
        }
      steps +=
        if (executeGrokImageSelfTest().isSuccess) {
          "image ok"
        } else {
          "image failed"
        }
      Log.i(GROK_SELF_TEST_TAG, "quick:self-test:done ${steps.joinToString(",")}")
      _grokStatusText.value = "Grok quick self-test finished • ${steps.joinToString(" • ")}"
    }
  }

  private suspend fun executeGrokSearchSelfTest(): Result<GrokSearchReply> {
    _grokSearchBusy.value = true
    return runCatching {
      xAiClient.search(
        prompt = "Give one concise sentence about the Solana Mobile Seeker and include at least one current citation.",
        useWebSearch = true,
        useXSearch = true,
        enableImageUnderstanding = false,
      ).also { reply ->
        _grokSearchResult.value = reply
      }
    }.also {
      _grokSearchBusy.value = false
    }
  }

  private suspend fun executeGrokRespondSelfTest(): Result<GrokTextReply> {
    _grokRespondBusy.value = true
    return runCatching {
      xAiClient.respond(
        systemPrompt = "You are a Grok device self-test harness. Reply with exactly one line and no markdown.",
        userPrompt = "Return the exact token GROK_RESPOND_OK and nothing else.",
        model = BuildConfig.XAI_SEARCH_MODEL,
      ).also { reply ->
        _grokRespondResult.value = reply
      }
    }.also {
      _grokRespondBusy.value = false
    }
  }

  private suspend fun executeGrokImageSelfTest(): Result<GrokGeneratedImage> {
    _grokImageBusy.value = true
    return runCatching {
      xAiClient.generateImage(
        prompt = "Minimal neon device schematic on black, green and purple interface accents, clean technical poster",
        aspectRatio = "1:1",
        resolution = "1k",
      ).also { image ->
        _grokImageResult.value = image
      }
    }.also {
      _grokImageBusy.value = false
    }
  }

  fun runGrokSearch(
    prompt: String,
    useWebSearch: Boolean,
    useXSearch: Boolean,
    enableImageUnderstanding: Boolean,
  ) {
    if (!_grokConfigured.value) {
      _grokStatusText.value = "Grok search is unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokSearchBusy.value = true
      _grokStatusText.value = "Running Grok search…"
      try {
        _grokSearchResult.value =
          xAiClient.search(
            prompt = prompt,
            useWebSearch = useWebSearch,
            useXSearch = useXSearch,
            enableImageUnderstanding = enableImageUnderstanding,
          )
        _grokStatusText.value =
          buildString {
            append("Grok search complete")
            val citationCount = _grokSearchResult.value?.citations?.size ?: 0
            if (citationCount > 0) {
              append(" • ")
              append(citationCount)
              append(" sources")
            }
          }
      } catch (err: Throwable) {
        _grokStatusText.value = err.message ?: "Grok search failed."
      } finally {
        _grokSearchBusy.value = false
      }
    }
  }

  fun generateGrokImage(
    activity: ComponentActivity?,
    prompt: String,
    aspectRatio: String,
    resolution: String,
  ) {
    if (!_grokConfigured.value && !_convexConfigured.value) {
      _grokStatusText.value = "Grok image generation is unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokImageBusy.value = true
      try {
        if (activity != null && _convexConfigured.value) {
          _grokStatusText.value = "Generating xAI image and publishing to Convex…"
          if (!ensureConvexSession(activity)) {
            _grokStatusText.value = "Sync your wallet to publish xAI images into the gallery."
            return@launch
          }
          val sessionToken =
            activeConvexSessionToken()
              ?: throw IllegalStateException("Convex gallery session is missing.")
          convexUserApi.generateGalleryArtwork(
            sessionToken = sessionToken,
            requestBody =
              ConvexGalleryGenerateRequest(
                prompt = prompt.trim(),
                title = prompt.trim().take(120),
                aspectRatio = aspectRatio,
                resolution = resolution,
              ),
          )
          _grokImageResult.value = null
          loadGrokGalleryFeed(announce = false)
          _grokGalleryStatusText.value = "New xAI artwork posted to the live gallery."
          _grokStatusText.value = "xAI image generated and published to Convex."
        } else {
          if (!_grokConfigured.value) {
            throw IllegalStateException("Local xAI image generation is unavailable in this build.")
          }
          _grokStatusText.value = "Generating Grok image…"
          _grokImageResult.value =
            xAiClient.generateImage(
              prompt = prompt,
              aspectRatio = aspectRatio,
              resolution = resolution,
            )
          _grokStatusText.value = "Grok image ready."
        }
      } catch (err: Throwable) {
        _grokStatusText.value = err.message ?: "Grok image generation failed."
      } finally {
        _grokImageBusy.value = false
      }
    }
  }

  fun runGrokRespond(
    systemPrompt: String,
    userPrompt: String,
    model: String? = null,
  ) {
    if (!_grokConfigured.value) {
      _grokStatusText.value = "Grok responses are unavailable in this build."
      return
    }
    viewModelScope.launch {
      _grokRespondBusy.value = true
      _grokStatusText.value = "Running Grok direct response…"
      try {
        _grokRespondResult.value =
          xAiClient.respond(
            systemPrompt = systemPrompt,
            userPrompt = userPrompt,
            model = model?.trim().orEmpty().ifBlank { BuildConfig.XAI_SEARCH_MODEL },
          )
        _grokStatusText.value = "Grok direct response ready."
      } catch (err: Throwable) {
        _grokStatusText.value = err.message ?: "Grok direct response failed."
      } finally {
        _grokRespondBusy.value = false
      }
    }
  }

  suspend fun chooseGrokChessMove(
    activity: ComponentActivity? = null,
    position: ChessPosition,
    moveLog: List<String>,
    aiColor: ChessColor,
  ): Result<GrokChessMoveChoice> {
    val legalMoves = allLegalMoves(position)
    if (legalMoves.isEmpty()) {
      return Result.failure(IllegalStateException("There are no legal moves in this position."))
    }

    val legalMoveTokens = legalMoves.map(::chessMoveToken)
    val systemPrompt =
      """
      You are Grok playing competitive chess inside SolanaOS.
      Choose exactly one legal move from the provided legal_moves list.
      Return only compact JSON with this schema:
      {"move":"e2e4","comment":"short reason"}
      The move value must match one legal_moves entry exactly.
      Do not include markdown, code fences, or any extra text.
      """.trimIndent()
    val userPrompt =
      buildString {
        appendLine("side_to_move=${position.turn.name.lowercase()}")
        appendLine("grok_color=${aiColor.name.lowercase()}")
        appendLine("move_log=${if (moveLog.isEmpty()) "none" else moveLog.joinToString(" ")}")
        appendLine("board:")
        appendLine(chessBoardAscii(position))
        appendLine("legal_moves=${legalMoveTokens.joinToString(",")}")
      }

    return runCatching {
      val content =
        if (_grokConfigured.value) {
          xAiClient.respond(systemPrompt = systemPrompt, userPrompt = userPrompt).content
        } else {
          val sessionToken =
            ensureConvexAiSession(activity) { status -> _grokStatusText.value = status }
              ?: throw IllegalStateException("Sync your wallet to use backend Grok chess.")
          convexUserApi.requestAiChessMove(
            sessionToken = sessionToken,
            requestBody =
              ConvexAiChessMoveRequest(
                provider = "grok",
                systemPrompt = systemPrompt,
                userPrompt = userPrompt,
              ),
          ).content
        }
      val parsed =
        parseGrokChessMoveChoice(content)
          ?: throw IllegalStateException("Grok did not return a parseable chess move.")
      if (parsed.move !in legalMoveTokens) {
        throw IllegalStateException("Grok returned an illegal move: ${parsed.move}")
      }
      parsed
    }.onFailure { err ->
      _grokStatusText.value = err.message ?: "Grok chess failed."
    }.onSuccess {
      _grokStatusText.value = "Grok chess move ready."
    }
  }

  suspend fun chooseOpenRouterChessMove(
    activity: ComponentActivity? = null,
    position: ChessPosition,
    moveLog: List<String>,
    aiColor: ChessColor,
  ): Result<GrokChessMoveChoice> {
    refreshOpenRouterChessAvailability()
    val legalMoves = allLegalMoves(position)
    if (legalMoves.isEmpty()) {
      return Result.failure(IllegalStateException("There are no legal moves in this position."))
    }

    val legalMoveTokens = legalMoves.map(::chessMoveToken)
    val systemPrompt =
      """
      You are GPT-5.4 mini playing competitive chess inside SolanaOS through OpenRouter.
      Choose exactly one legal move from the provided legal_moves list.
      Return only compact JSON with this schema:
      {"move":"e2e4","comment":"short reason"}
      The move value must match one legal_moves entry exactly.
      Do not include markdown, code fences, or any extra text.
      """.trimIndent()
    val userPrompt =
      buildString {
        appendLine("side_to_move=${position.turn.name.lowercase()}")
        appendLine("openai_color=${aiColor.name.lowercase()}")
        appendLine("move_log=${if (moveLog.isEmpty()) "none" else moveLog.joinToString(" ")}")
        appendLine("board:")
        appendLine(chessBoardAscii(position))
        appendLine("legal_moves=${legalMoveTokens.joinToString(",")}")
      }

    return runCatching {
      val content =
        if (BuildConfig.OPENROUTER_DIRECT_ENABLED && openRouterChessClient.isConfigured()) {
          openRouterChessClient.complete(
            systemPrompt = systemPrompt,
            messages =
              listOf(
                OpenRouterConversationTurn(
                  role = "user",
                  content = userPrompt,
                ),
              ),
            reasoningEnabled = true,
          ).content
        } else {
          val sessionToken =
            ensureConvexAiSession(activity) { status -> _openRouterChessStatusText.value = status }
              ?: throw IllegalStateException("Sync your wallet to use backend OpenAI chess.")
          convexUserApi.requestAiChessMove(
            sessionToken = sessionToken,
            requestBody =
              ConvexAiChessMoveRequest(
                provider = "openai",
                systemPrompt = systemPrompt,
                userPrompt = userPrompt,
              ),
          ).content
        }
      val parsed =
        parseGrokChessMoveChoice(content)
          ?: throw IllegalStateException("OpenAI did not return a parseable chess move.")
      if (parsed.move !in legalMoveTokens) {
        throw IllegalStateException("OpenAI returned an illegal move: ${parsed.move}")
      }
      parsed
    }.onFailure { err ->
      _openRouterChessStatusText.value = err.message ?: "OpenAI chess failed."
    }.onSuccess {
      _openRouterChessStatusText.value = "OpenAI chess move ready."
    }
  }

  suspend fun chooseAiChessMove(
    provider: ChessAiProvider,
    activity: ComponentActivity? = null,
    position: ChessPosition,
    moveLog: List<String>,
    aiColor: ChessColor,
  ): Result<GrokChessMoveChoice> =
    when (provider) {
      ChessAiProvider.Grok -> chooseGrokChessMove(activity = activity, position = position, moveLog = moveLog, aiColor = aiColor)
      ChessAiProvider.OpenAI -> chooseOpenRouterChessMove(activity = activity, position = position, moveLog = moveLog, aiColor = aiColor)
    }

  fun mintCollectionNft(
    activity: ComponentActivity,
    imageBytes: ByteArray,
    fileName: String,
    mimeType: String,
    nftName: String,
    nftDescription: String,
    collectionMint: String,
    recipient: String?,
  ) {
    val name = nftName.trim()
    val description = nftDescription.trim()
    val normalizedCollectionMint = collectionMint.trim()
    val normalizedRecipient = recipient?.trim().orEmpty().ifBlank { null }
    val userWalletAddress = mobileWalletState.value.authorizedAddress

    when {
      imageBytes.isEmpty() -> {
        _solanaNftStatusText.value = "Select an NFT image first."
        return
      }
      name.isBlank() -> {
        _solanaNftStatusText.value = "Enter an NFT name before minting."
        return
      }
      description.isBlank() -> {
        _solanaNftStatusText.value = "Enter an NFT description before minting."
        return
      }
      normalizedCollectionMint.isBlank() -> {
        _solanaNftStatusText.value = "Enter the collection mint that should own this NFT."
        return
      }
      userWalletAddress.isNullOrBlank() || !mobileWalletState.value.hasStoredAuthorization -> {
        _solanaNftStatusText.value = "Connect a Mobile Wallet Adapter wallet before minting."
        return
      }
    }

    viewModelScope.launch {
      val baseUrl = resolveRequiredAppKitBaseUrl(section = "nft minter", statusFlow = _solanaNftStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaNftMintResult.value = null
      try {
        _solanaNftStatusText.value = "Uploading image and metadata…"
        val metadataUri =
          solanaAppKitApi.uploadNftMetadata(
            baseUrl = baseUrl,
            fileName = fileName,
            mimeType = mimeType,
            imageBytes = imageBytes,
            nftName = name,
            tokenSymbol = deriveNftSymbol(name),
            description = description,
          )

        _solanaNftStatusText.value = "Building mint transaction…"
        val mintResponse =
          solanaAppKitApi.mintCollectionNft(
            baseUrl = baseUrl,
            userWalletAddress = userWalletAddress,
            collectionMint = normalizedCollectionMint,
            nftName = name,
            metadataUri = metadataUri,
            recipient = normalizedRecipient,
          )

        _solanaNftStatusText.value = "Requesting wallet signature and submission…"
        val unsignedTransaction =
          runCatching { Base64.getDecoder().decode(mintResponse.transaction) }
            .getOrElse { throw IllegalStateException("Mint transaction payload was not valid base64.", it) }

        mobileWalletManager.signAndSendTransactionForResult(activity, unsignedTransaction).fold(
          onSuccess = { payload ->
            val signature =
              payload.signatureBytes?.let(Base58::encodeToString)
                ?: throw IllegalStateException("Wallet returned no transaction signature.")
            _solanaNftMintResult.value =
              SolanaNftMintResult(
                mintAddress = mintResponse.mint,
                collectionMint = normalizedCollectionMint,
                metadataUri = metadataUri,
                transactionSignature = signature,
              )
            _solanaNftStatusText.value = "Mint submitted ${shortSignature(signature)}."
          },
          onFailure = { err ->
            throw err
          },
        )
      } catch (err: Throwable) {
        _solanaNftStatusText.value = formatAppKitApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun acceptGatewayTrustPrompt() {
    runtime.acceptGatewayTrustPrompt()
  }

  fun declineGatewayTrustPrompt() {
    runtime.declineGatewayTrustPrompt()
  }

  fun handleCanvasA2UIActionFromWebView(payloadJson: String) {
    runtime.handleCanvasA2UIActionFromWebView(payloadJson)
  }

  fun requestCanvasRehydrate(source: String = "screen_tab") {
    runtime.requestCanvasRehydrate(source = source, force = true)
  }

  fun loadChat(sessionKey: String) {
    runtime.loadChat(sessionKey)
  }

  fun refreshChat() {
    runtime.refreshChat()
  }

  fun refreshChatSessions(limit: Int? = null) {
    runtime.refreshChatSessions(limit = limit)
  }

  fun setChatThinkingLevel(level: String) {
    runtime.setChatThinkingLevel(level)
  }

  fun switchChatSession(sessionKey: String) {
    runtime.switchChatSession(sessionKey)
  }

  fun abortChat() {
    runtime.abortChat()
  }

  fun sendChat(message: String, thinking: String, attachments: List<OutgoingAttachment>) {
    runtime.sendChat(message = message, thinking = thinking, attachments = attachments)
  }

  fun sendClaudeCommand(command: String) {
    runtime.sendClaudeCommand(command)
  }

  fun sendGatewayCommand(command: String) {
    runtime.sendGatewayCommand(command)
  }

  fun attachLiveCameraPreview(previewView: PreviewView) {
    runtime.attachLiveCameraPreview(previewView)
  }

  fun detachLiveCameraPreview() {
    runtime.detachLiveCameraPreview()
  }

  suspend fun captureLiveCameraFrame(): CameraCaptureManager.JpegFrame =
    runtime.captureLiveCameraFrame()

  fun analyzeLiveCameraFrame() {
    runtime.analyzeLiveCameraFrame()
  }

  fun setLiveCameraCommentaryEnabled(enabled: Boolean) {
    runtime.setLiveCameraCommentaryEnabled(enabled)
  }

  fun attachMobileWalletActivity(activity: ComponentActivity) {
    mobileWalletManager.attachActivity(activity)
    maybeProcessPendingConvexPairingToken()
  }

  fun detachMobileWalletActivity(activity: ComponentActivity) {
    mobileWalletManager.detachActivity(activity)
  }

  fun requestHomeTab(tab: AppHomeTab) {
    _homeTabRequest.value = tab
  }

  fun consumeHomeTabRequest() {
    _homeTabRequest.value = null
  }

  fun refreshSolanaControl() {
    viewModelScope.launch {
      val baseUrl = resolveControlApiBaseUrl()
      _solanaControlBaseUrl.value = baseUrl
      if (baseUrl == null) {
        _solanaControlConnected.value = false
        _solanaControlStatusText.value =
          "Set a gateway host first. The control API is expected on the same host at http://<host>:18789."
        return@launch
      }
      _solanaControlBusy.value = true
      _solanaControlStatusText.value = "Checking Solana control API…"
      try {
        val status = solanaControlApi.fetchStatus(baseUrl)
        val threads = solanaControlApi.listThreads(baseUrl)
        _solanaControlStatus.value = status
        _solanaControlThreads.value = threads
        _solanaControlConnected.value = true
        _solanaControlStatusText.value =
          buildString {
            append("Connected to ${status.service}")
            append(" • ")
            append(status.threadCount)
            append(" threads")
            append(" • ")
            append(status.stagedIntentCount)
            append(" staged intents")
          }
      } catch (err: Throwable) {
        _solanaControlConnected.value = false
        _solanaControlStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun initializeSolanaTracker() {
    if (!_solanaTrackerConfigured.value) {
      _solanaTrackerStatusText.value = "Solana Tracker is unavailable in this build."
      return
    }
    if (_solanaTrackerDexOverview.value.latest.isEmpty() && !_solanaTrackerOverviewBusy.value) {
      refreshSolanaTrackerOverview()
    }
    if (_solanaTrackerTrendingTokens.value.isEmpty()) {
      refreshSolanaTrackerTrending()
    }
    if (_solanaTrackerSearchResults.value.isEmpty() && !_solanaTrackerSearchBusy.value) {
      refreshSolanaTrackerDexBoard()
    } else if (_solanaTrackerRpcSlot.value == null) {
      refreshSolanaTrackerRpcSlot()
    }
    startSolanaTrackerTrendingLoop()
    if (_solanaTrackerStreamAvailable.value) {
      startSolanaTrackerStream(force = false)
    }
    if (_solanaTrackerDatastreamAvailable.value) {
      startSolanaTrackerDatastream(force = false)
    }
  }

  fun refreshSolanaTrackerOverview() {
    if (!solanaTrackerApi.hasMarketData() && !trackerProxyAvailable()) {
      _solanaTrackerOverviewStatusText.value = "DEX overview is unavailable in this build."
      return
    }
    viewModelScope.launch {
      _solanaTrackerOverviewBusy.value = true
      _solanaTrackerOverviewStatusText.value = "Loading DEX overview…"
      try {
        val (slot, overview) = fetchSolanaTrackerDexOverview()
        _solanaTrackerRpcSlot.value = slot ?: _solanaTrackerRpcSlot.value
        _solanaTrackerDexOverview.value = overview
        _solanaTrackerOverviewStatusText.value =
          buildString {
            append("Loaded ")
            append(overview.latest.size)
            append(" latest, ")
            append(overview.graduating.size)
            append(" graduating, ")
            append(overview.graduated.size)
            append(" graduated tokens.")
          }
      } catch (err: Throwable) {
        _solanaTrackerOverviewStatusText.value = err.message ?: "Unable to load the DEX overview."
      } finally {
        _solanaTrackerOverviewBusy.value = false
      }
    }
  }

  fun refreshSolanaTrackerRpcSlot() {
    if (!_solanaTrackerConfigured.value) {
      _solanaTrackerStatusText.value = "Solana Tracker is not configured."
      return
    }
    viewModelScope.launch {
      try {
        _solanaTrackerRpcSlot.value = fetchSolanaTrackerSlot()
      } catch (err: Throwable) {
        _solanaTrackerStatusText.value = err.message ?: "Unable to fetch the current Solana slot."
      }
    }
  }

  fun refreshSolanaTrackerDexBoard() {
    if (!_solanaTrackerConfigured.value) {
      _solanaTrackerStatusText.value = "Solana Tracker is not configured."
      return
    }
    viewModelScope.launch {
      _solanaTrackerSearchBusy.value = true
      _solanaTrackerStatusText.value = "Loading Solana Tracker DEX board…"
      try {
        val (slot, tokens) = fetchSolanaTrackerDexBoard()
        _solanaTrackerRpcSlot.value = slot
        _solanaTrackerSearchResults.value = tokens
        _solanaTrackerStatusText.value =
          "Loaded ${_solanaTrackerSearchResults.value.size} high-volume Solana Tracker tokens."
      } catch (err: Throwable) {
        _solanaTrackerStatusText.value = err.message ?: "Unable to load the Solana Tracker DEX board."
      } finally {
        _solanaTrackerSearchBusy.value = false
      }
    }
  }

  fun refreshSolanaTrackerTrending() {
    if (!solanaTrackerApi.hasMarketData() && !trackerProxyAvailable()) {
      _solanaTrackerTickerStatusText.value = "Solana Tracker trending is unavailable in this build."
      return
    }
    viewModelScope.launch { loadSolanaTrackerTrending() }
  }

  fun searchSolanaTrackerTokens(query: String) {
    if (!_solanaTrackerConfigured.value) {
      _solanaTrackerStatusText.value = "Solana Tracker is not configured."
      return
    }
    val normalized = query.trim()
    if (normalized.isBlank()) {
      refreshSolanaTrackerDexBoard()
      return
    }
    viewModelScope.launch {
      _solanaTrackerSearchBusy.value = true
      _solanaTrackerStatusText.value = "Searching Solana Tracker for \"$normalized\"…"
      try {
        _solanaTrackerSearchResults.value =
          if (solanaTrackerApi.isConfigured()) {
            solanaTrackerApi.searchTokens(query = normalized)
          } else {
            convexUserApi.searchTrackerTokens(query = normalized)
          }
        _solanaTrackerStatusText.value =
          if (_solanaTrackerSearchResults.value.isEmpty()) {
            "No Solana Tracker tokens matched \"$normalized\"."
          } else {
            "Found ${_solanaTrackerSearchResults.value.size} Solana Tracker tokens for \"$normalized\"."
          }
      } catch (err: Throwable) {
        _solanaTrackerStatusText.value = err.message ?: "Solana Tracker token search failed."
      } finally {
        _solanaTrackerSearchBusy.value = false
      }
    }
  }

  fun openSolanaTrackerToken(mint: String) {
    val normalizedMint = mint.trim()
    if (normalizedMint.isBlank()) {
      _solanaTrackerStatusText.value = "Choose a token first."
      return
    }
    _solanaTrackerSelectedMint.value = normalizedMint
    _solanaTrackerLiveSnapshot.value = SolanaTrackerDatastreamSnapshot()
    _solanaTrackerFocusedFeed.value = emptyList()
    _solanaTrackerAnalysisResult.value =
      _solanaTrackerAnalysisResult.value?.takeIf { it.mint == normalizedMint }
    _solanaTrackerAnalysisStatusText.value =
      if (_grokConfigured.value) {
        "Ready to analyze ${shortMint(normalizedMint)} with Grok."
      } else if (_convexConfigured.value) {
        "Ready to analyze ${shortMint(normalizedMint)} through Convex after wallet sync."
      } else {
        "Add XAI_API_KEY to enable Grok token analysis."
      }
    if (_solanaTrackerDatastreamAvailable.value) {
      solanaTrackerDatastream.focusToken(normalizedMint)
    }
    viewModelScope.launch {
      loadSolanaTrackerToken(mint = normalizedMint, announce = true)
    }
  }

  fun refreshSolanaTrackerSelectedToken() {
    val mint = _solanaTrackerSelectedMint.value
    if (mint.isNullOrBlank()) {
      _solanaTrackerStatusText.value = "Open a token before refreshing."
      return
    }
    viewModelScope.launch {
      loadSolanaTrackerToken(mint = mint, announce = true)
    }
  }

  fun reconnectSolanaTrackerStream() {
    if (!_solanaTrackerStreamAvailable.value) {
      _solanaTrackerStreamStatusText.value = "Live slot streaming is unavailable in this build."
      return
    }
    startSolanaTrackerStream(force = true)
  }

  fun reconnectSolanaTrackerDatastream() {
    if (!_solanaTrackerDatastreamAvailable.value) {
      _solanaTrackerDatastreamStatusText.value = "Tracker live feed is unavailable in this build."
      return
    }
    startSolanaTrackerDatastream(force = true)
  }

  fun analyzeSolanaTrackerSelectedToken(activity: ComponentActivity? = null) {
    if (!_grokConfigured.value && !_convexConfigured.value) {
      _solanaTrackerAnalysisStatusText.value = "Grok token analysis is unavailable in this build."
      return
    }
    val mint = _solanaTrackerSelectedMint.value
    if (mint.isNullOrBlank()) {
      _solanaTrackerAnalysisStatusText.value = "Open a token before running Grok analysis."
      return
    }
    viewModelScope.launch {
      _solanaTrackerAnalysisBusy.value = true
      _solanaTrackerAnalysisStatusText.value = "Running Grok token analysis…"
      try {
        val cachedBundle =
          if (
            _solanaTrackerSelectedMint.value == mint &&
            _solanaTrackerSelectedToken.value != null &&
            _solanaTrackerSelectedTrades.value.isNotEmpty() &&
            _solanaTrackerSelectedHolders.value.isNotEmpty() &&
            _solanaTrackerSelectedChart.value.isNotEmpty()
          ) {
            SolanaTrackerBundle(
              token = _solanaTrackerSelectedToken.value!!,
              trades = _solanaTrackerSelectedTrades.value,
              holders = _solanaTrackerSelectedHolders.value,
              chart = _solanaTrackerSelectedChart.value,
            )
          } else {
            null
          }
        val bundle = cachedBundle ?: fetchSolanaTrackerTokenBundle(mint)
        val token = bundle.token
        val trades = bundle.trades
        val holders = bundle.holders
        val chart = bundle.chart
        val systemPrompt =
          """
          You are Grok acting as a Solana token market analyst inside an Android trading dashboard.
          Use only the supplied Solana Tracker market data.
          Give a concise analysis with these sections in plain text:
          Setup
          Price
          Flow
          Risk
          Takeaway
          Mention uncertainty when data quality is weak. Do not use markdown tables.
          """.trimIndent()
        val userPrompt =
          buildSolanaTrackerAnalysisPrompt(
            token = token,
            trades = trades,
            holders = holders,
            chart = chart,
            liveSnapshot = _solanaTrackerLiveSnapshot.value,
          )
        val content =
          if (_grokConfigured.value) {
            xAiClient.respond(systemPrompt = systemPrompt, userPrompt = userPrompt).content
          } else {
            val sessionToken =
              ensureConvexAiSession(activity) { status -> _solanaTrackerAnalysisStatusText.value = status }
                ?: throw IllegalStateException("Sync your wallet to use backend Grok analysis.")
            convexUserApi.requestTokenAnalysis(
              sessionToken = sessionToken,
              requestBody =
                ConvexTokenAnalysisRequest(
                  mint = mint,
                  systemPrompt = systemPrompt,
                  userPrompt = userPrompt,
                ),
            ).content
          }
        _solanaTrackerAnalysisResult.value =
          SolanaTrackerAnalysisResult(
            mint = mint,
            symbol = token.symbol.ifBlank { token.name.ifBlank { shortMint(mint) } },
            content = content.trim(),
          )
        _solanaTrackerAnalysisStatusText.value =
          "Grok analysis ready for ${token.symbol.ifBlank { token.name.ifBlank { shortMint(mint) } }}."
      } catch (err: Throwable) {
        _solanaTrackerAnalysisStatusText.value = err.message ?: "Grok token analysis failed."
      } finally {
        _solanaTrackerAnalysisBusy.value = false
      }
    }
  }

  fun postSolanaThread(body: String) {
    viewModelScope.launch {
      val normalizedBody = body.trim()
      if (normalizedBody.isBlank()) {
        _solanaFeedStatusText.value = "Type a post first."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "feed", statusFlow = _solanaFeedStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaFeedStatusText.value = "Posting thread…"
      try {
        solanaControlApi.createThread(
          baseUrl = baseUrl,
          author = resolvedSolanaAuthor(),
          headline = buildHeadline("Thread update", normalizedBody),
          body = normalizedBody,
          kind = "thread",
          stats = "posted from seeker",
        )
        val threads = solanaControlApi.listThreads(baseUrl)
        _solanaControlThreads.value = threads
        _solanaControlConnected.value = true
        _solanaFeedStatusText.value = "Thread posted to the control API."
      } catch (err: Throwable) {
        _solanaFeedStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun quoteLatestVisionToFeed() {
    viewModelScope.launch {
      val commentary = liveCameraLatestCommentary.value?.trim().orEmpty()
      if (commentary.isBlank()) {
        _solanaFeedStatusText.value = "Capture or analyze a live camera frame in Chat first."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "feed", statusFlow = _solanaFeedStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaFeedStatusText.value = "Posting Grok vision quote…"
      try {
        solanaControlApi.createThread(
          baseUrl = baseUrl,
          author = "grok.vision",
          headline = buildHeadline("Quoted live camera commentary", commentary),
          body = commentary,
          kind = "quote",
          stats = "quoted from chat",
        )
        _solanaControlThreads.value = solanaControlApi.listThreads(baseUrl)
        _solanaFeedStatusText.value = "Quoted Grok vision commentary into the feed."
      } catch (err: Throwable) {
        _solanaFeedStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun launchPumpfun(name: String, symbol: String, amountSolText: String) {
    viewModelScope.launch {
      val amountSol = amountSolText.trim().toDoubleOrNull()
      if (name.trim().isBlank() || symbol.trim().isBlank() || amountSol == null || amountSol <= 0.0) {
        _solanaPumpStatusText.value = "Enter a token name, symbol, and a positive SOL amount."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "pump.fun", statusFlow = _solanaPumpStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaPumpStatusText.value = "Staging Pump.fun launch…"
      try {
        val intent =
          solanaControlApi.launchPumpfun(
            baseUrl = baseUrl,
            name = name.trim(),
            symbol = symbol.trim().uppercase(),
            description = "Staged from SolanaOS Seeker",
            amountSol = amountSol,
          )
        _solanaPumpStatusText.value = intent.summary
        refreshSolanaControl()
      } catch (err: Throwable) {
        _solanaPumpStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun buyPumpfun(tokenAddress: String, amountSolText: String) {
    stagePumpfunSwap(tokenAddress = tokenAddress, amountSolText = amountSolText, side = "buy")
  }

  fun sellPumpfun(tokenAddress: String, amountSolText: String) {
    stagePumpfunSwap(tokenAddress = tokenAddress, amountSolText = amountSolText, side = "sell")
  }

  fun createTokenMillMarket(name: String, seedSolText: String, curvePreset: String) {
    viewModelScope.launch {
      val seedSol = seedSolText.trim().toDoubleOrNull()
      if (name.trim().isBlank() || curvePreset.trim().isBlank() || seedSol == null || seedSol <= 0.0) {
        _solanaTokenMillStatusText.value = "Enter a market name, curve preset, and positive SOL seed."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "token mill", statusFlow = _solanaTokenMillStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaTokenMillStatusText.value = "Creating Token Mill market draft…"
      try {
        val intent =
          solanaControlApi.createTokenMillMarket(
            baseUrl = baseUrl,
            name = name.trim(),
            curvePreset = curvePreset.trim(),
            seedSol = seedSol,
          )
        _solanaTokenMillStatusText.value = intent.summary
        refreshSolanaControl()
      } catch (err: Throwable) {
        _solanaTokenMillStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun stageTrade(fromToken: String, toToken: String, amountText: String, slippagePercentText: String) {
    viewModelScope.launch {
      val amount = amountText.trim().toDoubleOrNull()
      val slippageBps = parseSlippageBps(slippagePercentText)
      if (fromToken.trim().isBlank() || toToken.trim().isBlank() || amount == null || amount <= 0.0 || slippageBps == null) {
        _solanaTradeStatusText.value = "Enter valid from/to tokens, amount, and slippage."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "trade", statusFlow = _solanaTradeStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaTradeStatusText.value = "Fetching Jupiter quote…"
      try {
        val quote =
          solanaControlApi.quoteTrade(
            baseUrl = baseUrl,
            fromToken = fromToken.trim(),
            toToken = toToken.trim(),
            amount = amount,
            slippageBps = slippageBps,
          )
        val intent =
          solanaControlApi.stageTrade(
            baseUrl = baseUrl,
            fromToken = fromToken.trim(),
            toToken = toToken.trim(),
            amount = amount,
            slippageBps = slippageBps,
          )
        _solanaTradeStatusText.value =
          buildString {
            append(intent.summary)
            if (quote.outAmount.isNotBlank()) {
              append(" • Quote out=")
              append(quote.outAmount)
            }
            if (quote.routeCount > 0) {
              append(" • ")
              append(quote.routeCount)
              append(" routes")
            }
          }
        refreshSolanaControl()
      } catch (err: Throwable) {
        _solanaTradeStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun shareTradeToFeed(fromToken: String, toToken: String, amountText: String, slippagePercentText: String) {
    viewModelScope.launch {
      val amount = amountText.trim()
      val slippage = slippagePercentText.trim()
      if (fromToken.trim().isBlank() || toToken.trim().isBlank() || amount.isBlank() || slippage.isBlank()) {
        _solanaTradeStatusText.value = "Enter trade inputs before sharing."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "trade", statusFlow = _solanaTradeStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaTradeStatusText.value = "Sharing trade idea…"
      try {
        solanaControlApi.createThread(
          baseUrl = baseUrl,
          author = resolvedSolanaAuthor(),
          headline = "Trade idea",
          body = "Watching ${fromToken.trim().uppercase()} -> ${toToken.trim().uppercase()}. Size $amount with $slippage% slippage budget.",
          kind = "thread",
          stats = "shared from trade panel",
        )
        _solanaControlThreads.value = solanaControlApi.listThreads(baseUrl)
        _solanaTradeStatusText.value = "Trade idea posted to the control feed."
      } catch (err: Throwable) {
        _solanaTradeStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  fun previewDexSwap(
    inputMint: String,
    inputSymbol: String,
    inputDecimals: Int,
    outputMint: String,
    outputSymbol: String,
    outputDecimals: Int,
    amountText: String,
    slippagePercentText: String,
  ) {
    viewModelScope.launch {
      val slippageBps = parseSlippageBps(slippagePercentText)
      if (inputMint.trim().isBlank() || outputMint.trim().isBlank() || slippageBps == null) {
        _dexSwapStatusText.value = "Choose both swap mints and enter a valid slippage."
        return@launch
      }
      _dexSwapBusy.value = true
      _dexSwapStatusText.value = "Fetching Jupiter quote…"
      try {
        val quote =
          jupiterSwapApi.fetchQuote(
            inputMint = inputMint,
            outputMint = outputMint,
            inputSymbol = inputSymbol,
            outputSymbol = outputSymbol,
            inputDecimals = inputDecimals,
            outputDecimals = outputDecimals,
            amountUi = amountText,
            slippageBps = slippageBps,
          )
        _dexSwapQuote.value = quote
        _dexSwapStatusText.value =
          buildString {
            append("Quoted ")
            append(quote.inputAmountUi)
            append(' ')
            append(quote.inputSymbol)
            append(" -> ")
            append(quote.outputAmountUi)
            append(' ')
            append(quote.outputSymbol)
            quote.priceImpactPct?.let {
              append(" • impact ")
              append(
                String.format(
                  java.util.Locale.US,
                  "%.2f%%",
                  if (kotlin.math.abs(it) <= 1.0) it * 100.0 else it,
                ),
              )
            }
            if (quote.routeCount > 0) {
              append(" • ")
              append(quote.routeCount)
              append(" route")
              if (quote.routeCount != 1) append('s')
            }
          }
      } catch (err: Throwable) {
        _dexSwapQuote.value = null
        _dexSwapStatusText.value = err.message ?: "Unable to fetch a Jupiter quote."
      } finally {
        _dexSwapBusy.value = false
      }
    }
  }

  fun executeDexSwap(
    activity: ComponentActivity,
    inputMint: String,
    outputMint: String,
  ) {
    val quote = _dexSwapQuote.value
    when {
      quote == null -> {
        _dexSwapStatusText.value = "Preview a Jupiter quote before executing the swap."
        return
      }
      quote.inputMint != inputMint.trim() || quote.outputMint != outputMint.trim() -> {
        _dexSwapStatusText.value = "Swap inputs changed. Refresh the Jupiter quote first."
        return
      }
    }
    val userWalletAddress = mobileWalletState.value.authorizedAddress
    if (userWalletAddress.isNullOrBlank() || !mobileWalletState.value.hasStoredAuthorization) {
      _dexSwapStatusText.value = "Connect a Mobile Wallet Adapter wallet before swapping."
      return
    }

    viewModelScope.launch {
      _dexSwapBusy.value = true
      try {
        _dexSwapStatusText.value = "Building Jupiter swap transaction…"
        val swap =
          jupiterSwapApi.buildSwapTransaction(
            userPublicKey = userWalletAddress,
            quote = quote,
          )
        _dexSwapStatusText.value = "Requesting wallet signature and submission…"
        mobileWalletManager.signAndSendTransactionForResult(activity, swap.swapTransactionBytes).fold(
          onSuccess = { payload ->
            val signature = payload.signatureBytes?.let(Base58::encodeToString)
            _dexSwapStatusText.value =
              buildString {
                append("Swap submitted")
                signature?.let {
                  append(' ')
                  append(shortSignature(it))
                }
                swap.prioritizationFeeLamports?.let { fee ->
                  append(" • priority ")
                  append(fee)
                  append(" lamports")
                }
              }
          },
          onFailure = { err ->
            throw err
          },
        )
      } catch (err: Throwable) {
        _dexSwapStatusText.value = err.message ?: "Jupiter swap failed."
      } finally {
        _dexSwapBusy.value = false
      }
    }
  }

  fun clearDexSwapQuote() {
    _dexSwapQuote.value = null
    _dexSwapStatusText.value = "Cleared Jupiter quote."
  }

  fun handleDeepLink(intent: Intent?) {
    if (intent?.action != Intent.ACTION_VIEW) return
    val uri = intent.data ?: return
    if (uri.scheme.equals("solana", ignoreCase = true)) {
      parseSolanaPayUri(uri.toString())
      requestHomeTab(AppHomeTab.Solana)
      return
    }
    val route = resolveDeepLinkRoute(uri) ?: return
    when (route) {
      AppHomeTab.Connect -> {
        applyConnectionParams(uri)
        requestHomeTab(AppHomeTab.Connect)
        maybeProcessPendingConvexPairingToken()
      }
      AppHomeTab.Solana -> requestHomeTab(AppHomeTab.Solana)
      AppHomeTab.Dex -> requestHomeTab(AppHomeTab.Dex)
      AppHomeTab.Grok -> {
        applyGrokIntent(intent, uri)
        requestHomeTab(AppHomeTab.Grok)
      }
      AppHomeTab.Chat -> requestHomeTab(AppHomeTab.Chat)
      AppHomeTab.Arcade -> requestHomeTab(AppHomeTab.Arcade)
      AppHomeTab.Voice -> requestHomeTab(AppHomeTab.Voice)
      AppHomeTab.Ore -> requestHomeTab(AppHomeTab.Ore)
      AppHomeTab.Screen -> requestHomeTab(AppHomeTab.Screen)
      AppHomeTab.Settings -> requestHomeTab(AppHomeTab.Settings)
    }
  }

  private fun resolveDeepLinkRoute(uri: Uri): AppHomeTab? {
    val scheme = uri.scheme?.lowercase().orEmpty()
    if (scheme !in setOf("solanaos", "nanosolana", "com.nanosolana.solanaos")) return null
    val route = uri.host?.lowercase()?.ifBlank { null } ?: uri.pathSegments.firstOrNull()?.lowercase().orEmpty()
    return when (route) {
      "connect", "gateway", "pair" -> AppHomeTab.Connect
      "solana", "kit", "social" -> AppHomeTab.Solana
      "dex", "market", "markets", "tracker" -> AppHomeTab.Dex
      "grok" -> AppHomeTab.Grok
      "chat", "vision" -> AppHomeTab.Chat
      "arcade", "snake", "game", "mario", "platformer", "bros" -> AppHomeTab.Arcade
      "voice" -> AppHomeTab.Voice
      "ore", "miner", "mining", "bitaxe" -> AppHomeTab.Ore
      "screen", "canvas" -> AppHomeTab.Screen
      "settings" -> AppHomeTab.Settings
      else -> null
    }
  }

  private fun applyGrokIntent(intent: Intent, uri: Uri) {
    val requestedMode =
      intent.getStringExtra("grok_mode")
        ?.trim()
        ?.lowercase()
        ?.ifBlank { null }
        ?: uri.getQueryParameter("mode")
          ?.trim()
          ?.lowercase()
          ?.ifBlank { null }

    requestedMode
      ?.trim()
      ?.lowercase()
      ?.takeIf { it in setOf("search", "respond", "image", "vision") }
      ?.let { _grokRequestedMode.value = it }

    if (!BuildConfig.DEBUG) return

    when (
      intent.getStringExtra("grok_self_test")
        ?.trim()
        ?.lowercase()
        ?.ifBlank { null }
        ?: uri.getQueryParameter("self_test")
          ?.trim()
          ?.lowercase()
          ?.ifBlank { null }
    ) {
      "search" -> {
        Log.i(GROK_SELF_TEST_TAG, "deep-link:self-test=search")
        _grokRequestedMode.value = "search"
        runGrokSearchSelfTest()
      }
      "respond" -> {
        Log.i(GROK_SELF_TEST_TAG, "deep-link:self-test=respond")
        _grokRequestedMode.value = "respond"
        runGrokRespondSelfTest()
      }
      "image" -> {
        Log.i(GROK_SELF_TEST_TAG, "deep-link:self-test=image")
        _grokRequestedMode.value = "image"
        runGrokImageSelfTest()
      }
      "quick" -> {
        Log.i(GROK_SELF_TEST_TAG, "deep-link:self-test=quick")
        _grokRequestedMode.value = "search"
        runGrokQuickSelfTest()
      }
    }
  }

  private fun applyConnectionParams(uri: Uri) {
    if (resolveDeepLinkRoute(uri) == AppHomeTab.Connect) {
      val pairingToken = uri.getQueryParameter("token")?.trim().orEmpty()
      if (pairingToken.isNotBlank()) {
        _pendingConvexPairingToken.value = pairingToken
        runtime.prefs.setPendingConvexPairingToken(pairingToken)
      }
    }
    val host = uri.getQueryParameter("host")?.trim().orEmpty()
    val port = uri.getQueryParameter("port")?.toIntOrNull()
    val token = uri.getQueryParameter("token")?.trim().orEmpty()
    val password = uri.getQueryParameter("password")?.trim().orEmpty()
    val tls = uri.getQueryParameter("tls")?.equals("true", ignoreCase = true) == true
    val transport =
      when (uri.getQueryParameter("transport")?.lowercase()) {
        "native", "bridge", "json" -> GatewayTransport.NativeJsonTcp
        "rpc", "ws", "wss", "websocket" -> GatewayTransport.WebSocketRpc
        else -> null
      }
    if (host.isNotBlank()) {
      setManualEnabled(true)
      setManualHost(host)
    }
    if (port != null) {
      setManualPort(port)
    }
    if (uri.getQueryParameter("tls") != null) {
      setManualTls(tls)
    }
    if (transport != null) {
      setManualTransport(transport)
    }
    if (token.isNotBlank()) {
      setGatewayToken(token)
    }
    if (password.isNotBlank()) {
      setGatewayPassword(password)
    }
  }

  private fun stagePumpfunSwap(tokenAddress: String, amountSolText: String, side: String) {
    viewModelScope.launch {
      val amountSol = amountSolText.trim().toDoubleOrNull()
      if (tokenAddress.trim().isBlank() || amountSol == null || amountSol <= 0.0) {
        _solanaPumpStatusText.value = "Enter a token address and positive SOL amount."
        return@launch
      }
      val baseUrl = resolveRequiredControlApiBaseUrl(section = "pump.fun", statusFlow = _solanaPumpStatusText) ?: return@launch
      _solanaControlBusy.value = true
      _solanaPumpStatusText.value = if (side == "buy") "Staging Pump.fun buy…" else "Staging Pump.fun sell…"
      try {
        val intent =
          if (side == "buy") {
            solanaControlApi.buyPumpfun(baseUrl = baseUrl, tokenAddress = tokenAddress.trim(), amountSol = amountSol)
          } else {
            solanaControlApi.sellPumpfun(baseUrl = baseUrl, tokenAddress = tokenAddress.trim(), amountSol = amountSol)
          }
        _solanaPumpStatusText.value = intent.summary
        refreshSolanaControl()
      } catch (err: Throwable) {
        _solanaPumpStatusText.value = formatControlApiError(baseUrl, err)
      } finally {
        _solanaControlBusy.value = false
      }
    }
  }

  private fun resolveRequiredControlApiBaseUrl(
    section: String,
    statusFlow: MutableStateFlow<String?>,
  ): String? {
    val baseUrl = resolveControlApiBaseUrl()
    _solanaControlBaseUrl.value = baseUrl
    if (baseUrl == null) {
      statusFlow.value = "Set the gateway host first. $section uses the control API on port 18789."
      _solanaControlConnected.value = false
    }
    return baseUrl
  }

  private fun resolveRequiredAppKitBaseUrl(
    section: String,
    statusFlow: MutableStateFlow<String?>,
  ): String? {
    val baseUrl = resolveAppKitBaseUrl()
    if (baseUrl == null) {
      statusFlow.value = "Set the gateway host first. $section uses the Solana app kit API on port 8080."
    }
    return baseUrl
  }

  private fun resolveControlApiBaseUrl(): String? {
    val configuredHost = manualHost.value.trim()
    val host =
      when {
        configuredHost.isNotBlank() -> configuredHost
        !remoteAddress.value.isNullOrBlank() -> parseEndpointHost(remoteAddress.value!!)
        else -> null
      } ?: return null
    return "http://${host.trim()}:18789"
  }

  private fun resolveAppKitBaseUrl(): String? {
    val configuredHost = manualHost.value.trim()
    val host =
      when {
        configuredHost.isNotBlank() -> configuredHost
        !remoteAddress.value.isNullOrBlank() -> parseEndpointHost(remoteAddress.value!!)
        else -> null
      } ?: return null
    return "http://${host.trim()}:8080"
  }

  private fun parseEndpointHost(endpoint: String): String? {
    val trimmed = endpoint.trim()
    if (trimmed.isBlank()) return null
    if (trimmed.contains("://")) {
      return trimmed.toUri().host
    }
    if (trimmed.startsWith("[")) {
      return trimmed.substringAfter("[").substringBefore("]", "")
    }
    return trimmed.substringBeforeLast(":", trimmed)
  }

  private fun resolvedSolanaAuthor(): String = displayName.value.trim().ifBlank { nanoSolanaAppName }

  private fun buildHeadline(prefix: String, body: String): String {
    val summary = body.lineSequence().firstOrNull().orEmpty().trim()
    if (summary.isBlank()) return prefix
    return "$prefix: ${summary.take(44)}".trim()
  }

  private fun parseSlippageBps(value: String): Int? {
    val percent = value.trim().toDoubleOrNull() ?: return null
    if (percent < 0.0) return null
    return (percent * 100.0).toInt()
  }

  private fun deriveNftSymbol(name: String): String {
    val filtered = name.uppercase().filter { it.isLetterOrDigit() }
    if (filtered.isBlank()) return "NFT"
    return filtered.take(8)
  }

  private fun formatControlApiError(baseUrl: String, err: Throwable): String {
    val host = baseUrl.toUri().host.orEmpty()
    val detail = err.message ?: "request failed"
    return if (host == "127.0.0.1" || host == "localhost") {
      "Control API unreachable at $baseUrl. On a real device, use your Mac's Tailscale/LAN host or run adb reverse tcp:18789 tcp:18789. $detail"
    } else {
      "Control API error at $baseUrl. $detail"
    }
  }

  private fun formatAppKitApiError(baseUrl: String, err: Throwable): String {
    val host = baseUrl.toUri().host.orEmpty()
    val detail = err.message ?: "request failed"
    return if (host == "127.0.0.1" || host == "localhost") {
      "Solana app kit API unreachable at $baseUrl. On a real device, use your Mac's Tailscale/LAN host or run adb reverse tcp:8080 tcp:8080. $detail"
    } else {
      "Solana app kit API error at $baseUrl. $detail"
    }
  }

  private fun initialDexSwapStatusText(): String =
    when {
      !jupiterSwapApi.isConfigured() -> "Jupiter swap is unavailable in this build."
      BuildConfig.JUPITER_REFERRAL.isNotBlank() ->
        "Native Jupiter swap ready. Tracking account is attached; platform fees stay off until a fee account is configured."
      else -> "Native Jupiter swap ready."
    }

  private fun trackerProxyAvailable(): Boolean = _convexConfigured.value && convexUserApi.isConfigured()

  private suspend fun fetchSolanaTrackerSlot(): Long? =
    when {
      solanaTrackerApi.hasRpc() -> solanaTrackerApi.fetchCurrentSlot()
      trackerProxyAvailable() -> convexUserApi.fetchTrackerLive(globalLimit = 1, tradeLimit = 1).slot
      else -> throw IllegalStateException("Solana Tracker RPC is unavailable in this build.")
    }

  private suspend fun fetchSolanaTrackerDexBoard(): Pair<Long?, List<SolanaTrackerMarketToken>> =
    when {
      solanaTrackerApi.isConfigured() -> solanaTrackerApi.fetchCurrentSlot() to solanaTrackerApi.fetchDexBoard()
      trackerProxyAvailable() -> convexUserApi.fetchTrackerDexBoard()
      else -> throw IllegalStateException("Solana Tracker DEX board is unavailable in this build.")
    }

  private suspend fun fetchSolanaTrackerDexOverview(): Pair<Long?, SolanaTrackerDexOverview> =
    when {
      solanaTrackerApi.hasMarketData() && solanaTrackerApi.hasRpc() ->
        solanaTrackerApi.fetchCurrentSlot() to solanaTrackerApi.fetchDexOverview()
      solanaTrackerApi.hasMarketData() ->
        null to solanaTrackerApi.fetchDexOverview()
      trackerProxyAvailable() -> convexUserApi.fetchTrackerOverview()
      else -> throw IllegalStateException("Solana Tracker DEX overview is unavailable in this build.")
    }

  private suspend fun fetchSolanaTrackerTokenBundle(mint: String) =
    if (solanaTrackerApi.isConfigured()) {
      SolanaTrackerBundle(
        token = solanaTrackerApi.fetchTokenDetail(mint),
        trades = solanaTrackerApi.fetchTokenTrades(mint),
        holders = solanaTrackerApi.fetchTopHolders(mint),
        chart = solanaTrackerApi.fetchChart(mint),
      )
    } else if (trackerProxyAvailable()) {
      convexUserApi.fetchTrackerTokenBundle(mint).let { bundle ->
        SolanaTrackerBundle(
          token = bundle.token,
          trades = bundle.trades,
          holders = bundle.holders,
          chart = bundle.chart,
        )
      }
    } else {
      throw IllegalStateException("Solana Tracker token detail is unavailable in this build.")
    }

  private fun startSolanaTrackerProxyLoop(force: Boolean) {
    if (!trackerProxyAvailable()) {
      _solanaTrackerStreamStatusText.value = "Convex Tracker proxy is unavailable in this build."
      _solanaTrackerDatastreamStatusText.value = "Convex Tracker proxy is unavailable in this build."
      return
    }
    if (trackerProxyPollingJob != null && !force) return
    trackerProxyPollingJob?.cancel()
    _solanaTrackerStreamConnected.value = false
    _solanaTrackerDatastreamConnected.value = false
    _solanaTrackerStreamStatusText.value = "Starting Convex live slot polling…"
    _solanaTrackerDatastreamStatusText.value = "Starting Convex live market feed…"
    trackerProxyPollingJob =
      viewModelScope.launch {
        while (true) {
          try {
            val livePayload =
              convexUserApi.fetchTrackerLive(
                mint = _solanaTrackerSelectedMint.value,
                globalLimit = 8,
                tradeLimit = 8,
              )
            _solanaTrackerRpcSlot.value = livePayload.slot
            _solanaTrackerLiveSlot.value = livePayload.liveSlot ?: livePayload.slot
            _solanaTrackerLiveFeed.value = livePayload.globalEvents.takeLast(8)
            _solanaTrackerFocusedFeed.value = livePayload.focusedEvents.takeLast(10)
            _solanaTrackerLiveSnapshot.value = livePayload.snapshot
            _solanaTrackerStreamConnected.value = livePayload.slot != null
            _solanaTrackerDatastreamConnected.value = true
            _solanaTrackerStreamStatusText.value =
              if (livePayload.slot != null) {
                "Live slot polling via Convex is active."
              } else {
                "Convex live feed is active. Slot data is unavailable."
              }
            _solanaTrackerDatastreamStatusText.value = "Tracker live feed via Convex is active."
            val selectedMint = _solanaTrackerSelectedMint.value
            if (!selectedMint.isNullOrBlank() && !_solanaTrackerTokenBusy.value) {
              loadSolanaTrackerToken(mint = selectedMint, announce = false)
            }
          } catch (err: Throwable) {
            _solanaTrackerStreamConnected.value = false
            _solanaTrackerDatastreamConnected.value = false
            val message = err.message ?: "Convex Tracker polling failed."
            _solanaTrackerStreamStatusText.value = message
            _solanaTrackerDatastreamStatusText.value = message
          }
          delay(12_000L)
        }
      }
  }

  private fun formatSolanaPaySummary(request: SolanaPayRequest): String =
    when (request) {
      is SolanaPayRequest.Transaction -> "Parsed Solana Pay transaction request from ${request.link}."
      is SolanaPayRequest.Transfer ->
        buildString {
          append("Parsed transfer to ")
          append(shortSolanaAddress(request.recipient))
          request.amount?.let {
            append(" for ")
            append(it)
          }
          append(if (request.splTokenMint == null) " SOL." else " token units.")
        }
    }

  private fun shortSolanaAddress(address: String): String =
    if (address.length <= 10) {
      address
    } else {
      "${address.take(4)}…${address.takeLast(4)}"
    }

  private fun shortSignature(signature: String): String =
    if (signature.length <= 18) {
      signature
    } else {
      "${signature.take(8)}…${signature.takeLast(8)}"
    }

  private fun startSolanaTrackerStream(force: Boolean) {
    if (BuildConfig.SOLANA_TRACKER_WS_URL.isBlank()) {
      startSolanaTrackerProxyLoop(force = force)
      return
    }
    if (!_solanaTrackerStreamAvailable.value) {
      _solanaTrackerStreamStatusText.value = "Live slot streaming is unavailable in this build."
      return
    }
    if (trackerStreamStarted && !force) return
    trackerStreamStarted = true
    _solanaTrackerStreamConnected.value = false
    _solanaTrackerStreamStatusText.value = "Connecting live slot stream…"
    solanaTrackerStream.connect(
      url = BuildConfig.SOLANA_TRACKER_WS_URL,
      listener =
        object : SolanaTrackerStreamClient.Listener {
          override fun onConnected() {
            viewModelScope.launch {
              _solanaTrackerStreamConnected.value = true
              _solanaTrackerStreamStatusText.value = "Live slot stream connected."
            }
          }

          override fun onSlot(slot: Long) {
            viewModelScope.launch {
              _solanaTrackerLiveSlot.value = slot
              val selectedMint = _solanaTrackerSelectedMint.value
              val lastRefresh = lastTrackerAutoRefreshSlot
              if (!selectedMint.isNullOrBlank() && !_solanaTrackerTokenBusy.value && (lastRefresh == null || slot - lastRefresh >= 8L)) {
                lastTrackerAutoRefreshSlot = slot
                loadSolanaTrackerToken(mint = selectedMint, announce = false)
              }
            }
          }

          override fun onError(message: String) {
            viewModelScope.launch {
              trackerStreamStarted = false
              _solanaTrackerStreamConnected.value = false
              _solanaTrackerStreamStatusText.value = message
            }
          }

          override fun onClosed(reason: String) {
            viewModelScope.launch {
              trackerStreamStarted = false
              _solanaTrackerStreamConnected.value = false
              _solanaTrackerStreamStatusText.value = reason
            }
          }
        },
    )
  }

  private fun startSolanaTrackerTrendingLoop() {
    if (trackerTrendingLoopStarted || (!solanaTrackerApi.hasMarketData() && !trackerProxyAvailable())) return
    trackerTrendingLoopStarted = true
    viewModelScope.launch {
      while (true) {
        loadSolanaTrackerTrending()
        delay(60_000L)
      }
    }
  }

  private fun startSolanaTrackerDatastream(force: Boolean) {
    if (BuildConfig.SOLANA_TRACKER_DATASTREAM_KEY.isBlank()) {
      startSolanaTrackerProxyLoop(force = force)
      return
    }
    if (!_solanaTrackerDatastreamAvailable.value) {
      _solanaTrackerDatastreamStatusText.value = "Tracker live feed is unavailable in this build."
      return
    }
    if (trackerDatastreamStarted && !force) return
    trackerDatastreamStarted = true
    _solanaTrackerDatastreamConnected.value = false
    _solanaTrackerDatastreamStatusText.value = "Connecting Solana Tracker datastream…"
    solanaTrackerDatastream.connect(
      datastreamKey = BuildConfig.SOLANA_TRACKER_DATASTREAM_KEY,
      listener =
        object : SolanaTrackerDatastreamClient.Listener {
          override fun onConnected() {
            _solanaTrackerSelectedMint.value?.let(solanaTrackerDatastream::focusToken)
            viewModelScope.launch {
              _solanaTrackerDatastreamConnected.value = true
              _solanaTrackerDatastreamStatusText.value = "Tracker datastream connected."
            }
          }

          override fun onGlobalEvent(event: SolanaTrackerDatastreamEvent) {
            viewModelScope.launch {
              _solanaTrackerLiveFeed.value = (_solanaTrackerLiveFeed.value + event).takeLast(8)
            }
          }

          override fun onTokenEvent(event: SolanaTrackerDatastreamEvent) {
            viewModelScope.launch {
              _solanaTrackerFocusedFeed.value = (_solanaTrackerFocusedFeed.value + event).takeLast(10)
            }
          }

          override fun onTokenSnapshot(snapshot: SolanaTrackerDatastreamSnapshot) {
            viewModelScope.launch {
              _solanaTrackerLiveSnapshot.value = _solanaTrackerLiveSnapshot.value.merge(snapshot)
            }
          }

          override fun onError(message: String) {
            viewModelScope.launch {
              trackerDatastreamStarted = false
              _solanaTrackerDatastreamConnected.value = false
              _solanaTrackerDatastreamStatusText.value = message
            }
          }

          override fun onClosed(reason: String) {
            viewModelScope.launch {
              trackerDatastreamStarted = false
              _solanaTrackerDatastreamConnected.value = false
              _solanaTrackerDatastreamStatusText.value = reason
            }
          }
        },
    )
  }

  private suspend fun loadSolanaTrackerToken(mint: String, announce: Boolean) {
    _solanaTrackerTokenBusy.value = true
    if (announce) {
      _solanaTrackerStatusText.value = "Loading Solana Tracker token detail…"
    }
    try {
      val bundle = fetchSolanaTrackerTokenBundle(mint)
      _solanaTrackerSelectedToken.value = bundle.token
      _solanaTrackerSelectedTrades.value = bundle.trades
      _solanaTrackerSelectedHolders.value = bundle.holders
      _solanaTrackerSelectedChart.value = bundle.chart
      if (announce) {
        val token = _solanaTrackerSelectedToken.value
        _solanaTrackerStatusText.value =
          if (token != null) {
            "Loaded ${token.symbol.ifBlank { token.name }} from Solana Tracker."
          } else {
            "Token detail loaded."
          }
      }
    } catch (err: Throwable) {
      if (announce) {
        _solanaTrackerStatusText.value = err.message ?: "Unable to load Solana Tracker token detail."
      }
    } finally {
      _solanaTrackerTokenBusy.value = false
    }
  }

  private suspend fun loadSolanaTrackerTrending() {
    try {
      val tokens =
        if (solanaTrackerApi.hasMarketData()) {
          solanaTrackerApi.fetchTrendingTokens(limit = 18, timeframe = "1h")
        } else {
          convexUserApi.fetchTrackerTrending(limit = 18, timeframe = "1h")
        }
      if (tokens.isNotEmpty()) {
        _solanaTrackerTrendingTokens.value = tokens
        _solanaTrackerTickerStatusText.value = "Streaming ${tokens.size} trending Solana Tracker tokens."
      } else if (_solanaTrackerTrendingTokens.value.isEmpty()) {
        _solanaTrackerTickerStatusText.value = "No trending tokens are available right now."
      }
    } catch (err: Throwable) {
      if (_solanaTrackerTrendingTokens.value.isEmpty()) {
        _solanaTrackerTickerStatusText.value = err.message ?: "Unable to load trending tokens."
      }
    }
  }

  private fun buildSolanaTrackerAnalysisPrompt(
    token: SolanaTrackerTokenDetail,
    trades: List<SolanaTrackerTrade>,
    holders: List<SolanaTrackerHolder>,
    chart: List<SolanaTrackerOhlcvPoint>,
    liveSnapshot: SolanaTrackerDatastreamSnapshot,
  ): String =
    buildString {
      appendLine("Token snapshot")
      appendLine("Mint: ${token.mint}")
      appendLine("Name: ${token.name}")
      appendLine("Symbol: ${token.symbol}")
      appendLine("Description: ${token.description.orEmpty().ifBlank { "n/a" }}")
      appendLine("Holders: ${token.holders ?: 0}")
      appendLine("Buys: ${token.buys ?: 0}")
      appendLine("Sells: ${token.sells ?: 0}")
      appendLine("Txns: ${token.txns ?: 0}")
      appendLine("Price changes: 1m=${formatSignedPercentCompact(token.priceChanges.m1)}, 5m=${formatSignedPercentCompact(token.priceChanges.m5)}, 1h=${formatSignedPercentCompact(token.priceChanges.h1)}, 24h=${formatSignedPercentCompact(token.priceChanges.h24)}")
      appendLine("Risk: score=${token.risk.score ?: 0}, rugged=${token.risk.rugged}, top10=${formatPercentCompact(token.risk.top10)}, dev=${formatPercentCompact(token.risk.devPercentage)}, bundlers=${formatPercentCompact(token.risk.bundlerPercentage)}, snipers=${formatPercentCompact(token.risk.sniperPercentage)}")
      if (token.pools.isNotEmpty()) {
        appendLine("Pools:")
        token.pools.take(3).forEachIndexed { index, pool ->
          appendLine("${index + 1}. ${pool.market.ifBlank { "pool" }} price=${formatUsdCompact(pool.priceUsd)} liquidity=${formatUsdCompact(pool.liquidityUsd)} marketCap=${formatUsdCompact(pool.marketCapUsd)} volume24h=${formatUsdCompact(pool.volume24h)} buys=${pool.buys ?: 0} sells=${pool.sells ?: 0}")
        }
      }
      if (chart.isNotEmpty()) {
        appendLine("Recent candles:")
        chart.takeLast(6).forEach { candle ->
          appendLine("time=${candle.time ?: 0} open=${formatUsdCompact(candle.open)} close=${formatUsdCompact(candle.close)} high=${formatUsdCompact(candle.high)} low=${formatUsdCompact(candle.low)} volume=${formatUsdCompact(candle.volume)}")
        }
      }
      if (trades.isNotEmpty()) {
        appendLine("Recent trades:")
        trades.take(6).forEach { trade ->
          appendLine("${trade.type} amount=${formatNumericCompact(trade.amount)} price=${formatUsdCompact(trade.priceUsd)} volumeUsd=${formatUsdCompact(trade.volumeUsd)} wallet=${trade.wallet} time=${trade.time ?: 0} program=${trade.program.orEmpty()}")
        }
      }
      if (holders.isNotEmpty()) {
        appendLine("Top holders:")
        holders.take(5).forEach { holder ->
          appendLine("${holder.address} percentage=${formatPercentCompact(holder.percentage)} valueUsd=${formatUsdCompact(holder.valueUsd)} amount=${formatNumericCompact(holder.amount)}")
        }
      }
      if (liveSnapshot.hasData()) {
        appendLine("Live datastream:")
        appendLine("primaryPrice=${formatUsdCompact(liveSnapshot.primaryPriceUsd)} aggregatedPrice=${formatUsdCompact(liveSnapshot.aggregatedPriceUsd)} volumeUsd=${formatUsdCompact(liveSnapshot.volumeUsd)} buys=${liveSnapshot.buys ?: 0} sells=${liveSnapshot.sells ?: 0} holders=${liveSnapshot.holders ?: 0} curve=${formatPercentCompact(liveSnapshot.curvePercentage)} snipers=${formatPercentCompact(liveSnapshot.sniperPercentage)} insiders=${formatPercentCompact(liveSnapshot.insiderPercentage)}")
      }
    }

  private fun shortMint(value: String): String =
    if (value.length <= 10) {
      value
    } else {
      "${value.take(4)}…${value.takeLast(4)}"
    }

  private fun formatUsdCompact(value: Double?): String {
    val resolved = value ?: return "--"
    return when {
      resolved >= 1_000_000_000.0 -> "$" + String.format(java.util.Locale.US, "%.2fB", resolved / 1_000_000_000.0)
      resolved >= 1_000_000.0 -> "$" + String.format(java.util.Locale.US, "%.2fM", resolved / 1_000_000.0)
      resolved >= 1_000.0 -> "$" + String.format(java.util.Locale.US, "%.1fK", resolved / 1_000.0)
      resolved >= 1.0 -> "$" + String.format(java.util.Locale.US, "%.4f", resolved)
      resolved > 0.0 -> "$" + String.format(java.util.Locale.US, "%.8f", resolved)
      else -> "$0"
    }
  }

  private fun formatPercentCompact(value: Double?): String =
    value?.let { String.format(java.util.Locale.US, "%.2f%%", it) } ?: "--"

  private fun formatSignedPercentCompact(value: Double?): String =
    value?.let {
      if (it >= 0.0) {
        "+" + String.format(java.util.Locale.US, "%.2f%%", it)
      } else {
        String.format(java.util.Locale.US, "%.2f%%", it)
      }
    } ?: "--"

  private fun formatNumericCompact(value: Double?): String =
    value?.let { String.format(java.util.Locale.US, "%.4f", it) } ?: "--"

  override fun onCleared() {
    solanaTrackerStream.disconnect()
    solanaTrackerDatastream.disconnect()
    super.onCleared()
  }
}
