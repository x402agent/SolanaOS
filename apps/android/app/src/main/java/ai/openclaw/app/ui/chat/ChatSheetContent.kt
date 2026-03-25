package ai.openclaw.app.ui.chat

import android.content.ContentResolver
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.chat.ChatSessionEntry
import ai.openclaw.app.chat.ChatTransportMode
import ai.openclaw.app.chat.OutgoingAttachment
import ai.openclaw.app.ui.mobileAccent
import ai.openclaw.app.ui.mobileAccentSoft
import ai.openclaw.app.ui.mobileBorder
import ai.openclaw.app.ui.mobileBorderStrong
import ai.openclaw.app.ui.mobileCallout
import ai.openclaw.app.ui.mobileCaption1
import ai.openclaw.app.ui.mobileCaption2
import ai.openclaw.app.ui.mobileDanger
import ai.openclaw.app.ui.mobileDangerSoft
import ai.openclaw.app.ui.mobileSuccess
import ai.openclaw.app.ui.mobileSuccessSoft
import ai.openclaw.app.ui.mobileSurfaceStrong
import ai.openclaw.app.ui.mobileText
import ai.openclaw.app.ui.mobileTextSecondary
import ai.openclaw.app.ui.mobileWarning
import ai.openclaw.app.ui.mobileWarningSoft
import ai.openclaw.app.ui.SolanaBackendLink
import ai.openclaw.app.ui.SolanaBackplaneCard
import ai.openclaw.app.ui.SolanaPanel
import ai.openclaw.app.ui.SolanaPanelTone
import ai.openclaw.app.ui.SolanaSectionLabel
import ai.openclaw.app.ui.SolanaStatusPill
import java.io.ByteArrayOutputStream
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ChatSheetContent(viewModel: MainViewModel) {
  val messages by viewModel.chatMessages.collectAsState()
  val errorText by viewModel.chatError.collectAsState()
  val pendingRunCount by viewModel.pendingRunCount.collectAsState()
  val healthOk by viewModel.chatHealthOk.collectAsState()
  val transportMode by viewModel.chatTransportMode.collectAsState()
  val gatewayRpcAvailable by viewModel.chatGatewayRpcAvailable.collectAsState()
  val openRouterAvailable by viewModel.chatOpenRouterAvailable.collectAsState()
  val chatStatusText by viewModel.chatStatusText.collectAsState()
  val nodeBridgeOnly by viewModel.nodeBridgeOnly.collectAsState()
  val sessionKey by viewModel.chatSessionKey.collectAsState()
  val mainSessionKey by viewModel.mainSessionKey.collectAsState()
  val thinkingLevel by viewModel.chatThinkingLevel.collectAsState()
  val streamingAssistantText by viewModel.chatStreamingAssistantText.collectAsState()
  val pendingToolCalls by viewModel.chatPendingToolCalls.collectAsState()
  val toolActivity by viewModel.chatToolActivity.collectAsState()
  val sessions by viewModel.chatSessions.collectAsState()
  val liveCameraVisionAvailable by viewModel.liveCameraVisionAvailable.collectAsState()
  val liveCameraPreviewActive by viewModel.liveCameraPreviewActive.collectAsState()
  val liveCameraBusy by viewModel.liveCameraBusy.collectAsState()
  val liveCameraLiveEnabled by viewModel.liveCameraLiveEnabled.collectAsState()
  val liveCameraStatusText by viewModel.liveCameraStatusText.collectAsState()
  val liveCameraLatestCommentary by viewModel.liveCameraLatestCommentary.collectAsState()

  LaunchedEffect(mainSessionKey) {
    viewModel.loadChat(mainSessionKey)
    viewModel.refreshChatSessions(limit = 200)
  }

  val context = LocalContext.current
  val resolver = context.contentResolver
  val scope = rememberCoroutineScope()
  var runtimeExpanded by rememberSaveable { mutableStateOf(false) }
  var toolsExpanded by rememberSaveable { mutableStateOf(false) }

  val attachments = remember { mutableStateListOf<PendingImageAttachment>() }

  val pickImages =
    rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
      if (uris.isNullOrEmpty()) return@rememberLauncherForActivityResult
      scope.launch(Dispatchers.IO) {
        val next =
          uris.take(8).mapNotNull { uri ->
            try {
              loadImageAttachment(resolver, uri)
            } catch (_: Throwable) {
              null
            }
          }
        withContext(Dispatchers.Main) {
          attachments.addAll(next)
        }
      }
    }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .padding(horizontal = 12.dp, vertical = 8.dp),
    verticalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaStatusPill(
        label =
          when (transportMode) {
            ChatTransportMode.Gateway -> "Gateway"
            ChatTransportMode.OpenRouter -> "Hosted"
            ChatTransportMode.Offline -> "Offline"
          },
        active = healthOk,
        tone = SolanaPanelTone.Green,
      )
      SolanaStatusPill(
        label = if (pendingRunCount > 0) "Thinking" else "Idle",
        active = pendingRunCount > 0,
        tone = SolanaPanelTone.Purple,
      )
      if (nodeBridgeOnly) {
        SolanaStatusPill(
          label = "Bridge Only",
          active = true,
          tone = SolanaPanelTone.Orange,
        )
      }
      ChatTogglePill(label = if (runtimeExpanded) "Runtime Open" else "Runtime", active = runtimeExpanded) {
        runtimeExpanded = !runtimeExpanded
      }
      ChatTogglePill(label = if (toolsExpanded) "Vision Open" else "Vision", active = toolsExpanded) {
        toolsExpanded = !toolsExpanded
      }
    }

    if (runtimeExpanded) {
      SolanaBackplaneCard(
        title = "Chat Backplane",
        subtitle = "Chat routes through the live backend selected below. Runtime messaging and vision commentary stay on the same connection surface.",
        links =
          listOf(
            SolanaBackendLink(
              label = "Transport",
              state =
                when (transportMode) {
                  ChatTransportMode.Gateway -> "Gateway"
                  ChatTransportMode.OpenRouter -> "Hosted"
                  ChatTransportMode.Offline -> "Offline"
                },
              detail = chatStatusText,
              tone = SolanaPanelTone.Green,
              active = healthOk,
            ),
            SolanaBackendLink(
              label = "Gateway RPC",
              state = if (gatewayRpcAvailable) "Available" else "Missing",
              detail = if (gatewayRpcAvailable) "Host runtime commands and streamed tool events are available." else "Pair the runtime to unlock host command execution and tool streaming.",
              tone = SolanaPanelTone.Purple,
              active = gatewayRpcAvailable,
            ),
            SolanaBackendLink(
              label = "Fallback Chat",
              state = if (openRouterAvailable) "Ready" else "Missing",
              detail = if (openRouterAvailable) "The hosted SolanaOS agent is available when gateway chat is unavailable." else "No hosted SolanaOS agent is configured for this build.",
              tone = SolanaPanelTone.Orange,
              active = openRouterAvailable,
            ),
            SolanaBackendLink(
              label = "Live Camera",
              state = if (liveCameraVisionAvailable) "Ready" else "Disabled",
              detail = liveCameraStatusText,
              tone = SolanaPanelTone.Purple,
              active = liveCameraVisionAvailable,
            ),
          ),
      )

      if (transportMode == ChatTransportMode.OpenRouter && !gatewayRpcAvailable) {
        SolanaPanel(
          modifier = Modifier.fillMaxWidth(),
          tone = SolanaPanelTone.Purple,
        ) {
          SolanaSectionLabel("Fallback Mode", tone = SolanaPanelTone.Purple)
          Text(
            "Gateway chat is currently unavailable, so the app is using its hosted SolanaOS agent for messaging.",
            style = mobileCallout,
            color = mobileText,
          )
        }
      }
    }

    ChatThreadSelector(
      sessionKey = sessionKey,
      sessions = sessions,
      mainSessionKey = mainSessionKey,
      healthOk = healthOk,
      transportMode = transportMode,
      nodeBridgeOnly = nodeBridgeOnly,
      onSelectSession = { key -> viewModel.switchChatSession(key) },
    )

    if (!errorText.isNullOrBlank()) {
      ChatErrorRail(errorText = errorText!!)
    }

    if (toolsExpanded) {
      LiveCameraCard(
        visionAvailable = liveCameraVisionAvailable,
        previewActive = liveCameraPreviewActive,
        busy = liveCameraBusy,
        liveEnabled = liveCameraLiveEnabled,
        statusText = liveCameraStatusText,
        latestCommentary = liveCameraLatestCommentary,
        onAttachPreview = { previewView -> viewModel.attachLiveCameraPreview(previewView) },
        onDetachPreview = { viewModel.detachLiveCameraPreview() },
        onAttachFrame = {
          val frame = viewModel.captureLiveCameraFrame()
          attachments.add(
            PendingImageAttachment(
              id = "camera-" + UUID.randomUUID().toString(),
              fileName = "live-camera-frame.jpg",
              mimeType = frame.mimeType,
              base64 = frame.base64,
            ),
          )
        },
        onAnalyzeFrame = { viewModel.analyzeLiveCameraFrame() },
        onSetLiveEnabled = { enabled -> viewModel.setLiveCameraCommentaryEnabled(enabled) },
      )
    }

    if (toolActivity.isNotEmpty()) {
      ChatToolActivityRail(toolEvents = toolActivity)
    }

    ChatMessageListCard(
      messages = messages,
      pendingRunCount = pendingRunCount,
      pendingToolCalls = pendingToolCalls,
      streamingAssistantText = streamingAssistantText,
      healthOk = healthOk,
      modifier = Modifier.weight(1f, fill = true),
    )

    Row(modifier = Modifier.fillMaxWidth().imePadding()) {
      ChatComposer(
        healthOk = healthOk,
        nodeBridgeOnly = nodeBridgeOnly,
        openRouterAvailable = openRouterAvailable,
        chatStatusText = chatStatusText,
        thinkingLevel = thinkingLevel,
        pendingRunCount = pendingRunCount,
        attachments = attachments,
        onPickImages = { pickImages.launch("image/*") },
        onRemoveAttachment = { id -> attachments.removeAll { it.id == id } },
        onSetThinkingLevel = { level -> viewModel.setChatThinkingLevel(level) },
        onRefresh = {
          viewModel.refreshChat()
          viewModel.refreshChatSessions(limit = 200)
        },
        onAbort = { viewModel.abortChat() },
        onSend = { text ->
          val outgoing =
            attachments.map { att ->
              OutgoingAttachment(
                type = "image",
                mimeType = att.mimeType,
                fileName = att.fileName,
                base64 = att.base64,
              )
            }
          viewModel.sendChat(message = text, thinking = thinkingLevel, attachments = outgoing)
          attachments.clear()
        },
      )
    }
  }
}

@Composable
private fun ChatThreadSelector(
  sessionKey: String,
  sessions: List<ChatSessionEntry>,
  mainSessionKey: String,
  healthOk: Boolean,
  transportMode: ChatTransportMode,
  nodeBridgeOnly: Boolean,
  onSelectSession: (String) -> Unit,
) {
  val sessionOptions = resolveSessionChoices(sessionKey, sessions, mainSessionKey = mainSessionKey)
  val currentSessionLabel =
    friendlySessionName(sessionOptions.firstOrNull { it.key == sessionKey }?.displayName ?: sessionKey)

  if (sessionOptions.size <= 1) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
      Text(
        text = currentSessionLabel,
        style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
        color = mobileTextSecondary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      ChatConnectionPill(healthOk = healthOk, transportMode = transportMode, nodeBridgeOnly = nodeBridgeOnly)
    }
    return
  }

  Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
      Text(
        text = "SESSION",
        style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp),
        color = mobileTextSecondary,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Text(
          text = currentSessionLabel,
          style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
          color = mobileText,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        ChatConnectionPill(healthOk = healthOk, transportMode = transportMode, nodeBridgeOnly = nodeBridgeOnly)
      }
    }

    Row(
      modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      for (entry in sessionOptions) {
        val active = entry.key == sessionKey
        Surface(
          onClick = { onSelectSession(entry.key) },
          shape = RoundedCornerShape(14.dp),
          color = if (active) mobileAccent else mobileSurfaceStrong,
          border = BorderStroke(1.dp, if (active) mobileAccent.copy(alpha = 0.7f) else mobileBorderStrong),
          tonalElevation = 0.dp,
          shadowElevation = 0.dp,
        ) {
          Text(
            text = friendlySessionName(entry.displayName ?: entry.key),
            style = mobileCaption1.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
            color = if (active) Color.White else mobileText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
          )
        }
      }
    }
  }
}

@Composable
private fun ChatTogglePill(label: String, active: Boolean, onClick: () -> Unit) {
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(999.dp),
    color = if (active) mobileAccentSoft else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) mobileAccent.copy(alpha = 0.3f) else mobileBorderStrong),
  ) {
    Text(
      text = label,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = if (active) mobileAccent else mobileTextSecondary,
    )
  }
}

@Composable
private fun ChatConnectionPill(healthOk: Boolean, transportMode: ChatTransportMode, nodeBridgeOnly: Boolean) {
  val text =
    when (transportMode) {
      ChatTransportMode.Gateway -> if (healthOk) "Gateway" else "Offline"
      ChatTransportMode.OpenRouter -> if (healthOk) "Hosted" else "Offline"
      ChatTransportMode.Offline -> if (nodeBridgeOnly) "Node only" else "Offline"
    }
  val background =
    when (transportMode) {
      ChatTransportMode.Gateway -> if (healthOk) mobileSuccessSoft else mobileWarningSoft
      ChatTransportMode.OpenRouter -> mobileAccent.copy(alpha = 0.12f)
      ChatTransportMode.Offline -> if (nodeBridgeOnly) mobileSurfaceStrong else mobileWarningSoft
    }
  val border =
    when (transportMode) {
      ChatTransportMode.Gateway -> if (healthOk) mobileSuccess.copy(alpha = 0.35f) else mobileWarning.copy(alpha = 0.35f)
      ChatTransportMode.OpenRouter -> mobileAccent.copy(alpha = 0.28f)
      ChatTransportMode.Offline -> if (nodeBridgeOnly) mobileBorderStrong else mobileWarning.copy(alpha = 0.35f)
    }
  val color =
    when (transportMode) {
      ChatTransportMode.Gateway -> if (healthOk) mobileSuccess else mobileWarning
      ChatTransportMode.OpenRouter -> mobileAccent
      ChatTransportMode.Offline -> if (nodeBridgeOnly) mobileTextSecondary else mobileWarning
    }
  Surface(
    shape = RoundedCornerShape(999.dp),
    color = background,
    border = BorderStroke(1.dp, border),
  ) {
    Text(
      text = text,
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = color,
      modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
    )
  }
}

@Composable
private fun ChatErrorRail(errorText: String) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = mobileDangerSoft,
    shape = RoundedCornerShape(12.dp),
    border = androidx.compose.foundation.BorderStroke(1.dp, mobileDanger),
  ) {
    Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(
        text = "CHAT ERROR",
        style = mobileCaption2.copy(letterSpacing = 0.6.sp),
        color = mobileDanger,
      )
      Text(text = errorText, style = mobileCallout, color = mobileText)
    }
  }
}

data class PendingImageAttachment(
  val id: String,
  val fileName: String,
  val mimeType: String,
  val base64: String,
)

private suspend fun loadImageAttachment(resolver: ContentResolver, uri: Uri): PendingImageAttachment {
  val mimeType = resolver.getType(uri) ?: "image/*"
  val fileName = (uri.lastPathSegment ?: "image").substringAfterLast('/')
  val bytes =
    withContext(Dispatchers.IO) {
      resolver.openInputStream(uri)?.use { input ->
        val out = ByteArrayOutputStream()
        input.copyTo(out)
        out.toByteArray()
      } ?: ByteArray(0)
    }
  if (bytes.isEmpty()) throw IllegalStateException("empty attachment")
  val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
  return PendingImageAttachment(
    id = uri.toString() + "#" + System.currentTimeMillis().toString(),
    fileName = fileName,
    mimeType = mimeType,
    base64 = base64,
  )
}
