package ai.openclaw.app.ui

import ai.openclaw.app.MainViewModel
import ai.openclaw.app.convex.ConvexChessMatchDetail
import ai.openclaw.app.convex.ConvexChessMatchSummary
import ai.openclaw.app.convex.ConvexChessSavePacketRequest
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.activity.ComponentActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

private enum class ChessPlayMode(val label: String) {
  Local("Local"),
  Wallet("Wallet Duel"),
  Grok("Grok"),
  Arena("AI Arena"),
}

@Composable
fun ArcadeChessTabScreen(viewModel: MainViewModel) {
  val context = LocalContext.current
  val activity = remember(context) { context.findActivity() as? ComponentActivity }
  val walletState by viewModel.mobileWalletState.collectAsState()
  val grokConfigured by viewModel.grokConfigured.collectAsState()
  val grokTabStatus by viewModel.grokStatusText.collectAsState()
  val openRouterChessConfigured by viewModel.openRouterChessConfigured.collectAsState()
  val openRouterChessStatusText by viewModel.openRouterChessStatusText.collectAsState()
  val displayName by viewModel.displayName.collectAsState()
  val chessArchiveMatches by viewModel.chessArchiveMatches.collectAsState()
  val chessArchiveBusy by viewModel.chessArchiveBusy.collectAsState()
  val chessArchiveLoadingMatchId by viewModel.chessArchiveLoadingMatchId.collectAsState()
  val chessArchiveStatusText by viewModel.chessArchiveStatusText.collectAsState()
  val coroutineScope = rememberCoroutineScope()

  var mode by rememberSaveable { mutableStateOf(ChessPlayMode.Local) }

  var localGame by remember { mutableStateOf(ChessGameState()) }
  var walletGame by remember { mutableStateOf(ChessGameState()) }
  var grokGame by remember { mutableStateOf(ChessGameState()) }
  var arenaGame by remember { mutableStateOf(ChessGameState()) }

  var walletSession by remember { mutableStateOf<WalletChessSession?>(null) }
  var walletPendingShare by remember { mutableStateOf<String?>(null) }
  var walletStatus by remember { mutableStateOf("Connect a Solana wallet to create or accept a signed match.") }
  var walletBusy by remember { mutableStateOf(false) }
  var walletImportInput by rememberSaveable { mutableStateOf("") }
  var walletInviteColor by rememberSaveable { mutableStateOf(ChessColor.White) }

  var grokHumanColor by rememberSaveable { mutableStateOf(ChessColor.White) }
  var grokStatus by remember { mutableStateOf("Grok can take over the opposing side as soon as it is configured.") }
  var grokBusy by remember { mutableStateOf(false) }
  var grokLastComment by remember { mutableStateOf<String?>(null) }
  var grokRetryNonce by remember { mutableIntStateOf(0) }
  var arenaWhiteProvider by rememberSaveable { mutableStateOf(ChessAiProvider.Grok) }
  var arenaBlackProvider by rememberSaveable { mutableStateOf(ChessAiProvider.OpenAI) }
  var arenaStatus by remember {
    mutableStateOf("Pick which model controls White and Black, then let the arena autoplay.")
  }
  var arenaBusy by remember { mutableStateOf(false) }
  var arenaAutoPlay by rememberSaveable { mutableStateOf(true) }
  var arenaPendingManualTurns by rememberSaveable { mutableIntStateOf(0) }
  var arenaLastComment by remember { mutableStateOf<String?>(null) }
  var arenaRetryNonce by remember { mutableIntStateOf(0) }

  val activeGame =
    when (mode) {
      ChessPlayMode.Local -> localGame
      ChessPlayMode.Wallet -> walletGame
      ChessPlayMode.Grok -> grokGame
      ChessPlayMode.Arena -> arenaGame
    }

  val walletLocalTurn = walletSession?.let { walletGame.position.turn == it.localColor } == true
  val grokAiColor = grokHumanColor.opposite()
  val arenaCurrentProvider =
    if (arenaGame.position.turn == ChessColor.White) {
      arenaWhiteProvider
    } else {
      arenaBlackProvider
    }
  val grokNeedsMove =
    mode == ChessPlayMode.Grok &&
      grokConfigured &&
      !grokBusy &&
      grokGame.position.status !in setOf(ChessPositionStatus.Checkmate, ChessPositionStatus.Stalemate) &&
      grokGame.position.turn == grokAiColor
  val arenaCurrentProviderReady =
    when (arenaCurrentProvider) {
      ChessAiProvider.Grok -> grokConfigured
      ChessAiProvider.OpenAI -> openRouterChessConfigured
    }
  val arenaNeedsMove =
    mode == ChessPlayMode.Arena &&
      !arenaBusy &&
      arenaCurrentProviderReady &&
      arenaGame.position.status !in setOf(ChessPositionStatus.Checkmate, ChessPositionStatus.Stalemate) &&
      (arenaAutoPlay || arenaPendingManualTurns > 0)

  LaunchedEffect(mode, grokNeedsMove, chessPositionFingerprint(grokGame.position), grokHumanColor, grokRetryNonce) {
    if (!grokNeedsMove) return@LaunchedEffect
    grokBusy = true
    grokStatus = "Grok is thinking…"
    grokLastComment = null
    viewModel.chooseGrokChessMove(
      activity = activity,
      position = grokGame.position,
      moveLog = grokGame.moveLog,
      aiColor = grokAiColor,
    ).fold(
      onSuccess = { choice ->
        val move = findLegalMoveByToken(grokGame.position, choice.move)
        if (move == null) {
          grokStatus = "Grok returned ${choice.move}, which is not legal in this position."
        } else {
          grokGame = applyChessMoveToGame(grokGame, move)
          grokLastComment = choice.comment.ifBlank { null }
          grokStatus =
            buildString {
              append("Grok played ")
              append(chessMoveToken(move))
              choice.comment.takeIf { it.isNotBlank() }?.let {
                append(" • ")
                append(it)
              }
            }
        }
      },
      onFailure = { err ->
        grokStatus = err.message ?: grokTabStatus
      },
    )
    grokBusy = false
  }

  LaunchedEffect(
    mode,
    arenaNeedsMove,
    arenaAutoPlay,
    chessPositionFingerprint(arenaGame.position),
    arenaWhiteProvider,
    arenaBlackProvider,
    arenaRetryNonce,
  ) {
    if (!arenaNeedsMove) return@LaunchedEffect
    arenaBusy = true
    if (!arenaAutoPlay && arenaPendingManualTurns > 0) {
      arenaPendingManualTurns -= 1
    }
    arenaLastComment = null
    arenaStatus = "${arenaCurrentProvider.label} is thinking for ${arenaGame.position.turn.name.lowercase()}…"
    delay(650)
    viewModel.chooseAiChessMove(
      provider = arenaCurrentProvider,
      activity = activity,
      position = arenaGame.position,
      moveLog = arenaGame.moveLog,
      aiColor = arenaGame.position.turn,
    ).fold(
      onSuccess = { choice ->
        val move = findLegalMoveByToken(arenaGame.position, choice.move)
        if (move == null) {
          arenaAutoPlay = false
          arenaStatus = "${arenaCurrentProvider.label} returned ${choice.move}, which is not legal in this position."
        } else {
          arenaGame = applyChessMoveToGame(arenaGame, move)
          arenaLastComment = choice.comment.ifBlank { null }
          arenaStatus =
            buildString {
              append(arenaCurrentProvider.label)
              append(" played ")
              append(chessMoveToken(move))
              choice.comment.takeIf { it.isNotBlank() }?.let {
                append(" • ")
                append(it)
              }
            }
        }
      },
      onFailure = { err ->
        arenaAutoPlay = false
        arenaStatus = err.message ?: "${arenaCurrentProvider.label} failed to choose a move."
      },
    )
    arenaBusy = false
  }

  fun resetForCurrentMode() {
    when (mode) {
      ChessPlayMode.Local -> localGame = resetChessGame()
      ChessPlayMode.Wallet -> {
        walletGame = resetChessGame()
        walletSession = null
        walletPendingShare = null
        walletStatus = "Cleared the current wallet duel."
      }
      ChessPlayMode.Grok -> {
        grokGame = resetChessGame()
        grokLastComment = null
        grokStatus =
          if (grokHumanColor == ChessColor.White) {
            "New game started. Make the first move, then Grok will answer."
          } else {
            "New game started. Grok has White and will open automatically."
          }
      }
      ChessPlayMode.Arena -> {
        arenaGame = resetChessGame()
        arenaLastComment = null
        arenaAutoPlay = true
        arenaPendingManualTurns = 0
        arenaStatus = "Arena reset. ${arenaWhiteProvider.label} has White and will open automatically."
      }
    }
  }

  fun undoForCurrentMode() {
    when (mode) {
      ChessPlayMode.Local -> localGame = undoChessMove(localGame)
      ChessPlayMode.Wallet -> walletStatus = "Undo is disabled for signed wallet matches."
      ChessPlayMode.Grok -> {
        grokGame = if (grokGame.history.size >= 2) undoChessMove(undoChessMove(grokGame)) else undoChessMove(grokGame)
        grokLastComment = null
        grokStatus = "Rolled the Grok game back one full turn."
      }
      ChessPlayMode.Arena -> {
        arenaGame = if (arenaGame.history.size >= 2) undoChessMove(undoChessMove(arenaGame)) else undoChessMove(arenaGame)
        arenaLastComment = null
        arenaStatus = "Rolled the arena back one full turn."
      }
    }
  }

  fun flipForCurrentMode() {
    when (mode) {
      ChessPlayMode.Local -> localGame = toggleChessFlip(localGame)
      ChessPlayMode.Wallet -> walletGame = toggleChessFlip(walletGame)
      ChessPlayMode.Grok -> grokGame = toggleChessFlip(grokGame)
      ChessPlayMode.Arena -> arenaGame = toggleChessFlip(arenaGame)
    }
  }

  fun handleWalletTap(index: Int) {
    val session = walletSession
    if (session == null) {
      walletStatus = "Create or import a signed wallet match first."
      return
    }
    if (walletBusy) return
    if (!walletLocalTurn) {
      walletStatus = "Waiting for ${shortChessWallet(session.remoteAddress ?: session.inviterAddress)} to send the next signed move."
      return
    }
    val move = resolveChessMove(walletGame, index)
    if (move == null) {
      walletGame = selectChessSquare(walletGame, index)
      return
    }
    if (activity == null) {
      walletStatus = "Wallet signing requires the active Android activity."
      return
    }
    val localAddress = walletState.authorizedAddress?.trim().orEmpty()
    if (!walletState.hasStoredAuthorization || localAddress.isBlank()) {
      walletStatus = "Connect your Solana wallet before signing chess moves."
      return
    }
    if (localAddress != session.localAddress) {
      walletStatus = "Reconnect the same wallet used for this match: ${shortChessWallet(session.localAddress)}."
      return
    }

    val payload =
      WalletChessMovePayload(
        matchId = session.matchId,
        ply = walletGame.moveLog.size + 1,
        signerAddress = session.localAddress,
        move = chessMoveToken(move),
        moveDisplay = moveToDisplayString(move),
        beforeFingerprint = chessPositionFingerprint(walletGame.position),
        afterFingerprint = chessPositionFingerprint(applyChessMove(walletGame.position, move)),
        sentAtMs = System.currentTimeMillis(),
      )
    val payloadJson = walletChessProtocolJson().encodeToString(WalletChessMovePayload.serializer(), payload)
    walletBusy = true
    walletStatus = "Requesting a wallet signature for ${payload.move}…"
    coroutineScope.launch {
      val signResult =
        viewModel.signSolanaMessageForResult(activity, walletChessSignableMessage("move", payloadJson))
      if (signResult.isSuccess) {
        val signatureBase58 = signResult.getOrThrow().signatureBase58
        if (signatureBase58.isNullOrBlank()) {
          walletStatus = "Wallet returned no detached signature for the move."
        } else {
          val packet = walletChessBuildSignedMove(payload, signatureBase58)
          val nextGame = applyChessMoveToGame(walletGame, move)
          val packetEncoded = walletChessEncodePacket(packet)
          walletGame = nextGame
          walletPendingShare = packetEncoded
          walletStatus = "Signed ${payload.move}. Share the move packet with your opponent."
          val saveResult =
            viewModel.saveChessArchivePacket(
              activity = activity,
              requestBody =
                buildChessArchiveMoveRequest(
                  session = session,
                  game = nextGame,
                  payload = payload,
                  packet = packet,
                  packetEncoded = packetEncoded,
                ),
            )
          saveResult.onFailure { err ->
            walletStatus =
              buildString {
                append("Signed ${payload.move}. Share the move packet with your opponent.")
                append(" Convex save failed: ")
                append(err.message ?: "Unable to archive the signed move.")
              }
          }
        }
      } else {
        walletStatus = signResult.exceptionOrNull()?.message ?: "Move signing failed."
      }
      walletBusy = false
    }
  }

  Column(
    modifier = Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 68.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "Arcade Mode",
      title = "Chess",
      subtitle =
        "Play locally, duel another SolanaOS user with wallet-signed move packets, or run AI matches with Grok and OpenAI.",
    )

    ModeSelector(
      options = ChessPlayMode.entries,
      selected = mode,
      label = { it.label },
      onSelect = { mode = it },
    )

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label = "${activeGame.position.turn.name} To Move",
        active = true,
        tone = if (activeGame.position.turn == ChessColor.White) SolanaPanelTone.Green else SolanaPanelTone.Purple,
      )
      SolanaStatusPill(
        label =
          when (activeGame.position.status) {
            ChessPositionStatus.Check -> "Check"
            ChessPositionStatus.Checkmate -> "Checkmate"
            ChessPositionStatus.Stalemate -> "Stalemate"
            ChessPositionStatus.Normal -> "Live"
          },
        active = activeGame.position.status != ChessPositionStatus.Normal,
        tone = if (activeGame.position.status == ChessPositionStatus.Checkmate) SolanaPanelTone.Orange else SolanaPanelTone.Purple,
      )
      if (mode == ChessPlayMode.Wallet) {
        SolanaStatusPill(
          label = if (walletSession != null) "Wallet Match" else "No Match",
          active = walletSession != null,
          tone = if (walletSession != null) SolanaPanelTone.Green else SolanaPanelTone.Orange,
        )
      }
      if (mode == ChessPlayMode.Grok) {
        SolanaStatusPill(
          label = if (grokConfigured) "Grok Ready" else "Grok Off",
          active = grokConfigured,
          tone = if (grokConfigured) SolanaPanelTone.Green else SolanaPanelTone.Orange,
        )
      }
      if (mode == ChessPlayMode.Arena) {
        SolanaStatusPill(
          label = if (arenaAutoPlay) "Arena Auto" else "Arena Paused",
          active = arenaAutoPlay,
          tone = if (arenaAutoPlay) SolanaPanelTone.Green else SolanaPanelTone.Orange,
        )
      }
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
      SolanaSectionLabel("Board", tone = SolanaPanelTone.Purple)
      ChessBoard(
        state = activeGame,
        onTap = { tapped ->
          when (mode) {
            ChessPlayMode.Local -> localGame = handleChessTap(localGame, tapped)
            ChessPlayMode.Wallet -> handleWalletTap(tapped)
            ChessPlayMode.Grok -> {
              if (grokBusy || grokGame.position.turn != grokHumanColor) {
                grokStatus = if (grokBusy) "Grok is already thinking…" else "Wait for Grok to finish its turn."
              } else {
                val move = resolveChessMove(grokGame, tapped)
                grokGame =
                  if (move != null) {
                    grokStatus = "Move locked in. Grok will answer next."
                    applyChessMoveToGame(grokGame, move)
                  } else {
                    selectChessSquare(grokGame, tapped)
                  }
              }
            }
            ChessPlayMode.Arena -> {
              arenaStatus = "Arena is watch-only. Change the side providers or use pause/step controls below."
            }
          }
        },
      )
      Text(
        text =
          when (mode) {
            ChessPlayMode.Local -> chessStatusText(localGame)
            ChessPlayMode.Wallet -> walletStatus
            ChessPlayMode.Grok -> grokStatus
            ChessPlayMode.Arena -> arenaStatus
          },
        style = mobileCallout,
        color = mobileText,
      )
      if (mode == ChessPlayMode.Grok && !grokLastComment.isNullOrBlank()) {
        Text(
          "Grok: $grokLastComment",
          style = mobileCaption1,
          color = mobileAccent,
        )
      }
      if (mode == ChessPlayMode.Arena && !arenaLastComment.isNullOrBlank()) {
        Text(
          "${arenaCurrentProvider.label}: $arenaLastComment",
          style = mobileCaption1,
          color = mobileAccent,
        )
      }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      ArcadeActionButton(
        label = if (mode == ChessPlayMode.Wallet) "Clear" else "Reset",
        tone = SolanaPanelTone.Green,
        modifier = Modifier.weight(1f),
      ) {
        resetForCurrentMode()
      }
      ArcadeActionButton(
        label = "Undo",
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
        enabled = mode != ChessPlayMode.Wallet,
      ) {
        undoForCurrentMode()
      }
      ArcadeActionButton(
        label = "Flip",
        tone = SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
      ) {
        flipForCurrentMode()
      }
    }

    when (mode) {
      ChessPlayMode.Local -> {
        MoveLogPanel(game = localGame)
      }
      ChessPlayMode.Wallet -> {
        WalletChessPanel(
          activity = activity,
          viewModel = viewModel,
          walletStateReady = walletState.hasStoredAuthorization && !walletState.authorizedAddress.isNullOrBlank(),
          walletAddress = walletState.authorizedAddress,
          inviteColor = walletInviteColor,
          onInviteColorChange = { walletInviteColor = it },
          importInput = walletImportInput,
          onImportInputChange = { walletImportInput = it },
          session = walletSession,
          currentGame = walletGame,
          pendingShare = walletPendingShare,
          busy = walletBusy,
          displayName = displayName,
          statusText = walletStatus,
          onCreateInvite = {
            if (activity == null) {
              walletStatus = "Wallet invites require the active Android activity."
              return@WalletChessPanel
            }
            val localAddress = walletState.authorizedAddress?.trim().orEmpty()
            if (!walletState.hasStoredAuthorization || localAddress.isBlank()) {
              walletStatus = "Connect a Solana wallet before creating a duel invite."
              return@WalletChessPanel
            }
            val invite = newWalletChessInvite(localAddress = localAddress, localLabel = displayName, localColor = walletInviteColor)
            val payloadJson = walletChessProtocolJson().encodeToString(WalletChessInvitePayload.serializer(), invite)
            walletBusy = true
            walletStatus = "Requesting a wallet signature for the invite…"
            coroutineScope.launch {
              val signResult =
                viewModel.signSolanaMessageForResult(activity, walletChessSignableMessage("invite", payloadJson))
              if (signResult.isSuccess) {
                val signatureBase58 = signResult.getOrThrow().signatureBase58
                if (signatureBase58.isNullOrBlank()) {
                  walletStatus = "Wallet returned no detached signature for the invite."
                } else {
                  val packet = walletChessBuildSignedInvite(invite, signatureBase58)
                  val nextGame = resetChessGame()
                  val nextSession =
                    WalletChessSession(
                      matchId = invite.matchId,
                      localAddress = localAddress,
                      remoteAddress = null,
                      localColor = invite.inviterColor,
                      inviterAddress = invite.inviterAddress,
                    )
                  val packetEncoded = walletChessEncodePacket(packet)
                  walletSession =
                    nextSession
                  walletGame = nextGame
                  walletPendingShare = packetEncoded
                  walletStatus =
                    "Invite signed as ${walletInviteColor.name}. Share it with another wallet-connected SolanaOS user."
                  val saveResult =
                    viewModel.saveChessArchivePacket(
                      activity = activity,
                      requestBody =
                        buildChessArchiveInviteRequest(
                          session = nextSession,
                          game = nextGame,
                          invite = invite,
                          packet = packet,
                          packetEncoded = packetEncoded,
                        ),
                    )
                  saveResult.onFailure { err ->
                    walletStatus =
                      buildString {
                        append("Invite signed as ${walletInviteColor.name}. Share it with another wallet-connected SolanaOS user.")
                        append(" Convex save failed: ")
                        append(err.message ?: "Unable to archive the signed invite.")
                      }
                  }
                }
              } else {
                walletStatus = signResult.exceptionOrNull()?.message ?: "Invite signing failed."
              }
              walletBusy = false
            }
          },
          onImportPacket = {
            val localAddress = walletState.authorizedAddress?.trim().orEmpty()
            if (!walletState.hasStoredAuthorization || localAddress.isBlank()) {
              walletStatus = "Connect a Solana wallet before importing a signed match."
              return@WalletChessPanel
            }
            val rawPacket = walletImportInput
            coroutineScope.launch {
              val importResult =
                runCatching {
                  importWalletChessPacket(
                    raw = rawPacket,
                    currentSession = walletSession,
                    currentGame = walletGame,
                    localAddress = localAddress,
                  )
                }
              if (importResult.isSuccess) {
                val result = importResult.getOrThrow()
                walletSession = result.session
                walletGame = result.game
                walletPendingShare = null
                walletStatus = result.statusText
                walletImportInput = ""
                val archiveError =
                  try {
                    val resolvedActivity =
                      activity ?: throw IllegalStateException("Wallet archive requires the active Android activity.")
                    val decodedPacket = walletChessDecodePacket(rawPacket)
                    val packetEncoded = walletChessEncodePacket(decodedPacket)
                    val saveResult =
                      when (decodedPacket.kind) {
                        "invite" -> {
                          val invite = walletChessDecodeInvite(decodedPacket)
                          viewModel.saveChessArchivePacket(
                            activity = resolvedActivity,
                            requestBody =
                              buildChessArchiveInviteRequest(
                                session = result.session,
                                game = result.game,
                                invite = invite,
                                packet = decodedPacket,
                                packetEncoded = packetEncoded,
                              ),
                          )
                        }
                        "move" -> {
                          val movePayload = walletChessDecodeMove(decodedPacket)
                          viewModel.saveChessArchivePacket(
                            activity = resolvedActivity,
                            requestBody =
                              buildChessArchiveMoveRequest(
                                session = result.session,
                                game = result.game,
                                payload = movePayload,
                                packet = decodedPacket,
                                packetEncoded = packetEncoded,
                              ),
                          )
                        }
                        else -> Result.failure(IllegalStateException("Unsupported signed chess packet."))
                      }
                    saveResult.exceptionOrNull()
                  } catch (err: Throwable) {
                    err
                  }
                if (archiveError != null) {
                  walletStatus =
                    buildString {
                      append(result.statusText)
                      append(" Convex save failed: ")
                      append(archiveError.message ?: "Unable to archive the imported packet.")
                    }
                }
              } else {
                walletStatus = importResult.exceptionOrNull()?.message ?: "Unable to import that chess packet."
              }
            }
          },
          onCopyPendingShare = {
            walletPendingShare?.let { copyToClipboard(context, "wallet-chess-packet", it) }
            walletStatus = "Copied the signed packet to the clipboard."
          },
          onSharePendingShare = {
            walletPendingShare?.let { shareText(context, "SolanaOS Chess Packet", it) }
          },
        )
        SavedChessMatchesPanel(
          matches = chessArchiveMatches,
          busy = chessArchiveBusy,
          loadingMatchId = chessArchiveLoadingMatchId,
          statusText = chessArchiveStatusText,
          onRefresh = {
            activity?.let(viewModel::refreshChessArchive)
              ?: run { walletStatus = "Signed chess archive requires the active Android activity." }
          },
          onRecall = { summary ->
            val localAddress = walletState.authorizedAddress?.trim().orEmpty()
            if (!walletState.hasStoredAuthorization || localAddress.isBlank()) {
              walletStatus = "Connect a Solana wallet before recalling a saved match."
              return@SavedChessMatchesPanel
            }
            if (activity == null) {
              walletStatus = "Signed chess archive requires the active Android activity."
              return@SavedChessMatchesPanel
            }
            coroutineScope.launch {
              viewModel.recallChessArchiveMatch(activity, summary.matchId).fold(
                onSuccess = { detail ->
                  runCatching {
                    restoreSavedWalletChessMatch(
                      detail = detail,
                      localAddress = localAddress,
                    )
                  }.fold(
                    onSuccess = { restored ->
                      walletSession = restored.session
                      walletGame = restored.game
                      walletPendingShare = null
                      walletImportInput = ""
                      walletStatus =
                        "Recalled saved match ${summary.matchId.take(8)} with ${shortChessWallet(restored.session.remoteAddress ?: restored.session.inviterAddress)}."
                    },
                    onFailure = { err ->
                      walletStatus = err.message ?: "Unable to rebuild the saved chess match."
                    },
                  )
                },
                onFailure = { err ->
                  walletStatus = err.message ?: "Unable to recall the saved chess match."
                },
              )
            }
          },
        )
        MoveLogPanel(game = walletGame)
      }
      ChessPlayMode.Grok -> {
        GrokChessPanel(
          grokConfigured = grokConfigured,
          humanColor = grokHumanColor,
          onHumanColorChange = {
            grokHumanColor = it
            grokGame = resetChessGame()
            grokLastComment = null
            grokStatus =
              if (it == ChessColor.White) {
                "You have White. Make a move to begin."
              } else {
                "Grok has White and will open automatically."
              }
          },
          grokBusy = grokBusy,
          grokStatus = grokStatus,
          onRetry = {
            if (grokGame.position.turn == grokAiColor && grokConfigured && !grokBusy) {
              grokStatus = "Retry queued for Grok."
              grokRetryNonce += 1
            }
          },
        )
        MoveLogPanel(game = grokGame)
      }
      ChessPlayMode.Arena -> {
        AiArenaPanel(
          grokConfigured = grokConfigured,
          openRouterConfigured = openRouterChessConfigured,
          grokStatusText = grokTabStatus,
          openRouterStatusText = openRouterChessStatusText,
          whiteProvider = arenaWhiteProvider,
          blackProvider = arenaBlackProvider,
          onWhiteProviderChange = {
            arenaWhiteProvider = it
            arenaLastComment = null
            arenaStatus = "${it.label} will control White."
          },
          onBlackProviderChange = {
            arenaBlackProvider = it
            arenaLastComment = null
            arenaStatus = "${it.label} will control Black."
          },
          autoPlay = arenaAutoPlay,
          busy = arenaBusy,
          status = arenaStatus,
          onToggleAutoPlay = {
            arenaAutoPlay = !arenaAutoPlay
            arenaStatus =
              if (arenaAutoPlay) {
                "Arena autoplay resumed."
              } else {
                "Arena autoplay paused."
              }
          },
          onStep = {
            if (!arenaBusy) {
              arenaAutoPlay = false
              arenaPendingManualTurns += 1
              arenaStatus = "Single arena move requested."
              arenaRetryNonce += 1
            }
          },
          onRetry = {
            if (!arenaBusy) {
              arenaPendingManualTurns += 1
              arenaStatus = "Retry queued for ${arenaCurrentProvider.label}."
              arenaRetryNonce += 1
            }
          },
        )
        MoveLogPanel(game = arenaGame)
      }
    }

  }
}

@Composable
private fun WalletChessPanel(
  activity: ComponentActivity?,
  viewModel: MainViewModel,
  walletStateReady: Boolean,
  walletAddress: String?,
  inviteColor: ChessColor,
  onInviteColorChange: (ChessColor) -> Unit,
  importInput: String,
  onImportInputChange: (String) -> Unit,
  session: WalletChessSession?,
  currentGame: ChessGameState,
  pendingShare: String?,
  busy: Boolean,
  displayName: String,
  statusText: String,
  onCreateInvite: () -> Unit,
  onImportPacket: () -> Unit,
  onCopyPendingShare: () -> Unit,
  onSharePendingShare: () -> Unit,
) {
  SolanaPanel(
    modifier = Modifier.fillMaxWidth(),
    tone = if (session != null) SolanaPanelTone.Green else SolanaPanelTone.Orange,
  ) {
    SolanaSectionLabel("Wallet Duel", tone = if (session != null) SolanaPanelTone.Green else SolanaPanelTone.Orange)
    Text(
      "Use your connected Solana wallet as identity. Each invite and move packet is detached-message signed, so the other player can verify who sent it before applying it.",
      style = mobileCallout,
      color = mobileText,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      SolanaMetricTile(
        label = "Wallet",
        value = walletAddress?.let(::shortChessWallet) ?: "Not linked",
        tone = if (walletStateReady) SolanaPanelTone.Green else SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Identity",
        value = displayName.trim().ifBlank { "SolanaOS" },
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
      )
    }
    if (!walletStateReady) {
      ArcadeActionButton(
        label = "Connect Wallet",
        tone = SolanaPanelTone.Green,
        modifier = Modifier.fillMaxWidth(),
        enabled = activity != null && !busy,
      ) {
        activity?.let(viewModel::connectSolanaWallet)
      }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      ModeSelector(
        options = ChessColor.entries,
        selected = inviteColor,
        label = { "Host ${it.name}" },
        onSelect = onInviteColorChange,
      )
    }
    ArcadeActionButton(
      label = "Create Signed Invite",
      tone = SolanaPanelTone.Green,
      modifier = Modifier.fillMaxWidth(),
      enabled = walletStateReady && !busy,
      onClick = onCreateInvite,
    )

    OutlinedTextField(
      value = importInput,
      onValueChange = onImportInputChange,
      label = { Text("Import invite or move packet", style = mobileCaption1, color = mobileTextSecondary) },
      placeholder = { Text("solanaos://arcade/chess?packet=…", style = mobileCaption1, color = mobileTextTertiary) },
      modifier = Modifier.fillMaxWidth(),
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
      textStyle = mobileBody.copy(color = mobileText),
      shape = RoundedCornerShape(6.dp),
      colors = outlinedColors(),
    )
    ArcadeActionButton(
      label = "Import Signed Packet",
      tone = SolanaPanelTone.Purple,
      modifier = Modifier.fillMaxWidth(),
      enabled = importInput.isNotBlank() && walletStateReady && !busy,
      onClick = onImportPacket,
    )

    if (session != null) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        SolanaMetricTile(
          label = "Match",
          value = session.matchId.take(8),
          tone = SolanaPanelTone.Purple,
          modifier = Modifier.weight(1f),
        )
        SolanaMetricTile(
          label = "You",
          value = session.localColor.name,
          tone = SolanaPanelTone.Green,
          modifier = Modifier.weight(1f),
        )
      }
      Text(
        "Opponent: ${shortChessWallet(session.remoteAddress ?: session.inviterAddress)} • Position ${chessPositionFingerprint(currentGame.position).take(18)}",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    }

    if (!pendingShare.isNullOrBlank()) {
      Text(
        "A signed packet is ready to send.",
        style = mobileCaption1,
        color = mobileAccent,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        ArcadeActionButton(
          label = "Copy Packet",
          tone = SolanaPanelTone.Purple,
          modifier = Modifier.weight(1f),
          onClick = onCopyPendingShare,
        )
        ArcadeActionButton(
          label = "Share Packet",
          tone = SolanaPanelTone.Green,
          modifier = Modifier.weight(1f),
          onClick = onSharePendingShare,
        )
      }
    }

    Text(
      statusText,
      style = mobileCaption1,
      color = if (busy) mobileAccent else mobileTextSecondary,
    )
  }
}

@Composable
private fun SavedChessMatchesPanel(
  matches: List<ConvexChessMatchSummary>,
  busy: Boolean,
  loadingMatchId: String?,
  statusText: String,
  onRefresh: () -> Unit,
  onRecall: (ConvexChessMatchSummary) -> Unit,
) {
  SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
    SolanaSectionLabel("Saved Matches", tone = SolanaPanelTone.Purple)
    Text(
      "Signed wallet matches are archived in Convex so they can be recalled later from the same Solana wallet.",
      style = mobileCallout,
      color = mobileText,
    )
    ArcadeActionButton(
      label = if (busy) "Refreshing…" else "Refresh Archive",
      tone = SolanaPanelTone.Purple,
      modifier = Modifier.fillMaxWidth(),
      enabled = !busy,
      onClick = onRefresh,
    )
    Text(
      statusText,
      style = mobileCaption1,
      color = if (busy) mobileAccent else mobileTextSecondary,
    )
    if (matches.isEmpty()) {
      Text(
        "No archived matches are available for this wallet yet.",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
    } else {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        matches.forEach { summary ->
          Surface(
            shape = RoundedCornerShape(6.dp),
            color = mobileSurfaceStrong.copy(alpha = 0.7f),
            border = BorderStroke(1.dp, mobileBorder),
          ) {
            Column(
              modifier = Modifier.fillMaxWidth().padding(12.dp),
              verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
              ) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                  Text(
                    text = summary.inviterLabel?.ifBlank { null } ?: shortChessWallet(summary.inviterWalletAddress),
                    style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
                    color = mobileText,
                  )
                  Text(
                    text =
                      buildString {
                        append(summary.viewerColor ?: "Pending")
                        append(" • ")
                        append(summary.opponentWalletAddress?.let(::shortChessWallet) ?: "Waiting for opponent")
                      },
                    style = mobileCaption1,
                    color = mobileTextSecondary,
                  )
                }
                SolanaStatusPill(
                  label = summary.positionStatus,
                  active = summary.positionStatus != "Normal",
                  tone =
                    when (summary.positionStatus) {
                      "Checkmate" -> SolanaPanelTone.Orange
                      "Check" -> SolanaPanelTone.Green
                      else -> SolanaPanelTone.Purple
                    },
                )
              }
              Text(
                text =
                  buildString {
                    append("Match ")
                    append(summary.matchId.take(8))
                    append(" • ")
                    append(summary.moveCount)
                    append(" ply")
                    summary.latestMoveDisplay?.takeIf { it.isNotBlank() }?.let {
                      append(" • ")
                      append(it)
                    }
                  },
                style = mobileCaption1,
                color = mobileText,
              )
              Text(
                text = "Updated ${formatChessArchiveTime(summary.updatedAt)}",
                style = mobileCaption2,
                color = mobileTextTertiary,
              )
              ArcadeActionButton(
                label = if (loadingMatchId == summary.matchId) "Recalling…" else "Recall Match",
                tone = SolanaPanelTone.Green,
                modifier = Modifier.fillMaxWidth(),
                enabled = loadingMatchId != summary.matchId,
                onClick = { onRecall(summary) },
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun GrokChessPanel(
  grokConfigured: Boolean,
  humanColor: ChessColor,
  onHumanColorChange: (ChessColor) -> Unit,
  grokBusy: Boolean,
  grokStatus: String,
  onRetry: () -> Unit,
) {
  SolanaPanel(
    modifier = Modifier.fillMaxWidth(),
    tone = if (grokConfigured) SolanaPanelTone.Green else SolanaPanelTone.Orange,
  ) {
    SolanaSectionLabel("Grok Opponent", tone = if (grokConfigured) SolanaPanelTone.Green else SolanaPanelTone.Orange)
    Text(
      if (grokConfigured) {
        "Grok runs as the opposing side with the xAI Responses API and only gets the legal moves available in the current position."
      } else {
        "Grok chess is unavailable in this build."
      },
      style = mobileCallout,
      color = mobileText,
    )
    ModeSelector(
      options = ChessColor.entries,
      selected = humanColor,
      label = { "Play ${it.name}" },
      onSelect = onHumanColorChange,
    )
    Text(
      grokStatus,
      style = mobileCaption1,
      color = if (grokBusy) mobileAccent else mobileTextSecondary,
    )
    ArcadeActionButton(
      label = if (grokBusy) "Thinking…" else "Retry Grok",
      tone = SolanaPanelTone.Purple,
      modifier = Modifier.fillMaxWidth(),
      enabled = grokConfigured && !grokBusy,
      onClick = onRetry,
    )
  }
}

@Composable
private fun AiArenaPanel(
  grokConfigured: Boolean,
  openRouterConfigured: Boolean,
  grokStatusText: String,
  openRouterStatusText: String,
  whiteProvider: ChessAiProvider,
  blackProvider: ChessAiProvider,
  onWhiteProviderChange: (ChessAiProvider) -> Unit,
  onBlackProviderChange: (ChessAiProvider) -> Unit,
  autoPlay: Boolean,
  busy: Boolean,
  status: String,
  onToggleAutoPlay: () -> Unit,
  onStep: () -> Unit,
  onRetry: () -> Unit,
) {
  SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
    SolanaSectionLabel("AI Arena", tone = SolanaPanelTone.Purple)
    Text(
      "Run a watch-only chess match where each side is controlled by Grok or OpenAI through OpenRouter. The board advances automatically so you can watch the models play each other.",
      style = mobileCallout,
      color = mobileText,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label = if (grokConfigured) "Grok Ready" else "Grok Off",
        active = grokConfigured,
        tone = if (grokConfigured) SolanaPanelTone.Green else SolanaPanelTone.Orange,
      )
      SolanaStatusPill(
        label = if (openRouterConfigured) "OpenAI Ready" else "OpenAI Off",
        active = openRouterConfigured,
        tone = if (openRouterConfigured) SolanaPanelTone.Green else SolanaPanelTone.Orange,
      )
    }
    Text(
      "Grok: $grokStatusText",
      style = mobileCaption1,
      color = mobileTextSecondary,
    )
    Text(
      "OpenAI: $openRouterStatusText",
      style = mobileCaption1,
      color = mobileTextSecondary,
    )
    Text(
      "White controller",
      style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
      color = mobileAccent,
    )
    ModeSelector(
      options = ChessAiProvider.entries,
      selected = whiteProvider,
      label = { "${it.label} White" },
      onSelect = onWhiteProviderChange,
    )
    Text(
      "Black controller",
      style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
      color = mobileAccent,
    )
    ModeSelector(
      options = ChessAiProvider.entries,
      selected = blackProvider,
      label = { "${it.label} Black" },
      onSelect = onBlackProviderChange,
    )
    Text(
      status,
      style = mobileCaption1,
      color = if (busy) mobileAccent else mobileTextSecondary,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      ArcadeActionButton(
        label = if (autoPlay) "Pause Arena" else "Resume Arena",
        tone = SolanaPanelTone.Green,
        modifier = Modifier.weight(1f),
        enabled = !busy,
        onClick = onToggleAutoPlay,
      )
      ArcadeActionButton(
        label = "Step Move",
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
        enabled = !busy,
        onClick = onStep,
      )
      ArcadeActionButton(
        label = if (busy) "Thinking…" else "Retry",
        tone = SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
        enabled = !busy,
        onClick = onRetry,
      )
    }
  }
}

@Composable
private fun MoveLogPanel(game: ChessGameState) {
  SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Green) {
    SolanaSectionLabel("Move Log")
    if (game.moveLog.isEmpty()) {
      Text(
        "No moves yet. Tap a piece, then tap a highlighted square.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )
    } else {
      LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(game.moveLog.chunked(2)) { pair ->
          Surface(
            shape = RoundedCornerShape(4.dp),
            color = mobileCodeBg,
            border = BorderStroke(1.dp, mobileBorder),
          ) {
            Column(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
              verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
              pair.forEachIndexed { index, move ->
                Text(
                  text = "${if (index == 0) "W" else "B"} $move",
                  style = mobileCaption1.copy(fontWeight = FontWeight.Medium),
                  color = mobileText,
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
private fun ChessBoard(
  state: ChessGameState,
  onTap: (Int) -> Unit,
) {
  val boardIndices =
    if (state.flipped) {
      (7 downTo 0).flatMap { row -> (7 downTo 0).map { col -> chessIndex(row, col) } }
    } else {
      (0..7).flatMap { row -> (0..7).map { col -> chessIndex(row, col) } }
    }

  Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
    boardIndices.chunked(8).forEach { row ->
      Row(horizontalArrangement = Arrangement.spacedBy(0.dp), modifier = Modifier.fillMaxWidth()) {
        row.forEach { index ->
          val piece = state.position.board[index]
          val isLightSquare = (chessRow(index) + chessCol(index)) % 2 == 0
          val isSelected = state.selectedIndex == index
          val isTarget = index in state.legalTargets
          val bg =
            when {
              isSelected -> mobileAccent.copy(alpha = 0.32f)
              isTarget -> mobileSuccess.copy(alpha = 0.25f)
              isLightSquare -> Color(0xFF151A22)
              else -> Color(0xFF0D1117)
            }
          val border =
            when {
              isSelected -> mobileAccent
              isTarget -> mobileSuccess
              else -> mobileBorder.copy(alpha = 0.28f)
            }

          Box(
            modifier =
              Modifier
                .weight(1f)
                .aspectRatio(1f)
                .background(bg)
                .clickable { onTap(index) },
          ) {
            Surface(
              modifier = Modifier.matchParentSize(),
              color = Color.Transparent,
              border = BorderStroke(1.dp, border),
            ) {}

            Text(
              text = piece?.let(::pieceGlyph).orEmpty(),
              modifier = Modifier.align(Alignment.Center),
              style = mobileTitle1,
              color =
                when (piece?.color) {
                  ChessColor.White -> Color(0xFFEAEFF7)
                  ChessColor.Black -> Color(0xFF9A79FF)
                  null -> Color.Transparent
                },
              textAlign = TextAlign.Center,
            )

            if (piece == null && isTarget) {
              Surface(
                modifier = Modifier.align(Alignment.Center).size(12.dp),
                shape = RoundedCornerShape(999.dp),
                color = mobileSuccess.copy(alpha = 0.75f),
              ) {}
            }

            Text(
              text =
                if (state.flipped) {
                  if (chessRow(index) == 7) ('h' - chessCol(index)).toString() else if (chessCol(index) == 7) (chessRow(index) + 1).toString() else ""
                } else {
                  if (chessRow(index) == 7) ('a' + chessCol(index)).toString() else if (chessCol(index) == 0) (8 - chessRow(index)).toString() else ""
                },
              modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 4.dp, vertical = 2.dp),
              style = mobileCaption2,
              color = mobileTextTertiary,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun <T> ModeSelector(
  options: List<T>,
  selected: T,
  label: (T) -> String,
  onSelect: (T) -> Unit,
) {
  LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    items(options) { option ->
      val active = option == selected
      Surface(
        onClick = { onSelect(option) },
        shape = RoundedCornerShape(4.dp),
        color = if (active) mobileAccentSoft else mobileSurfaceStrong.copy(alpha = 0.72f),
        border = BorderStroke(1.dp, if (active) mobileAccent else mobileBorder),
      ) {
        Text(
          label(option).uppercase(),
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
          style = mobileCaption1.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
          color = if (active) mobileAccent else mobileTextSecondary,
        )
      }
    }
  }
}

@Composable
private fun ArcadeActionButton(
  label: String,
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  val borderColor =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccess
      SolanaPanelTone.Purple -> mobileAccent
      SolanaPanelTone.Orange -> mobileWarning
      SolanaPanelTone.Neutral -> mobileBorder
    }
  val containerColor =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccessSoft
      SolanaPanelTone.Purple -> mobileRuntimePanelPurple
      SolanaPanelTone.Orange -> mobileWarningSoft
      SolanaPanelTone.Neutral -> mobileSurface
    }

  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.height(44.dp),
    shape = RoundedCornerShape(4.dp),
    colors = ButtonDefaults.buttonColors(containerColor = containerColor, contentColor = borderColor),
    border = BorderStroke(1.dp, borderColor),
  ) {
    Text(label, style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
  }
}

private fun buildChessArchiveInviteRequest(
  session: WalletChessSession,
  game: ChessGameState,
  invite: WalletChessInvitePayload,
  packet: WalletChessSignedPacket,
  packetEncoded: String,
): ConvexChessSavePacketRequest =
  ConvexChessSavePacketRequest(
    matchId = invite.matchId,
    packetKind = "invite",
    packetEncoded = packetEncoded,
    signerWalletAddress = packet.signerAddress,
    payloadJson = packet.payloadJson,
    signatureBase58 = packet.signatureBase58,
    inviterWalletAddress = invite.inviterAddress,
    inviterLabel = invite.inviterLabel,
    inviterColor = invite.inviterColor.name,
    remoteWalletAddress = session.remoteAddress,
    localColor = session.localColor.name,
    positionFingerprint = chessPositionFingerprint(game.position),
    positionStatus = game.position.status.name,
    moveCount = game.moveLog.size,
    signedAtMs = invite.createdAtMs,
  )

private fun buildChessArchiveMoveRequest(
  session: WalletChessSession,
  game: ChessGameState,
  payload: WalletChessMovePayload,
  packet: WalletChessSignedPacket,
  packetEncoded: String,
): ConvexChessSavePacketRequest =
  ConvexChessSavePacketRequest(
    matchId = payload.matchId,
    packetKind = "move",
    packetEncoded = packetEncoded,
    signerWalletAddress = packet.signerAddress,
    payloadJson = packet.payloadJson,
    signatureBase58 = packet.signatureBase58,
    inviterWalletAddress = session.inviterAddress,
    inviterLabel = null,
    inviterColor = if (session.localAddress == session.inviterAddress) session.localColor.name else session.localColor.opposite().name,
    remoteWalletAddress = session.remoteAddress,
    localColor = session.localColor.name,
    positionFingerprint = chessPositionFingerprint(game.position),
    positionStatus = game.position.status.name,
    moveCount = game.moveLog.size,
    signedAtMs = payload.sentAtMs,
    ply = payload.ply,
    move = payload.move,
    moveDisplay = payload.moveDisplay,
    beforeFingerprint = payload.beforeFingerprint,
    afterFingerprint = payload.afterFingerprint,
  )

private fun restoreSavedWalletChessMatch(
  detail: ConvexChessMatchDetail,
  localAddress: String,
): WalletChessImportResult {
  var session: WalletChessSession? = null
  var game = resetChessGame()

  detail.events.sortedWith(compareBy<ai.openclaw.app.convex.ConvexChessPacketEvent>({ it.createdAt }, { it.ply ?: 0 })).forEach { event ->
    val packet = walletChessDecodePacket(event.packetEncoded)
    require(walletChessVerifyPacket(packet)) { "A saved chess packet failed wallet signature verification." }
    when (packet.kind) {
      "invite" -> {
        val invite = walletChessDecodeInvite(packet)
        val isInviter = invite.inviterAddress == localAddress
        session =
          WalletChessSession(
            matchId = invite.matchId,
            localAddress = localAddress,
            remoteAddress =
              if (isInviter) {
                detail.summary.opponentWalletAddress
              } else {
                invite.inviterAddress
              },
            localColor = if (isInviter) invite.inviterColor else invite.inviterColor.opposite(),
            inviterAddress = invite.inviterAddress,
          )
        game = resetChessGame()
      }

      "move" -> {
        val currentSession = requireNotNull(session) { "Saved match is missing its invite packet." }
        val payload = walletChessDecodeMove(packet)
        require(payload.matchId == currentSession.matchId) { "Saved move packet belongs to a different match." }
        require(chessPositionFingerprint(game.position) == payload.beforeFingerprint) {
          "Saved move history does not match the archived board fingerprint."
        }
        val move =
          findLegalMoveByToken(game.position, payload.move)
            ?: throw IllegalStateException("Saved move ${payload.move} is no longer legal for the restored position.")
        val nextGame = applyChessMoveToGame(game, move)
        require(chessPositionFingerprint(nextGame.position) == payload.afterFingerprint) {
          "Saved move ${payload.move} failed fingerprint validation during restore."
        }
        game = nextGame
        if (payload.signerAddress != localAddress) {
          session = currentSession.copy(remoteAddress = payload.signerAddress)
        }
      }
    }
  }

  val restoredSession = requireNotNull(session) { "Saved match is missing its invite packet." }
  return WalletChessImportResult(
    session = restoredSession,
    game = game,
    statusText = "Restored ${detail.summary.moveCount} archived plies.",
  )
}

private fun formatChessArchiveTime(epochMs: Long): String =
  runCatching {
    SimpleDateFormat("MMM d, h:mm a", Locale.US).format(Date(epochMs))
  }.getOrElse { "recently" }

data class WalletChessImportResult(
  val session: WalletChessSession,
  val game: ChessGameState,
  val statusText: String,
)

fun importWalletChessPacket(
  raw: String,
  currentSession: WalletChessSession?,
  currentGame: ChessGameState,
  localAddress: String,
): WalletChessImportResult {
  val packet = walletChessDecodePacket(raw)
  require(walletChessVerifyPacket(packet)) { "That chess packet failed wallet signature verification." }

  return when (packet.kind) {
    "invite" -> {
      val payload = walletChessDecodeInvite(packet)
      require(payload.inviterAddress != localAddress) { "That invite was signed by your own wallet." }
      WalletChessImportResult(
        session =
          WalletChessSession(
            matchId = payload.matchId,
            localAddress = localAddress,
            remoteAddress = payload.inviterAddress,
            localColor = payload.inviterColor.opposite(),
            inviterAddress = payload.inviterAddress,
          ),
        game = resetChessGame(),
        statusText =
          "Joined ${payload.inviterLabel.ifBlank { shortChessWallet(payload.inviterAddress) }}'s match as ${payload.inviterColor.opposite().name}.",
      )
    }

    "move" -> {
      val session = requireNotNull(currentSession) { "Import an invite before importing move packets." }
      val payload = walletChessDecodeMove(packet)
      require(payload.matchId == session.matchId) { "That move belongs to a different match." }
      require(payload.signerAddress != localAddress) { "That move was signed by your own wallet." }
      require(currentGame.position.turn != session.localColor) { "It is still your turn locally, so that remote move cannot be applied yet." }
      session.remoteAddress?.let { require(it == payload.signerAddress) { "That move was signed by a different opponent wallet." } }
      require(chessPositionFingerprint(currentGame.position) == payload.beforeFingerprint) { "This move does not match your current board state." }
      val move = findLegalMoveByToken(currentGame.position, payload.move)
        ?: throw IllegalStateException("That move is not legal in the current position.")
      val nextGame = applyChessMoveToGame(currentGame, move)
      require(chessPositionFingerprint(nextGame.position) == payload.afterFingerprint) { "The imported move failed board fingerprint validation." }
      WalletChessImportResult(
        session = session.copy(remoteAddress = payload.signerAddress),
        game = nextGame,
        statusText = "Imported ${payload.moveDisplay} from ${shortChessWallet(payload.signerAddress)}.",
      )
    }

    else -> throw IllegalStateException("Unsupported chess packet type.")
  }
}

private fun chessStatusText(game: ChessGameState): String =
  when (game.position.status) {
    ChessPositionStatus.Check -> "${game.position.turn.name.lowercase().replaceFirstChar(Char::uppercase)} is in check."
    ChessPositionStatus.Checkmate -> "${game.position.turn.name.lowercase().replaceFirstChar(Char::uppercase)} is checkmated."
    ChessPositionStatus.Stalemate -> "Stalemate. No legal moves remain."
    ChessPositionStatus.Normal ->
      if (game.selectedIndex == null) {
        "Tap a piece to see legal moves. Castling, promotion, and en passant are active."
      } else {
        "Selected ${chessNotation(game.selectedIndex)}. Legal targets are highlighted."
      }
  }

private fun copyToClipboard(context: Context, label: String, value: String) {
  val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
  clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
}

private fun shareText(context: Context, title: String, value: String) {
  val intent =
    Intent(Intent.ACTION_SEND)
      .setType("text/plain")
      .putExtra(Intent.EXTRA_SUBJECT, title)
      .putExtra(Intent.EXTRA_TEXT, value)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  context.startActivity(Intent.createChooser(intent, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

private fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }

@Composable
private fun outlinedColors() =
  OutlinedTextFieldDefaults.colors(
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurfaceStrong.copy(alpha = 0.68f),
    cursorColor = mobileAccent,
  )

private fun walletChessProtocolJson() =
  kotlinx.serialization.json.Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }
