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
import ai.openclaw.app.chat.GatewayModelCommands
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
internal fun GatewayModelRouterCard(
  gatewayRpcAvailable: Boolean,
  nodeBridgeOnly: Boolean,
  openRouterAvailable: Boolean,
  chatStatusText: String,
  transportMode: ChatTransportMode,
  pendingRunCount: Int,
  onSendCommand: (String) -> Unit,
) {
  var backend by rememberSaveable { mutableStateOf("ollama") }
  var model by rememberSaveable { mutableStateOf("8bit/DeepSolana") }

  val gatewayReady = gatewayRpcAvailable
  val busy = pendingRunCount > 0

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
      Text("Gateway Model Router", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileAccent)
      Text("Switch the host daemon backend", style = mobileHeadline.copy(fontWeight = FontWeight.Bold), color = mobileText)
      Text(
        "This sends real `/model ...` commands through the connected gateway, so you can flip the host daemon to Ollama while staying inside the Android app.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )

      if (!gatewayReady) {
        Text(
          text =
            when {
              nodeBridgeOnly -> "Connected in native bridge mode. Model switching requires operator WebSocket RPC, not the JSON node bridge."
              openRouterAvailable && transportMode == ChatTransportMode.OpenRouter -> "Standalone chat is active, but gateway model routing still requires gateway RPC."
              openRouterAvailable -> chatStatusText
              else -> "Gateway RPC is unavailable right now. Pair the host runtime before sending model-switch commands."
            },
          style = mobileCallout,
          color = mobileWarning,
        )
      } else {
        Text(
          "Host requirement: Ollama must be running on the gateway machine, and the model must be available there. Example: `ollama run 8bit/DeepSolana`.",
          style = mobileCallout,
          color = mobileTextSecondary,
        )
      }

      Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        GatewayModelQuickActionButton(
          label = "Status",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(GatewayModelCommands.status()) },
        )
        GatewayModelQuickActionButton(
          label = "DeepSolana",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(GatewayModelCommands.ollama("8bit/DeepSolana")) },
        )
        GatewayModelQuickActionButton(
          label = "MiniMax",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(GatewayModelCommands.ollama("minimax-m2.7:cloud")) },
        )
        GatewayModelQuickActionButton(
          label = "Mimo",
          enabled = gatewayReady && !busy,
          onClick = { onSendCommand(GatewayModelCommands.openRouter("xiaomi/mimo-v2-pro")) },
        )
      }

      OutlinedTextField(
        value = backend,
        onValueChange = { backend = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        placeholder = { Text("ollama", style = mobileCallout, color = mobileTextTertiary) },
        textStyle = mobileCallout.copy(color = mobileText),
        label = { Text("Backend", style = mobileCaption1, color = mobileTextSecondary) },
        shape = RoundedCornerShape(14.dp),
        colors = gatewayModelTextFieldColors(),
      )

      OutlinedTextField(
        value = model,
        onValueChange = { model = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        placeholder = { Text("8bit/DeepSolana", style = mobileCallout, color = mobileTextTertiary) },
        textStyle = mobileCallout.copy(color = mobileText),
        label = { Text("Model", style = mobileCaption1, color = mobileTextSecondary) },
        shape = RoundedCornerShape(14.dp),
        colors = gatewayModelTextFieldColors(),
      )

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Button(
          onClick = { onSendCommand(GatewayModelCommands.switch(backend, model)) },
          enabled = gatewayReady && !busy && (backend.trim().isNotEmpty() || model.trim().isNotEmpty()),
          modifier = Modifier.weight(1f).height(46.dp),
          shape = RoundedCornerShape(14.dp),
        ) {
          Text("Switch Model", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = {
            backend = "ollama"
            model = "8bit/DeepSolana"
          },
          enabled = !busy,
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
          Text("Load DeepSolana", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
      }
    }
  }
}

@Composable
private fun GatewayModelQuickActionButton(
  label: String,
  enabled: Boolean,
  onClick: () -> Unit,
) {
  Button(
    onClick = onClick,
    enabled = enabled,
    shape = RoundedCornerShape(14.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = mobileSurfaceStrong,
        contentColor = mobileTextSecondary,
        disabledContainerColor = mobileSurfaceStrong.copy(alpha = 0.6f),
        disabledContentColor = mobileTextTertiary,
      ),
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Text(label, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun gatewayModelTextFieldColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    focusedLabelColor = mobileTextSecondary,
    unfocusedLabelColor = mobileTextSecondary,
    cursorColor = mobileAccent,
  )
