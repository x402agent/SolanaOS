package ai.openclaw.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.util.Log
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import ai.openclaw.app.bitaxe.BitaxeApiClient
import ai.openclaw.app.bitaxe.BitaxeDeviceSnapshot
import ai.openclaw.app.chat.ChatController
import ai.openclaw.app.chat.ChatMessage
import ai.openclaw.app.chat.ChatPendingToolCall
import ai.openclaw.app.chat.ChatSessionEntry
import ai.openclaw.app.chat.ChatToolActivityEntry
import ai.openclaw.app.chat.ChatTransportMode
import ai.openclaw.app.chat.HostedDirectChatRouter
import ai.openclaw.app.chat.LiveCameraCommentaryController
import ai.openclaw.app.chat.OpenRouterDirectChatClient
import ai.openclaw.app.chat.OutgoingAttachment
import ai.openclaw.app.chat.TogetherDirectChatClient
import ai.openclaw.app.gateway.DeviceAuthStore
import ai.openclaw.app.gateway.DeviceIdentityStore
import ai.openclaw.app.gateway.GatewayDiscovery
import ai.openclaw.app.gateway.GatewayEndpoint
import ai.openclaw.app.gateway.GatewayInvokeClient
import ai.openclaw.app.gateway.GatewaySession
import ai.openclaw.app.gateway.GatewayTransport
import ai.openclaw.app.gateway.probeGatewayTlsFingerprint
import ai.openclaw.app.node.*
import ai.openclaw.app.protocol.OpenClawCanvasA2UIAction
import ai.openclaw.app.voice.MicCaptureManager
import ai.openclaw.app.voice.TalkModeManager
import ai.openclaw.app.voice.VoiceConversationEntry
import ai.openclaw.app.voice.XAiRealtimeVoiceClient
import ai.openclaw.app.voice.XAiRealtimeVoiceSessionConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

class NodeRuntime(context: Context) {
  private val appContext = context.applicationContext
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  val prefs = SecurePrefs(appContext)
  private val deviceAuthStore = DeviceAuthStore(prefs)
  val canvas = CanvasController()
  val camera = CameraCaptureManager(appContext)
  val location = LocationCaptureManager(appContext)
  val sms = SmsManager(appContext)
  private val json = Json { ignoreUnknownKeys = true }
  private val bitaxeApi = BitaxeApiClient(json = json)

  private val externalAudioCaptureActive = MutableStateFlow(false)
  private val xAiRealtimeVoiceAvailable = BuildConfig.XAI_DIRECT_ENABLED && BuildConfig.XAI_API_KEY.isNotBlank()
  private val _xAiVoiceConfigured = MutableStateFlow(xAiRealtimeVoiceAvailable)
  val xAiVoiceConfigured: StateFlow<Boolean> = _xAiVoiceConfigured.asStateFlow()

  private val discovery = GatewayDiscovery(appContext, scope = scope)
  val gateways: StateFlow<List<GatewayEndpoint>> = discovery.gateways
  val discoveryStatusText: StateFlow<String> = discovery.statusText

  private val identityStore = DeviceIdentityStore(appContext)
  private var connectedEndpoint: GatewayEndpoint? = prefs.loadLastConnectedGatewayEndpoint()

  private val cameraHandler: CameraHandler = CameraHandler(
    appContext = appContext,
    camera = camera,
    externalAudioCaptureActive = externalAudioCaptureActive,
    showCameraHud = ::showCameraHud,
    triggerCameraFlash = ::triggerCameraFlash,
    invokeErrorFromThrowable = { invokeErrorFromThrowable(it) },
  )

  private val debugHandler: DebugHandler = DebugHandler(
    appContext = appContext,
    identityStore = identityStore,
  )

  private val locationHandler: LocationHandler = LocationHandler(
    appContext = appContext,
    location = location,
    json = json,
    isForeground = { _isForeground.value },
    locationPreciseEnabled = { locationPreciseEnabled.value },
  )

  private val deviceHandler: DeviceHandler = DeviceHandler(
    appContext = appContext,
  )

  private val notificationsHandler: NotificationsHandler = NotificationsHandler(
    appContext = appContext,
  )

  private val systemHandler: SystemHandler = SystemHandler(
    appContext = appContext,
  )

  private val photosHandler: PhotosHandler = PhotosHandler(
    appContext = appContext,
  )

  private val contactsHandler: ContactsHandler = ContactsHandler(
    appContext = appContext,
  )

  private val calendarHandler: CalendarHandler = CalendarHandler(
    appContext = appContext,
  )

  private val motionHandler: MotionHandler = MotionHandler(
    appContext = appContext,
  )

  private val smsHandlerImpl: SmsHandler = SmsHandler(
    sms = sms,
  )

  private val compatBridgeServer: SolanaOsCompatBridgeServer =
    SolanaOsCompatBridgeServer(
      appContext = appContext,
      scope = scope,
      prefs = prefs,
      deviceHandler = deviceHandler,
      cameraHandler = cameraHandler,
      contactsHandler = contactsHandler,
      smsManager = sms,
      locationCaptureManager = location,
      locationPreciseEnabled = { locationPreciseEnabled.value },
    )

  private val a2uiHandler: A2UIHandler = A2UIHandler(
    canvas = canvas,
    json = json,
    getNodeCanvasHostUrl = { nodeSession.currentCanvasHostUrl() },
    getOperatorCanvasHostUrl = { operatorSession.currentCanvasHostUrl() },
  )

  private val connectionManager: ConnectionManager = ConnectionManager(
    prefs = prefs,
    cameraEnabled = { cameraEnabled.value },
    locationMode = { locationMode.value },
    voiceWakeMode = { VoiceWakeMode.Off },
    motionActivityAvailable = { motionHandler.isActivityAvailable() },
    motionPedometerAvailable = { motionHandler.isPedometerAvailable() },
    smsAvailable = { sms.canSendSms() },
    hasRecordAudioPermission = { hasRecordAudioPermission() },
    manualTls = { manualTls.value },
  )

  private val invokeDispatcher: InvokeDispatcher = InvokeDispatcher(
    canvas = canvas,
    cameraHandler = cameraHandler,
    locationHandler = locationHandler,
    deviceHandler = deviceHandler,
    notificationsHandler = notificationsHandler,
    systemHandler = systemHandler,
    photosHandler = photosHandler,
    contactsHandler = contactsHandler,
    calendarHandler = calendarHandler,
    motionHandler = motionHandler,
    smsHandler = smsHandlerImpl,
    a2uiHandler = a2uiHandler,
    debugHandler = debugHandler,
    isForeground = { _isForeground.value },
    cameraEnabled = { cameraEnabled.value },
    locationEnabled = { locationMode.value != LocationMode.Off },
    smsAvailable = { sms.canSendSms() },
    debugBuild = { BuildConfig.DEBUG },
    refreshNodeCanvasCapability = { nodeSession.refreshNodeCanvasCapability() },
    onCanvasA2uiPush = {
      _canvasA2uiHydrated.value = true
      _canvasRehydratePending.value = false
      _canvasRehydrateErrorText.value = null
    },
    onCanvasA2uiReset = { _canvasA2uiHydrated.value = false },
    motionActivityAvailable = { motionHandler.isActivityAvailable() },
    motionPedometerAvailable = { motionHandler.isPedometerAvailable() },
  )

  data class GatewayTrustPrompt(
    val endpoint: GatewayEndpoint,
    val fingerprintSha256: String,
  )

  private val _isConnected = MutableStateFlow(false)
  val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
  private val _nodeConnected = MutableStateFlow(false)
  val nodeConnected: StateFlow<Boolean> = _nodeConnected.asStateFlow()

  private val _statusText = MutableStateFlow("Offline")
  val statusText: StateFlow<String> = _statusText.asStateFlow()

  private val _nodeBridgeOnly = MutableStateFlow(false)
  val nodeBridgeOnly: StateFlow<Boolean> = _nodeBridgeOnly.asStateFlow()

  private val _pendingGatewayTrust = MutableStateFlow<GatewayTrustPrompt?>(null)
  val pendingGatewayTrust: StateFlow<GatewayTrustPrompt?> = _pendingGatewayTrust.asStateFlow()

  private val _mainSessionKey = MutableStateFlow("main")
  val mainSessionKey: StateFlow<String> = _mainSessionKey.asStateFlow()

  private val cameraHudSeq = AtomicLong(0)
  private val _cameraHud = MutableStateFlow<CameraHudState?>(null)
  val cameraHud: StateFlow<CameraHudState?> = _cameraHud.asStateFlow()

  private val _cameraFlashToken = MutableStateFlow(0L)
  val cameraFlashToken: StateFlow<Long> = _cameraFlashToken.asStateFlow()

  private val _canvasA2uiHydrated = MutableStateFlow(false)
  val canvasA2uiHydrated: StateFlow<Boolean> = _canvasA2uiHydrated.asStateFlow()
  private val _canvasRehydratePending = MutableStateFlow(false)
  val canvasRehydratePending: StateFlow<Boolean> = _canvasRehydratePending.asStateFlow()
  private val _canvasRehydrateErrorText = MutableStateFlow<String?>(null)
  val canvasRehydrateErrorText: StateFlow<String?> = _canvasRehydrateErrorText.asStateFlow()

  private val _serverName = MutableStateFlow<String?>(null)
  val serverName: StateFlow<String?> = _serverName.asStateFlow()

  private val _remoteAddress = MutableStateFlow<String?>(null)
  val remoteAddress: StateFlow<String?> = _remoteAddress.asStateFlow()

  private val _bridgeInvokeTelemetry = MutableStateFlow<List<GatewaySession.InvokeDeliveryUpdate>>(emptyList())
  val bridgeInvokeTelemetry: StateFlow<List<GatewaySession.InvokeDeliveryUpdate>> = _bridgeInvokeTelemetry.asStateFlow()

  private val _bridgeConsoleBusy = MutableStateFlow(false)
  val bridgeConsoleBusy: StateFlow<Boolean> = _bridgeConsoleBusy.asStateFlow()

  private val _bridgeConsoleStatusText = MutableStateFlow("Bridge console idle")
  val bridgeConsoleStatusText: StateFlow<String> = _bridgeConsoleStatusText.asStateFlow()

  private val _bridgeConsoleResponseJson = MutableStateFlow<String?>(null)
  val bridgeConsoleResponseJson: StateFlow<String?> = _bridgeConsoleResponseJson.asStateFlow()

  private val _seamColorArgb = MutableStateFlow(DEFAULT_SEAM_COLOR_ARGB)
  val seamColorArgb: StateFlow<Long> = _seamColorArgb.asStateFlow()

  private val _bitaxeResolvedBaseUrl = MutableStateFlow("")
  val bitaxeResolvedBaseUrl: StateFlow<String> = _bitaxeResolvedBaseUrl.asStateFlow()

  private val _bitaxeDevices = MutableStateFlow<List<BitaxeDeviceSnapshot>>(emptyList())
  val bitaxeDevices: StateFlow<List<BitaxeDeviceSnapshot>> = _bitaxeDevices.asStateFlow()

  private val _bitaxeStatusText = MutableStateFlow("Bitaxe API idle")
  val bitaxeStatusText: StateFlow<String> = _bitaxeStatusText.asStateFlow()

  private val _bitaxeBusy = MutableStateFlow(false)
  val bitaxeBusy: StateFlow<Boolean> = _bitaxeBusy.asStateFlow()

  private val _isForeground = MutableStateFlow(true)
  val isForeground: StateFlow<Boolean> = _isForeground.asStateFlow()

  private var lastAutoA2uiUrl: String? = null
  private var didAutoRequestCanvasRehydrate = false
  private val canvasRehydrateSeq = AtomicLong(0)
  private var operatorConnected = false
  private var operatorStatusText: String = "Offline"
  private var nodeStatusText: String = "Offline"

  private val operatorSession =
    GatewaySession(
      scope = scope,
      identityStore = identityStore,
      deviceAuthStore = deviceAuthStore,
      onConnected = { name, remote, mainSessionKey ->
        operatorConnected = true
        operatorStatusText = "Connected"
        _serverName.value = name
        _remoteAddress.value = remote
        _seamColorArgb.value = DEFAULT_SEAM_COLOR_ARGB
        applyMainSessionKey(mainSessionKey)
        updateStatus()
        if (!xAiRealtimeVoiceAvailable) {
          micCapture.onGatewayConnectionChanged(true)
        }
        scope.launch {
          refreshBrandingFromGateway()
          if (voiceReplySpeakerLazy.isInitialized()) {
            voiceReplySpeaker.refreshConfig()
          }
        }
      },
      onDisconnected = { message ->
        operatorConnected = false
        operatorStatusText = message
        _serverName.value = null
        _remoteAddress.value = null
        _seamColorArgb.value = DEFAULT_SEAM_COLOR_ARGB
        if (!isCanonicalMainSessionKey(_mainSessionKey.value)) {
          _mainSessionKey.value = "main"
        }
        chat.applyMainSessionKey(resolveMainSessionKey())
        chat.onDisconnected(message)
        updateStatus()
        if (!xAiRealtimeVoiceAvailable) {
          micCapture.onGatewayConnectionChanged(false)
        }
      },
      onEvent = { event, payloadJson ->
        handleGatewayEvent(event, payloadJson)
      },
    )

  private val nodeSession =
    GatewaySession(
      scope = scope,
      identityStore = identityStore,
      deviceAuthStore = deviceAuthStore,
      onConnected = { name, remote, _ ->
        _nodeConnected.value = true
        nodeStatusText = "Connected"
        if (connectedEndpoint?.transport == GatewayTransport.NativeJsonTcp) {
          _serverName.value = name
          _remoteAddress.value = remote
        }
        didAutoRequestCanvasRehydrate = false
        _canvasA2uiHydrated.value = false
        _canvasRehydratePending.value = false
        _canvasRehydrateErrorText.value = null
        updateStatus()
        maybeNavigateToA2uiOnConnect()
      },
      onDisconnected = { message ->
        _nodeConnected.value = false
        nodeStatusText = message
        if (connectedEndpoint?.transport == GatewayTransport.NativeJsonTcp) {
          _serverName.value = null
          _remoteAddress.value = null
        }
        didAutoRequestCanvasRehydrate = false
        _canvasA2uiHydrated.value = false
        _canvasRehydratePending.value = false
        _canvasRehydrateErrorText.value = null
        updateStatus()
        showLocalCanvasOnDisconnect()
      },
      onEvent = { _, _ -> },
      onInvoke = { req ->
        invokeDispatcher.handleInvoke(req.command, req.paramsJson)
      },
      onInvokeDelivery = ::recordInvokeDelivery,
      onTlsFingerprint = { stableId, fingerprint ->
        prefs.saveGatewayTlsFingerprint(stableId, fingerprint)
      },
    )

  private val gatewayInvokeClient =
    GatewayInvokeClient(
      json = json,
      requestDetailed = { method, paramsJson, timeoutMs ->
        operatorSession.requestDetailed(method, paramsJson, timeoutMs)
      },
      targetNodeId = ::resolveCurrentNodeId,
    )

  init {
    DeviceNotificationListenerService.setNodeEventSink { event, payloadJson ->
      scope.launch {
        nodeSession.sendNodeEvent(event = event, payloadJson = payloadJson)
      }
    }
  }

  private fun defaultScreenHubUrl(): String = prefs.loadScreenHubUrl(nanoSolanaHubUrl)

  private val directChatClient =
    HostedDirectChatRouter(
      listOf(
        TogetherDirectChatClient(
          apiKeyProvider = {
            prefs.loadTogetherApiKey().orEmpty().ifBlank { BuildConfig.TOGETHER_API_KEY }
          },
          modelProvider = {
            prefs.loadTogetherModel().orEmpty().ifBlank { BuildConfig.TOGETHER_MODEL }
          },
          json = json,
        ),
        OpenRouterDirectChatClient(
          apiKeyProvider = {
            prefs.loadOpenRouterApiKey().orEmpty().ifBlank { BuildConfig.OPENROUTER_API_KEY }
          },
          modelProvider = {
            prefs.loadOpenRouterModel().orEmpty().ifBlank { BuildConfig.OPENROUTER_MODEL }
          },
          json = json,
        ),
      ),
    )

  private val chat: ChatController =
    ChatController(
      scope = scope,
      session = operatorSession,
      json = json,
      supportsChatSubscribe = false,
      isGatewayRpcConnected = { operatorConnected },
      directChatClient = directChatClient,
    )
  private val liveCameraCommentary =
    LiveCameraCommentaryController(
      scope = scope,
      camera = camera,
      grokClient =
        OpenRouterDirectChatClient(
          apiKey = BuildConfig.OPENROUTER_API_KEY,
          model = BuildConfig.OPENROUTER_GROK_MODEL,
          json = json,
        ).takeIf { BuildConfig.OPENROUTER_DIRECT_ENABLED && it.isConfigured() },
    )
  private val voiceReplySpeakerLazy: Lazy<TalkModeManager> = lazy {
    // Reuse the existing TalkMode speech engine (ElevenLabs + deterministic system-TTS fallback)
    // without enabling the legacy talk capture loop.
    TalkModeManager(
      context = appContext,
      scope = scope,
      session = operatorSession,
      supportsChatSubscribe = false,
      isConnected = { operatorConnected },
    ).also { speaker ->
      speaker.setPlaybackEnabled(prefs.speakerEnabled.value)
    }
  }
  private val voiceReplySpeaker: TalkModeManager
    get() = voiceReplySpeakerLazy.value

  private val micCapture: MicCaptureManager by lazy {
    MicCaptureManager(
      context = appContext,
      scope = scope,
      sendToGateway = { message, onRunIdKnown ->
        val idempotencyKey = UUID.randomUUID().toString()
        // Notify MicCaptureManager of the idempotency key *before* the network
        // call so pendingRunId is set before any chat events can arrive.
        onRunIdKnown(idempotencyKey)
        val params =
          buildJsonObject {
            put("sessionKey", JsonPrimitive(resolveMainSessionKey()))
            put("message", JsonPrimitive(message))
            put("thinking", JsonPrimitive(chatThinkingLevel.value))
            put("timeoutMs", JsonPrimitive(30_000))
            put("idempotencyKey", JsonPrimitive(idempotencyKey))
          }
        val response = operatorSession.request("chat.send", params.toString())
        parseChatSendRunId(response) ?: idempotencyKey
      },
      speakAssistantReply = { text ->
        // Skip if TalkModeManager is handling TTS (ttsOnAllResponses) to avoid
        // double-speaking the same assistant reply from both pipelines.
        if (!talkMode.ttsOnAllResponses) {
          voiceReplySpeaker.speakAssistantReply(text)
        }
      },
    )
  }

  private val xAiRealtimeVoiceClientLazy: Lazy<XAiRealtimeVoiceClient>? =
    if (xAiRealtimeVoiceAvailable) {
      lazy {
        XAiRealtimeVoiceClient(
          context = appContext,
          scope = scope,
          apiKey = BuildConfig.XAI_API_KEY,
          configProvider = ::resolveXAiRealtimeVoiceConfig,
          playbackEnabledProvider = { prefs.speakerEnabled.value },
          json = json,
        )
      }
    } else {
      null
    }
  private val xAiRealtimeVoiceClient: XAiRealtimeVoiceClient?
    get() = xAiRealtimeVoiceClientLazy?.value

  val micStatusText: StateFlow<String>
    get() = xAiRealtimeVoiceClient?.statusText ?: micCapture.statusText

  val micLiveTranscript: StateFlow<String?>
    get() = xAiRealtimeVoiceClient?.liveTranscript ?: micCapture.liveTranscript

  val micIsListening: StateFlow<Boolean>
    get() = xAiRealtimeVoiceClient?.isListening ?: micCapture.isListening

  val micEnabled: StateFlow<Boolean>
    get() = xAiRealtimeVoiceClient?.micEnabled ?: micCapture.micEnabled

  val micCooldown: StateFlow<Boolean>
    get() = xAiRealtimeVoiceClient?.micCooldown ?: micCapture.micCooldown

  val micQueuedMessages: StateFlow<List<String>>
    get() = xAiRealtimeVoiceClient?.queuedMessages ?: micCapture.queuedMessages

  val micConversation: StateFlow<List<VoiceConversationEntry>>
    get() = xAiRealtimeVoiceClient?.conversation ?: micCapture.conversation

  val micInputLevel: StateFlow<Float>
    get() = xAiRealtimeVoiceClient?.inputLevel ?: micCapture.inputLevel

  val micIsSending: StateFlow<Boolean>
    get() = xAiRealtimeVoiceClient?.isSending ?: micCapture.isSending

  private val talkMode: TalkModeManager by lazy {
    TalkModeManager(
      context = appContext,
      scope = scope,
      session = operatorSession,
      supportsChatSubscribe = true,
      isConnected = { operatorConnected },
    )
  }

  private fun applyMainSessionKey(candidate: String?) {
    val trimmed = normalizeMainKey(candidate) ?: return
    if (isCanonicalMainSessionKey(_mainSessionKey.value)) return
    if (_mainSessionKey.value == trimmed) return
    _mainSessionKey.value = trimmed
    talkMode.setMainSessionKey(trimmed)
    chat.applyMainSessionKey(trimmed)
  }

  private fun updateStatus() {
    val operator = operatorStatusText.trim()
    val node = nodeStatusText.trim()
    val nativeBridge = connectedEndpoint?.transport == GatewayTransport.NativeJsonTcp
    _nodeBridgeOnly.value = nativeBridge && _nodeConnected.value && !operatorConnected
    _isConnected.value = operatorConnected || (nativeBridge && _nodeConnected.value)
    _statusText.value =
      when {
        nativeBridge && _nodeConnected.value -> "Connected (native bridge)"
        operatorConnected && _nodeConnected.value -> "Connected"
        operatorConnected && !_nodeConnected.value -> "Connected (node offline)"
        !operatorConnected && _nodeConnected.value ->
          if (operator.isNotEmpty() && operator != "Offline") {
            "Connected (operator: $operator)"
          } else {
            "Connected (operator offline)"
          }
        operator.isNotBlank() && operator != "Offline" -> operator
        else -> node
      }
  }

  private fun gatewayEndpointPort(endpoint: GatewayEndpoint): Int {
    return endpoint.gatewayPort ?: endpoint.port
  }

  private fun gatewayEndpointHosts(endpoint: GatewayEndpoint): Set<String> {
    return buildSet {
      listOf(endpoint.host, endpoint.lanHost, endpoint.tailnetDns).forEach { raw ->
        val normalized = raw?.trim()?.lowercase().orEmpty()
        if (normalized.isNotEmpty()) add(normalized)
      }
    }
  }

  private fun resolveDiscoveredGatewayMatch(reference: GatewayEndpoint): GatewayEndpoint? {
    val candidates = gateways.value
    if (candidates.isEmpty()) return null

    candidates.firstOrNull { it.stableId == reference.stableId }?.let { return it }

    val referenceHosts = gatewayEndpointHosts(reference)
    if (referenceHosts.isEmpty()) return null

    val referencePorts =
      buildSet {
        add(reference.port)
        add(gatewayEndpointPort(reference))
      }

    return candidates.firstOrNull { candidate ->
      val candidateHosts = gatewayEndpointHosts(candidate)
      if (candidateHosts.isEmpty()) return@firstOrNull false
      val hostMatches = candidateHosts.any { it in referenceHosts }
      val candidatePorts = setOf(candidate.port, gatewayEndpointPort(candidate))
      val portMatches = candidatePorts.any { it in referencePorts }
      hostMatches && portMatches
    }
  }

  private fun resolveLiveGatewayFallback(): GatewayEndpoint? {
    val discovered = gateways.value
    if (discovered.isEmpty()) return null

    val targetStableId = lastDiscoveredStableId.value.trim()
    if (targetStableId.isNotEmpty()) {
      discovered.firstOrNull { it.stableId == targetStableId }?.let { return it }
    }

    prefs.loadLastConnectedGatewayEndpoint()?.let { persisted ->
      resolveDiscoveredGatewayMatch(persisted)?.let { return it }
    }

    if (manualEnabled.value) {
      val host = manualHost.value.trim()
      val port = manualPort.value
      if (host.isNotEmpty() && port in 1..65535) {
        val manualEndpoint = GatewayEndpoint.manual(host = host, port = port, transport = manualTransport.value)
        resolveDiscoveredGatewayMatch(manualEndpoint)?.let { return it }
      }
    }

    if (discovered.size == 1) return discovered.first()

    val trusted = discovered.filter { !prefs.loadGatewayTlsFingerprint(it.stableId).isNullOrBlank() }
    if (trusted.size == 1) return trusted.first()

    return null
  }

  private fun rememberGatewaySelection(endpoint: GatewayEndpoint) {
    connectedEndpoint = endpoint
    prefs.saveLastConnectedGatewayEndpoint(endpoint)
    if (!endpoint.stableId.startsWith("manual|")) {
      prefs.setLastDiscoveredStableId(endpoint.stableId)
    }
  }

  private fun resolveCachedGatewayEndpoint(): GatewayEndpoint? {
    connectedEndpoint?.let { return it }

    val persisted = prefs.loadLastConnectedGatewayEndpoint()
    if (persisted != null) {
      val discoveredMatch = resolveDiscoveredGatewayMatch(persisted)
      connectedEndpoint = discoveredMatch ?: persisted
      return connectedEndpoint
    }

    if (manualEnabled.value) {
      val host = manualHost.value.trim()
      val port = manualPort.value
      if (host.isNotEmpty() && port in 1..65535) {
        val manualEndpoint = GatewayEndpoint.manual(host = host, port = port, transport = manualTransport.value)
        connectedEndpoint = resolveDiscoveredGatewayMatch(manualEndpoint) ?: manualEndpoint
        return connectedEndpoint
      }
    }

    val discovered = resolveLiveGatewayFallback() ?: return null
    connectedEndpoint = discovered
    return discovered
  }

  private fun resolveMainSessionKey(): String {
    val trimmed = _mainSessionKey.value.trim()
    return if (trimmed.isEmpty()) "main" else trimmed
  }

  private fun maybeNavigateToA2uiOnConnect() {
    val a2uiUrl = a2uiHandler.resolveA2uiHostUrl() ?: return
    val current = canvas.currentUrl()?.trim().orEmpty()
    if (current.isEmpty() || current == lastAutoA2uiUrl || current == defaultScreenHubUrl()) {
      lastAutoA2uiUrl = a2uiUrl
      canvas.navigate(a2uiUrl)
    }
  }

  private fun showLocalCanvasOnDisconnect() {
    lastAutoA2uiUrl = null
    _canvasA2uiHydrated.value = false
    _canvasRehydratePending.value = false
    _canvasRehydrateErrorText.value = null
    canvas.navigate(defaultScreenHubUrl())
  }

  fun requestCanvasRehydrate(source: String = "manual", force: Boolean = true) {
    scope.launch {
      if (!_nodeConnected.value) {
        _canvasRehydratePending.value = false
        _canvasRehydrateErrorText.value = "Node offline. Reconnect and retry."
        return@launch
      }
      if (!force && didAutoRequestCanvasRehydrate) return@launch
      didAutoRequestCanvasRehydrate = true
      val requestId = canvasRehydrateSeq.incrementAndGet()
      _canvasRehydratePending.value = true
      _canvasRehydrateErrorText.value = null

      val sessionKey = resolveMainSessionKey()
      val prompt =
        "Restore canvas now for session=$sessionKey source=$source. " +
          "If existing A2UI state exists, replay it immediately. " +
          "If not, create and render a compact mobile-friendly dashboard in Canvas."
      val sent =
        nodeSession.sendNodeEvent(
          event = "agent.request",
          payloadJson =
            buildJsonObject {
              put("message", JsonPrimitive(prompt))
              put("sessionKey", JsonPrimitive(sessionKey))
              put("thinking", JsonPrimitive("low"))
              put("deliver", JsonPrimitive(false))
            }.toString(),
        )
      if (!sent) {
        if (!force) {
          didAutoRequestCanvasRehydrate = false
        }
        if (canvasRehydrateSeq.get() == requestId) {
          _canvasRehydratePending.value = false
          _canvasRehydrateErrorText.value = "Failed to request restore. Tap to retry."
        }
        Log.w("OpenClawCanvas", "canvas rehydrate request failed ($source): transport unavailable")
        return@launch
      }
      scope.launch {
        delay(20_000)
        if (canvasRehydrateSeq.get() != requestId) return@launch
        if (!_canvasRehydratePending.value) return@launch
        if (_canvasA2uiHydrated.value) return@launch
        _canvasRehydratePending.value = false
        _canvasRehydrateErrorText.value = "No canvas update yet. Tap to retry."
      }
    }
  }

  val instanceId: StateFlow<String> = prefs.instanceId
  val displayName: StateFlow<String> = prefs.displayName
  val cameraEnabled: StateFlow<Boolean> = prefs.cameraEnabled
  val locationMode: StateFlow<LocationMode> = prefs.locationMode
  val locationPreciseEnabled: StateFlow<Boolean> = prefs.locationPreciseEnabled
  val preventSleep: StateFlow<Boolean> = prefs.preventSleep
  val autoStartOnBoot: StateFlow<Boolean> = prefs.autoStartOnBoot
  val manualEnabled: StateFlow<Boolean> = prefs.manualEnabled
  val manualHost: StateFlow<String> = prefs.manualHost
  val manualPort: StateFlow<Int> = prefs.manualPort
  val manualTls: StateFlow<Boolean> = prefs.manualTls
  val manualTransport: StateFlow<GatewayTransport> = prefs.manualTransport
  val bitaxeApiBaseUrl: StateFlow<String> = prefs.bitaxeApiBaseUrl
  val gatewayToken: StateFlow<String> = prefs.gatewayToken
  val bitaxeApiKey: StateFlow<String> = prefs.bitaxeApiKey
  val togetherApiKey: StateFlow<String> = prefs.togetherApiKey
  val togetherModel: StateFlow<String> = prefs.togetherModel
  val openRouterApiKey: StateFlow<String> = prefs.openRouterApiKey
  val openRouterModel: StateFlow<String> = prefs.openRouterModel
  val onboardingCompleted: StateFlow<Boolean> = prefs.onboardingCompleted
  val rewardsWaitlistJoined: StateFlow<Boolean> = prefs.rewardsWaitlistJoined
  fun setGatewayToken(value: String) = prefs.setGatewayToken(value)
  fun setGatewayPassword(value: String) = prefs.setGatewayPassword(value)
  fun setOnboardingCompleted(value: Boolean) = prefs.setOnboardingCompleted(value)
  val lastDiscoveredStableId: StateFlow<String> = prefs.lastDiscoveredStableId
  val canvasDebugStatusEnabled: StateFlow<Boolean> = prefs.canvasDebugStatusEnabled

  private var didAutoConnect = false

  val chatSessionKey: StateFlow<String> = chat.sessionKey
  val chatSessionId: StateFlow<String?> = chat.sessionId
  val chatMessages: StateFlow<List<ChatMessage>> = chat.messages
  val chatError: StateFlow<String?> = chat.errorText
  val chatHealthOk: StateFlow<Boolean> = chat.healthOk
  val chatTransportMode: StateFlow<ChatTransportMode> = chat.transportMode
  val chatGatewayRpcAvailable: StateFlow<Boolean> = chat.gatewayRpcAvailable
  val chatOpenRouterAvailable: StateFlow<Boolean> = chat.openRouterAvailable
  val chatStatusText: StateFlow<String> = chat.statusText
  val chatThinkingLevel: StateFlow<String> = chat.thinkingLevel
  val chatStreamingAssistantText: StateFlow<String?> = chat.streamingAssistantText
  val chatPendingToolCalls: StateFlow<List<ChatPendingToolCall>> = chat.pendingToolCalls
  val chatToolActivity: StateFlow<List<ChatToolActivityEntry>> = chat.toolActivity
  val chatSessions: StateFlow<List<ChatSessionEntry>> = chat.sessions
  val pendingRunCount: StateFlow<Int> = chat.pendingRunCount
  val liveCameraVisionAvailable: StateFlow<Boolean> = liveCameraCommentary.available
  val liveCameraPreviewActive: StateFlow<Boolean> = liveCameraCommentary.previewActive
  val liveCameraBusy: StateFlow<Boolean> = liveCameraCommentary.busy
  val liveCameraLiveEnabled: StateFlow<Boolean> = liveCameraCommentary.liveEnabled
  val liveCameraStatusText: StateFlow<String> = liveCameraCommentary.statusText
  val liveCameraLatestCommentary: StateFlow<String?> = liveCameraCommentary.latestCommentary

  init {
    compatBridgeServer.start()

    if (canvas.currentUrl().isNullOrBlank()) {
      canvas.navigate(defaultScreenHubUrl())
    }

    updateBitaxeResolvedBaseUrl()

    if (prefs.voiceWakeMode.value != VoiceWakeMode.Off) {
      prefs.setVoiceWakeMode(VoiceWakeMode.Off)
    }

    scope.launch {
      prefs.loadGatewayToken()
    }

    scope.launch {
      prefs.loadBitaxeApiKey()
    }

    scope.launch {
      prefs.loadTogetherApiKey()
    }

    scope.launch {
      prefs.loadTogetherModel()
    }

    scope.launch {
      prefs.loadOpenRouterApiKey()
    }

    scope.launch {
      prefs.loadOpenRouterModel()
    }

    scope.launch {
      chat.load(resolveMainSessionKey())
    }

    scope.launch {
      prefs.bitaxeApiBaseUrl.collect {
        updateBitaxeResolvedBaseUrl()
      }
    }

    scope.launch {
      prefs.talkEnabled.collect { enabled ->
        if (xAiRealtimeVoiceAvailable) {
          talkMode.ttsOnAllResponses = false
          xAiRealtimeVoiceClient?.setMicEnabled(enabled)
        } else {
          // MicCaptureManager handles STT + send to gateway.
          // TalkModeManager plays TTS on assistant responses.
          micCapture.setMicEnabled(enabled)
          if (enabled) {
            // Mic on = user is on voice screen and wants TTS responses.
            talkMode.ttsOnAllResponses = true
            scope.launch { talkMode.ensureChatSubscribed() }
          }
        }
        externalAudioCaptureActive.value = enabled
      }
    }

    scope.launch(Dispatchers.Default) {
      gateways.collect { list ->
        if (list.isNotEmpty()) {
          // Security: don't let an unauthenticated discovery feed continuously steer autoconnect.
          // UX parity with iOS: only set once when unset.
          if (lastDiscoveredStableId.value.trim().isEmpty()) {
            prefs.setLastDiscoveredStableId(list.first().stableId)
          }
        }

        if (didAutoConnect) return@collect
        if (_isConnected.value) return@collect

        if (manualEnabled.value) {
          val host = manualHost.value.trim()
          val port = manualPort.value
          if (host.isNotEmpty() && port in 1..65535) {
            val transport = manualTransport.value
            if (transport == GatewayTransport.WebSocketRpc) {
              // Security: autoconnect only to previously trusted gateways (stored TLS pin).
              if (!manualTls.value) return@collect
              val stableId = GatewayEndpoint.manual(host = host, port = port, transport = transport).stableId
              val storedFingerprint = prefs.loadGatewayTlsFingerprint(stableId)?.trim().orEmpty()
              if (storedFingerprint.isEmpty()) return@collect
            }

            didAutoConnect = true
            connect(GatewayEndpoint.manual(host = host, port = port, transport = transport))
          }
          return@collect
        }

        val targetStableId = lastDiscoveredStableId.value.trim()
        if (targetStableId.isEmpty()) return@collect
        val target = list.firstOrNull { it.stableId == targetStableId } ?: return@collect

        // Security: autoconnect only to previously trusted gateways (stored TLS pin).
        val storedFingerprint = prefs.loadGatewayTlsFingerprint(target.stableId)?.trim().orEmpty()
        if (storedFingerprint.isEmpty()) return@collect

        didAutoConnect = true
        connect(target)
      }
    }

    scope.launch {
      combine(
        canvasDebugStatusEnabled,
        statusText,
        serverName,
        remoteAddress,
      ) { debugEnabled, status, server, remote ->
        Quad(debugEnabled, status, server, remote)
      }.distinctUntilChanged()
        .collect { (debugEnabled, status, server, remote) ->
          canvas.setDebugStatusEnabled(debugEnabled)
          if (!debugEnabled) return@collect
          canvas.setDebugStatus(status, server ?: remote)
        }
    }

    scope.launch {
      combine(
        isConnected,
        nodeConnected,
        statusText,
        serverName,
        remoteAddress,
      ) { gatewayConnected, nodeConnected, status, server, remote ->
        CanvasController.RuntimeState(
          gatewayConnected = gatewayConnected,
          nodeConnected = nodeConnected,
          statusText = status,
          serverName = server,
          remoteAddress = remote,
          canvasUrl = null,
          a2uiHydrated = false,
          rehydratePending = false,
          rehydrateErrorText = null,
        )
      }
        .combine(canvas.currentUrl) { runtimeState, canvasUrl ->
          runtimeState.copy(canvasUrl = canvasUrl)
        }
        .combine(canvasA2uiHydrated) { runtimeState, hydrated ->
          runtimeState.copy(a2uiHydrated = hydrated)
        }
        .combine(canvasRehydratePending) { runtimeState, pending ->
          runtimeState.copy(rehydratePending = pending)
        }
        .combine(canvasRehydrateErrorText) { runtimeState, errorText ->
          runtimeState.copy(rehydrateErrorText = errorText)
        }
        .distinctUntilChanged()
        .collect { runtimeState ->
          canvas.setRuntimeState(runtimeState)
        }
    }

    updateBitaxeResolvedBaseUrl()
  }

  fun setForeground(value: Boolean) {
    _isForeground.value = value
    if (!value) {
      stopActiveVoiceSession()
    }
  }

  fun setDisplayName(value: String) {
    prefs.setDisplayName(value)
  }

  fun setCameraEnabled(value: Boolean) {
    prefs.setCameraEnabled(value)
  }

  fun setLocationMode(mode: LocationMode) {
    prefs.setLocationMode(mode)
  }

  fun setLocationPreciseEnabled(value: Boolean) {
    prefs.setLocationPreciseEnabled(value)
  }

  fun setPreventSleep(value: Boolean) {
    prefs.setPreventSleep(value)
  }

  fun setAutoStartOnBoot(value: Boolean) {
    prefs.setAutoStartOnBoot(value)
  }

  fun setManualEnabled(value: Boolean) {
    prefs.setManualEnabled(value)
  }

  fun setManualHost(value: String) {
    prefs.setManualHost(value)
  }

  fun setManualPort(value: Int) {
    prefs.setManualPort(value)
  }

  fun setManualTls(value: Boolean) {
    prefs.setManualTls(value)
  }

  fun setManualTransport(value: GatewayTransport) {
    prefs.setManualTransport(value)
  }

  fun setBitaxeApiBaseUrl(value: String) {
    prefs.setBitaxeApiBaseUrl(value)
    updateBitaxeResolvedBaseUrl()
  }

  fun setBitaxeApiKey(value: String) {
    prefs.setBitaxeApiKey(value)
  }

  fun setTogetherApiKey(value: String) {
    prefs.setTogetherApiKey(value)
    chat.refresh()
  }

  fun setTogetherModel(value: String) {
    prefs.setTogetherModel(value)
    chat.refresh()
  }

  fun setOpenRouterApiKey(value: String) {
    prefs.setOpenRouterApiKey(value)
    chat.refresh()
  }

  fun setOpenRouterModel(value: String) {
    prefs.setOpenRouterModel(value)
    chat.refresh()
  }

  fun setCanvasDebugStatusEnabled(value: Boolean) {
    prefs.setCanvasDebugStatusEnabled(value)
  }

  fun setRewardsWaitlistJoined(value: Boolean) {
    prefs.setRewardsWaitlistJoined(value)
  }

  fun setVoiceScreenActive(active: Boolean) {
    if (!active) {
      stopActiveVoiceSession()
    }
    // Don't re-enable on active=true; mic toggle drives that
  }

  fun setMicEnabled(value: Boolean) {
    prefs.setTalkEnabled(value)
    if (xAiRealtimeVoiceAvailable) {
      talkMode.ttsOnAllResponses = false
      if (value) {
        talkMode.stopTts()
      }
      xAiRealtimeVoiceClient?.setMicEnabled(value)
      externalAudioCaptureActive.value = value
      return
    }
    if (value) {
      // Tapping mic on interrupts any active TTS (barge-in)
      talkMode.stopTts()
      talkMode.ttsOnAllResponses = true
      scope.launch { talkMode.ensureChatSubscribed() }
    }
    micCapture.setMicEnabled(value)
    externalAudioCaptureActive.value = value
  }

  val speakerEnabled: StateFlow<Boolean>
    get() = prefs.speakerEnabled

  val grokVoiceId: StateFlow<String>
    get() = prefs.grokVoiceId

  val grokVadThreshold: StateFlow<String>
    get() = prefs.grokVadThreshold

  val grokSilenceDurationMs: StateFlow<String>
    get() = prefs.grokSilenceDurationMs

  val grokSampleRate: StateFlow<String>
    get() = prefs.grokSampleRate

  val grokWebSearchEnabled: StateFlow<Boolean>
    get() = prefs.grokWebSearchEnabled

  val grokXSearchEnabled: StateFlow<Boolean>
    get() = prefs.grokXSearchEnabled

  fun setSpeakerEnabled(value: Boolean) {
    prefs.setSpeakerEnabled(value)
    xAiRealtimeVoiceClient?.setPlaybackEnabled(value)
    if (voiceReplySpeakerLazy.isInitialized()) {
      voiceReplySpeaker.setPlaybackEnabled(value)
    }
    // Keep TalkMode in sync so speaker mute works when ttsOnAllResponses is active.
    talkMode.setPlaybackEnabled(value)
  }

  fun setGrokVoiceId(value: String) {
    prefs.setGrokVoiceId(value)
    xAiRealtimeVoiceClient?.refreshSessionConfig()
  }

  fun setGrokVadThreshold(value: String) {
    prefs.setGrokVadThreshold(value)
    xAiRealtimeVoiceClient?.refreshSessionConfig()
  }

  fun setGrokSilenceDurationMs(value: String) {
    prefs.setGrokSilenceDurationMs(value)
    xAiRealtimeVoiceClient?.refreshSessionConfig()
  }

  fun setGrokSampleRate(value: String) {
    prefs.setGrokSampleRate(value)
    xAiRealtimeVoiceClient?.restartActiveSession()
  }

  fun setGrokWebSearchEnabled(value: Boolean) {
    prefs.setGrokWebSearchEnabled(value)
    xAiRealtimeVoiceClient?.refreshSessionConfig()
  }

  fun setGrokXSearchEnabled(value: Boolean) {
    prefs.setGrokXSearchEnabled(value)
    xAiRealtimeVoiceClient?.refreshSessionConfig()
  }

  fun hasStartupChatAgent(): Boolean = directChatClient.isConfigured()

  private fun stopActiveVoiceSession() {
    talkMode.ttsOnAllResponses = false
    talkMode.stopTts()
    xAiRealtimeVoiceClient?.setMicEnabled(false)
    micCapture.setMicEnabled(false)
    prefs.setTalkEnabled(false)
    externalAudioCaptureActive.value = false
  }

  fun refreshGatewayConnection() {
    val endpoint =
      resolveCachedGatewayEndpoint() ?: run {
        _statusText.value = "Failed: no saved or discovered gateway yet. Pair or enter a host in Connect."
        return
      }
    rememberGatewaySelection(endpoint)
    operatorStatusText = "Connecting…"
    updateStatus()
    val token = prefs.loadGatewayToken()
    val password = prefs.loadGatewayPassword()
    val tls = connectionManager.resolveTlsParams(endpoint)
    if (endpoint.transport == GatewayTransport.NativeJsonTcp) {
      operatorSession.disconnect()
      operatorConnected = false
      operatorStatusText = "Native bridge mode (operator RPC unavailable)"
      updateStatus()
      nodeSession.connect(endpoint, token, password, connectionManager.buildNodeConnectOptions(), tls = null)
      nodeSession.reconnect()
      return
    }
    operatorSession.connect(endpoint, token, password, connectionManager.buildOperatorConnectOptions(), tls)
    nodeSession.connect(endpoint, token, password, connectionManager.buildNodeConnectOptions(), tls)
    operatorSession.reconnect()
    nodeSession.reconnect()
  }

  fun connect(endpoint: GatewayEndpoint) {
    val tls = connectionManager.resolveTlsParams(endpoint)
    if (tls?.required == true && tls.expectedFingerprint.isNullOrBlank()) {
      // First-time TLS: capture fingerprint, ask user to verify out-of-band, then store and connect.
      _statusText.value = "Verify gateway TLS fingerprint…"
      scope.launch {
        val fp = probeGatewayTlsFingerprint(endpoint.host, endpoint.port) ?: run {
          _statusText.value = "Failed: can't read TLS fingerprint"
          return@launch
        }
        _pendingGatewayTrust.value = GatewayTrustPrompt(endpoint = endpoint, fingerprintSha256 = fp)
      }
      return
    }

    rememberGatewaySelection(endpoint)
    updateBitaxeResolvedBaseUrl()
    operatorStatusText = "Connecting…"
    nodeStatusText = "Connecting…"
    updateStatus()
    val token = prefs.loadGatewayToken()
    val password = prefs.loadGatewayPassword()
    if (endpoint.transport == GatewayTransport.NativeJsonTcp) {
      operatorSession.disconnect()
      operatorConnected = false
      operatorStatusText = "Native bridge mode (operator RPC unavailable)"
      updateStatus()
      nodeSession.connect(endpoint, token, password, connectionManager.buildNodeConnectOptions(), tls = null)
      return
    }
    operatorSession.connect(endpoint, token, password, connectionManager.buildOperatorConnectOptions(), tls)
    nodeSession.connect(endpoint, token, password, connectionManager.buildNodeConnectOptions(), tls)
  }

  fun acceptGatewayTrustPrompt() {
    val prompt = _pendingGatewayTrust.value ?: return
    _pendingGatewayTrust.value = null
    prefs.saveGatewayTlsFingerprint(prompt.endpoint.stableId, prompt.fingerprintSha256)
    connect(prompt.endpoint)
  }

  fun declineGatewayTrustPrompt() {
    _pendingGatewayTrust.value = null
    _statusText.value = "Offline"
  }

  private fun hasRecordAudioPermission(): Boolean {
    return (
      ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED
      )
  }

  fun connectManual() {
    val host = manualHost.value.trim()
    val port = manualPort.value
    if (host.isEmpty() || port <= 0 || port > 65535) {
      _statusText.value = "Failed: invalid manual host/port"
      return
    }
    connect(GatewayEndpoint.manual(host = host, port = port, transport = manualTransport.value))
  }

  fun disconnect() {
    connectedEndpoint = null
    prefs.clearLastConnectedGatewayEndpoint()
    updateBitaxeResolvedBaseUrl()
    _pendingGatewayTrust.value = null
    operatorSession.disconnect()
    nodeSession.disconnect()
  }

  fun clearBridgeConsoleResponse() {
    _bridgeConsoleResponseJson.value = null
    _bridgeConsoleStatusText.value = "Bridge console idle"
  }

  fun invokeBridgeCommand(
    command: String,
    paramsJson: String?,
    viaGateway: Boolean,
  ) {
    scope.launch {
      val normalizedCommand = command.trim()
      if (normalizedCommand.isEmpty()) {
        _bridgeConsoleStatusText.value = "Bridge console requires a command"
        return@launch
      }
      _bridgeConsoleBusy.value = true
      _bridgeConsoleResponseJson.value = null
      _bridgeConsoleStatusText.value =
        if (viaGateway) {
          "Queueing $normalizedCommand through gateway…"
        } else {
          "Running $normalizedCommand locally…"
        }
      try {
        if (viaGateway) {
          if (!operatorConnected) {
            throw IllegalStateException("gateway RPC is offline")
          }
          if (!_nodeConnected.value) {
            throw IllegalStateException("node session is offline")
          }
          val result = gatewayInvokeClient.invoke(normalizedCommand, paramsJson)
          _bridgeConsoleResponseJson.value = result.payloadJson
          _bridgeConsoleStatusText.value =
            if (result.ok) {
              "Gateway invoke acked · ${result.command}"
            } else {
              "${result.error?.code ?: "UNAVAILABLE"} · ${result.error?.message ?: "invoke failed"}"
            }
        } else {
          val result = invokeDispatcher.handleInvoke(normalizedCommand, paramsJson?.trim()?.takeIf { it.isNotEmpty() })
          _bridgeConsoleResponseJson.value = result.payloadJson
          _bridgeConsoleStatusText.value =
            if (result.ok) {
              "Local invoke complete · $normalizedCommand"
            } else {
              "${result.error?.code ?: "UNAVAILABLE"} · ${result.error?.message ?: "invoke failed"}"
            }
        }
      } catch (err: Throwable) {
        val (code, message) = invokeErrorFromThrowable(err)
        _bridgeConsoleStatusText.value = "$code · $message"
      } finally {
        _bridgeConsoleBusy.value = false
      }
    }
  }

  private fun recordInvokeDelivery(update: GatewaySession.InvokeDeliveryUpdate) {
    _bridgeInvokeTelemetry.value =
      buildList {
        add(update)
        _bridgeInvokeTelemetry.value
          .asSequence()
          .filter { it.id != update.id }
          .take(23)
          .forEach(::add)
      }
  }

  private fun resolveCurrentNodeId(): String? {
    val identity = identityStore.loadOrCreate()
    val source = prefs.instanceId.value.trim().ifEmpty { identity.deviceId }
    val normalized = source.lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
    if (normalized.isEmpty()) return null
    return "nano-android-$normalized"
  }

  fun refreshBitaxeFleet() {
    val baseUrl = resolveBitaxeBaseUrl()
    if (baseUrl == null) {
      _bitaxeStatusText.value = "Set Bitaxe API host or connect to a gateway host first"
      _bitaxeDevices.value = emptyList()
      return
    }
    val apiKey = prefs.loadBitaxeApiKey()
    scope.launch {
      _bitaxeBusy.value = true
      _bitaxeStatusText.value = "Refreshing Bitaxe fleet…"
      try {
        val fleet = bitaxeApi.fetchFleet(baseUrl = baseUrl, apiKey = apiKey)
        _bitaxeDevices.value = fleet.devices
        _bitaxeStatusText.value = "Loaded ${fleet.devices.size} Bitaxe device(s)"
      } catch (err: Throwable) {
        _bitaxeStatusText.value = "Bitaxe API failed: ${err.message ?: "unknown error"}"
      } finally {
        _bitaxeBusy.value = false
      }
    }
  }

  fun restartBitaxeDevice(deviceId: String) {
    runBitaxeAction(
      actionLabel = "Restarting $deviceId…",
      successLabel = "Restart requested for $deviceId",
    ) { baseUrl, apiKey ->
      bitaxeApi.restartDevice(baseUrl = baseUrl, apiKey = apiKey, deviceId = deviceId)
    }
  }

  fun identifyBitaxeDevice(deviceId: String) {
    runBitaxeAction(
      actionLabel = "Identifying $deviceId…",
      successLabel = "Identify requested for $deviceId",
    ) { baseUrl, apiKey ->
      bitaxeApi.identifyDevice(baseUrl = baseUrl, apiKey = apiKey, deviceId = deviceId)
    }
  }

  fun setBitaxeFanSpeed(deviceId: String, fanSpeed: Int) {
    runBitaxeAction(
      actionLabel = "Updating fan for $deviceId…",
      successLabel = "Fan updated for $deviceId",
    ) { baseUrl, apiKey ->
      bitaxeApi.setFanSpeed(baseUrl = baseUrl, apiKey = apiKey, deviceId = deviceId, fanSpeed = fanSpeed)
    }
  }

  fun setBitaxePool(
    deviceId: String,
    poolUrl: String,
    poolPort: Int,
    poolUser: String,
    poolPass: String,
  ) {
    runBitaxeAction(
      actionLabel = "Updating pool for $deviceId…",
      successLabel = "Pool updated for $deviceId",
    ) { baseUrl, apiKey ->
      bitaxeApi.setPool(
        baseUrl = baseUrl,
        apiKey = apiKey,
        deviceId = deviceId,
        poolUrl = poolUrl,
        poolPort = poolPort,
        poolUser = poolUser,
        poolPass = poolPass,
      )
    }
  }

  fun setBitaxeOverclock(deviceId: String, frequencyMHz: Int, coreVoltage: Int?) {
    runBitaxeAction(
      actionLabel = "Applying overclock for $deviceId…",
      successLabel = "Overclock updated for $deviceId",
    ) { baseUrl, apiKey ->
      bitaxeApi.setOverclock(
        baseUrl = baseUrl,
        apiKey = apiKey,
        deviceId = deviceId,
        frequencyMHz = frequencyMHz,
        coreVoltage = coreVoltage,
      )
    }
  }

  fun openBitaxeDashboard() {
    val baseUrl = resolveBitaxeBaseUrl()
    if (baseUrl == null) {
      _bitaxeStatusText.value = "Set Bitaxe API host or connect to a gateway host first"
      return
    }
    canvas.navigate(baseUrl)
    _bitaxeStatusText.value = "Opened Bitaxe dashboard in Screen tab"
  }

  fun handleCanvasA2UIActionFromWebView(payloadJson: String) {
    scope.launch {
      val trimmed = payloadJson.trim()
      if (trimmed.isEmpty()) return@launch

      val root =
        try {
          json.parseToJsonElement(trimmed).asObjectOrNull() ?: return@launch
        } catch (_: Throwable) {
          return@launch
        }

      val userActionObj = (root["userAction"] as? JsonObject) ?: root
      val actionId = (userActionObj["id"] as? JsonPrimitive)?.content?.trim().orEmpty().ifEmpty {
        java.util.UUID.randomUUID().toString()
      }
      val name = OpenClawCanvasA2UIAction.extractActionName(userActionObj) ?: return@launch

      val surfaceId =
        (userActionObj["surfaceId"] as? JsonPrimitive)?.content?.trim().orEmpty().ifEmpty { "main" }
      val sourceComponentId =
        (userActionObj["sourceComponentId"] as? JsonPrimitive)?.content?.trim().orEmpty().ifEmpty { "-" }
      val contextJson = (userActionObj["context"] as? JsonObject)?.toString()

      val sessionKey = resolveMainSessionKey()
      val message =
        OpenClawCanvasA2UIAction.formatAgentMessage(
          actionName = name,
          sessionKey = sessionKey,
          surfaceId = surfaceId,
          sourceComponentId = sourceComponentId,
          host = displayName.value,
          instanceId = instanceId.value.lowercase(),
          contextJson = contextJson,
        )

      val connected = _nodeConnected.value
      var error: String? = null
      if (connected) {
        val sent =
          nodeSession.sendNodeEvent(
            event = "agent.request",
            payloadJson =
              buildJsonObject {
                put("message", JsonPrimitive(message))
                put("sessionKey", JsonPrimitive(sessionKey))
                put("thinking", JsonPrimitive("low"))
                put("deliver", JsonPrimitive(false))
                put("key", JsonPrimitive(actionId))
              }.toString(),
          )
        if (!sent) {
          error = "send failed"
        }
      } else {
        error = "gateway not connected"
      }

      try {
        canvas.eval(
          OpenClawCanvasA2UIAction.jsDispatchA2UIActionStatus(
            actionId = actionId,
            ok = connected && error == null,
            error = error,
          ),
        )
      } catch (_: Throwable) {
        // ignore
      }
    }
  }

  fun loadChat(sessionKey: String) {
    val key = sessionKey.trim().ifEmpty { resolveMainSessionKey() }
    chat.load(key)
  }

  fun refreshChat() {
    chat.refresh()
  }

  fun refreshChatSessions(limit: Int? = null) {
    chat.refreshSessions(limit = limit)
  }

  fun setChatThinkingLevel(level: String) {
    chat.setThinkingLevel(level)
  }

  fun switchChatSession(sessionKey: String) {
    chat.switchSession(sessionKey)
  }

  fun abortChat() {
    chat.abort()
  }

  fun sendChat(message: String, thinking: String, attachments: List<OutgoingAttachment>) {
    chat.sendMessage(message = message, thinkingLevel = thinking, attachments = attachments)
  }

  fun sendGatewayCommand(command: String) {
    chat.sendGatewayMessage(message = command.trim(), thinkingLevel = "low")
  }

  fun sendClaudeCommand(command: String) {
    sendGatewayCommand(command)
  }

  fun attachLiveCameraPreview(previewView: PreviewView) {
    liveCameraCommentary.attachPreview(previewView)
  }

  fun detachLiveCameraPreview() {
    liveCameraCommentary.detachPreview()
  }

  suspend fun captureLiveCameraFrame(): CameraCaptureManager.JpegFrame =
    liveCameraCommentary.captureFrameForAttachment()

  fun analyzeLiveCameraFrame() {
    liveCameraCommentary.analyzeCurrentFrame()
  }

  fun setLiveCameraCommentaryEnabled(enabled: Boolean) {
    liveCameraCommentary.setLiveEnabled(enabled)
  }

  private fun handleGatewayEvent(event: String, payloadJson: String?) {
    if (!xAiRealtimeVoiceAvailable) {
      micCapture.handleGatewayEvent(event, payloadJson)
    }
    talkMode.handleGatewayEvent(event, payloadJson)
    chat.handleGatewayEvent(event, payloadJson)
  }

  private fun resolveXAiRealtimeVoiceConfig(): XAiRealtimeVoiceSessionConfig {
    val sampleRateRaw = prefs.grokSampleRate.value.trim().toIntOrNull()
    val sampleRate =
      when (sampleRateRaw) {
        8000, 16000, 22050, 24000, 32000, 44100, 48000 -> sampleRateRaw
        else -> 24000
      }
    return XAiRealtimeVoiceSessionConfig(
      voiceId = prefs.grokVoiceId.value.trim().ifEmpty { "Eve" },
      vadThreshold = prefs.grokVadThreshold.value.trim().toDoubleOrNull()?.coerceIn(0.1, 0.9) ?: 0.85,
      silenceDurationMs = prefs.grokSilenceDurationMs.value.trim().toIntOrNull()?.coerceIn(0, 10_000) ?: 800,
      sampleRate = sampleRate,
      webSearchEnabled = prefs.grokWebSearchEnabled.value,
      xSearchEnabled = prefs.grokXSearchEnabled.value,
    )
  }

  private fun parseChatSendRunId(response: String): String? {
    return try {
      val root = json.parseToJsonElement(response).asObjectOrNull() ?: return null
      root["runId"].asStringOrNull()
    } catch (_: Throwable) {
      null
    }
  }

  private suspend fun refreshBrandingFromGateway() {
    if (!_isConnected.value) return
    try {
      val res = operatorSession.request("config.get", "{}")
      val root = json.parseToJsonElement(res).asObjectOrNull()
      val config = root?.get("config").asObjectOrNull()
      val ui = config?.get("ui").asObjectOrNull()
      val raw = ui?.get("seamColor").asStringOrNull()?.trim()
      val sessionCfg = config?.get("session").asObjectOrNull()
      val mainKey = normalizeMainKey(sessionCfg?.get("mainKey").asStringOrNull())
      applyMainSessionKey(mainKey)

      val parsed = parseHexColorArgb(raw)
      _seamColorArgb.value = parsed ?: DEFAULT_SEAM_COLOR_ARGB
    } catch (_: Throwable) {
      // ignore
    }
  }

  private fun triggerCameraFlash() {
    // Token is used as a pulse trigger; value doesn't matter as long as it changes.
    _cameraFlashToken.value = SystemClock.elapsedRealtimeNanos()
  }

  private fun showCameraHud(message: String, kind: CameraHudKind, autoHideMs: Long? = null) {
    val token = cameraHudSeq.incrementAndGet()
    _cameraHud.value = CameraHudState(token = token, kind = kind, message = message)

    if (autoHideMs != null && autoHideMs > 0) {
      scope.launch {
        delay(autoHideMs)
        if (_cameraHud.value?.token == token) _cameraHud.value = null
      }
    }
  }

  private fun updateBitaxeResolvedBaseUrl() {
    _bitaxeResolvedBaseUrl.value = resolveBitaxeBaseUrl().orEmpty()
  }

  private fun resolveBitaxeBaseUrl(): String? {
    val manual = prefs.bitaxeApiBaseUrl.value.trim()
    if (manual.isNotEmpty()) {
      return normalizeBitaxeBaseUrl(manual)
    }
    val host = connectedEndpoint?.host?.trim().orEmpty()
    if (host.isEmpty()) return null
    return normalizeBitaxeBaseUrl(hostForHttp(host) + ":8420")
  }

  private fun normalizeBitaxeBaseUrl(baseUrl: String): String {
    val trimmed = baseUrl.trim()
    val withScheme =
      if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
      } else {
        "http://$trimmed"
      }
    return withScheme.trimEnd('/')
  }

  private fun hostForHttp(host: String): String {
    if (host.contains(":") && !host.startsWith("[") && !host.endsWith("]")) {
      return "[$host]"
    }
    return host
  }

  private fun runBitaxeAction(
    actionLabel: String,
    successLabel: String,
    block: suspend (baseUrl: String, apiKey: String?) -> Unit,
  ) {
    val baseUrl = resolveBitaxeBaseUrl()
    if (baseUrl == null) {
      _bitaxeStatusText.value = "Set Bitaxe API host or connect to a gateway host first"
      return
    }
    val apiKey = prefs.loadBitaxeApiKey()
    scope.launch {
      _bitaxeBusy.value = true
      _bitaxeStatusText.value = actionLabel
      try {
        block(baseUrl, apiKey)
        _bitaxeStatusText.value = successLabel
        val fleet = bitaxeApi.fetchFleet(baseUrl = baseUrl, apiKey = apiKey)
        _bitaxeDevices.value = fleet.devices
      } catch (err: Throwable) {
        _bitaxeStatusText.value = "Bitaxe action failed: ${err.message ?: "unknown error"}"
      } finally {
        _bitaxeBusy.value = false
      }
    }
  }

}
