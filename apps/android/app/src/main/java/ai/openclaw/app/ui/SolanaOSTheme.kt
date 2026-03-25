package ai.openclaw.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val solanaDarkColorScheme =
  darkColorScheme(
    primary = mobileAccent,
    onPrimary = Color.White,
    primaryContainer = mobileAccentSoft,
    onPrimaryContainer = mobileText,
    secondary = mobileSuccess,
    onSecondary = Color(0xFF04110C),
    secondaryContainer = mobileSuccessSoft,
    onSecondaryContainer = mobileSuccess,
    tertiary = mobileTextSecondary,
    onTertiary = mobileText,
    background = Color(0xFF05070D),
    onBackground = mobileText,
    surface = mobileSurface,
    onSurface = mobileText,
    surfaceVariant = mobileSurfaceStrong,
    onSurfaceVariant = mobileTextSecondary,
    surfaceContainer = mobileSurface,
    surfaceContainerLow = mobileSurface,
    surfaceContainerHigh = mobileSurfaceStrong,
    outline = mobileBorder,
    outlineVariant = mobileBorderStrong,
    error = mobileDanger,
    onError = Color.White,
    errorContainer = mobileDangerSoft,
    onErrorContainer = mobileDanger,
  )

private val solanaTypography =
  Typography(
    headlineLarge = mobileTitle1,
    headlineMedium = mobileTitle2,
    titleLarge = mobileHeadline,
    bodyLarge = mobileBody,
    bodyMedium = mobileCallout,
    labelLarge = mobileCaption1,
    labelMedium = mobileCaption2,
  )

@Composable
fun SolanaOSTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = solanaDarkColorScheme,
    typography = solanaTypography,
    content = content,
  )
}

@Composable
fun OpenClawTheme(content: @Composable () -> Unit) {
  SolanaOSTheme(content = content)
}

@Composable
fun overlayContainerColor(): Color {
  val scheme = MaterialTheme.colorScheme
  return scheme.surfaceContainerLow
}

@Composable
fun overlayIconColor(): Color {
  return MaterialTheme.colorScheme.onSurfaceVariant
}
