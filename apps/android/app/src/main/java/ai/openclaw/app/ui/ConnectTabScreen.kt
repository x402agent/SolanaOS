package ai.openclaw.app.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ai.openclaw.app.BuildConfig
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.convex.ConvexWalletAgent
import ai.openclaw.app.gateway.GatewayEndpoint
import ai.openclaw.app.gateway.GatewayTransport
import ai.openclaw.app.nanoSolanaAppName

private enum class ConnectInputMode {
  SetupCode,
  Manual,
}

@Composable
fun ConnectTabScreen(viewModel: MainViewModel) {
  val context = LocalContext.current
  val activity = remember(context) { context.findActivity() as? ComponentActivity }
  val statusText by viewModel.statusText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val nodeBridgeOnly by viewModel.nodeBridgeOnly.collectAsState()
  val serverName by viewModel.serverName.collectAsState()
  val remoteAddress by viewModel.remoteAddress.collectAsState()
  val gateways by viewModel.gateways.collectAsState()
  val discoveryStatusText by viewModel.discoveryStatusText.collectAsState()
  val manualHost by viewModel.manualHost.collectAsState()
  val manualPort by viewModel.manualPort.collectAsState()
  val manualTls by viewModel.manualTls.collectAsState()
  val manualTransport by viewModel.manualTransport.collectAsState()
  val manualEnabled by viewModel.manualEnabled.collectAsState()
  val gatewayToken by viewModel.gatewayToken.collectAsState()
  val pendingTrust by viewModel.pendingGatewayTrust.collectAsState()
  val openRouterApiKey by viewModel.openRouterApiKey.collectAsState()
  val openRouterModel by viewModel.openRouterModel.collectAsState()
  val standaloneAgentAvailable by viewModel.chatOpenRouterAvailable.collectAsState()
  val rewardsWaitlistJoined by viewModel.rewardsWaitlistJoined.collectAsState()
  val mobileWalletState by viewModel.mobileWalletState.collectAsState()
  val convexConfigured by viewModel.convexConfigured.collectAsState()
  val convexHealth by viewModel.convexHealth.collectAsState()
  val convexRegisteredUser by viewModel.convexRegisteredUser.collectAsState()
  val convexBusy by viewModel.convexBusy.collectAsState()
  val convexStatusText by viewModel.convexStatusText.collectAsState()
  val convexWalletAgents by viewModel.convexWalletAgents.collectAsState()
  val convexWalletAgentsBusy by viewModel.convexWalletAgentsBusy.collectAsState()
  val convexWalletAgentsStatusText by viewModel.convexWalletAgentsStatusText.collectAsState()
  val walletSignMessageDraft by viewModel.walletSignMessageDraft.collectAsState()
  val walletTransactionDraft by viewModel.walletTransactionDraft.collectAsState()
  val showDiagnostics = BuildConfig.DEBUG
  val uriHandler = LocalUriHandler.current

  var advancedOpen by rememberSaveable { mutableStateOf(false) }
  var walletAdvancedOpen by rememberSaveable { mutableStateOf(false) }
  var inputMode by
    remember(manualEnabled, manualHost, gatewayToken) {
      mutableStateOf(
        if (manualEnabled || manualHost.isNotBlank() || gatewayToken.trim().isNotEmpty()) {
          ConnectInputMode.Manual
        } else {
          ConnectInputMode.SetupCode
        },
      )
    }
  var setupCode by rememberSaveable { mutableStateOf("") }
  var manualHostInput by rememberSaveable { mutableStateOf(manualHost) }
  var manualPortInput by rememberSaveable { mutableStateOf(manualPort.toString()) }
  var manualTlsInput by rememberSaveable { mutableStateOf(manualTls) }
  var passwordInput by rememberSaveable { mutableStateOf("") }
  var standaloneApiKeyInput by rememberSaveable(openRouterApiKey) { mutableStateOf(openRouterApiKey) }
  var standaloneModelInput by rememberSaveable(openRouterModel) { mutableStateOf(openRouterModel.ifBlank { BuildConfig.OPENROUTER_MODEL }) }
  var validationText by rememberSaveable { mutableStateOf<String?>(null) }

  LaunchedEffect(convexConfigured) {
    if (convexConfigured && convexHealth == null) {
      viewModel.refreshConvexHealth()
    }
  }

  if (pendingTrust != null) {
    val prompt = pendingTrust!!
    AlertDialog(
      onDismissRequest = { viewModel.declineGatewayTrustPrompt() },
      title = { Text("Trust this gateway?") },
      text = {
        Text(
          "First-time TLS connection.\n\nVerify this SHA-256 fingerprint before trusting:\n${prompt.fingerprintSha256}",
          style = mobileCallout,
        )
      },
      confirmButton = {
        TextButton(onClick = { viewModel.acceptGatewayTrustPrompt() }) {
          Text("Trust and continue")
        }
      },
      dismissButton = {
        TextButton(onClick = { viewModel.declineGatewayTrustPrompt() }) {
          Text("Cancel")
        }
      },
    )
  }

  val setupResolvedEndpoint = remember(setupCode) { decodeGatewaySetupCode(setupCode)?.url?.let { parseGatewayEndpoint(it)?.displayUrl } }
  val manualResolvedEndpoint = remember(manualHostInput, manualPortInput, manualTlsInput) {
    composeGatewayManualUrl(manualHostInput, manualPortInput, manualTlsInput)?.let { parseGatewayEndpoint(it)?.displayUrl }
  }

  val activeEndpoint =
    remember(isConnected, remoteAddress, setupResolvedEndpoint, manualResolvedEndpoint, inputMode) {
      when {
        isConnected && !remoteAddress.isNullOrBlank() -> remoteAddress!!
        inputMode == ConnectInputMode.SetupCode -> setupResolvedEndpoint ?: "Not set"
        else -> manualResolvedEndpoint ?: "Not set"
      }
    }
  val gatewayApiBase =
    remember(activeEndpoint, isConnected) {
      activeEndpoint
        .takeIf { isConnected || !it.isNullOrBlank() }
        ?.let(::gatewayApiBaseUrl)
    }

  val primaryLabel = if (isConnected) "Disconnect Gateway" else "Connect Gateway"
  val walletReady = mobileWalletState.hasStoredAuthorization
  val gatewayStateLabel =
    when {
      pendingTrust != null -> "Trust Pending"
      isConnected -> "Online"
      statusText.contains("operator offline", ignoreCase = true) -> "Operator Offline"
      nodeBridgeOnly -> "Bridge Only"
      else -> "Offline"
    }
  val convexStateLabel =
    when {
      convexRegisteredUser != null -> "Synced"
      convexConfigured -> "Configured"
      else -> "Missing"
    }
  val connectActionHint =
    when {
      !validationText.isNullOrBlank() -> validationText
      pendingTrust != null -> "Approve the TLS fingerprint to complete the first trusted connection."
      statusText.contains("operator offline", ignoreCase = true) ->
        "The operator looks offline. Tap Connect Gateway again after the host runtime is back up."
      nodeBridgeOnly ->
        "Node bridge mode can pair and stream node events, but full chat and automation require the WebSocket runtime endpoint."
      else -> null
    }
  val connectActionTone =
    when {
      !validationText.isNullOrBlank() -> SolanaPanelTone.Orange
      pendingTrust != null -> SolanaPanelTone.Purple
      nodeBridgeOnly -> SolanaPanelTone.Orange
      else -> SolanaPanelTone.Green
    }

  fun handleGatewayPrimaryAction() {
    if (isConnected) {
      viewModel.disconnect()
      validationText = null
      return
    }
    if (statusText.contains("operator offline", ignoreCase = true)) {
      validationText = null
      viewModel.refreshGatewayConnection()
      return
    }

    val config =
      resolveGatewayConnectConfig(
        useSetupCode = inputMode == ConnectInputMode.SetupCode,
        setupCode = setupCode,
        manualHost = manualHostInput,
        manualPort = manualPortInput,
        manualTls = manualTlsInput,
        manualTransport = manualTransport,
        fallbackToken = gatewayToken,
        fallbackPassword = passwordInput,
      )

    if (config == null) {
      validationText =
        if (inputMode == ConnectInputMode.SetupCode) {
          "Paste a valid setup code to connect."
        } else {
          "Enter a valid manual host and port to connect."
        }
      return
    }

    validationText = null
    viewModel.setManualEnabled(true)
    viewModel.setManualHost(config.host)
    viewModel.setManualPort(config.port)
    viewModel.setManualTls(config.tls)
    viewModel.setManualTransport(config.transport)
    if (config.token.isNotBlank()) {
      viewModel.setGatewayToken(config.token)
    }
    viewModel.setGatewayPassword(config.password)
    viewModel.connectManual()
  }

  fun handleWalletConnectToggle() {
    viewModel.clearMobileWalletMessages()
    val resolvedActivity = activity ?: return
    if (mobileWalletState.hasStoredAuthorization) {
      viewModel.disconnectSolanaWallet(resolvedActivity)
    } else {
      viewModel.connectSolanaWallet(resolvedActivity)
    }
  }

  Column(
    modifier = Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    SolanaWelcomeHero(
      eyebrow = "Welcome To",
      title = "SolanaOS",
      strapline = "The Solana Computer",
      subtitle = "Pair Seeker to your Solana workspace for wallet actions, private chat, and secure device control.",
      features =
        listOf(
          "Fast mobile pairing",
          "Wallet-first Seeker experience",
          "Private operator chat",
          "Daily wallet and device workflows",
        ),
      statusLabel = if (isConnected) "Gateway Online" else "Connect & Pair",
    )

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label = if (isConnected) "Gateway Online" else "Gateway Offline",
        active = isConnected,
        tone = if (isConnected) SolanaPanelTone.Green else SolanaPanelTone.Purple,
      )
      SolanaStatusPill(
        label = if (manualEnabled) "Manual Route" else "Setup Code",
        active = true,
        tone = SolanaPanelTone.Purple,
      )
    }

    SolanaBackplaneCard(
      title = "Connection Status",
      subtitle = "Review the core services that power pairing, wallet access, and account sync on this device.",
      links =
        listOf(
          SolanaBackendLink(
            label = "Gateway",
            state = gatewayStateLabel,
            detail = statusText,
            tone = if (isConnected) SolanaPanelTone.Green else SolanaPanelTone.Purple,
            active = isConnected,
          ),
          SolanaBackendLink(
            label = "Discovery",
            state =
              when {
                gateways.isNotEmpty() -> "${gateways.size} Found"
                discoveryStatusText.contains("search", ignoreCase = true) -> "Scanning"
                else -> "Idle"
              },
            detail = discoveryStatusText,
            tone = SolanaPanelTone.Purple,
            active = gateways.isNotEmpty(),
          ),
          SolanaBackendLink(
            label = "Connection",
            state =
              when {
                nodeBridgeOnly -> "Limited"
                isConnected -> "Ready"
                else -> "Offline"
              },
            detail =
              when {
                nodeBridgeOnly -> "Basic pairing is active, but some live controls are unavailable on this route."
                !serverName.isNullOrBlank() -> "Connected to ${serverName!!.trim()}."
                else -> "Live connection unlocks chat, wallet flows, and remote actions."
              },
            tone = if (nodeBridgeOnly) SolanaPanelTone.Orange else SolanaPanelTone.Green,
            active = isConnected && !nodeBridgeOnly,
          ),
          SolanaBackendLink(
            label = "Gateway API",
            state =
              when {
                gatewayApiBase != null && isConnected -> "Ready"
                gatewayApiBase != null -> "Standby"
                else -> "Pending"
              },
            detail =
              gatewayApiBase?.let { "$it/api/v1/health · protocol v3 · state, identity, invoke, and setup routes" }
                ?: "The REST backplane follows the same host as the pairing route and activates once a valid gateway endpoint is resolved.",
            tone = SolanaPanelTone.Purple,
            active = gatewayApiBase != null,
          ),
          SolanaBackendLink(
            label = "Wallet",
            state = if (walletReady) "Ready" else "Missing",
            detail = mobileWalletState.statusText,
            tone = SolanaPanelTone.Orange,
            active = walletReady,
          ),
          SolanaBackendLink(
            label = "Convex User",
            state = convexStateLabel,
            detail = convexStatusText,
            tone = if (convexRegisteredUser != null) SolanaPanelTone.Green else SolanaPanelTone.Purple,
            active = convexRegisteredUser != null,
          ),
        ),
      tone = if (isConnected) SolanaPanelTone.Green else SolanaPanelTone.Purple,
    )

    SolanaPanel(
      modifier = Modifier.fillMaxWidth(),
      tone = if (isConnected) SolanaPanelTone.Green else SolanaPanelTone.Purple,
    ) {
      SolanaSectionLabel(
        "Pairing Setup",
        tone = if (isConnected) SolanaPanelTone.Green else SolanaPanelTone.Purple,
      )
      Text(
        "Use a setup code for the fastest path, or enter a host manually if your operator gave you one.",
        style = mobileCallout,
        color = mobileText,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MethodChip(
          label = "Setup Code",
          active = inputMode == ConnectInputMode.SetupCode,
          onClick = {
            inputMode = ConnectInputMode.SetupCode
            validationText = null
          },
        )
        MethodChip(
          label = "Manual Route",
          active = inputMode == ConnectInputMode.Manual,
          onClick = {
            inputMode = ConnectInputMode.Manual
            validationText = null
          },
        )
      }

      if (inputMode == ConnectInputMode.SetupCode) {
        OutlinedTextField(
          value = setupCode,
          onValueChange = {
            setupCode = it
            validationText = null
          },
          placeholder = { Text("Paste setup code from your operator", style = mobileBody, color = mobileTextTertiary) },
          modifier = Modifier.fillMaxWidth(),
          minLines = 3,
          maxLines = 5,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
          textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
          shape = RoundedCornerShape(14.dp),
          colors = outlinedColors(),
        )
        if (!setupResolvedEndpoint.isNullOrBlank()) {
          EndpointPreview(endpoint = setupResolvedEndpoint)
        }
      } else {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedTextField(
            value = manualHostInput,
            onValueChange = {
              manualHostInput = it
              validationText = null
            },
            label = { Text("Host", style = mobileCaption1, color = mobileTextSecondary) },
            placeholder = { Text("gateway.local", style = mobileBody, color = mobileTextTertiary) },
            modifier = Modifier.weight(1f),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            textStyle = mobileBody.copy(color = mobileText),
            shape = RoundedCornerShape(14.dp),
            colors = outlinedColors(),
          )
          OutlinedTextField(
            value = manualPortInput,
            onValueChange = {
              manualPortInput = it
              validationText = null
            },
            label = { Text("Port", style = mobileCaption1, color = mobileTextSecondary) },
            placeholder = { Text("18790", style = mobileBody, color = mobileTextTertiary) },
            modifier = Modifier.width(120.dp),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
            shape = RoundedCornerShape(14.dp),
            colors = outlinedColors(),
          )
        }
        Text("Connection Mode", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          MethodChip(
            label = "Recommended",
            active = manualTransport == GatewayTransport.WebSocketRpc,
            onClick = {
              viewModel.setManualTransport(GatewayTransport.WebSocketRpc)
              validationText = null
            },
          )
          MethodChip(
            label = "Compatibility",
            active = manualTransport == GatewayTransport.NativeJsonTcp,
            onClick = {
              viewModel.setManualTransport(GatewayTransport.NativeJsonTcp)
              manualTlsInput = false
              validationText = null
            },
          )
        }
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween,
        ) {
          Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Use TLS", style = mobileHeadline, color = mobileText)
            Text(
              if (manualTransport == GatewayTransport.WebSocketRpc) {
                "Enable TLS if your operator gave you a secure remote address."
              } else {
                "Compatibility mode keeps the connection local and does not use TLS."
              },
              style = mobileCallout,
              color = mobileTextSecondary,
            )
          }
          Switch(
            checked = manualTlsInput && manualTransport == GatewayTransport.WebSocketRpc,
            enabled = manualTransport == GatewayTransport.WebSocketRpc,
            onCheckedChange = {
              manualTlsInput = it
              validationText = null
            },
            colors =
              SwitchDefaults.colors(
                checkedTrackColor = mobileAccent,
                uncheckedTrackColor = mobileBorderStrong,
                checkedThumbColor = mobileText,
                uncheckedThumbColor = mobileTextSecondary,
              ),
          )
        }
        if (!manualResolvedEndpoint.isNullOrBlank()) {
          EndpointPreview(endpoint = manualResolvedEndpoint)
        }
      }

      if (!connectActionHint.isNullOrBlank()) {
        Text(
          connectActionHint!!,
          style = mobileCaption1,
          color =
            when (connectActionTone) {
              SolanaPanelTone.Green -> mobileSuccess
              SolanaPanelTone.Purple -> mobileAccent
              SolanaPanelTone.Orange -> mobileWarning
              SolanaPanelTone.Neutral -> mobileTextSecondary
            },
        )
      }
      if (!validationText.isNullOrBlank()) {
        Text(validationText!!, style = mobileCaption1, color = mobileWarning)
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Button(
          onClick = ::handleGatewayPrimaryAction,
          modifier = Modifier.weight(1f).height(48.dp),
          shape = RoundedCornerShape(14.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = if (isConnected) mobileDangerSoft else mobileSuccessSoft,
              contentColor = if (isConnected) mobileDanger else mobileSuccess,
            ),
          border = BorderStroke(1.dp, if (isConnected) mobileDanger else mobileSuccess),
        ) {
          Text(primaryLabel.uppercase(), style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = {
            validationText = null
            setupCode = ""
            passwordInput = ""
            manualHostInput = manualHost
            manualPortInput = manualPort.toString()
            manualTlsInput = manualTls
          },
          modifier = Modifier.weight(1f).height(48.dp),
          shape = RoundedCornerShape(14.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileTextSecondary),
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Text("RESET INPUTS", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
    }

    SolanaPanel(
      modifier = Modifier.fillMaxWidth(),
      tone = SolanaPanelTone.Purple,
    ) {
      SolanaSectionLabel("Gateway Discovery", tone = SolanaPanelTone.Purple)
      Text(discoveryStatusText, style = mobileCallout, color = mobileTextSecondary)
      if (gateways.isEmpty()) {
        Text(
          "No nearby gateways found yet. You can wait for discovery to complete or enter a host manually.",
          style = mobileCallout,
          color = mobileText,
        )
      } else {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          gateways.forEach { endpoint ->
            DiscoveredGatewayCard(
              endpoint = endpoint,
              connected = isConnected && remoteAddress?.contains(endpoint.host, ignoreCase = true) == true,
              onConnect = {
                validationText = null
                viewModel.connect(endpoint)
              },
            )
          }
        }
      }
    }

    if (showDiagnostics) {
      SolanaPanel(
        modifier = Modifier.fillMaxWidth(),
        tone = SolanaPanelTone.Green,
      ) {
        SolanaSectionLabel("Active Endpoint")
        Text(
          activeEndpoint,
          style = mobileCallout.copy(fontFamily = mobileMonoFontFamily),
          color = mobileText,
        )
      }
    }

    SolanaPanel(
      modifier = Modifier.fillMaxWidth(),
      tone = SolanaPanelTone.Purple,
    ) {
      SolanaSectionLabel("Connection State", tone = SolanaPanelTone.Purple)
      Text(statusText, style = mobileCallout, color = mobileText)
    }

    if (nodeBridgeOnly) {
      SolanaPanel(
        modifier = Modifier.fillMaxWidth(),
        tone = SolanaPanelTone.Orange,
      ) {
        SolanaSectionLabel("Limited Connection", tone = SolanaPanelTone.Orange)
        Text(
          "This connection supports basic pairing, but some live chat and automation features are unavailable until the full runtime route is online.",
          style = mobileCallout,
          color = mobileText,
        )
      }
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text("SEEKER WALLET", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileAccent)
      Text("Mobile Wallet Adapter", style = mobileTitle2, color = mobileText)
      Text(
        "Use one native wallet connection for Seeker sign-in and signing flows.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("Wallet state", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
        Text(mobileWalletState.statusText, style = mobileBody, color = mobileText)
        HorizontalDivider(color = mobileBorder)
        if (!mobileWalletState.authorizedAddress.isNullOrBlank()) {
          Text("Connected address", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
          Text(
            "${mobileWalletState.authorizedAddress!!.take(4)}…${mobileWalletState.authorizedAddress!!.takeLast(4)}",
            style = mobileCallout,
            color = mobileText,
          )
          HorizontalDivider(color = mobileBorder)
        }
        Text(
          if (mobileWalletState.hasStoredAuthorization) {
            "Stored authorization is available on this device."
          } else {
            "No stored authorization yet."
          },
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
      }
    }

    SolanaPanel(
      modifier = Modifier.fillMaxWidth(),
      tone = if (walletReady) SolanaPanelTone.Green else SolanaPanelTone.Orange,
    ) {
      SolanaSectionLabel(
        "Wallet Command Deck",
        tone = if (walletReady) SolanaPanelTone.Green else SolanaPanelTone.Orange,
      )
      Text(
        if (!mobileWalletState.authorizedAddress.isNullOrBlank()) {
          "Authorized wallet ${mobileWalletState.authorizedAddress!!.take(4)}…${mobileWalletState.authorizedAddress!!.takeLast(4)} is live on-device for sign-in and transaction flows."
        } else {
          "Connect Seeker's wallet once, then run SIWS, detached message signing, and transaction verification from the same native authorization."
        },
        style = mobileCallout,
        color = mobileText,
      )
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Button(
          onClick = ::handleWalletConnectToggle,
          enabled = activity != null && !mobileWalletState.isBusy,
          modifier = Modifier.weight(1f).height(48.dp),
          shape = RoundedCornerShape(14.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = if (mobileWalletState.hasStoredAuthorization) mobileDangerSoft else mobileSuccessSoft,
              contentColor = if (mobileWalletState.hasStoredAuthorization) mobileDanger else mobileSuccess,
            ),
          border = BorderStroke(1.dp, if (mobileWalletState.hasStoredAuthorization) mobileDanger else mobileSuccess),
        ) {
          Text(
            if (mobileWalletState.hasStoredAuthorization) "DISCONNECT" else "CONNECT",
            style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
          )
        }
        Button(
          onClick = {
            viewModel.clearMobileWalletMessages()
            val resolvedActivity = activity ?: return@Button
            viewModel.signInWithSolana(resolvedActivity)
          },
          enabled = activity != null && !mobileWalletState.isBusy,
          modifier = Modifier.weight(1f).height(48.dp),
          shape = RoundedCornerShape(14.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
          border = BorderStroke(1.dp, mobileAccent.copy(alpha = 0.25f)),
        ) {
          Text("RUN SIWS", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = {
            viewModel.clearMobileWalletMessages()
            val resolvedActivity = activity ?: return@Button
            viewModel.signSolanaMessage(resolvedActivity, walletSignMessageDraft)
          },
          enabled = activity != null && !mobileWalletState.isBusy && walletSignMessageDraft.isNotBlank(),
          modifier = Modifier.weight(1f).height(48.dp),
          shape = RoundedCornerShape(14.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileText),
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Text("SIGN MSG", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("Future SPL rewards", style = mobileHeadline, color = mobileText)
        Text(
          if (!mobileWalletState.authorizedAddress.isNullOrBlank()) {
            "This wallet is reward-ready for a future SPL launch. No token distribution is active yet, but this address can be used later for allowlists, claim proofs, or usage-based rewards."
          } else {
            "Connect a wallet now so future SPL rewards can attach to a stable on-device identity when the program goes live."
          },
          style = mobileCallout,
          color = mobileTextSecondary,
        )
        HorizontalDivider(color = mobileBorder)
        Text(
          if (rewardsWaitlistJoined) {
            "This device is locally marked as opted into future reward notifications."
          } else {
            "Rewards are disabled at launch. You can mark this device as interested now without enabling any live token distribution."
          },
          style = mobileCaption1,
          color = if (rewardsWaitlistJoined) mobileAccent else mobileTextSecondary,
        )
      }
    }

    Button(
      onClick = { viewModel.setRewardsWaitlistJoined(!rewardsWaitlistJoined) },
      modifier = Modifier.fillMaxWidth().height(52.dp),
      shape = RoundedCornerShape(14.dp),
      colors =
        ButtonDefaults.buttonColors(
          containerColor = if (rewardsWaitlistJoined) mobileSurface else mobileSuccessSoft,
          contentColor = if (rewardsWaitlistJoined) mobileTextSecondary else mobileSuccess,
        ),
      border = BorderStroke(1.dp, if (rewardsWaitlistJoined) mobileBorder else mobileSuccess),
    ) {
      Text(
        if (rewardsWaitlistJoined) "Leave Future Rewards Waitlist" else "Join Future Rewards Waitlist",
        style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
      )
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurfaceStrong,
      border = BorderStroke(1.dp, mobileBorderStrong),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("Account Sync", style = mobileHeadline, color = mobileText)
        Text(
          if (convexConfigured) {
            "Account sync is available for this build and can link your wallet to the mobile profile."
          } else {
            "Account sync is unavailable in this build."
          },
          style = mobileCallout,
          color = mobileTextSecondary,
        )
        HorizontalDivider(color = mobileBorder)
        Text(convexStatusText, style = mobileCaption1, color = if (convexRegisteredUser != null) mobileSuccess else mobileTextSecondary)
        convexRegisteredUser?.let { user ->
          Text(
            "Synced wallet ${user.walletAddress.take(4)}…${user.walletAddress.takeLast(4)} at ${user.lastSeenAt}.",
            style = mobileCaption1,
            color = mobileSuccess,
          )
        }
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
          Button(
            onClick = viewModel::refreshConvexHealth,
            enabled = convexConfigured && !convexBusy,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
          ) {
            Text(if (convexBusy) "Checking…" else "Check Status", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
          }
          Button(
            onClick = {
              val resolvedActivity = activity ?: return@Button
              viewModel.syncConvexWalletUser(resolvedActivity)
            },
            enabled = convexConfigured && activity != null && mobileWalletState.hasStoredAuthorization && !convexBusy,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
          ) {
            Text(if (convexBusy) "Syncing…" else "Sync Wallet", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
          }
        }
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurfaceStrong,
      border = BorderStroke(1.dp, mobileBorderStrong),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("Agent Registry", style = mobileHeadline, color = mobileText)
        Text(
          "Hub and Convex agent registrations for this Seeker wallet, including public profile, A2A, and ACP command metadata.",
          style = mobileCallout,
          color = mobileTextSecondary,
        )
        HorizontalDivider(color = mobileBorder)
        Text(
          convexWalletAgentsStatusText,
          style = mobileCaption1,
          color = if (convexWalletAgents.isNotEmpty()) mobileSuccess else mobileTextSecondary,
        )
        if (convexWalletAgents.isEmpty()) {
          Text(
            if (convexRegisteredUser != null) {
              "No registered agents are linked to this wallet yet."
            } else {
              "Sync the wallet first so Seeker can read your agent registry records."
            },
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
        } else {
          convexWalletAgents.take(3).forEach { agent ->
            WalletAgentSummaryCard(
              agent = agent,
              onOpenProfile = {
                agent.publicProfileUrl()?.let(uriHandler::openUri)
              },
              onOpenA2A = {
                agent.agentCardUrl()?.let(uriHandler::openUri)
              },
              onOpenExplorer = {
                (
                  agent.explorerMetaplexAssetUrl
                    ?: agent.explorerAssetUrl
                    ?: agent.explorerMetaplexRegistrationUrl
                    ?: agent.explorerRegistrationUrl
                )?.let(uriHandler::openUri)
              },
            )
          }
          if (convexWalletAgents.size > 3) {
            Text(
              "+${convexWalletAgents.size - 3} more agent records in NanoHub.",
              style = mobileCaption1,
              color = mobileTextSecondary,
            )
          }
        }
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
          Button(
            onClick = viewModel::refreshConvexWalletAgents,
            enabled = convexConfigured && !convexWalletAgentsBusy,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
          ) {
            Text(
              if (convexWalletAgentsBusy) "Loading…" else "Refresh Agents",
              style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
            )
          }
          Button(
            onClick = { uriHandler.openUri(BuildConfig.SEEKER_SITE_URL) },
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
          ) {
            Text("Open NanoHub", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
          }
        }
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
      onClick = { walletAdvancedOpen = !walletAdvancedOpen },
    ) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text("Advanced wallet tools", style = mobileHeadline, color = mobileText)
          Text("Sign in with Solana and detached message signing.", style = mobileCaption1, color = mobileTextSecondary)
        }
        Icon(
          imageVector = if (walletAdvancedOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
          contentDescription = if (walletAdvancedOpen) "Collapse wallet tools" else "Expand wallet tools",
          tint = mobileTextSecondary,
        )
      }
    }

    AnimatedVisibility(visible = walletAdvancedOpen) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = mobileSurfaceStrong,
        border = BorderStroke(1.dp, mobileBorderStrong),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
          Text("Sign In with Solana", style = mobileHeadline, color = mobileText)
          Text(
            "Complete wallet authorization and identity verification in one flow.",
            style = mobileCallout,
            color = mobileTextSecondary,
          )
          Button(
            onClick = {
              viewModel.clearMobileWalletMessages()
              val resolvedActivity = activity ?: return@Button
              viewModel.signInWithSolana(resolvedActivity)
            },
            enabled = activity != null && !mobileWalletState.isBusy,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
          ) {
            Text("Run SIWS", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
          }

          HorizontalDivider(color = mobileBorder)

          Text("Detached message signing", style = mobileHeadline, color = mobileText)
          Text(
            "Verify wallet ownership without sending a transaction.",
            style = mobileCallout,
            color = mobileTextSecondary,
          )
          OutlinedTextField(
            value = walletSignMessageDraft,
            onValueChange = { viewModel.setWalletSignMessageDraft(it) },
            placeholder = { Text("Message to sign", style = mobileBody, color = mobileTextTertiary) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 4,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
            textStyle = mobileBody.copy(color = mobileText),
            shape = RoundedCornerShape(14.dp),
            colors = outlinedColors(),
          )
          Button(
            onClick = {
              viewModel.clearMobileWalletMessages()
              val resolvedActivity = activity ?: return@Button
              viewModel.signSolanaMessage(resolvedActivity, walletSignMessageDraft)
            },
            enabled = activity != null && !mobileWalletState.isBusy,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp),
          ) {
            Text("Sign Message", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
          }

          HorizontalDivider(color = mobileBorder)

          Text("Transaction verification", style = mobileHeadline, color = mobileText)
          Text(
            "Paste a devnet unsigned transaction in base64 to verify native wallet signing on Seeker.",
            style = mobileCallout,
            color = mobileTextSecondary,
          )
          OutlinedTextField(
            value = walletTransactionDraft,
            onValueChange = { viewModel.setWalletTransactionDraft(it) },
            placeholder = { Text("Unsigned transaction (base64)", style = mobileBody, color = mobileTextTertiary) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
            maxLines = 8,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = mobileCallout.copy(fontFamily = FontFamily.Monospace, color = mobileText),
            shape = RoundedCornerShape(14.dp),
            colors = outlinedColors(),
          )
          Text(
            "Use this for low-risk MWA verification. Keep values tiny and prefer devnet test transfers.",
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
          ) {
            Button(
              onClick = {
                viewModel.clearMobileWalletMessages()
                val resolvedActivity = activity ?: return@Button
                viewModel.signSolanaTransaction(resolvedActivity, walletTransactionDraft)
              },
              enabled = activity != null && !mobileWalletState.isBusy,
              modifier = Modifier.weight(1f).height(48.dp),
              shape = RoundedCornerShape(14.dp),
              colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
            ) {
              Text("Sign Raw Tx", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
            }
            Button(
              onClick = {
                viewModel.clearMobileWalletMessages()
                val resolvedActivity = activity ?: return@Button
                viewModel.signAndSendSolanaTransaction(resolvedActivity, walletTransactionDraft)
              },
              enabled = activity != null && !mobileWalletState.isBusy,
              modifier = Modifier.weight(1f).height(48.dp),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text("Sign + Send", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
            }
          }
        }
      }
    }

    if (!mobileWalletState.infoText.isNullOrBlank()) {
      Text(mobileWalletState.infoText!!, style = mobileCaption1, color = mobileAccent)
    }

    if (!mobileWalletState.errorText.isNullOrBlank()) {
      Text(mobileWalletState.errorText!!, style = mobileCaption1, color = mobileWarning)
    }

    if (activity == null) {
      Text("Wallet actions require an active Android activity.", style = mobileCaption1, color = mobileWarning)
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
      onClick = { advancedOpen = !advancedOpen },
    ) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text("Advanced controls", style = mobileHeadline, color = mobileText)
          Text("Setup code, endpoint, TLS, token, password, onboarding.", style = mobileCaption1, color = mobileTextSecondary)
        }
        Icon(
          imageVector = if (advancedOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
          contentDescription = if (advancedOpen) "Collapse advanced controls" else "Expand advanced controls",
          tint = mobileTextSecondary,
        )
      }
    }

    AnimatedVisibility(visible = advancedOpen) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = mobileSurfaceStrong,
        border = BorderStroke(1.dp, mobileBorderStrong),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
          Text("Connection method", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MethodChip(
              label = "Setup Code",
              active = inputMode == ConnectInputMode.SetupCode,
              onClick = { inputMode = ConnectInputMode.SetupCode },
            )
            MethodChip(
              label = "Manual",
              active = inputMode == ConnectInputMode.Manual,
              onClick = { inputMode = ConnectInputMode.Manual },
            )
          }

          Text(
            "Use a setup code when possible. Manual setup is best when your operator gives you a specific host, port, and optional credentials.",
            style = mobileCallout,
            color = mobileTextSecondary,
          )
          if (showDiagnostics) {
            Text("Developer startup reference:", style = mobileCallout, color = mobileTextSecondary)
            CommandBlock("solanaos gateway start")
            CommandBlock("solanaos gateway start --no-tailscale")
            CommandBlock("solanaos gateway start --port 18790")
            CommandBlock("solanaos gateway start --bind <tailnet-ip>")
          }

          if (inputMode == ConnectInputMode.SetupCode) {
            Text("Setup Code", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            OutlinedTextField(
              value = setupCode,
              onValueChange = {
                setupCode = it
                validationText = null
              },
              placeholder = { Text("Paste setup code from your $nanoSolanaAppName operator", style = mobileBody, color = mobileTextTertiary) },
              modifier = Modifier.fillMaxWidth(),
              minLines = 3,
              maxLines = 5,
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
              textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
              shape = RoundedCornerShape(14.dp),
              colors = outlinedColors(),
            )
            if (!setupResolvedEndpoint.isNullOrBlank()) {
              EndpointPreview(endpoint = setupResolvedEndpoint)
            }
          } else {
            if (showDiagnostics) {
              Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuickFillChip(
                  label = "Android Emulator",
                  onClick = {
                    manualHostInput = "10.0.2.2"
                    manualPortInput = "18790"
                    manualTlsInput = false
                    validationText = null
                  },
                )
                QuickFillChip(
                  label = "Localhost",
                  onClick = {
                    manualHostInput = "127.0.0.1"
                    manualPortInput = "18790"
                    manualTlsInput = false
                    validationText = null
                  },
                )
                QuickFillChip(
                  label = "Local RPC",
                  onClick = {
                    manualHostInput = "127.0.0.1"
                    manualPortInput = "18789"
                    manualTlsInput = false
                    validationText = null
                  },
                )
              }
            }

            Text("Host", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            OutlinedTextField(
              value = manualHostInput,
              onValueChange = {
                manualHostInput = it
                validationText = null
              },
              placeholder = { Text("gateway.local", style = mobileBody, color = mobileTextTertiary) },
              modifier = Modifier.fillMaxWidth(),
              singleLine = true,
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
              textStyle = mobileBody.copy(color = mobileText),
              shape = RoundedCornerShape(14.dp),
              colors = outlinedColors(),
            )

            Text("Port", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            OutlinedTextField(
              value = manualPortInput,
              onValueChange = {
                manualPortInput = it
                validationText = null
              },
              placeholder = { Text("18790", style = mobileBody, color = mobileTextTertiary) },
              modifier = Modifier.fillMaxWidth(),
              singleLine = true,
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
              textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
              shape = RoundedCornerShape(14.dp),
              colors = outlinedColors(),
            )

            Row(
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.SpaceBetween,
            ) {
              Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Use TLS", style = mobileHeadline, color = mobileText)
                Text("Enable TLS only if your operator tells you to use a secure remote route.", style = mobileCallout, color = mobileTextSecondary)
              }
              Switch(
                checked = manualTlsInput,
                onCheckedChange = {
                  if (it && manualPortInput == "18790") {
                    manualPortInput = "18789"
                  } else if (!it && manualPortInput == "18789") {
                    manualPortInput = "18790"
                  }
                  manualTlsInput = it
                  validationText = null
                },
                colors =
                  SwitchDefaults.colors(
                    checkedTrackColor = mobileAccent,
                    uncheckedTrackColor = mobileBorderStrong,
                    checkedThumbColor = mobileText,
                    uncheckedThumbColor = mobileTextSecondary,
                  ),
              )
            }

            Text("Token (optional)", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            OutlinedTextField(
              value = gatewayToken,
              onValueChange = { viewModel.setGatewayToken(it) },
              placeholder = { Text("token", style = mobileBody, color = mobileTextTertiary) },
              modifier = Modifier.fillMaxWidth(),
              singleLine = true,
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
              textStyle = mobileBody.copy(color = mobileText),
              shape = RoundedCornerShape(14.dp),
              colors = outlinedColors(),
            )

            Text("Password (optional)", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            OutlinedTextField(
              value = passwordInput,
              onValueChange = { passwordInput = it },
              placeholder = { Text("password", style = mobileBody, color = mobileTextTertiary) },
              modifier = Modifier.fillMaxWidth(),
              singleLine = true,
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
              textStyle = mobileBody.copy(color = mobileText),
              shape = RoundedCornerShape(14.dp),
              colors = outlinedColors(),
            )

            if (!manualResolvedEndpoint.isNullOrBlank()) {
              EndpointPreview(endpoint = manualResolvedEndpoint)
            }
          }

          HorizontalDivider(color = mobileBorder)

          TextButton(onClick = { viewModel.setOnboardingCompleted(false) }) {
            Text("Run onboarding again", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold), color = mobileAccent)
          }
        }
      }
    }

    if (!validationText.isNullOrBlank()) {
      Text(validationText!!, style = mobileCaption1, color = mobileWarning)
    }
  }
}

@Composable
private fun MethodChip(label: String, active: Boolean, onClick: () -> Unit) {
  Button(
    onClick = onClick,
    modifier = Modifier.height(40.dp),
    shape = RoundedCornerShape(12.dp),
    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = if (active) mobileAccent else mobileSurface,
        contentColor = if (active) mobileText else mobileText,
      ),
    border = BorderStroke(1.dp, if (active) mobileAccent.copy(alpha = 0.45f) else mobileBorderStrong),
  ) {
    Text(label, style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
  }
}

@Composable
private fun QuickFillChip(label: String, onClick: () -> Unit) {
  Button(
    onClick = onClick,
    shape = RoundedCornerShape(999.dp),
    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = mobileAccentSoft,
        contentColor = mobileAccent,
      ),
    elevation = null,
  ) {
    Text(label, style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun CommandBlock(command: String) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = mobileCodeBg,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Box(modifier = Modifier.width(3.dp).height(42.dp).background(mobileSuccess))
      Text(
        text = command,
        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        style = mobileCallout.copy(fontFamily = FontFamily.Monospace),
        color = mobileCodeText,
      )
    }
  }
}

@Composable
private fun EndpointPreview(endpoint: String) {
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    HorizontalDivider(color = mobileBorder)
    Text("Resolved endpoint", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
    Text(endpoint, style = mobileCallout.copy(fontFamily = FontFamily.Monospace), color = mobileText)
    HorizontalDivider(color = mobileBorder)
  }
}

@Composable
private fun DiscoveredGatewayCard(
  endpoint: GatewayEndpoint,
  connected: Boolean,
  onConnect: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (connected) mobileSuccess else mobileBorderStrong),
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
          Text(endpoint.name, style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
          Text(
            "${endpoint.host}:${endpoint.port} · ${endpoint.transport.name} · ${if (endpoint.tlsEnabled) "TLS" else "No TLS"}",
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
        }
        Button(
          onClick = onConnect,
          enabled = !connected,
          shape = RoundedCornerShape(12.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = if (connected) mobileSurface else mobileAccentSoft,
              contentColor = if (connected) mobileTextSecondary else mobileAccent,
            ),
        ) {
          Text(if (connected) "Connected" else "Connect", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
        }
      }
      endpoint.tailnetDns?.takeIf { it.isNotBlank() }?.let {
        Text("Tailnet: $it", style = mobileCaption1, color = mobileAccent)
      }
      if (endpoint.gatewayPort != null || endpoint.canvasPort != null) {
        Text(
          "Gateway ${endpoint.gatewayPort ?: endpoint.port} · Canvas ${endpoint.canvasPort ?: "--"}",
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
      }
    }
  }
}

@Composable
private fun outlinedColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    cursorColor = mobileAccent,
  )

@Composable
private fun WalletAgentSummaryCard(
  agent: ConvexWalletAgent,
  onOpenProfile: () -> Unit,
  onOpenA2A: () -> Unit,
  onOpenExplorer: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = mobileSurface,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text(agent.name, style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      Text(
        "${agent.cluster} · ${agent.registryMode.uppercase()} · ${agent.status.uppercase()}",
        style = mobileCaption1,
        color = if (agent.status.equals("ready", ignoreCase = true)) mobileSuccess else mobileTextSecondary,
      )
      Text(
        if (agent.ownerVerified) {
          "Owner verified on-chain."
        } else {
          "Owner transfer still pending verification."
        },
        style = mobileCaption1,
        color = if (agent.ownerVerified) mobileAccent else mobileTextSecondary,
      )
      agent.acpCommand()?.let { command ->
        Text("ACP: $command", style = mobileCaption1, color = mobileTextSecondary)
      }
      agent.errorMessage?.takeIf { it.isNotBlank() }?.let { errorMessage ->
        Text(errorMessage, style = mobileCaption1, color = mobileWarning)
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Button(
          onClick = onOpenProfile,
          enabled = agent.publicProfileUrl() != null,
          modifier = Modifier.weight(1f),
          shape = RoundedCornerShape(12.dp),
          contentPadding = PaddingValues(vertical = 10.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
        ) {
          Text("Profile", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = onOpenA2A,
          enabled = agent.agentCardUrl() != null,
          modifier = Modifier.weight(1f),
          shape = RoundedCornerShape(12.dp),
          contentPadding = PaddingValues(vertical = 10.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSurfaceStrong, contentColor = mobileText),
        ) {
          Text("A2A", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = onOpenExplorer,
          enabled =
            agent.explorerAssetUrl != null ||
              agent.explorerMetaplexAssetUrl != null ||
              agent.explorerRegistrationUrl != null ||
              agent.explorerMetaplexRegistrationUrl != null,
          modifier = Modifier.weight(1f),
          shape = RoundedCornerShape(12.dp),
          contentPadding = PaddingValues(vertical = 10.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
        ) {
          Text("Explorer", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
        }
      }
    }
  }
}

private fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }

private fun gatewayApiBaseUrl(endpoint: String): String? {
  val trimmed = endpoint.trim()
  if (trimmed.isBlank() || trimmed == "Not set") return null
  return when {
    trimmed.startsWith("wss://") -> "https://${trimmed.removePrefix("wss://")}"
    trimmed.startsWith("ws://") -> "http://${trimmed.removePrefix("ws://")}"
    trimmed.startsWith("https://") || trimmed.startsWith("http://") -> trimmed
    else -> "https://$trimmed"
  }
}
