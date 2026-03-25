package ai.openclaw.app.ui.chat

import androidx.camera.view.PreviewView
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import ai.openclaw.app.ui.mobileAccent
import ai.openclaw.app.ui.mobileAccentSoft
import ai.openclaw.app.ui.mobileBorder
import ai.openclaw.app.ui.mobileBorderStrong
import ai.openclaw.app.ui.mobileCallout
import ai.openclaw.app.ui.mobileCaption1
import ai.openclaw.app.ui.mobileHeadline
import ai.openclaw.app.ui.mobileSuccess
import ai.openclaw.app.ui.mobileSuccessSoft
import ai.openclaw.app.ui.mobileSurface
import ai.openclaw.app.ui.mobileSurfaceStrong
import ai.openclaw.app.ui.mobileText
import ai.openclaw.app.ui.mobileTextSecondary
import ai.openclaw.app.ui.mobileTextTertiary
import kotlinx.coroutines.launch

@Composable
internal fun LiveCameraCard(
  visionAvailable: Boolean,
  previewActive: Boolean,
  busy: Boolean,
  liveEnabled: Boolean,
  statusText: String,
  latestCommentary: String?,
  onAttachPreview: (PreviewView) -> Unit,
  onDetachPreview: () -> Unit,
  onAttachFrame: suspend () -> Unit,
  onAnalyzeFrame: () -> Unit,
  onSetLiveEnabled: (Boolean) -> Unit,
) {
  val scope = rememberCoroutineScope()
  var previewView by remember { mutableStateOf<PreviewView?>(null) }

  DisposableEffect(previewView) {
    val current = previewView
    if (current != null) {
      onAttachPreview(current)
    }
    onDispose { onDetachPreview() }
  }

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
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text("LIVE CAMERA", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileSuccess)
          Text("Grok Vision Commentary", style = mobileHeadline.copy(fontWeight = FontWeight.Bold), color = mobileText)
        }
        Surface(
          shape = RoundedCornerShape(999.dp),
          color = if (visionAvailable) mobileAccentSoft else mobileSurfaceStrong,
          border = BorderStroke(1.dp, if (visionAvailable) mobileAccent.copy(alpha = 0.35f) else mobileBorderStrong),
        ) {
          Text(
            text = if (visionAvailable) "OpenRouter + Grok" else "Vision disabled",
            style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
            color = if (visionAvailable) mobileAccent else mobileTextSecondary,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
          )
        }
      }

      Text(
        text = statusText,
        style = mobileCallout,
        color = if (previewActive) mobileTextSecondary else mobileTextTertiary,
      )

      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = Color(0xFF090D14),
        border = BorderStroke(1.dp, if (previewActive) mobileAccent.copy(alpha = 0.28f) else mobileBorderStrong),
      ) {
        AndroidView(
          modifier = Modifier.fillMaxWidth().height(216.dp),
          factory = { context ->
            PreviewView(context).apply {
              implementationMode = PreviewView.ImplementationMode.COMPATIBLE
              scaleType = PreviewView.ScaleType.FILL_CENTER
              previewView = this
            }
          },
          update = { view ->
            if (previewView !== view) {
              previewView = view
            }
          },
        )
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Button(
          onClick = { scope.launch { onAttachFrame() } },
          enabled = previewActive && !busy,
          modifier = Modifier.weight(1f),
          shape = RoundedCornerShape(14.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = mobileSurfaceStrong,
              contentColor = mobileText,
              disabledContainerColor = mobileSurfaceStrong.copy(alpha = 0.6f),
              disabledContentColor = mobileTextTertiary,
            ),
          border = BorderStroke(1.dp, mobileBorderStrong),
        ) {
          Text("Attach Frame", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
        }

        Button(
          onClick = onAnalyzeFrame,
          enabled = previewActive && !busy && visionAvailable,
          modifier = Modifier.weight(1f),
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
          Text("Analyze", style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
        }

        Button(
          onClick = { onSetLiveEnabled(!liveEnabled) },
          enabled = previewActive && visionAvailable,
          modifier = Modifier.weight(1f),
          shape = RoundedCornerShape(14.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = if (liveEnabled) mobileSuccessSoft else mobileAccent,
              contentColor = if (liveEnabled) mobileSuccess else Color.White,
              disabledContainerColor = mobileBorderStrong,
              disabledContentColor = mobileTextTertiary,
            ),
          border = BorderStroke(1.dp, if (liveEnabled) mobileSuccess.copy(alpha = 0.35f) else mobileAccent.copy(alpha = 0.35f)),
        ) {
          Text(
            text = if (liveEnabled) "Stop Live" else "Start Live",
            style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
          )
        }
      }

      if (!latestCommentary.isNullOrBlank()) {
        Surface(
          modifier = Modifier.fillMaxWidth(),
          shape = RoundedCornerShape(14.dp),
          color = mobileSurfaceStrong,
          border = BorderStroke(1.dp, mobileBorderStrong),
        ) {
          Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
          ) {
            Text(
              text = if (liveEnabled) "LIVE COMMENTARY" else "LATEST COMMENTARY",
              style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp),
              color = mobileSuccess,
            )
            Text(
              text = latestCommentary,
              style = mobileCallout,
              color = mobileText,
            )
          }
        }
      }
    }
  }
}
