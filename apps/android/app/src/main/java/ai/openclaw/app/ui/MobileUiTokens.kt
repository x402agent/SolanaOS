package ai.openclaw.app.ui

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import ai.openclaw.app.R

internal val mobileBackgroundGradient =
  Brush.verticalGradient(
    listOf(
      Color(0xFF05070D),
      Color(0xFF080B14),
      Color(0xFF05070D),
    ),
  )

internal val mobileSurface = Color(0xFF0C0F1A)
internal val mobileSurfaceStrong = Color(0xFF111525)
internal val mobileBorder = Color(0x1F14F195)
internal val mobileBorderStrong = Color(0x3314F195)
internal val mobileText = Color(0xFFE8EDF5)
internal val mobileTextSecondary = Color(0xFF8B95A8)
internal val mobileTextTertiary = Color(0xFF4A5568)
internal val mobileAccent = Color(0xFF9945FF)
internal val mobileAccentSoft = Color(0x169945FF)
internal val mobileSuccess = Color(0xFF14F195)
internal val mobileSuccessSoft = Color(0x1214F195)
internal val mobileWarning = Color(0xFFFF7400)
internal val mobileWarningSoft = Color(0x18FF7400)
internal val mobileDanger = Color(0xFFFF5B5B)
internal val mobileDangerSoft = Color(0x19FF5B5B)
internal val mobileCodeBg = Color(0xFF080B14)
internal val mobileCodeText = Color(0xFFE8EDF5)
internal val mobileOrange = Color(0xFFFF7400)
internal val mobileOrangeSoft = Color(0x18FF7400)
internal val mobileRuntimeGlow = Color(0x4014F195)
internal val mobileRuntimePurpleGlow = Color(0x339945FF)
internal val mobileRuntimePanel = Color(0x1414F195)
internal val mobileRuntimePanelPurple = Color(0x149945FF)
internal val mobileRuntimePanelOrange = Color(0x14FF7400)
internal val mobileMonoFontFamily = FontFamily.Monospace

internal val mobileFontFamily =
  FontFamily(
    Font(resId = R.font.manrope_400_regular, weight = FontWeight.Normal),
    Font(resId = R.font.manrope_500_medium, weight = FontWeight.Medium),
    Font(resId = R.font.manrope_600_semibold, weight = FontWeight.SemiBold),
    Font(resId = R.font.manrope_700_bold, weight = FontWeight.Bold),
  )

internal val mobileTitle1 =
  TextStyle(
    fontFamily = mobileFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 24.sp,
    lineHeight = 28.sp,
    letterSpacing = 0.8.sp,
  )

internal val mobileTitle2 =
  TextStyle(
    fontFamily = mobileFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 18.sp,
    lineHeight = 24.sp,
    letterSpacing = 1.1.sp,
  )

internal val mobileHeadline =
  TextStyle(
    fontFamily = mobileFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 16.sp,
    lineHeight = 22.sp,
    letterSpacing = 0.5.sp,
  )

internal val mobileBody =
  TextStyle(
    fontFamily = mobileFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 15.sp,
    lineHeight = 22.sp,
  )

internal val mobileCallout =
  TextStyle(
    fontFamily = mobileMonoFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 13.sp,
    lineHeight = 19.sp,
  )

internal val mobileCaption1 =
  TextStyle(
    fontFamily = mobileMonoFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 12.sp,
    lineHeight = 16.sp,
    letterSpacing = 0.9.sp,
  )

internal val mobileCaption2 =
  TextStyle(
    fontFamily = mobileMonoFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 11.sp,
    lineHeight = 14.sp,
    letterSpacing = 1.1.sp,
  )
