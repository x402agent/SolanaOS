package ai.openclaw.app.ui

import ai.openclaw.app.MainViewModel
import ai.openclaw.app.SolanaTrackerAnalysisResult
import ai.openclaw.app.solana.SolanaTrackerDatastreamEvent
import ai.openclaw.app.solana.SolanaTrackerDatastreamSnapshot
import ai.openclaw.app.solana.SolanaTrackerDexOverview
import ai.openclaw.app.solana.SolanaTrackerHolder
import ai.openclaw.app.solana.SolanaTrackerMarketToken
import ai.openclaw.app.solana.SolanaTrackerOhlcvPoint
import ai.openclaw.app.solana.SolanaTrackerTokenDetail
import ai.openclaw.app.solana.SolanaTrackerTrade
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CurrencyExchange
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class DexBoardMode(val label: String) {
  Latest("Latest"),
  Graduating("Graduating"),
  Graduated("Graduated"),
  Trending("Trending"),
  Board("Board"),
  Search("Search"),
}

private enum class DexSwapSide(val label: String) {
  Buy("Buy"),
  Sell("Sell"),
}

private const val SolMintAddress = "So11111111111111111111111111111111111111112"

@Composable
fun DexTabScreen(viewModel: MainViewModel) {
  val context = LocalContext.current
  val activity = remember(context) { context.findActivity() as? ComponentActivity }
  val walletState by viewModel.mobileWalletState.collectAsState()
  val trackerConfigured by viewModel.solanaTrackerConfigured.collectAsState()
  val trackerStreamAvailable by viewModel.solanaTrackerStreamAvailable.collectAsState()
  val trackerStreamConnected by viewModel.solanaTrackerStreamConnected.collectAsState()
  val trackerDatastreamAvailable by viewModel.solanaTrackerDatastreamAvailable.collectAsState()
  val trackerDatastreamConnected by viewModel.solanaTrackerDatastreamConnected.collectAsState()
  val trackerStatusText by viewModel.solanaTrackerStatusText.collectAsState()
  val trackerStreamStatusText by viewModel.solanaTrackerStreamStatusText.collectAsState()
  val trackerDatastreamStatusText by viewModel.solanaTrackerDatastreamStatusText.collectAsState()
  val trackerRpcSlot by viewModel.solanaTrackerRpcSlot.collectAsState()
  val trackerLiveSlot by viewModel.solanaTrackerLiveSlot.collectAsState()
  val trackerTrending by viewModel.solanaTrackerTrendingTokens.collectAsState()
  val trackerOverview by viewModel.solanaTrackerDexOverview.collectAsState()
  val trackerOverviewBusy by viewModel.solanaTrackerOverviewBusy.collectAsState()
  val trackerOverviewStatusText by viewModel.solanaTrackerOverviewStatusText.collectAsState()
  val trackerTickerStatusText by viewModel.solanaTrackerTickerStatusText.collectAsState()
  val searchBusy by viewModel.solanaTrackerSearchBusy.collectAsState()
  val tokenBusy by viewModel.solanaTrackerTokenBusy.collectAsState()
  val searchResults by viewModel.solanaTrackerSearchResults.collectAsState()
  val selectedToken by viewModel.solanaTrackerSelectedToken.collectAsState()
  val selectedTrades by viewModel.solanaTrackerSelectedTrades.collectAsState()
  val selectedHolders by viewModel.solanaTrackerSelectedHolders.collectAsState()
  val selectedChart by viewModel.solanaTrackerSelectedChart.collectAsState()
  val liveFeed by viewModel.solanaTrackerLiveFeed.collectAsState()
  val focusedFeed by viewModel.solanaTrackerFocusedFeed.collectAsState()
  val liveSnapshot by viewModel.solanaTrackerLiveSnapshot.collectAsState()
  val analysisBusy by viewModel.solanaTrackerAnalysisBusy.collectAsState()
  val analysisStatusText by viewModel.solanaTrackerAnalysisStatusText.collectAsState()
  val analysisResult by viewModel.solanaTrackerAnalysisResult.collectAsState()
  val dexSwapBusy by viewModel.dexSwapBusy.collectAsState()
  val dexSwapQuote by viewModel.dexSwapQuote.collectAsState()
  val dexSwapStatusText by viewModel.dexSwapStatusText.collectAsState()
  val grokConfigured by viewModel.grokConfigured.collectAsState()
  val convexConfigured by viewModel.convexConfigured.collectAsState()

  var boardMode by rememberSaveable { mutableStateOf(DexBoardMode.Latest) }
  var trackerQuery by rememberSaveable { mutableStateOf("") }
  var swapSide by rememberSaveable(selectedToken?.mint) { mutableStateOf(DexSwapSide.Buy) }
  var swapAmount by rememberSaveable(selectedToken?.mint) { mutableStateOf("0.05") }
  var swapSlippage by rememberSaveable(selectedToken?.mint) { mutableStateOf("1.0") }

  val boardTokens =
    when (boardMode) {
      DexBoardMode.Latest -> trackerOverview.latest
      DexBoardMode.Graduating -> trackerOverview.graduating
      DexBoardMode.Graduated -> trackerOverview.graduated
      DexBoardMode.Trending -> trackerTrending
      DexBoardMode.Board, DexBoardMode.Search -> searchResults
    }

  Column(
    modifier =
      Modifier
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 14.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "Live Markets",
      title = "Seeker DEX",
      subtitle = "Track new launches, graduating curves, graduated tokens, trending flow, and focused token detail from Solana Tracker.",
    )

    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      DexStatusChip(label = if (trackerConfigured) "Tracker Ready" else "Tracker Missing", active = trackerConfigured)
      DexStatusChip(label = if (trackerOverviewBusy) "Overview Loading" else "Overview Ready", active = !trackerOverviewBusy)
      DexStatusChip(label = if (trackerStreamConnected) "RPC WS Live" else "RPC WS Idle", active = trackerStreamConnected)
      DexStatusChip(label = if (trackerDatastreamConnected) "Feed Live" else "Feed Idle", active = trackerDatastreamConnected)
      DexStatusChip(label = if (grokConfigured || convexConfigured) "Analysis Ready" else "Analysis Off", active = grokConfigured || convexConfigured)
    }

    DexSectionCard(
      title = "Market Backplane",
      subtitle = "Direct Tracker data when available, with the Convex proxy path kept as fallback.",
      icon = Icons.AutoMirrored.Filled.ShowChart,
    ) {
      Text(
        buildString {
          trackerRpcSlot?.let {
            append("RPC ")
            append(formatCompactInteger(it))
          }
          trackerLiveSlot?.let {
            if (isNotBlank()) append(" • ")
            append("LIVE ")
            append(formatCompactInteger(it))
          }
          if (isBlank()) append("No live slot data yet.")
        },
        style = mobileCallout,
        color = mobileText,
      )
      Text(trackerOverviewStatusText, style = mobileCaption1, color = mobileTextSecondary)
      Text(trackerTickerStatusText, style = mobileCaption1, color = mobileTextSecondary)
      Text(trackerStreamStatusText, style = mobileCaption1, color = mobileTextSecondary)
      Text(trackerDatastreamStatusText, style = mobileCaption1, color = mobileTextSecondary)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(label = "Refresh Overview", emphasis = true, onClick = viewModel::refreshSolanaTrackerOverview)
        FeatureButton(label = "Refresh Trending", onClick = viewModel::refreshSolanaTrackerTrending)
        if (trackerStreamAvailable) {
          FeatureButton(label = "Reconnect RPC", onClick = viewModel::reconnectSolanaTrackerStream)
        }
        if (trackerDatastreamAvailable) {
          FeatureButton(label = "Reconnect Feed", onClick = viewModel::reconnectSolanaTrackerDatastream)
        }
      }
    }

    DexSectionCard(
      title = "Board",
      subtitle = "Latest, graduating, graduated, trending, or direct search.",
      icon = Icons.Default.Search,
    ) {
      OutlinedField(
        value = trackerQuery,
        onValueChange = { trackerQuery = it },
        label = "Symbol, name, or mint",
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FeatureButton(
          label = "Search",
          emphasis = true,
          onClick = {
            boardMode = DexBoardMode.Search
            viewModel.searchSolanaTrackerTokens(trackerQuery)
          },
        )
        FeatureButton(
          label = "Load Board",
          onClick = {
            boardMode = DexBoardMode.Board
            viewModel.refreshSolanaTrackerDexBoard()
          },
        )
      }
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        DexBoardMode.entries.forEach { mode ->
          DexModeChip(label = mode.label, active = boardMode == mode) {
            boardMode = mode
            when (mode) {
              DexBoardMode.Latest, DexBoardMode.Graduating, DexBoardMode.Graduated -> {
                if (trackerOverview.latest.isEmpty()) {
                  viewModel.refreshSolanaTrackerOverview()
                }
              }
              DexBoardMode.Trending -> viewModel.refreshSolanaTrackerTrending()
              DexBoardMode.Board -> viewModel.refreshSolanaTrackerDexBoard()
              DexBoardMode.Search -> if (trackerQuery.isNotBlank()) viewModel.searchSolanaTrackerTokens(trackerQuery)
            }
          }
        }
      }
      Text(trackerStatusText, style = mobileCaption1, color = mobileTextSecondary)
      when {
        (searchBusy || trackerOverviewBusy) && boardTokens.isEmpty() ->
          Text("Loading live token board…", style = mobileCallout, color = mobileTextSecondary)
        boardTokens.isEmpty() ->
          Text("No tokens are loaded in this view yet.", style = mobileCallout, color = mobileTextSecondary)
        else ->
          Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            boardTokens.take(10).forEach { token ->
              DexBoardTokenCard(
                token = token,
                onOpen = {
                  trackerQuery = token.mint
                  viewModel.openSolanaTrackerToken(token.mint)
                },
              )
            }
          }
      }
    }

    if (liveFeed.isNotEmpty()) {
      DexSectionCard(
        title = "Live Feed",
        subtitle = "Recent market events from the global tracker stream.",
        icon = Icons.Default.AutoAwesome,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          liveFeed.takeLast(6).reversed().forEach { event ->
            DexDatastreamEventCard(event = event)
          }
        }
      }
    }

    selectedToken?.let { token ->
      DexSwapCard(
        token = token,
        walletReady = walletState.hasStoredAuthorization,
        walletAddress = walletState.authorizedAddress,
        swapSide = swapSide,
        amount = swapAmount,
        slippage = swapSlippage,
        busy = dexSwapBusy,
        quote = dexSwapQuote,
        statusText = dexSwapStatusText,
        onSwapSideChange = { swapSide = it },
        onAmountChange = { swapAmount = it },
        onSlippageChange = { swapSlippage = it },
        onPreview = {
          val selectedSymbol = token.symbol.ifBlank { token.name.ifBlank { "TOKEN" } }
          val selectedDecimals = token.decimals ?: 6
          val inputMint = if (swapSide == DexSwapSide.Buy) SolMintAddress else token.mint
          val inputSymbol = if (swapSide == DexSwapSide.Buy) "SOL" else selectedSymbol
          val inputDecimals = if (swapSide == DexSwapSide.Buy) 9 else selectedDecimals
          val outputMint = if (swapSide == DexSwapSide.Buy) token.mint else SolMintAddress
          val outputSymbol = if (swapSide == DexSwapSide.Buy) selectedSymbol else "SOL"
          val outputDecimals = if (swapSide == DexSwapSide.Buy) selectedDecimals else 9
          viewModel.previewDexSwap(
            inputMint = inputMint,
            inputSymbol = inputSymbol,
            inputDecimals = inputDecimals,
            outputMint = outputMint,
            outputSymbol = outputSymbol,
            outputDecimals = outputDecimals,
            amountText = swapAmount,
            slippagePercentText = swapSlippage,
          )
        },
        onExecute = {
          val resolvedActivity = activity ?: return@DexSwapCard
          val inputMint = if (swapSide == DexSwapSide.Buy) SolMintAddress else token.mint
          val outputMint = if (swapSide == DexSwapSide.Buy) token.mint else SolMintAddress
          viewModel.executeDexSwap(
            activity = resolvedActivity,
            inputMint = inputMint,
            outputMint = outputMint,
          )
        },
        onClear = viewModel::clearDexSwapQuote,
      )
      DexSelectedTokenCard(
        token = token,
        trades = selectedTrades,
        holders = selectedHolders,
        chart = selectedChart,
        liveSnapshot = liveSnapshot,
        liveEvents = focusedFeed,
        analysisBusy = analysisBusy,
        analysis = analysisResult?.takeIf { it.mint == token.mint },
        analysisStatusText = analysisStatusText,
        grokConfigured = grokConfigured || convexConfigured,
        busy = tokenBusy,
        onRefresh = viewModel::refreshSolanaTrackerSelectedToken,
        onAnalyze = { viewModel.analyzeSolanaTrackerSelectedToken(activity) },
        onCopyMint = { copyToClipboard(context, token.mint) },
      )
    }
  }
}

@Composable
private fun DexSwapCard(
  token: SolanaTrackerTokenDetail,
  walletReady: Boolean,
  walletAddress: String?,
  swapSide: DexSwapSide,
  amount: String,
  slippage: String,
  busy: Boolean,
  quote: ai.openclaw.app.solana.JupiterSwapQuotePreview?,
  statusText: String,
  onSwapSideChange: (DexSwapSide) -> Unit,
  onAmountChange: (String) -> Unit,
  onSlippageChange: (String) -> Unit,
  onPreview: () -> Unit,
  onExecute: () -> Unit,
  onClear: () -> Unit,
) {
  val selectedSymbol = token.symbol.ifBlank { token.name.ifBlank { "TOKEN" } }
  val currentQuoteMatchesToken =
    quote?.let {
      (it.inputMint == SolMintAddress && it.outputMint == token.mint) ||
        (it.inputMint == token.mint && it.outputMint == SolMintAddress)
    } == true
  DexSectionCard(
    title = "Native Swap",
    subtitle = "Live Jupiter quote and wallet submission for $selectedSymbol.",
    icon = Icons.Default.CurrencyExchange,
  ) {
    DexStatusChip(label = if (walletReady) "Wallet Ready" else "Connect Wallet", active = walletReady)
    walletAddress?.let {
      Text("Wallet ${shortTrackerAddress(it)}", style = mobileCaption1, color = mobileTextSecondary)
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      DexSwapSide.entries.forEach { side ->
        DexModeChip(label = side.label, active = swapSide == side) {
          onSwapSideChange(side)
        }
      }
    }
    OutlinedField(
      value = amount,
      onValueChange = onAmountChange,
      label = if (swapSide == DexSwapSide.Buy) "Spend SOL" else "Sell $selectedSymbol",
      keyboardType = KeyboardType.Decimal,
    )
    OutlinedField(
      value = slippage,
      onValueChange = onSlippageChange,
      label = "Slippage %",
      keyboardType = KeyboardType.Decimal,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      FeatureButton(label = if (busy) "Quoting…" else "Preview Quote", emphasis = true, onClick = onPreview)
      FeatureButton(label = if (busy) "Working…" else "Swap", onClick = onExecute)
      if (quote != null) {
        FeatureButton(label = "Clear", onClick = onClear)
      }
    }
    Text(statusText, style = mobileCaption1, color = mobileTextSecondary)
    if (quote != null) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = mobileSurface,
        border = BorderStroke(1.dp, if (currentQuoteMatchesToken) mobileBorder else mobileWarning),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          Text(
            "${quote.inputAmountUi} ${quote.inputSymbol} -> ${quote.outputAmountUi} ${quote.outputSymbol}",
            style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
            color = mobileText,
          )
          Text(
            "Slippage ${quote.slippageBps / 100.0}% • Impact ${formatJupiterImpact(quote.priceImpactPct)} • ${quote.routeCount} routes",
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
          quote.contextSlot?.let {
            Text("Quote slot ${formatCompactInteger(it)}", style = mobileCaption1, color = mobileTextTertiary)
          }
          if (!currentQuoteMatchesToken) {
            Text(
              "This quote was generated for a different token pair. Refresh it before swapping.",
              style = mobileCaption1,
              color = mobileWarning,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun DexSectionCard(
  title: String,
  subtitle: String,
  icon: ImageVector,
  content: @Composable ColumnScope.() -> Unit,
) {
  SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Green) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
      Surface(
        modifier = Modifier.padding(top = 2.dp),
        shape = RoundedCornerShape(4.dp),
        color = mobileRuntimePanelPurple,
        border = BorderStroke(1.dp, mobileAccent),
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = mobileSuccess,
          modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
        )
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
private fun DexStatusChip(label: String, active: Boolean) {
  SolanaStatusPill(
    label = label,
    active = active,
    tone = if (active) SolanaPanelTone.Green else SolanaPanelTone.Neutral,
  )
}

@Composable
private fun DexModeChip(label: String, active: Boolean, onClick: () -> Unit) {
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(999.dp),
    color = if (active) mobileAccentSoft else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) mobileAccent else mobileBorderStrong),
  ) {
    Text(
      text = label,
      style = mobileCaption1.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
      color = if (active) mobileAccent else mobileTextSecondary,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
    )
  }
}

@Composable
private fun DexBoardTokenCard(
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
        DexStatusChip(label = token.status?.uppercase(Locale.US) ?: token.market.ifBlank { "TOKEN" }, active = true)
      }
      Text(
        "Price ${formatUsd(token.priceUsd)} • 24h ${formatUsd(token.volume24h)} • Liq ${formatUsd(token.liquidityUsd)}",
        style = mobileCallout,
        color = mobileText,
      )
      Text(
        buildString {
          append("MCap ${formatUsd(token.marketCapUsd)}")
          append(" • Holders ${formatCompactInteger(token.holders?.toLong())}")
          token.curvePercentage?.let {
            append(" • Curve ${formatPercent(it)}")
          }
          token.totalTransactions?.let {
            append(" • Txns ${formatCompactInteger(it.toLong())}")
          }
        },
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
      token.priceChange24h?.let {
        Text("24h move ${formatSignedPercent(it)}", style = mobileCaption1, color = mobileTextSecondary)
      }
    }
  }
}

@Composable
private fun DexSelectedTokenCard(
  token: SolanaTrackerTokenDetail,
  trades: List<SolanaTrackerTrade>,
  holders: List<SolanaTrackerHolder>,
  chart: List<SolanaTrackerOhlcvPoint>,
  liveSnapshot: SolanaTrackerDatastreamSnapshot,
  liveEvents: List<SolanaTrackerDatastreamEvent>,
  analysisBusy: Boolean,
  analysis: SolanaTrackerAnalysisResult?,
  analysisStatusText: String,
  grokConfigured: Boolean,
  busy: Boolean,
  onRefresh: () -> Unit,
  onAnalyze: () -> Unit,
  onCopyMint: () -> Unit,
) {
  val lastCandle = chart.lastOrNull()
  DexSectionCard(
    title = token.symbol.ifBlank { token.name.ifBlank { "Token" } },
    subtitle = shortTrackerAddress(token.mint),
    icon = Icons.AutoMirrored.Filled.ShowChart,
  ) {
    DexStatusChip(label = if (busy) "Refreshing" else "Focused Token", active = !busy)
    Text(
      "Holders ${formatCompactInteger(token.holders?.toLong())} • Buys ${formatCompactInteger(token.buys?.toLong())} • Sells ${formatCompactInteger(token.sells?.toLong())} • Txns ${formatCompactInteger(token.txns?.toLong())}",
      style = mobileCallout,
      color = mobileText,
    )
    Text(
      "Risk ${token.risk.score ?: 0} • Top10 ${formatPercent(token.risk.top10)} • Dev ${formatPercent(token.risk.devPercentage)} • Bundlers ${formatPercent(token.risk.bundlerPercentage)}",
      style = mobileCaption1,
      color = if (token.risk.rugged) mobileWarning else mobileTextSecondary,
    )
    Text(
      "Moves 1m ${formatSignedPercent(token.priceChanges.m1)} • 5m ${formatSignedPercent(token.priceChanges.m5)} • 1h ${formatSignedPercent(token.priceChanges.h1)} • 24h ${formatSignedPercent(token.priceChanges.h24)}",
      style = mobileCaption1,
      color = mobileTextSecondary,
    )
    lastCandle?.let { candle ->
      Text(
        "Last candle close ${formatUsd(candle.close)} • high ${formatUsd(candle.high)} • low ${formatUsd(candle.low)} • volume ${formatUsd(candle.volume)}",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    }
    if (liveSnapshot.hasData()) {
      Text("Live Datastream", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
      Text(
        "Primary ${formatUsd(liveSnapshot.primaryPriceUsd)} • Aggregated ${formatUsd(liveSnapshot.aggregatedPriceUsd)} • Volume ${formatUsd(liveSnapshot.volumeUsd)}",
        style = mobileCallout,
        color = mobileText,
      )
      Text(
        "Buys ${formatCompactInteger(liveSnapshot.buys)} • Sells ${formatCompactInteger(liveSnapshot.sells)} • Holders ${formatCompactInteger(liveSnapshot.holders)} • Curve ${formatPercent(liveSnapshot.curvePercentage)}",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      FeatureButton(label = "Refresh Token", emphasis = true, onClick = onRefresh)
      FeatureButton(label = if (analysisBusy) "Analyzing…" else "Analyze", onClick = onAnalyze)
      FeatureButton(label = "Copy Mint", onClick = onCopyMint)
    }
    Text(
      analysisStatusText,
      style = mobileCaption1,
      color = if (grokConfigured) mobileTextSecondary else mobileWarning,
    )
    analysis?.let { result ->
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
          Text(formatTrackerTime(result.generatedAtMs), style = mobileCaption1, color = mobileTextTertiary)
        }
      }
    }
    if (liveEvents.isNotEmpty()) {
      Text("Focused Feed", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        liveEvents.takeLast(4).reversed().forEach { event ->
          DexDatastreamEventCard(event = event)
        }
      }
    }
    if (token.pools.isNotEmpty()) {
      Text("Top Pools", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
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
      Text("Recent Trades", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
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
      Text("Top Holders", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileText)
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

@Composable
private fun DexDatastreamEventCard(event: SolanaTrackerDatastreamEvent) {
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
        DexStatusChip(label = event.stream.uppercase(Locale.US), active = true)
      }
      Text(event.detail, style = mobileCaption1, color = mobileTextSecondary)
      Text(formatTrackerTime(event.timestampMs), style = mobileCaption1, color = mobileTextTertiary)
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
private fun OutlinedField(
  value: String,
  onValueChange: (String) -> Unit,
  label: String,
  keyboardType: KeyboardType = KeyboardType.Text,
) {
  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    modifier = Modifier.fillMaxWidth(),
    label = { Text(label, style = mobileCaption1, color = mobileTextSecondary) },
    singleLine = true,
    textStyle = mobileBody.copy(color = mobileText),
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

private fun formatJupiterImpact(value: Double?): String =
  value?.let {
    val resolved = if (kotlin.math.abs(it) <= 1.0) it * 100.0 else it
    String.format(Locale.US, "%.2f%%", resolved)
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
  if (value.length <= 10) value else "${value.take(4)}…${value.takeLast(4)}"

private fun formatTrackerTime(value: Long?): String {
  val resolved = value ?: return "--"
  return runCatching {
    DateTimeFormatter.ofPattern("MMM d HH:mm", Locale.US)
      .withZone(ZoneId.systemDefault())
      .format(Instant.ofEpochMilli(resolved))
  }.getOrElse { "--" }
}

private fun copyToClipboard(context: Context, value: String) {
  val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return
  clipboard.setPrimaryClip(ClipData.newPlainText("tracker", value))
}

private tailrec fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }
