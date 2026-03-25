package ai.openclaw.app.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.openclaw.app.chat.ChatMessage
import ai.openclaw.app.chat.ChatPendingToolCall
import ai.openclaw.app.ui.mobileAccent
import ai.openclaw.app.ui.mobileBorder
import ai.openclaw.app.ui.mobileCallout
import ai.openclaw.app.ui.mobileHeadline
import ai.openclaw.app.ui.mobileCodeBg
import ai.openclaw.app.ui.mobileSurfaceStrong
import ai.openclaw.app.ui.mobileCaption2
import ai.openclaw.app.ui.mobileText
import ai.openclaw.app.ui.mobileTextSecondary

@Composable
fun ChatMessageListCard(
  messages: List<ChatMessage>,
  pendingRunCount: Int,
  pendingToolCalls: List<ChatPendingToolCall>,
  streamingAssistantText: String?,
  healthOk: Boolean,
  modifier: Modifier = Modifier,
) {
  val listState = rememberLazyListState()

  // With reverseLayout the newest item is at index 0 (bottom of screen).
  LaunchedEffect(messages.size, pendingRunCount, pendingToolCalls.size, streamingAssistantText) {
    listState.animateScrollToItem(index = 0)
  }

  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(20.dp),
    color = mobileSurfaceStrong,
    border = androidx.compose.foundation.BorderStroke(1.dp, mobileBorder),
  ) {
    Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp)) {
      Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            text = "CHAT THREAD",
            style = mobileCaption2.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.9.sp),
            color = mobileTextSecondary,
          )
          Text(
            text = if (messages.isEmpty()) "Waiting" else "${messages.size} messages",
            style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
            color = if (healthOk) mobileAccent else mobileTextSecondary,
          )
        }
        LazyColumn(
          modifier = Modifier.fillMaxSize(),
          state = listState,
          reverseLayout = true,
          verticalArrangement = Arrangement.spacedBy(10.dp),
          contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 8.dp),
        ) {
          val stream = streamingAssistantText?.trim()
          if (!stream.isNullOrEmpty()) {
            item(key = "stream") {
              ChatStreamingAssistantBubble(text = stream)
            }
          }

          if (pendingToolCalls.isNotEmpty()) {
            item(key = "tools") {
              ChatPendingToolsBubble(toolCalls = pendingToolCalls)
            }
          }

          if (pendingRunCount > 0) {
            item(key = "typing") {
              ChatTypingIndicatorBubble()
            }
          }

          items(count = messages.size, key = { idx -> messages[messages.size - 1 - idx].id }) { idx ->
            ChatMessageBubble(message = messages[messages.size - 1 - idx])
          }
        }

        if (messages.isEmpty() && pendingRunCount == 0 && pendingToolCalls.isEmpty() && streamingAssistantText.isNullOrBlank()) {
          EmptyChatHint(
            modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
            healthOk = healthOk,
          )
        }
      }
    }
  }
}

@Composable
private fun EmptyChatHint(modifier: Modifier = Modifier, healthOk: Boolean) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileCodeBg,
    border = androidx.compose.foundation.BorderStroke(1.dp, mobileBorder.copy(alpha = 0.85f)),
  ) {
    androidx.compose.foundation.layout.Column(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text("NO MESSAGES YET", style = mobileHeadline, color = mobileText)
      Text(
        text =
          if (healthOk) {
            "Send the first prompt to start the session. Ask for trades, research, wallet actions, or code help."
          } else {
            "Connect the gateway first, then come back here to chat with the runtime."
          },
        style = mobileCallout,
        color = mobileTextSecondary,
      )
    }
  }
}
