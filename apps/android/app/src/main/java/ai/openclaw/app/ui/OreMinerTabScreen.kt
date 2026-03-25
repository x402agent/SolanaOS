@file:Suppress("SetJavaScriptEnabled")

package ai.openclaw.app.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import ai.openclaw.app.BuildConfig
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.solana.SolanaRpcBalanceClient
import ai.openclaw.app.solana.SolanaRpcBalanceSnapshot

private const val oreMinerUrl = "https://www.miner.supply"

@Composable
fun OreMinerTabScreen(viewModel: MainViewModel) {
  val context = LocalContext.current
  val activity = remember(context) { context.findActivity() as? ComponentActivity }
  val walletState by viewModel.mobileWalletState.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val statusText by viewModel.statusText.collectAsState()
  val convexConfigured by viewModel.convexConfigured.collectAsState()
  val convexRegisteredUser by viewModel.convexRegisteredUser.collectAsState()
  val convexStatusText by viewModel.convexStatusText.collectAsState()
  val balanceClient = remember { SolanaRpcBalanceClient(BuildConfig.DEFAULT_SOLANA_RPC_URL) }
  val walletAddress = walletState.authorizedAddress?.trim().orEmpty()
  val hasWalletAddress = walletState.hasStoredAuthorization && walletAddress.isNotBlank()

  var amountPerBlockInput by rememberSaveable { mutableStateOf("0.01") }
  var occupiedBlocksInput by rememberSaveable { mutableStateOf("5") }
  var liveMinerVisible by rememberSaveable { mutableStateOf(false) }
  var showPlanner by rememberSaveable { mutableStateOf(false) }
  var balanceSnapshot by remember { mutableStateOf<SolanaRpcBalanceSnapshot?>(null) }
  var balanceStatusText by remember { mutableStateOf("Connect a wallet to load live mainnet SOL balance.") }
  val plan = remember(amountPerBlockInput, occupiedBlocksInput) {
    calculateOreMiningPlan(
      amountPerBlockInput = amountPerBlockInput,
      occupiedBlocksInput = occupiedBlocksInput,
    )
  }
  val walletReadyForOre =
    hasWalletAddress &&
      (balanceSnapshot?.sol ?: 0.0) >= 0.5
  val canContinueToMiner = hasWalletAddress && !walletState.isBusy

  LaunchedEffect(walletState.authorizedAddress, walletState.hasStoredAuthorization) {
    balanceSnapshot = null
    balanceStatusText =
      when {
        !walletState.hasStoredAuthorization || walletState.authorizedAddress.isNullOrBlank() ->
          "Connect a wallet to load live mainnet SOL balance."
        !balanceClient.isConfigured() ->
          "Mainnet RPC is not configured in this build."
        else -> {
          "Loading live balance from mainnet RPC…"
        }
      }

    val address = walletState.authorizedAddress?.trim().orEmpty()
    if (!walletState.hasStoredAuthorization || address.isBlank() || !balanceClient.isConfigured()) {
      return@LaunchedEffect
    }

    runCatching { balanceClient.fetchBalance(address) }
      .onSuccess { snapshot ->
        balanceSnapshot = snapshot
        balanceStatusText =
          if (snapshot.sol >= 0.5) {
            "Wallet is funded for ORE mainnet participation."
          } else {
            "Wallet is live on mainnet, but balance is below the suggested 0.5 SOL starting bankroll."
          }
      }.onFailure { err ->
        balanceStatusText = err.message ?: "Unable to load live mainnet balance."
      }
  }

  Column(
    modifier = Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 10.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "Live Mining",
      title = "Official ORE Miner",
      subtitle =
        "Prepare the same Seeker wallet you want to mine with on Solana mainnet, then run the official ORE miner directly inside this tab.",
    )

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label = if (walletState.hasStoredAuthorization) "Wallet Ready" else "Wallet Needed",
        active = walletState.hasStoredAuthorization,
        tone = if (walletState.hasStoredAuthorization) SolanaPanelTone.Green else SolanaPanelTone.Orange,
      )
      SolanaStatusPill(
        label = if (walletReadyForOre) "Mainnet Ready" else "Mainnet Check",
        active = walletReadyForOre,
        tone = if (walletReadyForOre) SolanaPanelTone.Green else SolanaPanelTone.Orange,
      )
      SolanaStatusPill(
        label = if (isConnected) "Gateway Online" else "Gateway Optional",
        active = isConnected,
        tone = SolanaPanelTone.Purple,
      )
      SolanaStatusPill(
        label = "Official Mainnet",
        active = true,
        tone = SolanaPanelTone.Green,
      )
    }

    SolanaBackplaneCard(
      title = "Mining Backplane",
      subtitle = "This tab validates the connected wallet, checks mainnet balance, and hosts the live official ORE mainnet flow in-app.",
      links =
        listOf(
          SolanaBackendLink(
            label = "Wallet Signer",
            state = if (walletState.hasStoredAuthorization) "Ready" else "Missing",
            detail = walletState.statusText,
            tone = SolanaPanelTone.Green,
            active = walletState.hasStoredAuthorization,
          ),
          SolanaBackendLink(
            label = "Gateway Runtime",
            state = if (isConnected) "Online" else "Optional",
            detail = statusText,
            tone = SolanaPanelTone.Purple,
            active = isConnected,
          ),
          SolanaBackendLink(
            label = "Mainnet RPC",
            state = if (balanceSnapshot != null) "Live" else "Pending",
            detail = balanceStatusText,
            tone = SolanaPanelTone.Orange,
            active = balanceSnapshot != null,
          ),
          SolanaBackendLink(
            label = "Convex User",
            state =
              when {
                convexRegisteredUser != null -> "Synced"
                convexConfigured -> "Configured"
                else -> "Missing"
              },
            detail =
              convexRegisteredUser?.let { user ->
                "Wallet ${user.walletAddress.take(4)}…${user.walletAddress.takeLast(4)} linked to Convex."
              } ?: convexStatusText,
            tone = SolanaPanelTone.Green,
            active = convexRegisteredUser != null,
          ),
        ),
      tone = SolanaPanelTone.Purple,
    )

    if (!liveMinerVisible || showPlanner) {
      SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
      SolanaSectionLabel("ORE Round Model", tone = SolanaPanelTone.Purple)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        SolanaMetricTile(label = "Grid", value = "5x5", tone = SolanaPanelTone.Green, modifier = Modifier.weight(1f))
        SolanaMetricTile(label = "Round", value = "60s", tone = SolanaPanelTone.Purple, modifier = Modifier.weight(1f))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        SolanaMetricTile(label = "Motherlode", value = "1/625", tone = SolanaPanelTone.Orange, modifier = Modifier.weight(1f))
        SolanaMetricTile(label = "Starter Bankroll", value = "0.5-1 SOL", tone = SolanaPanelTone.Green, modifier = Modifier.weight(1f))
      }
      Text(
        "Each minute one block wins. SOL on the 24 losing blocks is redistributed to miners on the winning block, and the ORE reward plus any Motherlode bonus follow that round’s winners.",
        style = mobileCallout,
        color = mobileText,
      )
      }

      SolanaPanel(
        modifier = Modifier.fillMaxWidth(),
        tone = if (walletState.hasStoredAuthorization) SolanaPanelTone.Green else SolanaPanelTone.Orange,
      ) {
        SolanaSectionLabel("Wallet Prep", tone = if (walletState.hasStoredAuthorization) SolanaPanelTone.Green else SolanaPanelTone.Orange)
        Text(
          walletState.authorizedAddress?.let {
            "Connected wallet: ${it.take(4)}…${it.takeLast(4)}"
          } ?: "Connect the Seeker wallet you intend to use for ORE mainnet before opening the miner.",
          style = mobileCallout,
          color = mobileText,
        )
        Text(
          walletState.statusText,
          style = mobileCaption1,
          color = if (walletState.errorText != null) mobileDanger else mobileTextSecondary,
        )
        HorizontalDivider(color = mobileBorder.copy(alpha = 0.5f))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          SolanaMetricTile(
            label = "SOL Balance",
            value = balanceSnapshot?.sol?.let { "${formatOrePlanNumber(it, digits = 4)} SOL" } ?: "--",
            tone = if (walletReadyForOre) SolanaPanelTone.Green else SolanaPanelTone.Orange,
            modifier = Modifier.weight(1f),
          )
          SolanaMetricTile(
            label = "RPC",
            value = shortRpcLabel(BuildConfig.DEFAULT_SOLANA_RPC_URL),
            tone = SolanaPanelTone.Purple,
            modifier = Modifier.weight(1f),
          )
        }
        Text(
          balanceStatusText,
          style = mobileCaption1,
          color = if (walletReadyForOre) mobileSuccess else mobileTextSecondary,
        )
        Text(
          "Planning stays local, but the actual deploy and claim flow now runs through the official ORE miner embedded below instead of kicking you out to a browser.",
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          Button(
            onClick = { activity?.let(viewModel::connectSolanaWallet) },
            enabled = activity != null && !walletState.isBusy,
            modifier = Modifier.weight(1f).height(46.dp),
            shape = RoundedCornerShape(4.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
            border = BorderStroke(1.dp, mobileSuccess),
          ) {
            Text(
              if (walletState.hasStoredAuthorization) "Reconnect Wallet" else "Connect Wallet",
              style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
            )
          }
          Button(
            onClick = {
              walletAddress.takeIf { it.isNotBlank() }?.let { copyToClipboard(context, it) }
              liveMinerVisible = true
              showPlanner = false
            },
            enabled = canContinueToMiner,
            modifier = Modifier.weight(1f).height(46.dp),
            shape = RoundedCornerShape(4.dp),
            colors = ButtonDefaults.buttonColors(containerColor = mobileRuntimePanelPurple, contentColor = mobileAccent),
            border = BorderStroke(1.dp, mobileAccent),
          ) {
            Text("Load Official Miner", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
          }
        }
      }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Green) {
      SolanaSectionLabel("Round Planner")
      Text(
        "Use this to size one ORE round before loading the official miner. The planner stays local, while the live mining session below stays on mainnet.",
        style = mobileCallout,
        color = mobileText,
      )
      OutlinedTextField(
        value = amountPerBlockInput,
        onValueChange = { amountPerBlockInput = it },
        label = { Text("SOL per block", style = mobileCaption1, color = mobileTextSecondary) },
        placeholder = { Text("0.01", style = mobileBody, color = mobileTextTertiary) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        textStyle = mobileBody.copy(color = mobileText, fontWeight = FontWeight.Medium),
        shape = RoundedCornerShape(6.dp),
        colors = oreOutlinedColors(),
      )
      OutlinedTextField(
        value = occupiedBlocksInput,
        onValueChange = { occupiedBlocksInput = it },
        label = { Text("Blocks occupied", style = mobileCaption1, color = mobileTextSecondary) },
        placeholder = { Text("5", style = mobileBody, color = mobileTextTertiary) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = mobileBody.copy(color = mobileText, fontWeight = FontWeight.Medium),
        shape = RoundedCornerShape(6.dp),
        colors = oreOutlinedColors(),
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        SolanaMetricTile(
          label = "Total SOL",
          value = plan.totalDeploymentSol?.let { formatOrePlanNumber(it) } ?: "N/A",
          tone = SolanaPanelTone.Green,
          modifier = Modifier.weight(1f),
        )
        SolanaMetricTile(
          label = "Coverage",
          value = plan.winningCoveragePct?.let(::formatOreCoverage) ?: "N/A",
          tone = SolanaPanelTone.Purple,
          modifier = Modifier.weight(1f),
        )
      }
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(4.dp),
        color = mobileCodeBg,
        border = BorderStroke(1.dp, mobileBorder),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          Text("STRATEGY ${plan.strategyLabel.uppercase()}", style = mobileCaption2, color = mobileAccent)
          Text(plan.strategySummary, style = mobileCallout, color = mobileText)
          Text(plan.riskSummary, style = mobileCaption1, color = mobileWarning)
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(
          onClick = {
            copyToClipboard(
              context = context,
              value =
                buildString {
                  append("ORE v2 round plan\n")
                  append("SOL per block: ${amountPerBlockInput.trim()}\n")
                  append("Blocks: ${occupiedBlocksInput.trim()}\n")
                  append("Total SOL: ${plan.totalDeploymentSol?.let { formatOrePlanNumber(it) } ?: "N/A"}\n")
                  append("Coverage: ${plan.winningCoveragePct?.let(::formatOreCoverage) ?: "N/A"}\n")
                  append("Strategy: ${plan.strategyLabel}")
                },
            )
          },
          modifier = Modifier.weight(1f).height(46.dp),
          shape = RoundedCornerShape(4.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileTextSecondary),
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Text("Copy Plan", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = {
            walletAddress.takeIf { it.isNotBlank() }?.let { copyToClipboard(context, it) }
            liveMinerVisible = true
            showPlanner = false
          },
          enabled = canContinueToMiner,
          modifier = Modifier.weight(1f).height(46.dp),
          shape = RoundedCornerShape(4.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
          border = BorderStroke(1.dp, mobileSuccess),
        ) {
          Text("Start In-App Miner", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Orange) {
      SolanaSectionLabel("Mainnet Checklist", tone = SolanaPanelTone.Orange)
      Text(
        "1. Connect the Seeker wallet here.\n2. Confirm the wallet has live SOL on mainnet.\n3. Open the official miner.\n4. If the miner prompts again, reconnect the same wallet address there before deploying SOL.",
        style = mobileCallout,
        color = mobileText,
      )
      HorizontalDivider(color = mobileBorder.copy(alpha = 0.5f))
      Text(
        "Risk: 24 of 25 blocks lose each round. Most rounds are losses. Treat this as active bankroll risk, not passive yield.",
        style = mobileCaption1,
        color = mobileDanger,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(
          onClick = {
            walletAddress.takeIf { it.isNotBlank() }?.let { copyToClipboard(context, it) }
          },
          enabled = hasWalletAddress,
          modifier = Modifier.weight(1f).height(44.dp),
          shape = RoundedCornerShape(4.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileRuntimePanelPurple, contentColor = mobileAccent),
          border = BorderStroke(1.dp, mobileAccent),
        ) {
          Text("Copy Wallet", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = {
            walletAddress.takeIf { it.isNotBlank() }?.let { copyToClipboard(context, it) }
            liveMinerVisible = true
            showPlanner = false
          },
          enabled = canContinueToMiner,
          modifier = Modifier.weight(1f).height(44.dp),
          shape = RoundedCornerShape(4.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileTextSecondary),
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Text("Show Miner", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
    }
    }

    if (liveMinerVisible) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(
          onClick = { showPlanner = !showPlanner },
          modifier = Modifier.weight(1f).height(44.dp),
          shape = RoundedCornerShape(4.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileTextSecondary),
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Text(if (showPlanner) "Hide Planner" else "Show Planner", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = { liveMinerVisible = false },
          modifier = Modifier.weight(1f).height(44.dp),
          shape = RoundedCornerShape(4.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileRuntimePanelPurple, contentColor = mobileAccent),
          border = BorderStroke(1.dp, mobileAccent),
        ) {
          Text("Hide Miner", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
      EmbeddedOreMinerPanel(
        walletAddress = walletAddress,
        onOpenExternalFallback = { launchExternalView(context, oreMinerUrl) },
      )
    }

    if (!liveMinerVisible || showPlanner) {
      SolanaTerminalSurface(modifier = Modifier.fillMaxWidth()) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          Text("GATEWAY STATUS", style = mobileCaption2, color = mobileAccent)
          Text(statusText, style = mobileBody.copy(fontWeight = FontWeight.Medium), color = mobileText)
          Text(
            "Gateway is optional here. ORE mining now stays inside this tab through the official miner WebView, with external open kept only as a fallback.",
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
        }
      }
    }
  }
}

@Composable
private fun EmbeddedOreMinerPanel(
  walletAddress: String,
  onOpenExternalFallback: () -> Unit,
) {
  val context = LocalContext.current
  val webViewRef = remember { mutableStateOf<WebView?>(null) }
  var currentUrl by remember { mutableStateOf(oreMinerUrl) }
  var pageLoading by remember { mutableStateOf(true) }
  var pageStatusText by remember {
    mutableStateOf("Loading the official ORE miner inside SolanaOS…")
  }

  DisposableEffect(Unit) {
    onDispose {
      webViewRef.value?.apply {
        stopLoading()
        destroy()
      }
      webViewRef.value = null
    }
  }

  SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
    SolanaSectionLabel("Embedded Miner", tone = SolanaPanelTone.Purple)
    Text(
      "This is the official ORE miner loaded inside the Android app. If the site needs a wallet deep link or another app intent, Android will hand that specific request out and return here.",
      style = mobileCallout,
      color = mobileText,
    )
    if (walletAddress.isNotBlank()) {
      Text(
        "Prepared wallet: ${walletAddress.take(4)}…${walletAddress.takeLast(4)}",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    }
    Text(
      pageStatusText,
      style = mobileCaption1,
      color = if (pageLoading) mobileAccent else mobileTextSecondary,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      Button(
        onClick = { webViewRef.value?.goBack() },
        enabled = webViewRef.value?.canGoBack() == true,
        modifier = Modifier.weight(1f).height(42.dp),
        shape = RoundedCornerShape(4.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileTextSecondary),
        border = BorderStroke(1.dp, mobileBorder),
      ) {
        Text("Back", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
      }
      Button(
        onClick = { webViewRef.value?.reload() },
        modifier = Modifier.weight(1f).height(42.dp),
        shape = RoundedCornerShape(4.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileRuntimePanelPurple, contentColor = mobileAccent),
        border = BorderStroke(1.dp, mobileAccent),
      ) {
        Text("Reload", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
      }
      Button(
        onClick = onOpenExternalFallback,
        modifier = Modifier.weight(1f).height(42.dp),
        shape = RoundedCornerShape(4.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
        border = BorderStroke(1.dp, mobileSuccess),
      ) {
        Text("External", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
      }
    }
    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(6.dp),
      color = mobileCodeBg,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      AndroidView(
        modifier = Modifier.fillMaxWidth().height(720.dp),
        factory = { viewContext ->
          WebView(viewContext).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.setSupportZoom(false)
            settings.userAgentString = "${settings.userAgentString} SolanaOS-Android-ORE/1.0"
            webChromeClient =
              object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, newProgress: Int) {
                  pageLoading = newProgress in 0..99
                  if (pageLoading) {
                    pageStatusText = "Loading miner… $newProgress%"
                  }
                }
              }
            webViewClient =
              object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                  val target = request.url ?: return false
                  val scheme = target.scheme?.lowercase().orEmpty()
                  if (scheme == "http" || scheme == "https") {
                    return false
                  }
                  return openOreExternalIntent(context, target) { errorText ->
                    pageStatusText = errorText
                  }
                }

                override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                  pageLoading = true
                  currentUrl = url ?: oreMinerUrl
                  pageStatusText = "Opening ${currentUrl.toUri().host ?: currentUrl}…"
                }

                override fun onPageFinished(view: WebView, url: String?) {
                  pageLoading = false
                  currentUrl = url ?: currentUrl
                  pageStatusText = "Official miner live in-app."
                }

                override fun onReceivedError(
                  view: WebView,
                  request: WebResourceRequest,
                  error: WebResourceError,
                ) {
                  if (!request.isForMainFrame) return
                  pageLoading = false
                  pageStatusText = error.description?.toString() ?: "Official miner failed to load."
                }
              }
            loadUrl(oreMinerUrl)
            webViewRef.value = this
          }
        },
        update = { view ->
          webViewRef.value = view
          if (view.url.isNullOrBlank()) {
            view.loadUrl(oreMinerUrl)
          }
        },
      )
    }
  }
}

@Composable
private fun oreOutlinedColors() =
  OutlinedTextFieldDefaults.colors(
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    disabledTextColor = mobileTextTertiary,
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurface,
    disabledContainerColor = mobileSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    cursorColor = mobileAccent,
    focusedLabelColor = mobileAccent,
    unfocusedLabelColor = mobileTextSecondary,
    focusedPlaceholderColor = mobileTextTertiary,
    unfocusedPlaceholderColor = mobileTextTertiary,
  )

private fun copyToClipboard(context: Context, value: String) {
  val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
  clipboard.setPrimaryClip(ClipData.newPlainText("ore-plan", value))
}

private fun launchExternalView(context: Context, url: String) {
  context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

private fun openOreExternalIntent(
  context: Context,
  uri: Uri,
  onFailure: (String) -> Unit,
): Boolean {
  return try {
    val intent =
      if (uri.scheme.equals("intent", ignoreCase = true)) {
        Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
      } else {
        Intent(Intent.ACTION_VIEW, uri)
      }
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (_: ActivityNotFoundException) {
    onFailure("No app can open ${uri.scheme ?: "that link"} yet. Use External if the official miner needs a browser handoff.")
    true
  } catch (_: Throwable) {
    onFailure("Unable to open ${uri.scheme ?: "the requested"} link. Use External as a fallback.")
    true
  }
}

private fun shortRpcLabel(url: String): String {
  val trimmed = url.trim()
  if (trimmed.isBlank()) return "Missing"
  return when {
    trimmed.contains("solanatracker", ignoreCase = true) -> "Tracker"
    trimmed.contains("helius", ignoreCase = true) -> "Helius"
    trimmed.contains("mainnet-beta.solana.com", ignoreCase = true) -> "Solana"
    else -> "Custom"
  }
}

private fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }
