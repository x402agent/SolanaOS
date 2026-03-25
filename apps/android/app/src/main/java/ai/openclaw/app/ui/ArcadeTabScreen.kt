package ai.openclaw.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import ai.openclaw.app.MainViewModel

private enum class ArcadeMode(val label: String) {
  Chess("Chess"),
  Platformer("Platformer"),
  Snake("Snake"),
}

@Composable
fun ArcadeTabScreen(viewModel: MainViewModel) {
  var mode by rememberSaveable { mutableStateOf(ArcadeMode.Chess) }

  Box(modifier = Modifier.fillMaxSize()) {
    AnimatedContent(
      targetState = mode,
      transitionSpec = {
        val movingForward = targetState.ordinal >= initialState.ordinal
        (
          fadeIn() +
            scaleIn(initialScale = 0.985f) +
            slideInHorizontally { fullWidth -> if (movingForward) fullWidth / 12 else -fullWidth / 12 }
          )
          .togetherWith(
            fadeOut() +
              scaleOut(targetScale = 0.992f) +
              slideOutHorizontally { fullWidth -> if (movingForward) -fullWidth / 16 else fullWidth / 16 }
            )
      },
      label = "arcade_mode_transition",
    ) { currentMode ->
      when (currentMode) {
        ArcadeMode.Chess -> ArcadeChessTabScreen(viewModel = viewModel)
        ArcadeMode.Platformer -> ArcadeSmbLauncherScreen()
        ArcadeMode.Snake -> ArcadeSnakeTabScreen()
      }
    }

    Surface(
      modifier = Modifier.align(Alignment.TopEnd).padding(horizontal = 20.dp, vertical = 14.dp),
      shape = RoundedCornerShape(8.dp),
      color = mobileCodeBg.copy(alpha = 0.94f),
      border = BorderStroke(1.dp, mobileBorderStrong),
      shadowElevation = 6.dp,
    ) {
      Column(
        modifier = Modifier.padding(horizontal = 6.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Text(
          text = "ARCADE MODES",
          style = mobileCaption2.copy(fontWeight = FontWeight.Bold),
          color = mobileAccent,
          modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
          ArcadeMode.entries.forEach { option ->
            val selected = option == mode
            val containerColor by
              animateColorAsState(
                targetValue = if (selected) mobileAccentSoft else mobileSurfaceStrong.copy(alpha = 0.78f),
                label = "arcade_switch_container",
              )
            val borderColor by
              animateColorAsState(
                targetValue = if (selected) mobileAccent else mobileBorder,
                label = "arcade_switch_border",
              )
            val textColor by
              animateColorAsState(
                targetValue = if (selected) mobileAccent else mobileTextSecondary,
                label = "arcade_switch_text",
              )
            val scale by animateFloatAsState(targetValue = if (selected) 1f else 0.97f, label = "arcade_switch_scale")
            Surface(
              onClick = { mode = option },
              modifier = Modifier.graphicsLayer(scaleX = scale, scaleY = scale),
              shape = RoundedCornerShape(4.dp),
              color = containerColor,
              border = BorderStroke(1.dp, borderColor),
            ) {
              Text(
                text = option.label.uppercase(),
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                style = mobileCaption1.copy(fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold),
                color = textColor,
              )
            }
          }
        }
      }
    }
  }
}
