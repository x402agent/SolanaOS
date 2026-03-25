package ai.openclaw.app.ui

import android.Manifest
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.BuildConfig
import ai.openclaw.app.chat.ChatTransportMode
import ai.openclaw.app.gateway.GatewayInvokeCatalog
import ai.openclaw.app.gateway.GatewaySession
import ai.openclaw.app.LocationMode
import ai.openclaw.app.node.DeviceNotificationListenerService
import ai.openclaw.app.node.InvokeCommandRegistry
import ai.openclaw.app.node.NodeRuntimeFlags
import ai.openclaw.app.solana.SolanaTrackerHolder
import ai.openclaw.app.solana.SolanaTrackerDatastreamEvent
import ai.openclaw.app.solana.SolanaTrackerDatastreamSnapshot
import ai.openclaw.app.solana.SolanaTrackerMarketToken
import ai.openclaw.app.solana.SolanaTrackerOhlcvPoint
import ai.openclaw.app.solana.SolanaTrackerTokenDetail
import ai.openclaw.app.solana.SolanaTrackerTrade
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentResolver
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.net.toUri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CurrencyExchange
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import ai.openclaw.app.solana.SolanaPayRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class SolanaFeedKind(val badge: String) {
  Market("MARKET"),
  Trade("TRADE"),
  Thread("THREAD"),
  Quote("QUOTE"),
}

private data class SolanaFeedItem(
  val id: Int,
  val kind: SolanaFeedKind,
  val author: String,
  val headline: String,
  val body: String,
  val stats: String,
)

@Composable
fun SolanaKitScreen(
  viewModel: MainViewModel,
  onOpenChat: () -> Unit,
  onOpenConnect: () -> Unit,
) {
  val context = LocalContext.current
  val activity = remember(context) { context.findActivity() as? ComponentActivity }
  val walletState by viewModel.mobileWalletState.collectAsState()
  val gatewayConnected by viewModel.isConnected.collectAsState()
  val gatewayStatusText by viewModel.statusText.collectAsState()
  val gatewayServerName by viewModel.serverName.collectAsState()
  val nodeBridgeOnly by viewModel.nodeBridgeOnly.collectAsState()
  val bridgeInvokeTelemetry by viewModel.bridgeInvokeTelemetry.collectAsState()
  val bridgeConsoleBusy by viewModel.bridgeConsoleBusy.collectAsState()
  val bridgeConsoleStatusText by viewModel.bridgeConsoleStatusText.collectAsState()
  val bridgeConsoleResponseJson by viewModel.bridgeConsoleResponseJson.collectAsState()
  val canvasUrl by viewModel.canvasCurrentUrl.collectAsState()
  val canvasHydrated by viewModel.canvasA2uiHydrated.collectAsState()
  val cameraEnabled by viewModel.cameraEnabled.collectAsState()
  val locationMode by viewModel.locationMode.collectAsState()
  val liveCameraVisionAvailable by viewModel.liveCameraVisionAvailable.collectAsState()
  val liveCameraLatestCommentary by viewModel.liveCameraLatestCommentary.collectAsState()
  val chatTransportMode by viewModel.chatTransportMode.collectAsState()
  val chatStatusText by viewModel.chatStatusText.collectAsState()
  val solanaControlBaseUrl by viewModel.solanaControlBaseUrl.collectAsState()
  val solanaControlStatus by viewModel.solanaControlStatus.collectAsState()
  val solanaControlThreads by viewModel.solanaControlThreads.collectAsState()
  val solanaControlConnected by viewModel.solanaControlConnected.collectAsState()
  val solanaControlBusy by viewModel.solanaControlBusy.collectAsState()
  val solanaControlStatusText by viewModel.solanaControlStatusText.collectAsState()
  val feedStatusText by viewModel.solanaFeedStatusText.collectAsState()
  val pumpStatusText by viewModel.solanaPumpStatusText.collectAsState()
  val tokenMillStatusText by viewModel.solanaTokenMillStatusText.collectAsState()
  val tradeStatusText by viewModel.solanaTradeStatusText.collectAsState()
  val nftStatusText by viewModel.solanaNftStatusText.collectAsState()
  val mintedNftResult by viewModel.solanaNftMintResult.collectAsState()
  val solanaPayUriDraft by viewModel.solanaPayUriDraft.collectAsState()
  val solanaPayRequest by viewModel.solanaPayRequest.collectAsState()
  val solanaPayStatusText by viewModel.solanaPayStatusText.collectAsState()
  val solanaTrackerConfigured by viewModel.solanaTrackerConfigured.collectAsState()
  val solanaTrackerStreamAvailable by viewModel.solanaTrackerStreamAvailable.collectAsState()
  val solanaTrackerStreamConnected by viewModel.solanaTrackerStreamConnected.collectAsState()
  val solanaTrackerDatastreamAvailable by viewModel.solanaTrackerDatastreamAvailable.collectAsState()
  val solanaTrackerDatastreamConnected by viewModel.solanaTrackerDatastreamConnected.collectAsState()
  val solanaTrackerStatusText by viewModel.solanaTrackerStatusText.collectAsState()
  val solanaTrackerStreamStatusText by viewModel.solanaTrackerStreamStatusText.collectAsState()
  val solanaTrackerDatastreamStatusText by viewModel.solanaTrackerDatastreamStatusText.collectAsState()
  val solanaTrackerRpcSlot by viewModel.solanaTrackerRpcSlot.collectAsState()
  val solanaTrackerLiveSlot by viewModel.solanaTrackerLiveSlot.collectAsState()
  val solanaTrackerLiveFeed by viewModel.solanaTrackerLiveFeed.collectAsState()
  val solanaTrackerFocusedFeed by viewModel.solanaTrackerFocusedFeed.collectAsState()
  val solanaTrackerLiveSnapshot by viewModel.solanaTrackerLiveSnapshot.collectAsState()
  val solanaTrackerSearchBusy by viewModel.solanaTrackerSearchBusy.collectAsState()
  val solanaTrackerTokenBusy by viewModel.solanaTrackerTokenBusy.collectAsState()
  val solanaTrackerSearchResults by viewModel.solanaTrackerSearchResults.collectAsState()
  val solanaTrackerSelectedToken by viewModel.solanaTrackerSelectedToken.collectAsState()
  val solanaTrackerSelectedTrades by viewModel.solanaTrackerSelectedTrades.collectAsState()
  val solanaTrackerSelectedHolders by viewModel.solanaTrackerSelectedHolders.collectAsState()
  val solanaTrackerSelectedChart by viewModel.solanaTrackerSelectedChart.collectAsState()
  val solanaTrackerAnalysisBusy by viewModel.solanaTrackerAnalysisBusy.collectAsState()
  val solanaTrackerAnalysisResult by viewModel.solanaTrackerAnalysisResult.collectAsState()
  val solanaTrackerAnalysisStatusText by viewModel.solanaTrackerAnalysisStatusText.collectAsState()
  val grokConfigured by viewModel.grokConfigured.collectAsState()
  val convexConfigured by viewModel.convexConfigured.collectAsState()
  val scope = rememberCoroutineScope()
  val feedItems = solanaControlThreads.mapIndexed { index, item -> item.toFeedItem(index) }
  val externalWalletAvailable =
    remember(context, solanaPayRequest?.rawUri) {
      solanaPayRequest?.rawUri?.let { hasExternalSolanaPayHandler(context, it) } == true
    }
  val solanaPayInAppExecutable =
    solanaPayRequest is SolanaPayRequest.Transfer &&
      (solanaPayRequest as SolanaPayRequest.Transfer).splTokenMint == null &&
      (solanaPayRequest as SolanaPayRequest.Transfer).amount != null &&
      walletState.hasStoredAuthorization &&
      activity != null
  val sensorManager = remember(context) { context.getSystemService(SensorManager::class.java) }
  val notificationsPermissionGranted =
    remember(context) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
      } else {
        true
      }
    }
  val notificationListenerEnabled =
    remember(context, gatewayConnected, nodeBridgeOnly) {
      DeviceNotificationListenerService.isAccessEnabled(context)
    }
  val photosPermissionGranted =
    remember(context) {
      val permission =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          Manifest.permission.READ_MEDIA_IMAGES
        } else {
          Manifest.permission.READ_EXTERNAL_STORAGE
        }
      ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
  val smsAvailable =
    remember(context) {
      context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    }
  val motionPermissionGranted =
    remember(context) {
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
    }
  val motionActivityAvailable = remember(sensorManager) { sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null }
  val motionPedometerAvailable = remember(sensorManager) { sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null }
  val bridgeFlags =
    remember(cameraEnabled, locationMode, smsAvailable, motionActivityAvailable, motionPedometerAvailable) {
      NodeRuntimeFlags(
        cameraEnabled = cameraEnabled,
        locationEnabled = locationMode != LocationMode.Off,
        smsAvailable = smsAvailable,
        voiceWakeEnabled = false,
        motionActivityAvailable = motionActivityAvailable,
        motionPedometerAvailable = motionPedometerAvailable,
        debugBuild = BuildConfig.DEBUG,
      )
    }
  val advertisedCapabilities = remember(bridgeFlags) { InvokeCommandRegistry.advertisedCapabilities(bridgeFlags) }
  val advertisedCommands = remember(bridgeFlags) { InvokeCommandRegistry.advertisedCommands(bridgeFlags) }

  LaunchedEffect(Unit) {
    viewModel.refreshSolanaControl()
    viewModel.initializeSolanaTracker()
  }

  var composerText by rememberSaveable { mutableStateOf("Ship a token launch thread with wallet receipts and a Grok vision screenshot.") }
  var trackerQuery by rememberSaveable { mutableStateOf("TRUMP") }
  var bridgeCommand by rememberSaveable { mutableStateOf("device.status") }
  var bridgeParamsJson by rememberSaveable { mutableStateOf("{}") }

  var launchName by rememberSaveable { mutableStateOf("Seeker Signal") }
  var launchSymbol by rememberSaveable { mutableStateOf("SEEKR") }
  var launchAmountSol by rememberSaveable { mutableStateOf("0.10") }
  var pumpTokenAddress by rememberSaveable { mutableStateOf("9xQeWvG816bUx9EPfBpkv9vB5wY5dJQpR8n8h5m7pump") }

  var marketName by rememberSaveable { mutableStateOf("SolanaOS Research Vault") }
  var marketSeedSol by rememberSaveable { mutableStateOf("5") }
  var curvePreset by rememberSaveable { mutableStateOf("Exponential") }

  var tradeFromToken by rememberSaveable { mutableStateOf("SOL") }
  var tradeToToken by rememberSaveable { mutableStateOf("JUP") }
  var tradeAmount by rememberSaveable { mutableStateOf("0.75") }
  var tradeSlippage by rememberSaveable { mutableStateOf("0.50") }
  var nftName by rememberSaveable { mutableStateOf("Seeker Memory #1") }
  var nftDescription by rememberSaveable { mutableStateOf("Minted from the native SolanaOS Android build.") }
  var nftCollectionMint by rememberSaveable { mutableStateOf("") }
  var nftRecipient by rememberSaveable { mutableStateOf("") }
  var nftImage by remember { mutableStateOf<NftDraftImage?>(null) }
  val liveFeedsActive = solanaTrackerStreamConnected || solanaTrackerDatastreamConnected
  val trackerReady = solanaTrackerConfigured || solanaTrackerStreamAvailable || solanaTrackerDatastreamAvailable
  val solanaRuntimeWarning =
    when {
      nodeBridgeOnly ->
        "This device is in bridge-only mode. Feed, wallet, and pay surfaces still render, but full gateway-backed automation remains limited until the WebSocket runtime is reachable."
      !solanaControlConnected && !liveFeedsActive ->
        "Both the Control API and the tracker feeds are idle. Open Connect to restore the runtime path before staging actions here."
      !walletState.hasStoredAuthorization ->
        "Most actions can be previewed, but anything that signs, sends, or executes still needs a native wallet authorization."
      else -> null
    }
  val solanaRuntimeWarningTone =
    when {
      nodeBridgeOnly -> SolanaPanelTone.Orange
      !solanaControlConnected && !liveFeedsActive -> SolanaPanelTone.Orange
      else -> SolanaPanelTone.Purple
    }

  val pickNftImage =
    rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
      if (uri == null) return@rememberLauncherForActivityResult
      scope.launch(Dispatchers.IO) {
        val next =
          runCatching { loadNftDraftImage(context.contentResolver, uri) }
            .getOrNull()
        if (next != null) {
          withContext(Dispatchers.Main) {
            nftImage = next
          }
        }
      }
    }

  fun ensureWalletForAction(): Boolean {
    if (walletState.hasStoredAuthorization) return true
    val resolvedActivity = activity ?: return false
    viewModel.connectSolanaWallet(resolvedActivity)
    return false
  }

  Column(
    modifier =
      Modifier
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "OODA Runtime",
      title = "Solana Dashboard",
      subtitle = "Observe feeds, route actions, and operate the Seeker command surface without leaving the runtime deck.",
    )

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label = if (solanaControlConnected) "Control API" else "Control API Down",
        active = solanaControlConnected,
        tone = SolanaPanelTone.Green,
      )
      SolanaStatusPill(
        label = if (solanaTrackerStreamConnected || solanaTrackerDatastreamConnected) "Live Feeds" else "Feeds Idle",
        active = solanaTrackerStreamConnected || solanaTrackerDatastreamConnected,
        tone = SolanaPanelTone.Purple,
      )
      SolanaStatusPill(
        label = if (walletState.hasStoredAuthorization) "Wallet Ready" else "Wallet Needed",
        active = walletState.hasStoredAuthorization,
        tone = SolanaPanelTone.Orange,
      )
    }

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaMetricTile(
        label = "Mode",
        value = if (nodeBridgeOnly) "BRIDGE" else "RUNTIME",
        tone = SolanaPanelTone.Green,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Transport",
        value = when (chatTransportMode) {
          ChatTransportMode.Gateway -> "GATEWAY"
          ChatTransportMode.OpenRouter -> "HOSTED"
          ChatTransportMode.Offline -> "OFFLINE"
        },
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Slot",
        value = (solanaTrackerLiveSlot ?: solanaTrackerRpcSlot)?.toString() ?: "--",
        tone = SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
      )
    }

    SolanaBackplaneCard(
      title = "Live Services",
      subtitle = "These services keep wallet actions, market data, payments, and vision features ready in the background.",
      links =
        listOf(
          SolanaBackendLink(
            label = "Control API",
            state = if (solanaControlConnected) "Online" else if (solanaControlBusy) "Syncing" else "Offline",
            detail = solanaControlStatusText,
            tone = SolanaPanelTone.Green,
            active = solanaControlConnected,
          ),
          SolanaBackendLink(
            label = "Tracker Stream",
            state =
              when {
                solanaTrackerStreamConnected -> "Live"
                solanaTrackerStreamAvailable -> "Available"
                trackerReady -> "Idle"
                else -> "Missing"
              },
            detail = solanaTrackerStreamStatusText,
            tone = SolanaPanelTone.Purple,
            active = solanaTrackerStreamConnected,
          ),
          SolanaBackendLink(
            label = "Datastream",
            state =
              when {
                solanaTrackerDatastreamConnected -> "Live"
                solanaTrackerDatastreamAvailable -> "Available"
                trackerReady -> "Idle"
                else -> "Missing"
              },
            detail = solanaTrackerDatastreamStatusText,
            tone = SolanaPanelTone.Orange,
            active = solanaTrackerDatastreamConnected,
          ),
          SolanaBackendLink(
            label = "Wallet",
            state = if (walletState.hasStoredAuthorization) "Ready" else "Missing",
            detail = walletState.statusText,
            tone = SolanaPanelTone.Green,
            active = walletState.hasStoredAuthorization,
          ),
          SolanaBackendLink(
            label = "Solana Pay",
            state =
              when {
                solanaPayRequest != null && solanaPayInAppExecutable -> "In-App Ready"
                solanaPayRequest != null && externalWalletAvailable -> "Wallet Ready"
                solanaPayRequest != null -> "Parsed"
                else -> "Idle"
              },
            detail = solanaPayStatusText?.ifBlank { "Waiting for a solana: request, QR payload, or pasted URI." }
              ?: "Waiting for a solana: request, QR payload, or pasted URI.",
            tone = SolanaPanelTone.Purple,
            active = solanaPayRequest != null,
          ),
          SolanaBackendLink(
            label = "Vision",
            state = if (liveCameraVisionAvailable) "Ready" else "Disabled",
            detail =
              if (!liveCameraLatestCommentary.isNullOrBlank()) {
                liveCameraLatestCommentary!!.take(96)
              } else {
                chatStatusText
              },
            tone = SolanaPanelTone.Orange,
            active = liveCameraVisionAvailable,
          ),
        ),
      tone = if (solanaControlConnected || liveFeedsActive) SolanaPanelTone.Green else SolanaPanelTone.Purple,
    )

    if (!solanaRuntimeWarning.isNullOrBlank()) {
      SolanaPanel(
        modifier = Modifier.fillMaxWidth(),
        tone = solanaRuntimeWarningTone,
      ) {
        SolanaSectionLabel("Runtime Note", tone = solanaRuntimeWarningTone)
        Text(solanaRuntimeWarning!!, style = mobileCallout, color = mobileText)
      }
    }

    if (BuildConfig.DEBUG) {
      FeatureSectionCard(
        title = "Native Bridge",
        subtitle = "Invoke registry, handlers, and gateway delivery state",
        icon = Icons.Default.Bolt,
      ) {
      StatusChip(
        label =
          when {
            nodeBridgeOnly -> "NativeJsonTcp"
            gatewayConnected -> "WebSocketRpc"
            else -> "Offline"
          },
        active = gatewayConnected || nodeBridgeOnly,
      )
      StatusChip(
        label =
          when {
            canvasHydrated -> "Canvas Hydrated"
            !canvasUrl.isNullOrBlank() -> "Canvas Loaded"
            else -> "Canvas Idle"
          },
        active = canvasHydrated || !canvasUrl.isNullOrBlank(),
      )
      StatusChip(
        label =
          when {
            notificationsPermissionGranted && notificationListenerEnabled -> "Notifications Full"
            notificationsPermissionGranted || notificationListenerEnabled -> "Notifications Partial"
            else -> "Notifications Missing"
          },
        active = notificationsPermissionGranted && notificationListenerEnabled,
      )
      StatusChip(
        label = "${advertisedCommands.size} Commands",
        active = advertisedCommands.isNotEmpty(),
      )
      Text(
        gatewayServerName?.takeIf { it.isNotBlank() }?.let { "$it · $gatewayStatusText" } ?: gatewayStatusText,
        style = mobileCallout,
        color = mobileText,
      )
      Text(
        "These capabilities and commands are generated from the same `InvokeCommandRegistry` and runtime flags the gateway sees during Android pairing.",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
      Text("Advertised Capabilities", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileTextTertiary)
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        advertisedCapabilities.forEach { capability ->
          StatusChip(label = capability, active = true)
        }
      }
      Text("Handler Coverage", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileTextTertiary)
      BridgeHandlerRow(
        title = "DeviceHandler",
        detail = "device.status · device.info · device.permissions · device.health",
        active = true,
      )
      BridgeHandlerRow(
        title = "NotificationsHandler",
        detail = "notifications.list · notifications.actions",
        active = notificationsPermissionGranted || notificationListenerEnabled,
      )
      BridgeHandlerRow(
        title = "PhotosHandler",
        detail = "photos.latest",
        active = photosPermissionGranted,
      )
      BridgeHandlerRow(
        title = "SmsHandler",
        detail = "sms.send",
        active = smsAvailable,
      )
      BridgeHandlerRow(
        title = "SystemHandler",
        detail = "system.notify",
        active = true,
      )
      BridgeHandlerRow(
        title = "LocationHandler",
        detail = "location.get",
        active = locationMode != LocationMode.Off,
      )
      BridgeHandlerRow(
        title = "MotionHandler",
        detail = "motion.activity · motion.pedometer",
        active = motionPermissionGranted && (motionActivityAvailable || motionPedometerAvailable),
      )
      BridgeHandlerRow(
        title = "Canvas / A2UI",
        detail = "canvas.present · canvas.navigate · canvas.eval · canvas.snapshot · canvas.a2ui.push",
        active = canvasHydrated || !canvasUrl.isNullOrBlank(),
      )
      Text("Advertised Commands", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileTextTertiary)
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        advertisedCommands.forEach { command ->
          BridgeCommandChip(
            command = command,
            active = bridgeCommand == command,
            onClick = {
              bridgeCommand = command
              bridgeParamsJson = GatewayInvokeCatalog.find(command)?.defaultParamsJson ?: "{}"
            },
          )
        }
      }
      Text("Bridge Console", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileTextTertiary)
      Text(
        "Use the typed invoke catalog to populate params, then run a handler locally or route the invoke through the live gateway for a full queue → ack roundtrip.",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
      OutlinedField(
        value = bridgeCommand,
        onValueChange = { bridgeCommand = it },
        label = "Invoke command",
      )
      OutlinedField(
        value = bridgeParamsJson,
        onValueChange = { bridgeParamsJson = it },
        label = "Params JSON",
        singleLine = false,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = if (bridgeConsoleBusy) "Running…" else "Run Local",
          emphasis = false,
          onClick = {
            viewModel.invokeBridgeCommand(
              command = bridgeCommand,
              paramsJson = bridgeParamsJson,
              viaGateway = false,
            )
          },
        )
        FeatureButton(
          label = if (bridgeConsoleBusy) "Queued…" else "Run Via Gateway",
          emphasis = true,
          onClick = {
            viewModel.invokeBridgeCommand(
              command = bridgeCommand,
              paramsJson = bridgeParamsJson,
              viaGateway = true,
            )
          },
        )
        FeatureButton(label = "Clear", onClick = viewModel::clearBridgeConsoleResponse)
      }
      Text(bridgeConsoleStatusText, style = mobileCallout, color = mobileText)
      bridgeConsoleResponseJson?.takeIf { it.isNotBlank() }?.let { payload ->
        Surface(
          modifier = Modifier.fillMaxWidth(),
          shape = RoundedCornerShape(14.dp),
          color = mobileSurfaceStrong,
          border = BorderStroke(1.dp, mobileBorderStrong),
        ) {
          Text(
            text = payload,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            style = mobileCaption1,
            color = mobileText,
          )
        }
      }
      Text("Delivery Telemetry", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileTextTertiary)
      if (bridgeInvokeTelemetry.isEmpty()) {
        Text("No invoke deliveries yet. Run a bridge command or wait for a remote operator invoke.", style = mobileCaption1, color = mobileTextSecondary)
      } else {
        bridgeInvokeTelemetry.take(8).forEach { entry ->
          BridgeDeliveryRow(entry = entry)
        }
      }
    }
    }

    FeatureSectionCard(
      title = "Control API",
      subtitle = "Shared backend for feed, staging, and Solana actions",
      icon = Icons.Default.AutoAwesome,
    ) {
      StatusChip(
        label = if (solanaControlConnected) "Control API Online" else "Control API Offline",
        active = solanaControlConnected,
      )
      StatusChip(
        label = if (solanaControlBusy) "Syncing" else "Idle",
        active = solanaControlBusy,
      )
      StatusChip(
        label = if (solanaControlStatus?.openRouter?.enabled == true) "Server Grok Vision Enabled" else "Server Grok Vision Off",
        active = solanaControlStatus?.openRouter?.enabled == true,
      )
      Text(
        if (solanaControlConnected) {
          "Connected to the live control service for feed, staging, and wallet actions."
        } else {
          "Connect the gateway first so this device can reach the live control service."
        },
        style = mobileBody,
        color = mobileText,
      )
      Text(solanaControlStatusText, style = mobileCallout, color = mobileTextSecondary)
      if (!liveCameraLatestCommentary.isNullOrBlank()) {
        Text(
          "Latest Grok commentary ready to quote: ${liveCameraLatestCommentary!!.take(96)}",
          style = mobileCaption1,
          color = mobileSuccess,
        )
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(label = "Refresh API", emphasis = true, onClick = viewModel::refreshSolanaControl)
        FeatureButton(label = "Open Connect", onClick = onOpenConnect)
      }
    }

    FeatureSectionCard(
      title = "Wallet + Vision",
      subtitle = "Keep wallet signing and Grok vision additive",
      icon = Icons.Default.Wallet,
    ) {
      StatusChip(
        label = if (walletState.hasStoredAuthorization) "Wallet Ready" else "Wallet Needed",
        active = walletState.hasStoredAuthorization,
      )
      StatusChip(
        label = if (liveCameraVisionAvailable) "Grok Vision Live" else "Grok Vision Disabled",
        active = liveCameraVisionAvailable,
      )
      StatusChip(
        label =
          when (chatTransportMode) {
            ChatTransportMode.OpenRouter -> "Hosted Agent"
            ChatTransportMode.Gateway -> "Gateway RPC"
            ChatTransportMode.Offline -> if (nodeBridgeOnly) "Node Bridge Only" else "Offline"
          },
        active = chatTransportMode != ChatTransportMode.Offline,
      )
      Text(chatStatusText, style = mobileCallout, color = mobileTextSecondary)
      Text(
        "Live camera commentary remains available from Chat. This Solana tab keeps wallet and market actions front and center.",
        style = mobileCallout,
        color = mobileText,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = if (walletState.hasStoredAuthorization) "Disconnect Wallet" else "Connect Wallet",
          emphasis = true,
          onClick = {
            val resolvedActivity = activity ?: return@FeatureButton
            if (walletState.hasStoredAuthorization) {
              viewModel.disconnectSolanaWallet(resolvedActivity)
            } else {
              viewModel.connectSolanaWallet(resolvedActivity)
            }
          },
        )
        FeatureButton(label = "Open Grok Vision", onClick = onOpenChat)
        FeatureButton(label = "Gateway Setup", onClick = onOpenConnect)
      }
    }

    FeatureSectionCard(
      title = "Solana Pay",
      subtitle = "Handle solana: payment links from QR, browser, or NFC",
      icon = Icons.Default.Wallet,
    ) {
      StatusChip(
        label = if (solanaPayRequest != null) "Parsed Request" else "Awaiting URI",
        active = solanaPayRequest != null,
      )
      StatusChip(
        label = if (externalWalletAvailable) "External Wallet Ready" else "Preview / Capture",
        active = externalWalletAvailable,
      )
      Text(
        "This adapts the Solana Pay Android sample into the current build: incoming solana: links land here, get parsed, and can be forwarded to another wallet app if one is installed.",
        style = mobileCallout,
        color = mobileText,
      )
      OutlinedField(
        value = solanaPayUriDraft,
        onValueChange = viewModel::setSolanaPayUriDraft,
        label = "solana: URI",
        singleLine = false,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Parse",
          emphasis = true,
          onClick = viewModel::parseSolanaPayUri,
        )
        FeatureButton(
          label = "Paste",
          onClick = {
            val pasted = readClipboardText(context).orEmpty()
            if (pasted.isNotBlank()) {
              viewModel.setSolanaPayUriDraft(pasted)
              viewModel.parseSolanaPayUri(pasted)
            }
          },
        )
        FeatureButton(label = "Clear", onClick = viewModel::clearSolanaPayRequest)
      }
      if (!solanaPayStatusText.isNullOrBlank()) {
        Text(solanaPayStatusText!!, style = mobileCaption1, color = mobileTextSecondary)
      }
      solanaPayRequest?.let { request ->
        SolanaPayRequestCard(request = request)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          if (request is SolanaPayRequest.Transfer && request.splTokenMint == null && request.amount != null) {
            FeatureButton(
              label = "Send In App",
              emphasis = true,
              onClick = {
                val resolvedActivity = activity ?: return@FeatureButton
                if (!ensureWalletForAction()) {
                  return@FeatureButton
                }
                viewModel.executeSolanaPayTransfer(resolvedActivity)
              },
            )
          }
          if (externalWalletAvailable) {
            FeatureButton(
              label = "Open in Wallet",
              emphasis = !solanaPayInAppExecutable,
              onClick = { openExternalSolanaPayHandler(context, request.rawUri) },
            )
          }
          when (request) {
            is SolanaPayRequest.Transaction ->
              FeatureButton(
                label = "Open HTTPS",
                onClick = { launchExternalView(context, request.link) },
              )
            is SolanaPayRequest.Transfer ->
              FeatureButton(
              label = "Copy Recipient",
                onClick = { copyToClipboard(context, request.recipient) },
              )
          }
          FeatureButton(
            label = "Copy URI",
            onClick = { copyToClipboard(context, request.rawUri) },
          )
        }
        if (request is SolanaPayRequest.Transfer && request.splTokenMint != null) {
          Text(
            "SPL token transfer execution is not wired in-app yet. Preview stays native; signing is still delegated to a wallet app.",
            style = mobileCaption1,
            color = mobileWarning,
          )
        }
      }
    }

    FeatureSectionCard(
      title = "Tracker DEX",
      subtitle = "Live market board and token inspection powered by Solana Tracker",
      icon = Icons.AutoMirrored.Filled.ShowChart,
    ) {
      StatusChip(
        label = if (solanaTrackerConfigured) "Tracker Ready" else "Tracker Missing",
        active = solanaTrackerConfigured,
      )
      StatusChip(
        label = if (solanaTrackerStreamConnected) "RPC WS On" else "RPC WS Off",
        active = solanaTrackerStreamConnected,
      )
      StatusChip(
        label = if (solanaTrackerDatastreamConnected) "Datastream On" else "Datastream Off",
        active = solanaTrackerDatastreamConnected,
      )
      StatusChip(
        label = if (grokConfigured || convexConfigured) "Grok Analysis Ready" else "Grok Analysis Off",
        active = grokConfigured || convexConfigured,
      )
      StatusChip(
        label = if (solanaTrackerSelectedToken != null) "Token Loaded" else "Board Mode",
        active = solanaTrackerSelectedToken != null,
      )
      Text(
        "Search by symbol, name, or mint, inspect market/pool/risk data, and stream live Solana Tracker datastream events for new listings and the focused token.",
        style = mobileCallout,
        color = mobileText,
      )
      val slotSummary =
        buildString {
          solanaTrackerRpcSlot?.let {
            append("RPC slot ")
            append(formatCompactInteger(it))
          }
          solanaTrackerLiveSlot?.let {
            if (isNotBlank()) append(" • ")
            append("Live slot ")
            append(formatCompactInteger(it))
          }
          if (isBlank()) {
            append("No live slot data yet.")
          }
        }
      Text(slotSummary, style = mobileCaption1, color = mobileText.copy(alpha = 0.84f))
      Text(solanaTrackerStreamStatusText, style = mobileCaption1, color = mobileText.copy(alpha = 0.84f))
      Text(solanaTrackerDatastreamStatusText, style = mobileCaption1, color = mobileText.copy(alpha = 0.84f))
      OutlinedField(
        value = trackerQuery,
        onValueChange = { trackerQuery = it },
        label = "Symbol, name, or mint",
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Search",
          emphasis = true,
          onClick = { viewModel.searchSolanaTrackerTokens(trackerQuery) },
        )
        FeatureButton(label = "Load Board", onClick = viewModel::refreshSolanaTrackerDexBoard)
        if (solanaTrackerStreamAvailable) {
          FeatureButton(label = "Reconnect RPC", onClick = viewModel::reconnectSolanaTrackerStream)
        }
        if (solanaTrackerDatastreamAvailable) {
          FeatureButton(label = "Reconnect Feed", onClick = viewModel::reconnectSolanaTrackerDatastream)
        }
      }
      Text(solanaTrackerStatusText, style = mobileCaption1, color = mobileText.copy(alpha = 0.84f))
      if (solanaTrackerSearchBusy && solanaTrackerSearchResults.isEmpty()) {
        Text("Loading live token board…", style = mobileCallout, color = mobileText.copy(alpha = 0.84f))
      } else if (solanaTrackerSearchResults.isEmpty()) {
        Text("No tracker tokens loaded yet.", style = mobileCallout, color = mobileText.copy(alpha = 0.84f))
      } else {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          solanaTrackerSearchResults.take(8).forEach { token ->
            TrackerBoardTokenCard(
              token = token,
              onOpen = {
                trackerQuery = token.mint
                viewModel.openSolanaTrackerToken(token.mint)
              },
            )
          }
        }
      }
      if (solanaTrackerLiveFeed.isNotEmpty()) {
        Text("Live Market Feed", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          solanaTrackerLiveFeed.takeLast(4).reversed().forEach { event ->
            TrackerDatastreamEventCard(event = event)
          }
        }
      }
      solanaTrackerSelectedToken?.let { token ->
        TrackerSelectedTokenCard(
          token = token,
          trades = solanaTrackerSelectedTrades,
          holders = solanaTrackerSelectedHolders,
          chart = solanaTrackerSelectedChart,
          liveSnapshot = solanaTrackerLiveSnapshot,
          liveEvents = solanaTrackerFocusedFeed,
          analysisBusy = solanaTrackerAnalysisBusy,
          analysis = solanaTrackerAnalysisResult?.takeIf { it.mint == token.mint },
          analysisStatusText = solanaTrackerAnalysisStatusText,
          grokConfigured = grokConfigured || convexConfigured,
          busy = solanaTrackerTokenBusy,
          onRefresh = viewModel::refreshSolanaTrackerSelectedToken,
          onAnalyze = { viewModel.analyzeSolanaTrackerSelectedToken(activity) },
          onCopyMint = { copyToClipboard(context, token.mint) },
        )
      }
    }

    FeatureSectionCard(
      title = "Thread Feed",
      subtitle = "Home/feed style composition inspired by Solana Social Kit",
      icon = Icons.Default.AutoAwesome,
    ) {
      OutlinedField(
        value = composerText,
        onValueChange = { composerText = it },
        label = "Post to feed",
        singleLine = false,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Post Update",
          emphasis = true,
          onClick = {
            val text = composerText.trim()
            if (text.isBlank()) return@FeatureButton
            viewModel.postSolanaThread(text)
            composerText = ""
          },
        )
        FeatureButton(
          label = "Quote Grok Vision",
          onClick = {
            viewModel.quoteLatestVisionToFeed()
          },
        )
      }
      if (!feedStatusText.isNullOrBlank()) {
        Text(feedStatusText!!, style = mobileCaption1, color = mobileTextSecondary)
      }
      if (feedItems.isEmpty()) {
        Text("No backend thread items yet.", style = mobileCallout, color = mobileTextSecondary)
      } else {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          feedItems.forEach { item ->
            FeedItemCard(item = item)
          }
        }
      }
    }

    FeatureSectionCard(
      title = "NFT Minter",
      subtitle = "Adapted from the mobile NFT minter flow with native MWA signing",
      icon = Icons.Default.AutoAwesome,
    ) {
      StatusChip(
        label = if (nftImage != null) "Image Selected" else "Select Image",
        active = nftImage != null,
      )
      StatusChip(
        label = if (walletState.hasStoredAuthorization) "Wallet Ready" else "Wallet Needed",
        active = walletState.hasStoredAuthorization,
      )
      Text(
        "This uses the Solana app kit API on port 8080 for metadata upload and collection mint transaction building, then signs and sends the returned transaction through Mobile Wallet Adapter.",
        style = mobileCallout,
        color = mobileText,
      )
      nftImage?.let { image ->
        NftImagePreviewCard(image = image)
      } ?: Text("Pick a photo or artwork file to mint.", style = mobileCaption1, color = mobileTextSecondary)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(label = "Pick Image", emphasis = true, onClick = { pickNftImage.launch("image/*") })
        if (nftImage != null) {
          FeatureButton(label = "Clear Image", onClick = { nftImage = null })
        }
      }
      OutlinedField(value = nftName, onValueChange = { nftName = it }, label = "NFT name")
      OutlinedField(
        value = nftDescription,
        onValueChange = { nftDescription = it },
        label = "Description",
        singleLine = false,
      )
      OutlinedField(
        value = nftCollectionMint,
        onValueChange = { nftCollectionMint = it },
        label = "Collection mint",
      )
      OutlinedField(
        value = nftRecipient,
        onValueChange = { nftRecipient = it },
        label = "Recipient (optional)",
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Mint NFT",
          emphasis = true,
          onClick = {
            val resolvedActivity = activity ?: return@FeatureButton
            if (!ensureWalletForAction()) {
              return@FeatureButton
            }
            val selectedImage = nftImage ?: return@FeatureButton
            viewModel.mintCollectionNft(
              activity = resolvedActivity,
              imageBytes = selectedImage.bytes,
              fileName = selectedImage.fileName,
              mimeType = selectedImage.mimeType,
              nftName = nftName,
              nftDescription = nftDescription,
              collectionMint = nftCollectionMint,
              recipient = nftRecipient,
            )
          },
        )
        if (mintedNftResult != null) {
          FeatureButton(label = "Clear Result", onClick = viewModel::clearMintedNftResult)
        }
        FeatureButton(
          label = "Paste Collection",
          onClick = {
            val pasted = readClipboardText(context).orEmpty()
            if (pasted.isNotBlank()) {
              nftCollectionMint = pasted
            }
          },
        )
      }
      if (!nftStatusText.isNullOrBlank()) {
        Text(nftStatusText!!, style = mobileCaption1, color = mobileTextSecondary)
      }
      mintedNftResult?.let { result ->
        MintedNftResultCard(result = result)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          FeatureButton(label = "Copy Mint", onClick = { copyToClipboard(context, result.mintAddress) })
          FeatureButton(label = "Copy Signature", onClick = { copyToClipboard(context, result.transactionSignature) })
          FeatureButton(label = "Copy Metadata URI", onClick = { copyToClipboard(context, result.metadataUri) })
        }
      }
    }

    FeatureSectionCard(
      title = "Pump.fun",
      subtitle = "Launch, buy, and sell staging",
      icon = Icons.Default.Bolt,
    ) {
      OutlinedField(value = launchName, onValueChange = { launchName = it }, label = "Token name")
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedField(
          modifier = Modifier.width(130.dp),
          value = launchSymbol,
          onValueChange = { launchSymbol = it.uppercase() },
          label = "Symbol",
        )
        OutlinedField(
          modifier = Modifier.width(130.dp),
          value = launchAmountSol,
          onValueChange = { launchAmountSol = it },
          label = "SOL size",
          keyboardType = KeyboardType.Decimal,
        )
      }
      OutlinedField(value = pumpTokenAddress, onValueChange = { pumpTokenAddress = it }, label = "Token address / mint")
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Launch + Buy",
          emphasis = true,
          onClick = {
            if (!ensureWalletForAction()) {
              return@FeatureButton
            }
            viewModel.launchPumpfun(name = launchName, symbol = launchSymbol, amountSolText = launchAmountSol)
          },
        )
        FeatureButton(
          label = "Buy",
          onClick = {
            if (!ensureWalletForAction()) {
              return@FeatureButton
            }
            viewModel.buyPumpfun(tokenAddress = pumpTokenAddress, amountSolText = launchAmountSol)
          },
        )
        FeatureButton(
          label = "Sell",
          onClick = {
            if (!ensureWalletForAction()) {
              return@FeatureButton
            }
            viewModel.sellPumpfun(tokenAddress = pumpTokenAddress, amountSolText = launchAmountSol)
          },
        )
      }
      if (!pumpStatusText.isNullOrBlank()) {
        Text(pumpStatusText!!, style = mobileCaption1, color = mobileTextSecondary)
      }
    }

    FeatureSectionCard(
      title = "Token Mill",
      subtitle = "Bonding curve market drafts",
      icon = Icons.AutoMirrored.Filled.ShowChart,
    ) {
      OutlinedField(value = marketName, onValueChange = { marketName = it }, label = "Market name")
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedField(
          modifier = Modifier.width(140.dp),
          value = marketSeedSol,
          onValueChange = { marketSeedSol = it },
          label = "Seed SOL",
          keyboardType = KeyboardType.Decimal,
        )
        CurvePresetPicker(current = curvePreset, onSelect = { curvePreset = it })
      }
      FeatureButton(
        label = "Draft Market",
        emphasis = true,
        onClick = {
          if (!ensureWalletForAction()) {
            return@FeatureButton
          }
          viewModel.createTokenMillMarket(name = marketName, seedSolText = marketSeedSol, curvePreset = curvePreset)
        },
      )
      if (!tokenMillStatusText.isNullOrBlank()) {
        Text(tokenMillStatusText!!, style = mobileCaption1, color = mobileTextSecondary)
      }
    }

    FeatureSectionCard(
      title = "Trade / Jupiter",
      subtitle = "Copy-trade staging and share-to-feed flow",
      icon = Icons.Default.CurrencyExchange,
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedField(
          modifier = Modifier.width(110.dp),
          value = tradeFromToken,
          onValueChange = { tradeFromToken = it.uppercase() },
          label = "From",
        )
        OutlinedField(
          modifier = Modifier.width(110.dp),
          value = tradeToToken,
          onValueChange = { tradeToToken = it.uppercase() },
          label = "To",
        )
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedField(
          modifier = Modifier.width(130.dp),
          value = tradeAmount,
          onValueChange = { tradeAmount = it },
          label = "Amount",
          keyboardType = KeyboardType.Decimal,
        )
        OutlinedField(
          modifier = Modifier.width(130.dp),
          value = tradeSlippage,
          onValueChange = { tradeSlippage = it },
          label = "Slippage %",
          keyboardType = KeyboardType.Decimal,
        )
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Stage Swap",
          emphasis = true,
          onClick = {
            if (!ensureWalletForAction()) {
              return@FeatureButton
            }
            viewModel.stageTrade(
              fromToken = tradeFromToken,
              toToken = tradeToToken,
              amountText = tradeAmount,
              slippagePercentText = tradeSlippage,
            )
          },
        )
        FeatureButton(
          label = "Share to Feed",
          onClick = {
            viewModel.shareTradeToFeed(
              fromToken = tradeFromToken,
              toToken = tradeToToken,
              amountText = tradeAmount,
              slippagePercentText = tradeSlippage,
            )
          },
        )
      }
      if (!tradeStatusText.isNullOrBlank()) {
        Text(tradeStatusText!!, style = mobileCaption1, color = mobileTextSecondary)
      }
    }
  }
}

@Composable
private fun SolanaPayRequestCard(request: SolanaPayRequest) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      when (request) {
        is SolanaPayRequest.Transaction -> {
          Text("Transaction Request", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
          SolanaPayDetailRow(label = "Link", value = request.link)
          Text(
            "This request points to a remote HTTPS transaction builder. Open it in a wallet app to continue.",
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
        }
        is SolanaPayRequest.Transfer -> {
          Text("Transfer Request", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
          SolanaPayDetailRow(label = "Recipient", value = request.recipient)
          SolanaPayDetailRow(label = "Amount", value = request.amount ?: "Wallet decides")
          SolanaPayDetailRow(label = "Asset", value = request.splTokenMint ?: "Native SOL")
          request.label?.let { SolanaPayDetailRow(label = "Label", value = it) }
          request.message?.let { SolanaPayDetailRow(label = "Message", value = it) }
          request.memo?.let { SolanaPayDetailRow(label = "Memo", value = it) }
          if (request.references.isNotEmpty()) {
            SolanaPayDetailRow(label = "References", value = "${request.references.size} attached")
          }
          Text(
            if (request.splTokenMint == null && request.amount != null) {
              "Simple SOL transfers can be sent in-app through the connected MWA wallet. SPL token transfer support still needs a second pass."
            } else {
              "Preview is wired, but this request still needs an external wallet app for execution."
            },
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
        }
      }
    }
  }
}

@Composable
private fun SolanaPayDetailRow(label: String, value: String) {
  Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
    Text(label.uppercase(), style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileTextTertiary)
    Text(value, style = mobileCallout, color = mobileText)
  }
}

@Composable
private fun NftImagePreviewCard(image: NftDraftImage) {
  val imageState = rememberDraftNftImageState(image.bytes)
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      if (imageState.image != null) {
        Image(
          bitmap = imageState.image,
          contentDescription = image.fileName,
          modifier = Modifier.fillMaxWidth().height(208.dp),
          contentScale = ContentScale.Crop,
        )
      }
      Text(image.fileName, style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      Text(
        "${image.mimeType} • ${image.bytes.size / 1024} KB",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    }
  }
}

@Composable
private fun MintedNftResultCard(result: ai.openclaw.app.solana.SolanaNftMintResult) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text("Mint Submitted", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      SolanaPayDetailRow(label = "Mint", value = result.mintAddress)
      SolanaPayDetailRow(label = "Collection", value = result.collectionMint)
      SolanaPayDetailRow(label = "Signature", value = result.transactionSignature)
      SolanaPayDetailRow(label = "Metadata URI", value = result.metadataUri)
    }
  }
}

@Composable
private fun FeatureSectionCard(
  title: String,
  subtitle: String,
  icon: ImageVector,
  content: @Composable ColumnScope.() -> Unit,
) {
  SolanaPanel(
    modifier = Modifier.fillMaxWidth(),
    tone = SolanaPanelTone.Green,
  ) {
    Row(
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Surface(
        modifier = Modifier.size(36.dp),
        shape = RoundedCornerShape(4.dp),
        color = mobileRuntimePanelPurple,
        border = BorderStroke(1.dp, mobileAccent),
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(imageVector = icon, contentDescription = null, tint = mobileSuccess)
        }
      }
      Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        SolanaSectionLabel(title, tone = SolanaPanelTone.Purple)
        Text(title, style = mobileHeadline, color = mobileText)
        Text(subtitle, style = mobileCallout, color = mobileTextSecondary)
      }
    }
    content()
  }
}

@Composable
private fun TrackerBoardTokenCard(
  token: SolanaTrackerMarketToken,
  onOpen: () -> Unit,
) {
  Surface(
    onClick = onOpen,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(token.symbol.ifBlank { token.name }, style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
          Text(token.name.ifBlank { token.mint }, style = mobileCaption1, color = mobileTextSecondary)
        }
        StatusChip(label = token.market.ifBlank { "token" }, active = true)
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text("Price ${formatUsd(token.priceUsd)}", style = mobileCallout, color = mobileText)
        Text("24h ${formatUsd(token.volume24h)}", style = mobileCallout, color = mobileTextSecondary)
      }
      Text(
        "Liquidity ${formatUsd(token.liquidityUsd)} • MCap ${formatUsd(token.marketCapUsd)} • Holders ${formatCompactInteger(token.holders?.toLong())}",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    }
  }
}

@Composable
private fun TrackerSelectedTokenCard(
  token: SolanaTrackerTokenDetail,
  trades: List<SolanaTrackerTrade>,
  holders: List<SolanaTrackerHolder>,
  chart: List<SolanaTrackerOhlcvPoint>,
  liveSnapshot: SolanaTrackerDatastreamSnapshot,
  liveEvents: List<SolanaTrackerDatastreamEvent>,
  analysisBusy: Boolean,
  analysis: ai.openclaw.app.SolanaTrackerAnalysisResult?,
  analysisStatusText: String,
  grokConfigured: Boolean,
  busy: Boolean,
  onRefresh: () -> Unit,
  onAnalyze: () -> Unit,
  onCopyMint: () -> Unit,
) {
  val lastCandle = chart.lastOrNull()
  val sectionHeadingColor = mobileText
  val supportTextColor = mobileText.copy(alpha = 0.84f)
  val tertiarySupportTextColor = mobileText.copy(alpha = 0.68f)
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(token.symbol.ifBlank { token.name }, style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
          Text(token.name, style = mobileCaption1, color = supportTextColor)
        }
        StatusChip(label = if (busy) "Refreshing" else "Live Token", active = !busy)
      }
      Text(shortTrackerAddress(token.mint), style = mobileCaption1, color = tertiarySupportTextColor)
      Text(
        "Holders ${formatCompactInteger(token.holders?.toLong())} • Buys ${formatCompactInteger(token.buys?.toLong())} • Sells ${formatCompactInteger(token.sells?.toLong())} • Txns ${formatCompactInteger(token.txns?.toLong())}",
        style = mobileCallout,
        color = mobileText,
      )
      Text(
        "Risk ${token.risk.score ?: 0} • Top10 ${formatPercent(token.risk.top10)} • Dev ${formatPercent(token.risk.devPercentage)} • Bundlers ${formatPercent(token.risk.bundlerPercentage)}",
        style = mobileCaption1,
        color = if (token.risk.rugged) mobileWarning else supportTextColor,
      )
      Text(
        "Moves 1m ${formatSignedPercent(token.priceChanges.m1)} • 5m ${formatSignedPercent(token.priceChanges.m5)} • 1h ${formatSignedPercent(token.priceChanges.h1)} • 24h ${formatSignedPercent(token.priceChanges.h24)}",
        style = mobileCaption1,
        color = supportTextColor,
      )
      lastCandle?.let { candle ->
        Text(
          "Last 1m candle close ${formatUsd(candle.close)} • high ${formatUsd(candle.high)} • low ${formatUsd(candle.low)} • volume ${formatUsd(candle.volume)}",
          style = mobileCaption1,
          color = supportTextColor,
        )
      }
      if (liveSnapshot.hasData()) {
        Text("Live Datastream", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = sectionHeadingColor)
        Text(
          "Primary ${formatUsd(liveSnapshot.primaryPriceUsd)} • Aggregated ${formatUsd(liveSnapshot.aggregatedPriceUsd)} • Volume ${formatUsd(liveSnapshot.volumeUsd)}",
          style = mobileCallout,
          color = mobileText,
        )
        Text(
          "Buys ${formatCompactInteger(liveSnapshot.buys)} • Sells ${formatCompactInteger(liveSnapshot.sells)} • Holders ${formatCompactInteger(liveSnapshot.holders)} • Curve ${formatPercent(liveSnapshot.curvePercentage)}",
          style = mobileCaption1,
          color = supportTextColor,
        )
        Text(
          "Snipers ${formatPercent(liveSnapshot.sniperPercentage)} • Insiders ${formatPercent(liveSnapshot.insiderPercentage)}",
          style = mobileCaption1,
          color = supportTextColor,
        )
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(label = "Refresh Token", emphasis = true, onClick = onRefresh)
        FeatureButton(
          label = if (analysisBusy) "Analyzing…" else "Analyze With Grok",
          emphasis = false,
          onClick = onAnalyze,
        )
        FeatureButton(label = "Copy Mint", onClick = onCopyMint)
      }
      Text(
        analysisStatusText,
        style = mobileCaption1,
        color = if (grokConfigured) supportTextColor else mobileWarning,
      )
      analysis?.let { result ->
        Text("Grok Analysis", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = sectionHeadingColor)
        Surface(
          modifier = Modifier.fillMaxWidth(),
          shape = RoundedCornerShape(14.dp),
          color = mobileSurface,
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
          ) {
            Text(result.content, style = mobileCallout, color = mobileText)
            Text(formatTrackerTime(result.generatedAtMs), style = mobileCaption1, color = tertiarySupportTextColor)
          }
        }
      }
      if (liveEvents.isNotEmpty()) {
        Text("Focused Token Feed", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = sectionHeadingColor)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          liveEvents.takeLast(4).reversed().forEach { event ->
            TrackerDatastreamEventCard(event = event)
          }
        }
      }
      if (token.pools.isNotEmpty()) {
        Text("Top Pools", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = sectionHeadingColor)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          token.pools.take(3).forEach { pool ->
            Text(
              "${pool.market.ifBlank { "pool" }} • price ${formatUsd(pool.priceUsd)} • liq ${formatUsd(pool.liquidityUsd)} • 24h ${formatUsd(pool.volume24h)}",
              style = mobileCallout,
              color = mobileText,
            )
          }
        }
      }
      if (trades.isNotEmpty()) {
        Text("Recent Trades", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = sectionHeadingColor)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          trades.take(5).forEach { trade ->
            Text(
              "${trade.type.uppercase(Locale.US)} ${formatCompactAmount(trade.amount)} @ ${formatUsd(trade.priceUsd)} • ${shortTrackerAddress(trade.wallet)} • ${formatTrackerTime(trade.time)}",
              style = mobileCallout,
              color = mobileText,
            )
          }
        }
      }
      if (holders.isNotEmpty()) {
        Text("Top Holders", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = sectionHeadingColor)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          holders.take(5).forEach { holder ->
            Text(
              "${shortTrackerAddress(holder.address)} • ${formatPercent(holder.percentage)} • ${formatUsd(holder.valueUsd)}",
              style = mobileCallout,
              color = mobileText,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun TrackerDatastreamEventCard(event: SolanaTrackerDatastreamEvent) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurface,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(event.headline, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
        StatusChip(label = event.stream.uppercase(Locale.US), active = true)
      }
      Text(event.detail, style = mobileCaption1, color = mobileTextSecondary)
      Text(formatTrackerTime(event.timestampMs), style = mobileCaption1, color = mobileTextTertiary)
    }
  }
}

@Composable
private fun FeedItemCard(item: SolanaFeedItem) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(item.author, style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
          Text(item.headline, style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
        }
        StatusChip(label = item.kind.badge, active = item.kind != SolanaFeedKind.Thread)
      }
      Text(item.body, style = mobileCallout, color = mobileTextSecondary)
      HorizontalDivider(color = mobileBorder)
      Text(item.stats, style = mobileCaption1, color = mobileTextTertiary)
    }
  }
}

private fun formatUsd(value: Double?): String {
  val resolved = value ?: return "--"
  return when {
    resolved >= 1_000_000_000.0 -> "$" + String.format(Locale.US, "%.2fB", resolved / 1_000_000_000.0)
    resolved >= 1_000_000.0 -> "$" + String.format(Locale.US, "%.2fM", resolved / 1_000_000.0)
    resolved >= 1_000.0 -> "$" + String.format(Locale.US, "%.1fK", resolved / 1_000.0)
    resolved >= 1.0 -> "$" + String.format(Locale.US, "%.4f", resolved)
    resolved > 0.0 -> "$" + String.format(Locale.US, "%.8f", resolved)
    else -> "$0"
  }
}

private fun formatPercent(value: Double?): String =
  value?.let { String.format(Locale.US, "%.2f%%", it) } ?: "--"

private fun formatSignedPercent(value: Double?): String =
  value?.let {
    if (it >= 0.0) {
      "+" + String.format(Locale.US, "%.2f%%", it)
    } else {
      String.format(Locale.US, "%.2f%%", it)
    }
  } ?: "--"

private fun formatCompactInteger(value: Long?): String {
  val resolved = value ?: return "--"
  return when {
    resolved >= 1_000_000_000L -> String.format(Locale.US, "%.2fB", resolved / 1_000_000_000.0)
    resolved >= 1_000_000L -> String.format(Locale.US, "%.2fM", resolved / 1_000_000.0)
    resolved >= 1_000L -> String.format(Locale.US, "%.1fK", resolved / 1_000.0)
    else -> resolved.toString()
  }
}

private fun formatCompactAmount(value: Double?): String {
  val resolved = value ?: return "--"
  return when {
    resolved >= 1_000_000_000.0 -> String.format(Locale.US, "%.2fB", resolved / 1_000_000_000.0)
    resolved >= 1_000_000.0 -> String.format(Locale.US, "%.2fM", resolved / 1_000_000.0)
    resolved >= 1_000.0 -> String.format(Locale.US, "%.1fK", resolved / 1_000.0)
    resolved >= 1.0 -> String.format(Locale.US, "%.2f", resolved)
    resolved > 0.0 -> String.format(Locale.US, "%.6f", resolved)
    else -> "0"
  }
}

private fun shortTrackerAddress(value: String): String =
  if (value.length <= 10) {
    value
  } else {
    "${value.take(4)}…${value.takeLast(4)}"
  }

private fun formatTrackerTime(value: Long?): String {
  val resolved = value ?: return "--"
  return runCatching {
    DateTimeFormatter.ofPattern("MMM d HH:mm", Locale.US)
      .withZone(ZoneId.systemDefault())
      .format(Instant.ofEpochMilli(resolved))
  }.getOrElse { "--" }
}

private fun ai.openclaw.app.solana.SolanaControlThreadItem.toFeedItem(index: Int): SolanaFeedItem =
  SolanaFeedItem(
    id = index + 1,
    kind = kind.toFeedKind(),
    author = author,
    headline = headline,
    body = body,
    stats = stats,
  )

private fun String.toFeedKind(): SolanaFeedKind =
  when (lowercase()) {
    "market", "pumpfun-launch", "tokenmill-market" -> SolanaFeedKind.Market
    "trade", "pumpfun-buy", "pumpfun-sell" -> SolanaFeedKind.Trade
    "quote" -> SolanaFeedKind.Quote
    else -> SolanaFeedKind.Thread
  }

@Composable
private fun StatusChip(label: String, active: Boolean) {
  SolanaStatusPill(
    label = label,
    active = active,
    tone = if (active) SolanaPanelTone.Green else SolanaPanelTone.Neutral,
  )
}

@Composable
private fun CurvePresetPicker(current: String, onSelect: (String) -> Unit) {
  FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    listOf("Linear", "Exponential", "Custom").forEach { preset ->
      Surface(
        onClick = { onSelect(preset) },
        shape = RoundedCornerShape(999.dp),
        color = if (current == preset) mobileSuccessSoft else mobileSurfaceStrong,
        border = BorderStroke(1.dp, if (current == preset) mobileSuccess.copy(alpha = 0.35f) else mobileBorderStrong),
      ) {
        Text(
          text = preset,
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
          style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
          color = if (current == preset) mobileSuccess else mobileTextSecondary,
        )
      }
    }
  }
}

@Composable
private fun FeatureButton(
  label: String,
  emphasis: Boolean = false,
  onClick: () -> Unit,
) {
  Button(
    onClick = onClick,
    shape = RoundedCornerShape(14.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = if (emphasis) mobileAccent else mobileSurfaceStrong,
        contentColor = if (emphasis) Color.White else mobileText,
      ),
    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
  ) {
    Text(label, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun BridgeHandlerRow(
  title: String,
  detail: String,
  active: Boolean,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) mobileSuccess.copy(alpha = 0.28f) else mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(title, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
        StatusChip(label = if (active) "Ready" else "Blocked", active = active)
      }
      Text(detail, style = mobileCaption1, color = mobileTextSecondary)
    }
  }
}

@Composable
private fun BridgeCommandChip(command: String) {
  Surface(
    modifier = Modifier,
    shape = RoundedCornerShape(999.dp),
    color = mobileAccentSoft,
    border = BorderStroke(1.dp, mobileAccent.copy(alpha = 0.22f)),
  ) {
    Text(
      text = command,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = mobileAccent,
    )
  }
}

@Composable
private fun BridgeCommandChip(
  command: String,
  active: Boolean,
  onClick: (() -> Unit)?,
) {
  Surface(
    modifier =
      if (onClick != null) {
        Modifier.clickable(onClick = onClick)
      } else {
        Modifier
      },
    shape = RoundedCornerShape(999.dp),
    color = if (active) mobileAccent.copy(alpha = 0.16f) else mobileAccentSoft,
    border = BorderStroke(1.dp, if (active) mobileAccent.copy(alpha = 0.44f) else mobileAccent.copy(alpha = 0.22f)),
  ) {
    Text(
      text = command,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = mobileAccent,
    )
  }
}

@Composable
private fun BridgeDeliveryRow(entry: GatewaySession.InvokeDeliveryUpdate) {
  val active = entry.stage != GatewaySession.InvokeDeliveryStage.Failed
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) mobileSuccess.copy(alpha = 0.22f) else mobileDanger.copy(alpha = 0.32f)),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(entry.command, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
        StatusChip(label = entry.stage.name.uppercase(Locale.US), active = active)
      }
      Text("${entry.transport} · ${entry.nodeId}", style = mobileCaption1, color = mobileTextSecondary)
      Text(
        buildString {
          entry.errorCode?.takeIf { it.isNotBlank() }?.let { append(it) }
          entry.elapsedMs?.let {
            if (isNotEmpty()) append(" · ")
            append("${it}ms")
          }
          entry.timeoutMs?.let {
            if (isNotEmpty()) append(" · ")
            append("timeout ${it}ms")
          }
        }.ifBlank { if (entry.ok == true) "ok" else "awaiting result" },
        style = mobileCaption1,
        color = if (entry.stage == GatewaySession.InvokeDeliveryStage.Failed) mobileDanger else mobileTextSecondary,
      )
      entry.errorMessage?.takeIf { it.isNotBlank() }?.let {
        Text(it, style = mobileCaption1, color = mobileTextSecondary)
      }
    }
  }
}

@Composable
private fun OutlinedField(
  value: String,
  onValueChange: (String) -> Unit,
  label: String,
  modifier: Modifier = Modifier,
  singleLine: Boolean = true,
  keyboardType: KeyboardType = KeyboardType.Text,
) {
  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    modifier = modifier,
    label = { Text(label, style = mobileCaption1, color = mobileTextSecondary) },
    singleLine = singleLine,
    textStyle = if (singleLine) mobileBody.copy(color = mobileText) else mobileCallout.copy(color = mobileText),
    shape = RoundedCornerShape(14.dp),
    colors =
      OutlinedTextFieldDefaults.colors(
        focusedContainerColor = mobileSurfaceStrong,
        unfocusedContainerColor = mobileSurfaceStrong,
        focusedBorderColor = mobileAccent,
        unfocusedBorderColor = mobileBorderStrong,
        focusedTextColor = mobileText,
        unfocusedTextColor = mobileText,
        cursorColor = mobileAccent,
      ),
    keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
  )
}

private fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }

private data class NftDraftImage(
  val fileName: String,
  val mimeType: String,
  val bytes: ByteArray,
)

private data class DraftNftImageState(
  val image: ImageBitmap?,
  val failed: Boolean,
)

@Composable
private fun rememberDraftNftImageState(bytes: ByteArray): DraftNftImageState {
  var image by remember(bytes) { mutableStateOf<ImageBitmap?>(null) }
  var failed by remember(bytes) { mutableStateOf(false) }

  LaunchedEffect(bytes) {
    failed = false
    image =
      withContext(Dispatchers.Default) {
        try {
          BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
        } catch (_: Throwable) {
          null
        }
      }
    if (image == null) failed = true
  }

  return DraftNftImageState(image = image, failed = failed)
}

private suspend fun loadNftDraftImage(resolver: ContentResolver, uri: Uri): NftDraftImage {
  val mimeType = resolver.getType(uri)?.takeIf { it.contains('/') } ?: "image/jpeg"
  val fileName = (uri.lastPathSegment ?: "nft-image.jpg").substringAfterLast('/')
  val bytes =
    withContext(Dispatchers.IO) {
      resolver.openInputStream(uri)?.use { input ->
        val out = ByteArrayOutputStream()
        input.copyTo(out)
        out.toByteArray()
      } ?: ByteArray(0)
    }
  if (bytes.isEmpty()) throw IllegalStateException("empty image")
  return NftDraftImage(fileName = fileName, mimeType = mimeType, bytes = bytes)
}

private fun launchExternalView(context: Context, url: String) {
  context.startActivity(
    Intent(Intent.ACTION_VIEW, url.toUri()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
  )
}

private fun readClipboardText(context: Context): String? =
  (context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager)
    ?.primaryClip
    ?.getItemAt(0)
    ?.coerceToText(context)
    ?.toString()

private fun copyToClipboard(context: Context, value: String) {
  val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
  clipboard.setPrimaryClip(ClipData.newPlainText("solana-pay", value))
}

private fun hasExternalSolanaPayHandler(context: Context, rawUri: String): Boolean =
  externalSolanaPayIntents(context, rawUri).isNotEmpty()

private fun openExternalSolanaPayHandler(context: Context, rawUri: String): Boolean {
  val intents = externalSolanaPayIntents(context, rawUri)
  if (intents.isEmpty()) return false
  val primary = intents.first().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  if (intents.size == 1) {
    context.startActivity(primary)
    return true
  }
  val chooser =
    Intent.createChooser(primary, "Open Solana Pay request").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.drop(1).toTypedArray())
    }
  context.startActivity(chooser)
  return true
}

private fun externalSolanaPayIntents(context: Context, rawUri: String): List<Intent> {
  val baseIntent =
    Intent(Intent.ACTION_VIEW, rawUri.toUri())
      .addCategory(Intent.CATEGORY_BROWSABLE)
  val packageManager = context.packageManager
  val handlers =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.queryIntentActivities(
        baseIntent,
        PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
      )
    } else {
      @Suppress("DEPRECATION")
      packageManager.queryIntentActivities(baseIntent, PackageManager.MATCH_DEFAULT_ONLY)
    }
  return handlers
    .mapNotNull { it.activityInfo?.packageName }
    .distinct()
    .filter { it != context.packageName }
    .map { packageName -> Intent(baseIntent).setPackage(packageName) }
}
