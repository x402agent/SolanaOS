package ai.openclaw.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.nanoSolanaHubUrl
import ai.openclaw.app.grok.GrokSearchReply
import ai.openclaw.app.nanoSolanaBrandName
import ai.openclaw.app.solana.SolanaTrackerMarketToken
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.delay

private enum class StatusVisual {
  Connected,
  Connecting,
  Warning,
  Error,
  Offline,
}

@Composable
fun PostOnboardingTabs(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  var activeTab by
    rememberSaveable {
      mutableStateOf(if (viewModel.hasStartupChatAgent) AppHomeTab.Chat else AppHomeTab.Connect)
    }
  val requestedTab by viewModel.homeTabRequest.collectAsState()

  LaunchedEffect(requestedTab) {
    val tab = requestedTab ?: return@LaunchedEffect
    activeTab = tab
    viewModel.consumeHomeTabRequest()
  }

  // Stop TTS when user navigates away from voice tab
  LaunchedEffect(activeTab) {
    viewModel.setVoiceScreenActive(activeTab == AppHomeTab.Voice)
  }

  val statusText by viewModel.statusText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val grokConfigured by viewModel.grokConfigured.collectAsState()
  val grokSearchBusy by viewModel.grokSearchBusy.collectAsState()
  val grokSearchResult by viewModel.grokSearchResult.collectAsState()
  val grokStatusText by viewModel.grokStatusText.collectAsState()
  val solanaTrackerTrendingTokens by viewModel.solanaTrackerTrendingTokens.collectAsState()
  val solanaTrackerTickerStatusText by viewModel.solanaTrackerTickerStatusText.collectAsState()
  var searchOpen by rememberSaveable { mutableStateOf(false) }
  var searchQuery by rememberSaveable { mutableStateOf("") }
  var globalUseWebSearch by rememberSaveable { mutableStateOf(true) }
  var globalUseXSearch by rememberSaveable { mutableStateOf(true) }

  LaunchedEffect(activeTab) {
    if (activeTab == AppHomeTab.Chat) {
      searchOpen = false
    }
  }

  val statusVisual =
    remember(statusText, isConnected) {
      val lower = statusText.lowercase()
      when {
        isConnected -> StatusVisual.Connected
        lower.contains("connecting") || lower.contains("reconnecting") -> StatusVisual.Connecting
        lower.contains("pairing") || lower.contains("approval") || lower.contains("auth") -> StatusVisual.Warning
        lower.contains("error") || lower.contains("failed") -> StatusVisual.Error
        else -> StatusVisual.Offline
      }
    }

  val density = LocalDensity.current
  val imeVisible = WindowInsets.ime.getBottom(density) > 0
  val hideBottomTabBar = (activeTab == AppHomeTab.Chat || activeTab == AppHomeTab.Grok) && imeVisible

  Scaffold(
    modifier = modifier,
    containerColor = Color.Transparent,
    contentWindowInsets = WindowInsets(0, 0, 0, 0),
    topBar = {
      Column {
        TopStatusBar(
          statusText = statusText,
          statusVisual = statusVisual,
          activeTab = activeTab,
          compact = activeTab == AppHomeTab.Chat,
          searchOpen = searchOpen,
          onToggleSearch = { searchOpen = !searchOpen },
        )
        SolanaTrendingTicker(
          tokens = solanaTrackerTrendingTokens,
          statusText = solanaTrackerTickerStatusText,
          onOpenToken = { token ->
            viewModel.openSolanaTrackerToken(token.mint)
            activeTab = AppHomeTab.Dex
          },
        )
        AnimatedVisibility(
          visible = searchOpen,
          enter = fadeIn() + slideInVertically { -it / 3 },
          exit = fadeOut() + slideOutVertically { -it / 4 },
        ) {
          GlobalGrokSearchTray(
            query = searchQuery,
            onQueryChange = { searchQuery = it },
            configured = grokConfigured,
            busy = grokSearchBusy,
            statusText = grokStatusText,
            result = grokSearchResult,
            useWebSearch = globalUseWebSearch,
            useXSearch = globalUseXSearch,
            onToggleWebSearch = { globalUseWebSearch = !globalUseWebSearch },
            onToggleXSearch = { globalUseXSearch = !globalUseXSearch },
            onSearch = {
              viewModel.runGrokSearch(
                prompt = searchQuery,
                useWebSearch = globalUseWebSearch,
                useXSearch = globalUseXSearch,
                enableImageUnderstanding = false,
              )
            },
            onOpenGrok = { activeTab = AppHomeTab.Grok },
            onClear = {
              searchQuery = ""
              viewModel.clearGrokSearchResult()
              searchOpen = false
            },
          )
        }
      }
    },
    bottomBar = {
      AnimatedVisibility(
        visible = !hideBottomTabBar,
        enter = fadeIn() + slideInVertically { it / 3 },
        exit = fadeOut() + slideOutVertically { it / 2 },
      ) {
        BottomTabBar(
          activeTab = activeTab,
          onSelect = { activeTab = it },
        )
      }
    },
  ) { innerPadding ->
    Box(
      modifier =
        Modifier
          .fillMaxSize()
          .padding(innerPadding)
          .consumeWindowInsets(innerPadding),
    ) {
      SolanaRuntimeBackground {
        AnimatedContent(
          targetState = activeTab,
          transitionSpec = {
            val movingForward = targetState.ordinal >= initialState.ordinal
            (
              fadeIn() +
                scaleIn(initialScale = 0.985f) +
                slideInHorizontally { fullWidth -> if (movingForward) fullWidth / 10 else -fullWidth / 10 }
              )
              .togetherWith(
                fadeOut() +
                  scaleOut(targetScale = 0.992f) +
                  slideOutHorizontally { fullWidth -> if (movingForward) -fullWidth / 14 else fullWidth / 14 }
              )
          },
          label = "home_tab_transition",
        ) { tab ->
          when (tab) {
            AppHomeTab.Connect -> ConnectTabScreen(viewModel = viewModel)
            AppHomeTab.Solana ->
              SolanaKitScreen(
                viewModel = viewModel,
                onOpenChat = { activeTab = AppHomeTab.Chat },
                onOpenConnect = { activeTab = AppHomeTab.Connect },
              )
            AppHomeTab.Dex -> DexTabScreen(viewModel = viewModel)
            AppHomeTab.Grok -> GrokTabScreen(viewModel = viewModel)
            AppHomeTab.Chat -> ChatSheet(viewModel = viewModel)
            AppHomeTab.Arcade -> ArcadeTabScreen(viewModel = viewModel)
            AppHomeTab.Voice -> VoiceTabScreen(viewModel = viewModel)
            AppHomeTab.Ore -> OreMinerTabScreen(viewModel = viewModel)
            AppHomeTab.Screen -> ScreenTabScreen(viewModel = viewModel)
            AppHomeTab.Settings -> SettingsSheet(viewModel = viewModel)
          }
        }
      }
    }
  }
}

@Composable
private fun ScreenTabScreen(viewModel: MainViewModel) {
  val screenHubUrl = nanoSolanaHubUrl
  val isConnected by viewModel.isConnected.collectAsState()
  val isNodeConnected by viewModel.isNodeConnected.collectAsState()
  val statusText by viewModel.statusText.collectAsState()
  val serverName by viewModel.serverName.collectAsState()
  val remoteAddress by viewModel.remoteAddress.collectAsState()
  val canvasUrl by viewModel.canvasCurrentUrl.collectAsState()
  val canvasA2uiHydrated by viewModel.canvasA2uiHydrated.collectAsState()
  val canvasRehydratePending by viewModel.canvasRehydratePending.collectAsState()
  val canvasRehydrateErrorText by viewModel.canvasRehydrateErrorText.collectAsState()
  val isA2uiUrl = canvasUrl?.contains("/__openclaw__/a2ui/") == true
  val isHubFallbackUrl = canvasUrl == screenHubUrl
  val showingHubFallback = isHubFallbackUrl && !isConnected && !isNodeConnected
  val showRestoreCta =
    isConnected &&
      isNodeConnected &&
      (canvasUrl.isNullOrBlank() || isHubFallbackUrl || (isA2uiUrl && !canvasA2uiHydrated))
  val canvasLive = !canvasUrl.isNullOrBlank() && (!isA2uiUrl || canvasA2uiHydrated)
  val webViewAlpha by
    animateFloatAsState(
      targetValue =
        when {
          canvasLive -> 1f
          canvasRehydratePending -> 0.74f
          canvasUrl.isNullOrBlank() -> 0.26f
          else -> 0.56f
        },
      label = "canvas_alpha",
    )
  val restoreCtaText =
    when {
      canvasRehydratePending -> "Restore requested. Waiting for agent…"
      !canvasRehydrateErrorText.isNullOrBlank() -> canvasRehydrateErrorText!!
      else -> "Canvas reset. Tap to restore dashboard."
    }
  val centerTitle =
    when {
      canvasRehydratePending -> "RESTORING CANVAS"
      !canvasRehydrateErrorText.isNullOrBlank() -> "RESTORE FAILED"
      canvasUrl.isNullOrBlank() -> "WAITING FOR RUNTIME HTML"
      isA2uiUrl && !canvasA2uiHydrated -> "HYDRATING A2UI"
      else -> "CANVAS LIVE"
    }
  val centerBody =
    when {
      canvasRehydratePending ->
        "The gateway has accepted a restore request. This surface will fade fully in as soon as the backend republishes the runtime page."
      !canvasRehydrateErrorText.isNullOrBlank() ->
        canvasRehydrateErrorText ?: "The restore request failed."
      canvasUrl.isNullOrBlank() ->
        "No runtime page has been pushed into the WebView yet. Pair the gateway, then let the backend publish the scaffold or dashboard surface."
      isA2uiUrl && !canvasA2uiHydrated ->
        "The runtime page is loaded, but the A2UI bridge is still replaying state into the scaffold. This usually resolves once the node finishes rehydration."
      else -> "The runtime surface is live."
    }

  Box(modifier = Modifier.fillMaxSize()) {
    CanvasScreen(
      viewModel = viewModel,
      modifier =
        Modifier
          .fillMaxSize()
          .graphicsLayer(alpha = webViewAlpha),
    )

    AnimatedVisibility(
      visible = !canvasLive,
      enter = fadeIn() + scaleIn(initialScale = 0.96f),
      exit = fadeOut() + scaleOut(targetScale = 0.985f),
    ) {
      SolanaPanel(
        modifier = Modifier.align(Alignment.Center).padding(horizontal = 20.dp),
        tone =
          when {
            !canvasRehydrateErrorText.isNullOrBlank() -> SolanaPanelTone.Orange
            canvasRehydratePending -> SolanaPanelTone.Green
            else -> SolanaPanelTone.Purple
          },
      ) {
        SolanaSectionLabel(
          text = "Screen Surface",
          tone =
            when {
              !canvasRehydrateErrorText.isNullOrBlank() -> SolanaPanelTone.Orange
              canvasRehydratePending -> SolanaPanelTone.Green
              else -> SolanaPanelTone.Purple
            },
        )
        Text(
          text = centerTitle,
          style = mobileTitle2.copy(fontWeight = FontWeight.ExtraBold),
          color = mobileText,
        )
        Text(
          text = centerBody,
          style = mobileCallout,
          color = mobileTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          SolanaStatusPill(
            label = if (isConnected) "Gateway Online" else "Gateway Offline",
            active = isConnected,
            tone = SolanaPanelTone.Green,
          )
          SolanaStatusPill(
            label = if (isNodeConnected) "Node Attached" else "Node Waiting",
            active = isNodeConnected,
            tone = SolanaPanelTone.Purple,
          )
        }
        Text(
          text = listOfNotNull(serverName, remoteAddress).joinToString(" • ").ifBlank { statusText },
          style = mobileCaption1,
          color = mobileTextTertiary,
        )
        if (showRestoreCta) {
          Button(
            onClick = {
              if (canvasRehydratePending) return@Button
              viewModel.requestCanvasRehydrate(source = "screen_tab_cta")
            },
            enabled = !canvasRehydratePending,
            colors =
              ButtonDefaults.buttonColors(
                containerColor = mobileAccent,
                contentColor = mobileText,
                disabledContainerColor = mobileAccent.copy(alpha = 0.42f),
                disabledContentColor = mobileTextTertiary,
              ),
            shape = RoundedCornerShape(12.dp),
          ) {
            Text(
              text = if (canvasRehydratePending) "Restoring…" else "Restore Dashboard",
              style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
            )
          }
        }
      }
    }

    if (!showingHubFallback) {
      SolanaBackplaneCard(
        title = "Screen Sync",
        subtitle = "The Screen tab stays in sync with the paired workspace so the live dashboard can restore cleanly on mobile.",
        links =
          listOf(
            SolanaBackendLink(
              label = "Workspace",
              state = if (isConnected) "Online" else "Offline",
              detail = listOfNotNull(serverName, statusText).joinToString(" • "),
              tone = SolanaPanelTone.Green,
              active = isConnected,
            ),
            SolanaBackendLink(
              label = "Device Link",
              state = if (isNodeConnected) "Attached" else "Waiting",
              detail = "The paired device supplies the live dashboard state for this screen.",
              tone = SolanaPanelTone.Purple,
              active = isNodeConnected,
            ),
            SolanaBackendLink(
              label = "Dashboard",
              state =
                when {
                  isHubFallbackUrl -> "Hub"
                  canvasUrl.isNullOrBlank() -> "Empty"
                  else -> "Loaded"
                },
              detail =
                when {
                  isHubFallbackUrl -> "Seeker hub is loaded as the local fallback surface for this tab."
                  canvasUrl.isNullOrBlank() -> "No live dashboard has been restored yet."
                  else -> "A live dashboard is ready on this screen."
                },
              tone = SolanaPanelTone.Orange,
              active = !canvasUrl.isNullOrBlank(),
            ),
            SolanaBackendLink(
              label = "Live Updates",
              state = if (canvasA2uiHydrated) "Hydrated" else if (canvasRehydratePending) "Restoring" else "Waiting",
              detail = canvasRehydrateErrorText ?: "Interactive updates stay attached so the dashboard can restore cleanly.",
              tone = SolanaPanelTone.Purple,
              active = canvasA2uiHydrated || canvasRehydratePending,
            ),
          ),
        modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = 16.dp, vertical = 20.dp),
        tone = SolanaPanelTone.Purple,
      )
    }

    if (showRestoreCta && canvasLive) {
      Surface(
        onClick = {
          if (canvasRehydratePending) return@Surface
          viewModel.requestCanvasRehydrate(source = "screen_tab_chip")
        },
        modifier = Modifier.align(Alignment.TopCenter).padding(horizontal = 16.dp, vertical = 16.dp),
        shape = RoundedCornerShape(12.dp),
        color = mobileSurface.copy(alpha = 0.9f),
        border = BorderStroke(1.dp, mobileBorder),
        shadowElevation = 4.dp,
      ) {
        Text(
          text = restoreCtaText,
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
          style = mobileCallout.copy(fontWeight = FontWeight.Medium),
          color = mobileText,
        )
      }
    }
  }
}

@Composable
private fun TopStatusBar(
  statusText: String,
  statusVisual: StatusVisual,
  activeTab: AppHomeTab,
  compact: Boolean,
  searchOpen: Boolean,
  onToggleSearch: () -> Unit,
) {
  val safeInsets = WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
  val timeText by
    produceState(initialValue = formatTopBarTime()) {
      while (true) {
        value = formatTopBarTime()
        delay(30_000L)
      }
    }

  val (chipBg, chipDot, chipText, chipBorder) =
    when (statusVisual) {
      StatusVisual.Connected ->
        listOf(
          mobileSuccessSoft,
          mobileSuccess,
          mobileSuccess,
          Color(0xFFCFEBD8),
        )
      StatusVisual.Connecting ->
        listOf(
          mobileAccentSoft,
          mobileAccent,
          mobileAccent,
          Color(0xFFD5E2FA),
        )
      StatusVisual.Warning ->
        listOf(
          mobileWarningSoft,
          mobileWarning,
          mobileWarning,
          Color(0xFFEED8B8),
        )
      StatusVisual.Error ->
        listOf(
          mobileDangerSoft,
          mobileDanger,
          mobileDanger,
          Color(0xFFF3C8C8),
        )
      StatusVisual.Offline ->
        listOf(
          mobileSurface,
          mobileTextTertiary,
          mobileTextSecondary,
          mobileBorder,
        )
    }

  Surface(
    modifier = Modifier.fillMaxWidth().windowInsetsPadding(safeInsets),
    color = Color.Transparent,
    shadowElevation = 0.dp,
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = if (compact) 8.dp else 10.dp),
      verticalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 8.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Text(
          text = timeText,
          style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
          color = mobileSuccess,
        )
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Surface(
            onClick = onToggleSearch,
            shape = RoundedCornerShape(4.dp),
            color = if (searchOpen) mobileAccentSoft else Color.Transparent,
            border = BorderStroke(1.dp, if (searchOpen) mobileAccent else mobileBorder),
          ) {
            Box(modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
              Text(
                text = "⌕",
                style = mobileTitle2.copy(fontWeight = FontWeight.Bold),
                color = if (searchOpen) mobileAccent else mobileSuccess,
              )
            }
          }
          Surface(
            modifier = Modifier.size(width = 22.dp, height = 12.dp),
            shape = RoundedCornerShape(2.dp),
            color = Color.Transparent,
            border = BorderStroke(1.dp, mobileSuccess.copy(alpha = 0.72f)),
          ) {
            Box(modifier = Modifier.padding(horizontal = 2.dp, vertical = 2.dp)) {
              Surface(
                modifier = Modifier.align(Alignment.CenterStart).size(width = 14.dp, height = 6.dp),
                shape = RoundedCornerShape(1.dp),
                color = mobileSuccess,
              ) {}
            }
          }
          Surface(
            modifier = Modifier.size(6.dp),
            color = chipDot,
            shape = RoundedCornerShape(1.dp),
          ) {}
        }
      }

      if (compact) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween,
        ) {
          Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
              text = activeTab.label.uppercase(Locale.US),
              style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
              color = mobileAccent,
            )
            Text(
              text = nanoSolanaBrandName.uppercase(),
              style = mobileCaption2,
              color = mobileTextSecondary,
            )
          }
          Surface(
            shape = RoundedCornerShape(2.dp),
            color = chipBg,
            border = BorderStroke(1.dp, chipBorder),
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
              horizontalArrangement = Arrangement.spacedBy(6.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Surface(
                modifier = Modifier.size(6.dp),
                color = chipDot,
                shape = RoundedCornerShape(1.dp),
              ) {}
              Text(
                text = statusText.trim().ifEmpty { "Offline" }.uppercase(Locale.US),
                style = mobileCaption2,
                color = chipText,
                maxLines = 1,
              )
            }
          }
        }
      } else {
        Text(
          text = activeTab.label.uppercase(Locale.US),
          modifier = Modifier.align(Alignment.CenterHorizontally),
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
          color = mobileAccent,
        )

        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween,
        ) {
          Text(
            text = nanoSolanaBrandName.uppercase(),
            style = mobileTitle2,
            color = mobileText,
          )
          Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(6.dp),
          ) {
            Text(
              text = "THE SOLANA COMPUTER",
              style = mobileCaption2,
              color = mobileAccent,
            )
            Surface(
              shape = RoundedCornerShape(2.dp),
              color = chipBg,
              border = BorderStroke(1.dp, chipBorder),
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
              ) {
                Surface(
                  modifier = Modifier.size(6.dp),
                  color = chipDot,
                  shape = RoundedCornerShape(1.dp),
                ) {}
                Text(
                  text = statusText.trim().ifEmpty { "Offline" }.uppercase(Locale.US),
                  style = mobileCaption2,
                  color = chipText,
                  maxLines = 1,
                )
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun SolanaTrendingTicker(
  tokens: List<SolanaTrackerMarketToken>,
  statusText: String,
  onOpenToken: (SolanaTrackerMarketToken) -> Unit,
) {
  val displayTokens = remember(tokens) { tokens.take(10) }
  val marqueeTokens =
    remember(displayTokens) {
      if (displayTokens.isEmpty()) {
        emptyList()
      } else {
        buildList {
          repeat(3) {
            addAll(displayTokens)
          }
        }
      }
    }

  Surface(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
    color = Color.Transparent,
  ) {
    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(8.dp),
      color = mobileSurface.copy(alpha = 0.9f),
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Text(
          text = "LIVE TRENDS",
          style = mobileCaption2.copy(fontWeight = FontWeight.Bold),
          color = mobileAccent,
        )
        if (marqueeTokens.isEmpty()) {
          Text(
            text = statusText,
            style = mobileCaption1,
            color = mobileTextSecondary,
            maxLines = 1,
          )
        } else {
          Row(
            modifier = Modifier.weight(1f).basicMarquee(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            marqueeTokens.forEach { token ->
              val positiveMove = (token.priceChange24h ?: 0.0) >= 0.0
              Surface(
                onClick = { onOpenToken(token) },
                shape = RoundedCornerShape(6.dp),
                color = mobileSurfaceStrong,
                border = BorderStroke(1.dp, mobileBorderStrong),
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                  horizontalArrangement = Arrangement.spacedBy(8.dp),
                  verticalAlignment = Alignment.CenterVertically,
                ) {
                  Text(
                    text = token.symbol.ifBlank { token.name.ifBlank { "TOKEN" } }.uppercase(Locale.US),
                    style = mobileCaption2.copy(fontWeight = FontWeight.Bold),
                    color = mobileText,
                  )
                  Text(
                    text = formatUsd(token.priceUsd),
                    style = mobileCaption1,
                    color = mobileTextSecondary,
                  )
                  Text(
                    text = formatSignedPercent(token.priceChange24h),
                    style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
                    color = if (positiveMove) mobileSuccess else mobileWarning,
                  )
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun GlobalGrokSearchTray(
  query: String,
  onQueryChange: (String) -> Unit,
  configured: Boolean,
  busy: Boolean,
  statusText: String,
  result: GrokSearchReply?,
  useWebSearch: Boolean,
  useXSearch: Boolean,
  onToggleWebSearch: () -> Unit,
  onToggleXSearch: () -> Unit,
  onSearch: () -> Unit,
  onOpenGrok: () -> Unit,
  onClear: () -> Unit,
) {
  val keyboard = LocalSoftwareKeyboardController.current
  val canSearch = configured && !busy && query.isNotBlank() && (useWebSearch || useXSearch)

  SolanaPanel(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
    tone = SolanaPanelTone.Purple,
  ) {
    SolanaSectionLabel("Global Grok Search", tone = SolanaPanelTone.Purple)
    Text(
      text =
        if (configured) {
          "Run a live Grok search from anywhere in the app and jump into the full workspace when you want more control."
        } else {
          "Grok search is unavailable in this build."
        },
      style = mobileCallout,
      color = mobileTextSecondary,
    )
    OutlinedTextField(
      value = query,
      onValueChange = onQueryChange,
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      shape = RoundedCornerShape(12.dp),
      textStyle = mobileBody.copy(color = mobileText),
      placeholder = {
        Text(
          "Search Solana, Seeker, ORE, Grok, or runtime state…",
          style = mobileBody,
          color = mobileTextTertiary,
        )
      },
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
      keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
      keyboardActions =
        KeyboardActions(
          onSearch = {
            keyboard?.hide()
            if (canSearch) onSearch()
          },
        ),
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(label = "Web Search", active = useWebSearch, tone = SolanaPanelTone.Green)
      SolanaStatusPill(label = "X Search", active = useXSearch, tone = SolanaPanelTone.Purple)
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Button(
        onClick = onToggleWebSearch,
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileSuccessSoft, contentColor = mobileSuccess),
      ) {
        Text(if (useWebSearch) "Web On" else "Web Off", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
      }
      Button(
        onClick = onToggleXSearch,
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
      ) {
        Text(if (useXSearch) "X On" else "X Off", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
      }
      Button(
        onClick = {
          keyboard?.hide()
          onSearch()
        },
        enabled = canSearch,
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileAccent, contentColor = mobileText),
      ) {
        Text(if (busy) "Searching…" else "Search", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
      }
    }
    if (!configured || busy || result != null || statusText.isNotBlank()) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = mobileSurfaceStrong,
        border = BorderStroke(1.dp, mobileBorderStrong),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text(
            text =
              when {
                busy -> "Running Grok search…"
                result != null -> result.content.take(320)
                else -> statusText
              },
            style = mobileCallout,
            color = mobileText,
          )
          if (!result?.citations.isNullOrEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              result!!.citations.take(3).forEach { citation ->
                SolanaStatusPill(label = citation, active = true, tone = SolanaPanelTone.Purple)
              }
            }
          }
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
              onClick = onOpenGrok,
              modifier = Modifier.weight(1f),
              shape = RoundedCornerShape(12.dp),
              colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileText),
              border = BorderStroke(1.dp, mobileBorder),
            ) {
              Icon(
                imageVector = Icons.Default.AutoAwesome,
                contentDescription = null,
                tint = mobileText,
                modifier = Modifier.padding(end = 6.dp),
              )
              Text("Open Grok", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
            }
            Button(
              onClick = onClear,
              modifier = Modifier.weight(1f),
              shape = RoundedCornerShape(12.dp),
              colors = ButtonDefaults.buttonColors(containerColor = mobileSurface, contentColor = mobileTextSecondary),
              border = BorderStroke(1.dp, mobileBorder),
            ) {
              Text("Clear", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
            }
          }
        }
      }
    }
  }
}

@Composable
private fun BottomTabBar(
  activeTab: AppHomeTab,
  onSelect: (AppHomeTab) -> Unit,
) {
  val safeInsets = WindowInsets.navigationBars.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)
  val scrollState = rememberScrollState()

  Box(
    modifier =
      Modifier
        .fillMaxWidth()
        .background(
          Brush.verticalGradient(
            colors =
              listOf(
                Color.Transparent,
                mobileSurface.copy(alpha = 0.58f),
                mobileSurface.copy(alpha = 0.96f),
              ),
          ),
        ),
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        color = mobileSurface.copy(alpha = 0.92f),
        shape = RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp),
        border = BorderStroke(1.dp, mobileBorder),
        shadowElevation = 10.dp,
      ) {
        Row(
          modifier =
            Modifier
              .fillMaxWidth()
              .windowInsetsPadding(safeInsets)
              .horizontalScroll(scrollState)
              .padding(horizontal = 8.dp, vertical = 7.dp),
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          AppHomeTab.entries.forEach { tab ->
            val active = tab == activeTab
            val containerColor by
              animateColorAsState(
                targetValue = if (active) mobileRuntimePanelPurple else Color.Transparent,
                label = "tab_container",
              )
            val borderColor by
              animateColorAsState(
                targetValue = if (active) mobileAccent else mobileBorder.copy(alpha = 0.45f),
                label = "tab_border",
              )
            val iconColor by
              animateColorAsState(
                targetValue = if (active) mobileSuccess else mobileTextTertiary,
                label = "tab_icon",
              )
            val textColor by
              animateColorAsState(
                targetValue = if (active) mobileSuccess else mobileTextSecondary,
                label = "tab_text",
              )
            val tabScale by animateFloatAsState(targetValue = if (active) 1f else 0.965f, label = "tab_scale")
            Surface(
              onClick = { onSelect(tab) },
              modifier =
                Modifier
                  .heightIn(min = 56.dp)
                  .graphicsLayer(scaleX = tabScale, scaleY = tabScale),
              shape = RoundedCornerShape(5.dp),
              color = containerColor,
              border = BorderStroke(1.dp, borderColor),
              shadowElevation = 0.dp,
            ) {
              Column(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(3.dp),
              ) {
                Text(
                  text = tab.glyph,
                  color = iconColor,
                  style = mobileTitle2.copy(fontWeight = FontWeight.Bold),
                )
                Text(
                  text = tab.label.uppercase(Locale.US),
                  color = textColor,
                  style = mobileCaption2.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.Medium),
                )
              }
            }
          }
        }
      }

      Surface(
        modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 4.dp),
        shape = RoundedCornerShape(99.dp),
        color = mobileAccent.copy(alpha = 0.38f),
      ) {
        Box(modifier = Modifier.width(96.dp).height(4.dp))
      }
    }
  }
}

private fun formatTopBarTime(): String =
  LocalTime.now().format(DateTimeFormatter.ofPattern("H:mm"))

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

private fun formatSignedPercent(value: Double?): String =
  value?.let {
    if (it >= 0.0) {
      "+" + String.format(Locale.US, "%.2f%%", it)
    } else {
      String.format(Locale.US, "%.2f%%", it)
    }
  } ?: "--"
