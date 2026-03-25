package ai.openclaw.app.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ai.openclaw.app.chat.ChatTransportMode
import ai.openclaw.app.chat.ClaudeControlCommands
import ai.openclaw.app.ui.mobileAccent
import ai.openclaw.app.ui.mobileAccentSoft
import ai.openclaw.app.ui.mobileBorder
import ai.openclaw.app.ui.mobileBorderStrong
import ai.openclaw.app.ui.mobileCallout
import ai.openclaw.app.ui.mobileCaption1
import ai.openclaw.app.ui.mobileHeadline
import ai.openclaw.app.ui.mobileSurface
import ai.openclaw.app.ui.mobileSurfaceStrong
import ai.openclaw.app.ui.mobileText
import ai.openclaw.app.ui.mobileTextSecondary
import ai.openclaw.app.ui.mobileTextTertiary
import ai.openclaw.app.ui.mobileWarning

@Composable
internal fun ClaudeControlCard(
  gatewayRpcAvailable: Boolean,
  nodeBridgeOnly: Boolean,
  openRouterAvailable: Boolean,
  chatStatusText: String,
  transportMode: ChatTransportMode,
  pendingRunCount: Int,
  onSendCommand: (String) -> Unit,
) {
  var prompt by rememberSaveable { mutableStateOf("") }

  val gatewayReady = gatewayRpcAvailable
  val busy = pendingRunCount > 0
  val promptReady = prompt.trim().isNotEmpty()

  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurface,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text("Claude Code", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileAccent)
      Text("Remote control the host CLI", style = mobileHeadline.copy(fontWeight = FontWeight.Bold), color = mobileText)
      Text(
        "This drives the gateway host's local `claude` CLI through `/claude` commands in chat. " +
          "It is not Anthropic Remote Control, which requires claude.ai login instead of API keys.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )

      if (!gatewayReady) {
        Text(
          text =
            when {
              nodeBridgeOnly -> "Connected in native bridge mode. Claude control requires operator WebSocket RPC, not the JSON node bridge."
              openRouterAvailable && transportMode == ChatTransportMode.OpenRouter -> "The hosted SolanaOS agent is active, but Claude control still requires gateway chat RPC."
              openRouterAvailable -> chatStatusText
              else -> "Gateway chat is unavailable, and this build has no hosted SolanaOS agent compiled in."
            },
          style = mobileCallout,
          color = mobileWarning,
        )
      } else {
        Text(
          "Host requirement: install `claude` and set `ANTHROPIC_API_KEY` on the gateway machine. Replies appear below in this chat thread.",
          style = mobileCallout,
          color = mobileTextSecondary,
        )
      }

      Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        ClaudeQuickActionButton(
          label = "Sessions",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(ClaudeControlCommands.sessions()) },
        )
        ClaudeQuickActionButton(
          label = "Status",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(ClaudeControlCommands.status()) },
        )
        ClaudeQuickActionButton(
          label = "Log",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(ClaudeControlCommands.log()) },
        )
        ClaudeQuickActionButton(
          label = "Commit",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(ClaudeControlCommands.commit()) },
        )
        ClaudeQuickActionButton(
          label = "Stop",
          enabled = gatewayReady,
          danger = true,
          onClick = { onSendCommand(ClaudeControlCommands.stop()) },
        )
      }

      OutlinedTextField(
        value = prompt,
        onValueChange = { prompt = it },
        modifier = Modifier.fillMaxWidth(),
        placeholder = {
          Text(
            "Build a Kotlin RPC dashboard in the current repo",
            style = mobileCallout,
            color = mobileTextTertiary,
          )
        },
        minLines = 2,
        maxLines = 4,
        textStyle = mobileCallout.copy(color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = claudeControlTextFieldColors(),
      )

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Button(
          onClick = {
            onSendCommand(ClaudeControlCommands.start(prompt))
            prompt = ""
          },
          enabled = gatewayReady && !busy && promptReady,
          modifier = Modifier.weight(1f).height(46.dp),
          shape = RoundedCornerShape(14.dp),
        ) {
          Text("Start Session", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = {
            onSendCommand(ClaudeControlCommands.continueSession(prompt))
            prompt = ""
          },
          enabled = gatewayReady && !busy && promptReady,
          modifier = Modifier.weight(1f).height(46.dp),
          shape = RoundedCornerShape(14.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = mobileAccentSoft,
              contentColor = mobileAccent,
              disabledContainerColor = mobileAccentSoft.copy(alpha = 0.45f),
              disabledContentColor = mobileTextTertiary,
            ),
          border = BorderStroke(1.dp, mobileBorderStrong),
        ) {
          Text("Continue", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
    }
  }
}

@Composable
private fun ClaudeQuickActionButton(
  label: String,
  enabled: Boolean,
  danger: Boolean = false,
  onClick: () -> Unit,
) {
  Button(
    onClick = onClick,
    enabled = enabled,
    shape = RoundedCornerShape(14.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = mobileSurfaceStrong,
        contentColor = if (danger) mobileWarning else mobileTextSecondary,
        disabledContainerColor = mobileSurfaceStrong.copy(alpha = 0.6f),
        disabledContentColor = mobileTextTertiary,
      ),
    border = BorderStroke(1.dp, if (danger) mobileWarning.copy(alpha = 0.35f) else mobileBorderStrong),
  ) {
    Text(label, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun claudeControlTextFieldColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    cursorColor = mobileAccent,
  )
