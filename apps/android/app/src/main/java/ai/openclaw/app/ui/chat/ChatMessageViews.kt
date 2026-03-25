package ai.openclaw.app.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.openclaw.app.chat.ChatMessage
import ai.openclaw.app.chat.ChatMessageContent
import ai.openclaw.app.chat.ChatPendingToolCall
import ai.openclaw.app.chat.ChatToolActivityEntry
import ai.openclaw.app.tools.ToolDisplayRegistry
import ai.openclaw.app.ui.mobileAccent
import ai.openclaw.app.ui.mobileAccentSoft
import ai.openclaw.app.ui.mobileBody
import ai.openclaw.app.ui.mobileBorder
import ai.openclaw.app.ui.mobileBorderStrong
import ai.openclaw.app.ui.mobileCallout
import ai.openclaw.app.ui.mobileCaption1
import ai.openclaw.app.ui.mobileCaption2
import ai.openclaw.app.ui.mobileCodeBg
import ai.openclaw.app.ui.mobileCodeText
import ai.openclaw.app.ui.mobileHeadline
import ai.openclaw.app.ui.mobileMonoFontFamily
import ai.openclaw.app.ui.mobileSurface
import ai.openclaw.app.ui.mobileSurfaceStrong
import ai.openclaw.app.ui.mobileSuccess
import ai.openclaw.app.ui.mobileText
import ai.openclaw.app.ui.mobileTextSecondary
import ai.openclaw.app.ui.mobileWarning
import ai.openclaw.app.ui.mobileWarningSoft
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val assistantBubbleText = mobileText
private val assistantBubbleSecondaryText = Color(0xFFA4B0C3)

private data class ChatBubbleStyle(
  val alignEnd: Boolean,
  val containerColor: Color,
  val borderColor: Color,
  val roleColor: Color,
  val bodyColor: Color,
  val metaColor: Color,
)

@Composable
fun ChatMessageBubble(message: ChatMessage) {
  val role = message.role.trim().lowercase(Locale.US)
  val style = bubbleStyle(role)

  // Filter to only displayable content parts (text with content, or base64 images).
  val displayableContent =
    message.content.filter { part ->
      when (part.type) {
        "text" -> !part.text.isNullOrBlank()
        else -> part.base64 != null
      }
    }

  if (displayableContent.isEmpty()) return

  ChatBubbleContainer(
    style = style,
    roleLabel = roleLabel(role),
    timestampLabel = message.timestampMs?.let(::formatMessageTimestamp),
  ) {
    SelectionContainer {
      ChatMessageBody(content = displayableContent, textColor = style.bodyColor)
    }
  }
}

@Composable
private fun ChatBubbleContainer(
  style: ChatBubbleStyle,
  roleLabel: String,
  modifier: Modifier = Modifier,
  timestampLabel: String? = null,
  content: @Composable () -> Unit,
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = if (style.alignEnd) Arrangement.End else Arrangement.Start,
  ) {
    Surface(
      shape = RoundedCornerShape(18.dp),
      border = BorderStroke(1.dp, style.borderColor),
      color = style.containerColor,
      tonalElevation = 0.dp,
      shadowElevation = 0.dp,
      modifier = Modifier.fillMaxWidth(0.94f),
    ) {
      Column(
        modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            text = roleLabel,
            style = mobileCaption2.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.9.sp),
            color = style.roleColor,
          )
          if (!timestampLabel.isNullOrBlank()) {
            Text(
              text = timestampLabel,
              style = mobileCaption2,
              color = style.metaColor,
            )
          }
        }
        Surface(
          shape = RoundedCornerShape(14.dp),
          color = Color.White.copy(alpha = 0.015f),
          border = BorderStroke(1.dp, style.borderColor.copy(alpha = 0.22f)),
        )
        {
          Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
          ) {
            content()
          }
        }
      }
    }
  }
}

@Composable
private fun ChatMessageBody(content: List<ChatMessageContent>, textColor: Color) {
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    for (part in content) {
      when (part.type) {
        "text" -> {
          val text = part.text ?: continue
          ChatMarkdown(text = text, textColor = textColor)
        }
        else -> {
          val b64 = part.base64 ?: continue
          ChatBase64Image(base64 = b64, mimeType = part.mimeType)
        }
      }
    }
  }
}

@Composable
fun ChatTypingIndicatorBubble() {
  ChatBubbleContainer(
    style = bubbleStyle("assistant"),
    roleLabel = roleLabel("assistant"),
  ) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      DotPulse(color = assistantBubbleSecondaryText)
      Text("Thinking...", style = mobileCallout, color = assistantBubbleSecondaryText)
    }
  }
}

@Composable
fun ChatPendingToolsBubble(toolCalls: List<ChatPendingToolCall>) {
  val context = LocalContext.current
  val displays =
    remember(toolCalls, context) {
      toolCalls.map { ToolDisplayRegistry.resolve(context, it.name, it.args) }
    }

  ChatBubbleContainer(
    style = bubbleStyle("assistant"),
    roleLabel = "TOOLS",
  ) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text("Running tools...", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = assistantBubbleSecondaryText)
      for (display in displays.take(6)) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(
            "${display.emoji} ${display.label}",
            style = mobileBody.copy(fontSize = 14.sp, lineHeight = 20.sp),
            color = assistantBubbleText,
            fontFamily = mobileMonoFontFamily,
          )
          display.detailLine?.let { detail ->
            Text(
              detail,
              style = mobileCaption1,
              color = assistantBubbleSecondaryText,
              fontFamily = mobileMonoFontFamily,
            )
          }
        }
      }
      if (toolCalls.size > 6) {
        Text(
          text = "... +${toolCalls.size - 6} more",
          style = mobileCaption1,
          color = assistantBubbleSecondaryText,
        )
      }
    }
  }
}

@Composable
fun ChatToolActivityRail(toolEvents: List<ChatToolActivityEntry>) {
  val context = LocalContext.current
  val displays =
    remember(toolEvents, context) {
      toolEvents.takeLast(6).reversed().map { entry ->
        entry to ToolDisplayRegistry.resolve(context, entry.name, entry.args, meta = entry.detail)
      }
    }

  Surface(
    shape = RoundedCornerShape(4.dp),
    border = BorderStroke(1.dp, mobileBorderStrong),
    color = mobileSurfaceStrong,
    modifier = Modifier.fillMaxWidth(),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 11.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      Text(
        text = "RECENT TOOL ACTIVITY",
        style = mobileCaption2.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.9.sp),
        color = mobileAccent,
      )
      for ((entry, display) in displays) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
          ) {
            Text(
              text = display.summaryLine,
              style = mobileBody.copy(fontSize = 14.sp, lineHeight = 20.sp),
              color = mobileText,
              fontFamily = mobileMonoFontFamily,
            )
            if (!entry.detail.isNullOrBlank()) {
              Text(
                text = entry.detail!!,
                style = mobileCaption1,
                color = assistantBubbleSecondaryText,
                fontFamily = mobileMonoFontFamily,
              )
            }
          }
          Surface(
            shape = RoundedCornerShape(999.dp),
            color = toolPhaseColor(entry.phase).copy(alpha = 0.14f),
            border = BorderStroke(1.dp, toolPhaseColor(entry.phase).copy(alpha = 0.45f)),
          ) {
            Text(
              text = toolPhaseLabel(entry.phase),
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
              style = mobileCaption2.copy(fontWeight = FontWeight.SemiBold),
              color = toolPhaseColor(entry.phase),
            )
          }
        }
      }
    }
  }
}

@Composable
fun ChatStreamingAssistantBubble(text: String) {
  ChatBubbleContainer(
    style = bubbleStyle("assistant").copy(borderColor = mobileAccent),
    roleLabel = "ASSISTANT · LIVE",
  ) {
    SelectionContainer {
      ChatMarkdown(text = text, textColor = assistantBubbleText)
    }
  }
}

private fun bubbleStyle(role: String): ChatBubbleStyle {
  return when (role) {
    "user" ->
      ChatBubbleStyle(
        alignEnd = true,
        containerColor = mobileAccentSoft,
        borderColor = mobileAccent.copy(alpha = 0.75f),
        roleColor = mobileAccent,
        bodyColor = mobileText,
        metaColor = mobileTextSecondary,
      )

    "system" ->
      ChatBubbleStyle(
        alignEnd = false,
        containerColor = mobileWarningSoft,
        borderColor = mobileWarning.copy(alpha = 0.45f),
        roleColor = mobileWarning,
        bodyColor = mobileText,
        metaColor = mobileTextSecondary,
      )

    else ->
      ChatBubbleStyle(
        alignEnd = false,
        containerColor = mobileSurfaceStrong,
        borderColor = mobileBorder.copy(alpha = 0.8f),
        roleColor = mobileAccent,
        bodyColor = mobileText,
        metaColor = assistantBubbleSecondaryText,
      )
  }
}

private fun roleLabel(role: String): String {
  return when (role) {
    "user" -> "YOU"
    "system" -> "SYSTEM"
    else -> "SOLANAOS"
  }
}

private fun toolPhaseLabel(phase: String): String {
  return when (phase.lowercase(Locale.US)) {
    "start" -> "RUNNING"
    "result" -> "DONE"
    "error" -> "ERROR"
    "approval" -> "APPROVAL"
    "denied" -> "DENIED"
    "limit" -> "LIMIT"
    else -> phase.uppercase(Locale.US)
  }
}

private fun toolPhaseColor(phase: String): Color {
  return when (phase.lowercase(Locale.US)) {
    "start", "approval" -> mobileAccent
    "result" -> mobileSuccess
    "error", "denied" -> mobileWarning
    "limit" -> mobileWarning
    else -> mobileTextSecondary
  }
}

@Composable
private fun ChatBase64Image(base64: String, mimeType: String?) {
  val imageState = rememberBase64ImageState(base64)
  val image = imageState.image

  if (image != null) {
    Surface(
      shape = RoundedCornerShape(16.dp),
      border = BorderStroke(1.dp, mobileBorder),
      color = mobileSurface,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Image(
        bitmap = image!!,
        contentDescription = mimeType ?: "attachment",
        contentScale = ContentScale.Fit,
        modifier = Modifier.fillMaxWidth(),
      )
    }
  } else if (imageState.failed) {
    Text("Unsupported attachment", style = mobileCaption1, color = mobileTextSecondary)
  }
}

@Composable
private fun DotPulse(color: Color) {
  Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
    PulseDot(alpha = 0.38f, color = color)
    PulseDot(alpha = 0.62f, color = color)
    PulseDot(alpha = 0.90f, color = color)
  }
}

@Composable
private fun PulseDot(alpha: Float, color: Color) {
  Surface(
    modifier = Modifier.size(6.dp).alpha(alpha),
    shape = RoundedCornerShape(1.dp),
    color = color,
  ) {}
}

@Composable
fun ChatCodeBlock(code: String, language: String?) {
  Surface(
    shape = RoundedCornerShape(16.dp),
    color = mobileCodeBg,
    border = BorderStroke(1.dp, mobileBorder),
    modifier = Modifier.fillMaxWidth(),
  ) {
    Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
      if (!language.isNullOrBlank()) {
        Text(
          text = language.uppercase(Locale.US),
          style = mobileCaption2.copy(letterSpacing = 0.4.sp),
          color = mobileTextSecondary,
        )
      }
        Text(
          text = code.trimEnd(),
          fontFamily = mobileMonoFontFamily,
          style = mobileCallout,
          color = mobileCodeText,
        )
    }
  }
}

private fun formatMessageTimestamp(timestampMs: Long): String {
  val formatter = SimpleDateFormat("h:mm a", Locale.US)
  return formatter.format(Date(timestampMs))
}
