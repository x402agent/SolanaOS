package ai.openclaw.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.sin

enum class SolanaPanelTone {
  Green,
  Purple,
  Orange,
  Neutral,
}

enum class SolanaBotMotion {
  None,
  Float,
  FloatDelayed,
  Walk,
}

data class SolanaBackendLink(
  val label: String,
  val state: String,
  val detail: String,
  val tone: SolanaPanelTone = SolanaPanelTone.Green,
  val active: Boolean = true,
)

@Composable
fun SolanaRuntimeBackground(
  modifier: Modifier = Modifier,
  content: @Composable BoxScope.() -> Unit,
) {
  var scanProgress by remember { mutableFloatStateOf(0f) }
  var columnPulse by remember { mutableFloatStateOf(0f) }

  LaunchedEffect(Unit) {
    while (true) {
      scanProgress = (scanProgress + 0.0045f) % 1f
      columnPulse = (columnPulse + 0.018f) % 1f
      delay(16L)
    }
  }

  Box(
    modifier =
      modifier
        .fillMaxSize()
        .background(mobileBackgroundGradient),
  ) {
    Canvas(modifier = Modifier.matchParentSize()) {
      val topGlow =
        Brush.radialGradient(
          colors = listOf(mobileAccent.copy(alpha = 0.14f), Color.Transparent),
          center = Offset(size.width * 0.12f, size.height * 0.10f),
          radius = size.minDimension * 0.42f,
        )
      val bottomGlow =
        Brush.radialGradient(
          colors = listOf(mobileSuccess.copy(alpha = 0.10f), Color.Transparent),
          center = Offset(size.width * 0.88f, size.height * 0.92f),
          radius = size.minDimension * 0.36f,
        )
      val centerGlow =
        Brush.radialGradient(
          colors = listOf(mobileAccent.copy(alpha = 0.06f), Color.Transparent),
          center = Offset(size.width * 0.52f, size.height * 0.42f),
          radius = size.minDimension * 0.46f,
        )
      drawRect(brush = topGlow)
      drawRect(brush = bottomGlow)
      drawRect(brush = centerGlow)

      val scanY = size.height * scanProgress
      drawRect(
        brush =
          Brush.verticalGradient(
            colors =
              listOf(
                Color.Transparent,
                mobileSuccess.copy(alpha = 0.03f),
                mobileSuccess.copy(alpha = 0.11f),
                mobileSuccess.copy(alpha = 0.03f),
                Color.Transparent,
              ),
          ),
        topLeft = Offset(0f, scanY - 14.dp.toPx()),
        size = androidx.compose.ui.geometry.Size(size.width, 28.dp.toPx()),
      )

      drawLine(
        color = mobileSuccess.copy(alpha = 0.10f),
        start = Offset(0f, scanY),
        end = Offset(size.width, scanY),
        strokeWidth = 2.dp.toPx(),
      )

      val columns = 6
      repeat(columns) { index ->
        val x = size.width * (0.1f + index * 0.16f)
        val alpha = 0.02f + (((columnPulse + index * 0.12f) % 1f) * 0.02f)
        drawLine(
          color = mobileSuccess.copy(alpha = alpha),
          start = Offset(x, 0f),
          end = Offset(x, size.height),
          strokeWidth = 1.dp.toPx(),
        )

        val streamProgress = ((columnPulse * 1.2f) + index * 0.14f) % 1f
        repeat(7) { segment ->
          val y = size.height * ((streamProgress + segment * 0.17f) % 1f)
          val segmentAlpha = (0.14f - (segment * 0.016f)).coerceAtLeast(0.03f)
          drawLine(
            color = mobileSuccess.copy(alpha = segmentAlpha),
            start = Offset(x, y),
            end = Offset(x, y + 18.dp.toPx()),
            strokeWidth = 1.5.dp.toPx(),
          )
        }
      }

      repeat(10) { row ->
        val y = size.height * (0.06f + row * 0.095f)
        drawLine(
          color = mobileAccent.copy(alpha = 0.028f),
          start = Offset(0f, y),
          end = Offset(size.width, y),
          strokeWidth = 1.dp.toPx(),
        )
      }

      val frameColor = mobileAccent.copy(alpha = 0.34f)
      val inset = 14.dp.toPx()
      val corner = 12.dp.toPx()
      val stroke = 1.dp.toPx()

      drawLine(frameColor, Offset(inset, inset), Offset(inset + corner, inset), strokeWidth = stroke)
      drawLine(frameColor, Offset(inset, inset), Offset(inset, inset + corner), strokeWidth = stroke)

      drawLine(
        frameColor,
        Offset(size.width - inset - corner, inset),
        Offset(size.width - inset, inset),
        strokeWidth = stroke,
      )
      drawLine(
        frameColor,
        Offset(size.width - inset, inset),
        Offset(size.width - inset, inset + corner),
        strokeWidth = stroke,
      )
    }

    content()
  }
}

@Composable
fun SolanaPanel(
  modifier: Modifier = Modifier,
  tone: SolanaPanelTone = SolanaPanelTone.Green,
  content: @Composable ColumnScope.() -> Unit,
) {
  val colors = panelColors(tone)
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(8.dp),
    color = mobileSurface.copy(alpha = 0.96f),
    border = BorderStroke(1.dp, colors.second.copy(alpha = 0.34f)),
    shadowElevation = 0.dp,
  ) {
    Box(modifier = Modifier.fillMaxWidth()) {
      Canvas(modifier = Modifier.matchParentSize()) {
        val accent = colors.second
        val stroke = 1.25.dp.toPx()
        val corner = 11.dp.toPx()
        val inset = 10.dp.toPx()
        drawRoundRect(
          color = colors.first.copy(alpha = 0.75f),
          cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx(), 8.dp.toPx()),
        )
        drawLine(accent.copy(alpha = 0.72f), Offset(inset, inset), Offset(inset + corner, inset), strokeWidth = stroke)
        drawLine(accent.copy(alpha = 0.72f), Offset(inset, inset), Offset(inset, inset + corner), strokeWidth = stroke)
        drawLine(
          accent.copy(alpha = 0.72f),
          Offset(size.width - inset - corner, inset),
          Offset(size.width - inset, inset),
          strokeWidth = stroke,
        )
        drawLine(
          accent.copy(alpha = 0.72f),
          Offset(size.width - inset, inset),
          Offset(size.width - inset, inset + corner),
          strokeWidth = stroke,
        )
      }

      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
      )
    }
  }
}

@Composable
fun SolanaSectionLabel(
  text: String,
  modifier: Modifier = Modifier,
  tone: SolanaPanelTone = SolanaPanelTone.Green,
) {
  Text(
    text = text.uppercase(),
    modifier = modifier,
    style = mobileCaption2.copy(fontWeight = FontWeight.Bold),
    color = panelReadableAccentColor(tone),
  )
}

@Composable
fun SolanaStatusPill(
  label: String,
  modifier: Modifier = Modifier,
  active: Boolean = true,
  tone: SolanaPanelTone = SolanaPanelTone.Green,
) {
  val colors = panelColors(if (active) tone else SolanaPanelTone.Neutral)
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(99.dp),
    color = colors.first,
    border = BorderStroke(1.dp, colors.second.copy(alpha = if (active) 0.72f else 0.30f)),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
      horizontalArrangement = Arrangement.spacedBy(6.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Surface(
        modifier = Modifier.size(6.dp),
        shape = RoundedCornerShape(99.dp),
        color = if (active) colors.second else mobileTextTertiary,
      ) {}
      Text(
        text = label.uppercase(),
        style = mobileCaption2.copy(fontWeight = FontWeight.SemiBold),
        color = if (active) panelReadableAccentColor(tone) else mobileTextSecondary,
      )
    }
  }
}

@Composable
fun SolanaMetricTile(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  tone: SolanaPanelTone = SolanaPanelTone.Green,
) {
  val borderColor = panelColors(tone).second
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(5.dp),
    color = mobileCodeBg.copy(alpha = 0.52f),
    border = BorderStroke(1.dp, borderColor.copy(alpha = 0.45f)),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        text = label.uppercase(),
        style = mobileCaption2,
        color = mobileTextSecondary,
      )
      Text(
        text = value,
        style = mobileTitle2.copy(fontWeight = FontWeight.Bold),
        color = borderColor,
      )
    }
  }
}

@Composable
fun SolanaHeroTitle(
  eyebrow: String,
  title: String,
  subtitle: String,
  modifier: Modifier = Modifier,
) {
  SolanaPanel(
    modifier = modifier.fillMaxWidth(),
    tone = SolanaPanelTone.Purple,
  ) {
    Column(
      modifier = Modifier.fillMaxWidth(),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaSectionLabel(text = eyebrow, tone = SolanaPanelTone.Purple)
      Text(
        text = title.uppercase(),
        style = mobileTitle1.copy(fontWeight = FontWeight.ExtraBold),
        color = mobileText,
      )
      Text(
        text = subtitle,
        style = mobileCallout,
        color = mobileTextSecondary,
      )
      SolanaSignalLine(
        modifier = Modifier.fillMaxWidth().height(18.dp),
        color = mobileAccent,
      )
    }
  }
}

@Composable
fun SolanaTerminalBanner(
  title: String,
  subtitle: String,
  modifier: Modifier = Modifier,
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Row(
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      SolanaMawdBot(
        tone = SolanaPanelTone.Orange,
        motion = SolanaBotMotion.Walk,
        modifier = Modifier.size(34.dp),
      )
      Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        SolanaSectionLabel(text = title, tone = SolanaPanelTone.Orange)
        Text(
          text = subtitle,
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
      }
    }
    SolanaMawdBot(
      tone = SolanaPanelTone.Purple,
      motion = SolanaBotMotion.FloatDelayed,
      modifier = Modifier.size(28.dp),
    )
  }
}

private fun Modifier.animatedBotModifier(motion: SolanaBotMotion): Modifier = composed {
  val density = LocalDensity.current
  var phase by remember(motion) { mutableFloatStateOf(0f) }

  LaunchedEffect(motion) {
    if (motion == SolanaBotMotion.None) {
      phase = 0f
      return@LaunchedEffect
    }
    phase = if (motion == SolanaBotMotion.FloatDelayed) 0.5f else 0f
    while (true) {
      delay(16L)
      phase = (phase + 0.014f) % 1f
    }
  }

  val translationY =
    when (motion) {
      SolanaBotMotion.Float,
      SolanaBotMotion.FloatDelayed -> with(density) { (sin(phase * 2f * PI).toFloat() * 5.dp.toPx()) }
      SolanaBotMotion.Walk -> with(density) { (sin(phase * 4f * PI).toFloat() * 2.4.dp.toPx()) }
      SolanaBotMotion.None -> 0f
    }
  val translationX =
    when (motion) {
      SolanaBotMotion.Walk -> with(density) { (sin(phase * 2f * PI).toFloat() * 4.dp.toPx()) }
      else -> 0f
    }
  val rotation =
    when (motion) {
      SolanaBotMotion.Walk -> sin(phase * 4f * PI).toFloat() * 2.8f
      else -> 0f
    }

  graphicsLayer(
    translationX = translationX,
    translationY = translationY,
    rotationZ = rotation,
  )
}

@Composable
fun SolanaHeroSignalStack(
  eyebrow: String,
  title: String,
  strapline: String,
  subtitle: String,
  modifier: Modifier = Modifier,
) {
  Column(
    modifier = modifier,
    verticalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    Text(
      text = eyebrow.uppercase(),
      style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
      color = mobileTextSecondary,
      textAlign = TextAlign.Center,
      modifier = Modifier.fillMaxWidth(),
    )
    Text(
      text = title.uppercase(),
      style = mobileTitle1.copy(fontWeight = FontWeight.ExtraBold),
      color = mobileSuccess,
      textAlign = TextAlign.Center,
      modifier = Modifier.fillMaxWidth(),
    )
    Text(
      text = strapline.uppercase(),
      style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
      color = mobileAccent,
      textAlign = TextAlign.Center,
      modifier = Modifier.fillMaxWidth(),
    )
    Text(
      text = subtitle,
      style = mobileCallout,
      color = mobileTextSecondary,
      textAlign = TextAlign.Center,
      modifier = Modifier.fillMaxWidth(),
    )
  }
}

@Composable
fun SolanaWelcomeHero(
  modifier: Modifier = Modifier,
  eyebrow: String = "Welcome To",
  title: String = "SolanaOS",
  strapline: String = "The Solana Computer",
  subtitle: String,
  features: List<String>,
  statusLabel: String? = null,
) {
  Column(
    modifier = modifier,
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      SolanaMawdBot(
        tone = SolanaPanelTone.Orange,
        motion = SolanaBotMotion.Float,
        modifier = Modifier.size(52.dp),
      )
      Spacer(modifier = Modifier.width(14.dp))
      SolanaTargetLogo(logoSize = 88.dp)
      Spacer(modifier = Modifier.width(14.dp))
      SolanaMawdBot(
        tone = SolanaPanelTone.Purple,
        motion = SolanaBotMotion.FloatDelayed,
        modifier = Modifier.size(52.dp),
      )
    }

    SolanaHeroSignalStack(
      eyebrow = eyebrow,
      title = title,
      strapline = strapline,
      subtitle = subtitle,
    )

    features.forEachIndexed { index, feature ->
      SolanaFeatureRail(
        number = index + 1,
        text = feature,
        tone = if (index % 2 == 0) SolanaPanelTone.Green else SolanaPanelTone.Purple,
      )
    }

    statusLabel?.takeIf { it.isNotBlank() }?.let { label ->
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(4.dp),
        color = mobileRuntimePanel,
        border = BorderStroke(1.dp, mobileSuccess),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
          horizontalArrangement = Arrangement.Center,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            text = "{ ${label.uppercase()} }",
            style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
            color = mobileSuccess,
          )
        }
      }
    }

    SolanaSignalLine(modifier = Modifier.fillMaxWidth().height(22.dp))
  }
}

@Composable
fun SolanaFeatureRail(
  number: Int,
  text: String,
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
) {
  val accent = panelColors(tone).second
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(4.dp),
    color = panelColors(tone).first,
    border = BorderStroke(1.dp, accent.copy(alpha = 0.4f)),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text(
        text = "[${number.toString().padStart(2, '0')}]",
        style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
        color = accent,
      )
      Text(
        text = text,
        modifier = Modifier.weight(1f),
        style = mobileCallout,
        color = mobileText,
      )
      Surface(
        modifier = Modifier.size(8.dp),
        shape = RoundedCornerShape(1.dp),
        color = accent,
      ) {}
    }
  }
}

@Composable
fun SolanaSignalLine(
  modifier: Modifier = Modifier,
  color: Color = mobileSuccess,
) {
  Canvas(modifier = modifier) {
    val path = Path()
    val points =
      listOf(
        0.0f to 0.52f,
        0.06f to 0.40f,
        0.12f to 0.66f,
        0.18f to 0.30f,
        0.24f to 0.58f,
        0.32f to 0.36f,
        0.40f to 0.70f,
        0.48f to 0.28f,
        0.56f to 0.54f,
        0.64f to 0.34f,
        0.72f to 0.60f,
        0.80f to 0.32f,
        0.88f to 0.56f,
        1.00f to 0.42f,
      )
    points.forEachIndexed { index, (xFraction, yFraction) ->
      val x = size.width * xFraction
      val y = size.height * yFraction
      if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    drawPath(path = path, color = color.copy(alpha = 0.6f), style = Stroke(width = 2.dp.toPx()))
  }
}

@Composable
fun SolanaMawdBot(
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
  motion: SolanaBotMotion = SolanaBotMotion.None,
) {
  val body =
    when (tone) {
      SolanaPanelTone.Orange -> mobileOrange
      SolanaPanelTone.Purple -> mobileAccent
      SolanaPanelTone.Green -> mobileSuccess
      SolanaPanelTone.Neutral -> mobileTextSecondary
    }
  val inner =
    when (tone) {
      SolanaPanelTone.Orange -> Color(0xFFFF8C2A)
      SolanaPanelTone.Purple -> Color(0xFFAB60FF)
      SolanaPanelTone.Green -> Color(0xFF46F7B2)
      SolanaPanelTone.Neutral -> Color(0xFF75828B)
    }
  val face = if (tone == SolanaPanelTone.Purple) mobileSuccess else mobileCodeBg

  Canvas(modifier = modifier.animatedBotModifier(motion)) {
    val bodyWidth = size.width * 0.64f
    val bodyHeight = size.height * 0.52f
    val bodyLeft = (size.width - bodyWidth) / 2f
    val bodyTop = size.height * 0.18f
    val armWidth = size.width * 0.14f
    val armHeight = size.height * 0.12f
    val legWidth = size.width * 0.16f
    val legHeight = size.height * 0.18f

    drawRoundRect(
      color = body,
      topLeft = Offset(bodyLeft, bodyTop),
      size = androidx.compose.ui.geometry.Size(bodyWidth, bodyHeight),
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx(), 8.dp.toPx()),
    )
    drawRoundRect(
      color = inner,
      topLeft = Offset(bodyLeft + size.width * 0.03f, bodyTop + size.height * 0.03f),
      size = androidx.compose.ui.geometry.Size(bodyWidth - size.width * 0.06f, bodyHeight - size.height * 0.06f),
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(6.dp.toPx(), 6.dp.toPx()),
    )
    drawRoundRect(
      color = body,
      topLeft = Offset(size.width * 0.05f, bodyTop + size.height * 0.18f),
      size = androidx.compose.ui.geometry.Size(armWidth, armHeight),
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx(), 5.dp.toPx()),
    )
    drawRoundRect(
      color = body,
      topLeft = Offset(size.width - size.width * 0.05f - armWidth, bodyTop + size.height * 0.18f),
      size = androidx.compose.ui.geometry.Size(armWidth, armHeight),
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx(), 5.dp.toPx()),
    )
    drawRoundRect(
      color = body,
      topLeft = Offset(size.width * 0.26f, bodyTop + bodyHeight),
      size = androidx.compose.ui.geometry.Size(legWidth, legHeight),
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx(), 5.dp.toPx()),
    )
    drawRoundRect(
      color = body,
      topLeft = Offset(size.width * 0.58f, bodyTop + bodyHeight),
      size = androidx.compose.ui.geometry.Size(legWidth, legHeight),
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx(), 5.dp.toPx()),
    )
    drawCircle(color = face, radius = size.width * 0.04f, center = Offset(size.width * 0.36f, size.height * 0.44f))
    drawCircle(color = face, radius = size.width * 0.04f, center = Offset(size.width * 0.64f, size.height * 0.44f))
    drawLine(
      color = face.copy(alpha = 0.8f),
      start = Offset(size.width * 0.40f, size.height * 0.60f),
      end = Offset(size.width * 0.60f, size.height * 0.60f),
      strokeWidth = 2.dp.toPx(),
    )
  }
}

@Composable
fun SolanaTargetLogo(
  logoSize: Dp,
  modifier: Modifier = Modifier,
) {
  Canvas(modifier = modifier.size(logoSize)) {
    val center = Offset(size.width / 2f, size.height / 2f)
    val outer = size.minDimension * 0.42f
    val inner = size.minDimension * 0.32f
    drawCircle(color = mobileSuccess.copy(alpha = 0.82f), radius = outer, center = center, style = Stroke(width = 2.dp.toPx()))
    drawCircle(color = mobileAccent.copy(alpha = 0.55f), radius = inner, center = center, style = Stroke(width = 1.5.dp.toPx()))
    drawLine(color = mobileSuccess.copy(alpha = 0.38f), start = Offset(center.x, size.height * 0.08f), end = Offset(center.x, size.height * 0.28f), strokeWidth = 1.dp.toPx())
    drawLine(color = mobileSuccess.copy(alpha = 0.38f), start = Offset(center.x, size.height * 0.72f), end = Offset(center.x, size.height * 0.92f), strokeWidth = 1.dp.toPx())
    drawLine(color = mobileSuccess.copy(alpha = 0.38f), start = Offset(size.width * 0.08f, center.y), end = Offset(size.width * 0.28f, center.y), strokeWidth = 1.dp.toPx())
    drawLine(color = mobileSuccess.copy(alpha = 0.38f), start = Offset(size.width * 0.72f, center.y), end = Offset(size.width * 0.92f, center.y), strokeWidth = 1.dp.toPx())
    val diamond = Path().apply {
      moveTo(center.x, center.y - size.minDimension * 0.14f)
      lineTo(center.x + size.minDimension * 0.14f, center.y)
      lineTo(center.x, center.y + size.minDimension * 0.14f)
      lineTo(center.x - size.minDimension * 0.14f, center.y)
      close()
    }
    drawPath(diamond, color = mobileSuccess, style = Stroke(width = 1.5.dp.toPx()))
  }
  Box(
    modifier = modifier.size(logoSize),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text = "S",
      style = mobileTitle1.copy(fontWeight = FontWeight.ExtraBold),
      color = mobileAccent,
    )
  }
}

@Composable
fun SolanaTerminalSurface(
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(6.dp),
    color = mobileCodeBg,
    border = BorderStroke(1.dp, mobileSuccess.copy(alpha = 0.20f)),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
      content = { content() },
    )
  }
}

@Composable
fun SolanaBackplaneCard(
  title: String,
  subtitle: String,
  links: List<SolanaBackendLink>,
  modifier: Modifier = Modifier,
  tone: SolanaPanelTone = SolanaPanelTone.Purple,
) {
  SolanaPanel(
    modifier = modifier,
    tone = tone,
  ) {
    SolanaSectionLabel(text = title, tone = tone)
    Text(
      text = subtitle,
      style = mobileCallout,
      color = mobileTextSecondary,
    )
    links.forEach { link ->
      SolanaBackplaneLinkRow(link = link)
    }
  }
}

@Composable
private fun SolanaBackplaneLinkRow(link: SolanaBackendLink) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(4.dp),
    color = mobileCodeBg.copy(alpha = 0.65f),
    border = BorderStroke(
      1.dp,
      panelColors(if (link.active) link.tone else SolanaPanelTone.Neutral).second.copy(alpha = 0.24f),
    ),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 9.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(2.dp),
      ) {
        Text(
          text = link.label.uppercase(),
          style = mobileCaption2.copy(fontWeight = FontWeight.Bold),
          color = if (link.active) panelColors(link.tone).second else mobileTextSecondary,
        )
        Text(
          text = link.detail,
          style = mobileCaption1,
          color = if (link.active) mobileText else mobileTextSecondary,
        )
      }
      SolanaStatusPill(
        label = link.state,
        active = link.active,
        tone = link.tone,
      )
    }
  }
}

private fun panelColors(tone: SolanaPanelTone): Pair<Color, Color> =
  when (tone) {
    SolanaPanelTone.Green -> mobileRuntimePanel to mobileSuccess
    SolanaPanelTone.Purple -> mobileRuntimePanelPurple to mobileAccent
    SolanaPanelTone.Orange -> mobileRuntimePanelOrange to mobileOrange
    SolanaPanelTone.Neutral -> mobileSurfaceStrong to mobileBorderStrong
  }

private fun panelReadableAccentColor(tone: SolanaPanelTone): Color =
  when (tone) {
    SolanaPanelTone.Green -> Color(0xFFEAFBF5)
    SolanaPanelTone.Purple -> mobileAccent
    SolanaPanelTone.Orange -> mobileOrange
    SolanaPanelTone.Neutral -> mobileTextSecondary
  }
