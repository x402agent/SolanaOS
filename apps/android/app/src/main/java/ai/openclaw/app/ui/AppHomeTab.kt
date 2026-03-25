package ai.openclaw.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ScreenShare
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CurrencyExchange
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

enum class AppHomeTab(
  val label: String,
  val icon: ImageVector,
  val glyph: String,
) {
  Connect(label = "Connect", icon = Icons.Default.CheckCircle, glyph = "✓"),
  Solana(label = "Solana", icon = Icons.Default.AutoAwesome, glyph = "✦"),
  Dex(label = "DEX", icon = Icons.AutoMirrored.Filled.ShowChart, glyph = "◭"),
  Grok(label = "Grok", icon = Icons.Default.Search, glyph = "⌕"),
  Chat(label = "Chat", icon = Icons.Default.ChatBubble, glyph = "◌"),
  Arcade(label = "Arcade", icon = Icons.Default.SportsEsports, glyph = "◈"),
  Voice(label = "Voice", icon = Icons.Default.RecordVoiceOver, glyph = "◉"),
  Ore(label = "ORE", icon = Icons.Default.CurrencyExchange, glyph = "⚒"),
  Screen(label = "Screen", icon = Icons.AutoMirrored.Filled.ScreenShare, glyph = "▣"),
  Settings(label = "Settings", icon = Icons.Default.Settings, glyph = "⚙"),
}
