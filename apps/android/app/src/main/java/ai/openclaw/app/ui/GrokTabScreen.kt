package ai.openclaw.app.ui

import ai.openclaw.app.convex.ConvexGalleryFeedItem
import ai.openclaw.app.BuildConfig
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.grok.GrokGeneratedImage
import ai.openclaw.app.grok.GrokSearchReply
import ai.openclaw.app.grok.GrokTextReply
import ai.openclaw.app.ui.chat.LiveCameraCard
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.net.URL
import kotlin.math.max
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private enum class GrokWorkspaceMode(
  val label: String,
  val subtitle: String,
  val icon: ImageVector,
) {
  Search(label = "Search", subtitle = "Responses API + live tools", icon = Icons.Default.Search),
  Respond(label = "Respond", subtitle = "Direct prompt workspace", icon = Icons.Default.AutoAwesome),
  Image(label = "Image", subtitle = "Grok imagine studio", icon = Icons.Default.Image),
  Vision(label = "Vision", subtitle = "Live camera analysis", icon = Icons.Default.Image),
  ;

  companion object {
    fun fromKey(raw: String?): GrokWorkspaceMode? =
      when (raw?.trim()?.lowercase()) {
        "search" -> Search
        "respond" -> Respond
        "image" -> Image
        "vision" -> Vision
        else -> null
      }
  }
}

@Composable
fun GrokTabScreen(viewModel: MainViewModel) {
  val context = LocalContext.current
  val activity = remember(context) { context.findActivity() as? ComponentActivity }
  val isConnected by viewModel.isConnected.collectAsState()
  val gatewayStatusText by viewModel.statusText.collectAsState()
  val configured by viewModel.grokConfigured.collectAsState()
  val statusText by viewModel.grokStatusText.collectAsState()
  val convexConfigured by viewModel.convexConfigured.collectAsState()
  val convexRegisteredUser by viewModel.convexRegisteredUser.collectAsState()
  val convexStatusText by viewModel.convexStatusText.collectAsState()
  val galleryFeed by viewModel.grokGalleryFeed.collectAsState()
  val galleryBusy by viewModel.grokGalleryBusy.collectAsState()
  val galleryStatusText by viewModel.grokGalleryStatusText.collectAsState()
  val galleryRatingArtworkId by viewModel.grokGalleryRatingArtworkId.collectAsState()
  val liveCameraVisionAvailable by viewModel.liveCameraVisionAvailable.collectAsState()
  val liveCameraPreviewActive by viewModel.liveCameraPreviewActive.collectAsState()
  val liveCameraBusy by viewModel.liveCameraBusy.collectAsState()
  val liveCameraLiveEnabled by viewModel.liveCameraLiveEnabled.collectAsState()
  val liveCameraStatusText by viewModel.liveCameraStatusText.collectAsState()
  val liveCameraLatestCommentary by viewModel.liveCameraLatestCommentary.collectAsState()
  val solanaTrackerConfigured by viewModel.solanaTrackerConfigured.collectAsState()
  val solanaTrackerStatusText by viewModel.solanaTrackerStatusText.collectAsState()
  val searchBusy by viewModel.grokSearchBusy.collectAsState()
  val searchResult by viewModel.grokSearchResult.collectAsState()
  val imageBusy by viewModel.grokImageBusy.collectAsState()
  val imageResult by viewModel.grokImageResult.collectAsState()
  val respondBusy by viewModel.grokRespondBusy.collectAsState()
  val respondResult by viewModel.grokRespondResult.collectAsState()
  val requestedMode by viewModel.grokRequestedMode.collectAsState()

  var workspaceMode by rememberSaveable { mutableStateOf(GrokWorkspaceMode.Search) }
  var searchPrompt by rememberSaveable { mutableStateOf("What are people saying about Solana Mobile and Seeker on X today?") }
  var useWebSearch by rememberSaveable { mutableStateOf(true) }
  var useXSearch by rememberSaveable { mutableStateOf(true) }
  var enableImageUnderstanding by rememberSaveable { mutableStateOf(false) }
  var respondSystemPrompt by
    rememberSaveable {
      mutableStateOf("You are SolanaOS Grok, a concise Solana-native copilot for Seeker and the local runtime.")
    }
  var respondUserPrompt by rememberSaveable { mutableStateOf("") }
  var respondModel by rememberSaveable { mutableStateOf(BuildConfig.XAI_SEARCH_MODEL) }
  var imagePrompt by rememberSaveable { mutableStateOf("A Solana Seeker phone floating above a neon trading desk, crisp product render, cinematic lighting") }
  var imageAspectRatio by rememberSaveable { mutableStateOf("1:1") }
  var imageResolution by rememberSaveable { mutableStateOf("1k") }
  var frameCaptureStatus by rememberSaveable { mutableStateOf<String?>(null) }

  val imageWorkspaceReady = configured || convexConfigured
  val searchEnabled = configured && !searchBusy && searchPrompt.isNotBlank() && (useWebSearch || useXSearch)
  val imageEnabled = imageWorkspaceReady && !imageBusy && imagePrompt.isNotBlank()
  val respondEnabled = configured && !respondBusy && respondSystemPrompt.isNotBlank() && respondUserPrompt.isNotBlank()
  val canRunSelfTest = configured && !searchBusy && !imageBusy && !respondBusy

  LaunchedEffect(requestedMode) {
    GrokWorkspaceMode.fromKey(requestedMode)?.let { mode ->
      workspaceMode = mode
      viewModel.consumeGrokRequestedMode()
    }
  }

  LaunchedEffect(convexConfigured) {
    if (convexConfigured) {
      viewModel.initializeGrokGallery()
    }
  }

  Column(
    modifier =
      Modifier
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 12.dp, vertical = 10.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "xAI Direct Client",
      title = "Grok Search + Execute",
      subtitle = "Run live web and X search, direct prompting, image generation, and camera-assisted vision from one Android workspace.",
    )

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaMetricTile(
        label = "Workspace",
        value = workspaceMode.label.uppercase(),
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "xAI",
        value =
          when {
            configured -> "DIRECT"
            convexConfigured -> "BACKEND"
            else -> "MISSING"
          },
        tone = if (imageWorkspaceReady) SolanaPanelTone.Green else SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Vision",
        value = if (liveCameraVisionAvailable) "LIVE" else "OFF",
        tone = if (liveCameraVisionAvailable) SolanaPanelTone.Orange else SolanaPanelTone.Neutral,
        modifier = Modifier.weight(1f),
      )
    }

    SolanaBackplaneCard(
      title = "Vision Backplane",
      subtitle = "The Grok workspace stays direct-to-xAI where possible, while still sharing runtime context with gateway, tracker, Convex, and Seeker vision.",
      links =
        listOf(
          SolanaBackendLink(
            label = "xAI Direct",
            state = if (configured) "Ready" else "Missing",
            detail = statusText,
            tone = SolanaPanelTone.Green,
            active = configured,
          ),
          SolanaBackendLink(
            label = "Gateway Runtime",
            state = if (isConnected) "Online" else "Offline",
            detail = gatewayStatusText,
            tone = SolanaPanelTone.Purple,
            active = isConnected,
          ),
          SolanaBackendLink(
            label = "Live Camera",
            state = if (liveCameraVisionAvailable) "Vision" else "Disabled",
            detail = liveCameraStatusText,
            tone = SolanaPanelTone.Orange,
            active = liveCameraVisionAvailable,
          ),
          SolanaBackendLink(
            label = "Tracker Context",
            state = if (solanaTrackerConfigured) "Market Data" else "Missing",
            detail = solanaTrackerStatusText,
            tone = SolanaPanelTone.Purple,
            active = solanaTrackerConfigured,
          ),
          SolanaBackendLink(
            label = "Convex User",
            state =
              when {
                convexRegisteredUser != null -> "Synced"
                convexConfigured -> "Configured"
                else -> "Missing"
              },
            detail =
              convexRegisteredUser?.let { user ->
                "Wallet ${user.walletAddress.take(4)}…${user.walletAddress.takeLast(4)} is linked for shared backend identity."
              } ?: convexStatusText,
            tone = SolanaPanelTone.Green,
            active = convexRegisteredUser != null,
          ),
        ),
    )

    GrokSectionCard(
      title = "Workspace",
      subtitle = "Search, direct prompt, image, and vision are separated so the screen stays close to the real Android backend surface.",
      icon = Icons.Default.AutoAwesome,
    ) {
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        GrokWorkspaceMode.entries.forEach { mode ->
          GrokToggleChip(
            label = mode.label,
            active = workspaceMode == mode,
            onClick = { workspaceMode = mode },
          )
        }
      }
      Text(
        "${workspaceMode.label.uppercase()} · ${workspaceMode.subtitle}",
        style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
        color = mobileTextSecondary,
      )
    }

    when (workspaceMode) {
      GrokWorkspaceMode.Search -> {
        GrokSectionCard(
          title = "Live Search",
          subtitle = "Responses API with Web Search and X Search tools",
          icon = Icons.Default.Search,
        ) {
          GrokOutlinedField(
            value = searchPrompt,
            onValueChange = { searchPrompt = it },
            label = "Ask Grok",
            singleLine = false,
          )
          FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            GrokToggleChip(label = "Web Search", active = useWebSearch, onClick = { useWebSearch = !useWebSearch })
            GrokToggleChip(label = "X Search", active = useXSearch, onClick = { useXSearch = !useXSearch })
            GrokToggleChip(
              label = "Image Understanding",
              active = enableImageUnderstanding,
              onClick = { enableImageUnderstanding = !enableImageUnderstanding },
            )
          }
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GrokButton(
              label = if (searchBusy) "Searching…" else "Search",
              emphasis = true,
              enabled = searchEnabled,
              onClick = {
                viewModel.runGrokSearch(
                  prompt = searchPrompt,
                  useWebSearch = useWebSearch,
                  useXSearch = useXSearch,
                  enableImageUnderstanding = enableImageUnderstanding,
                )
              },
            )
            GrokButton(
              label = "Clear",
              enabled = searchResult != null,
              onClick = viewModel::clearGrokSearchResult,
            )
          }
          if (!useWebSearch && !useXSearch) {
            Text(
              "Enable at least one live search tool before sending a request.",
              style = mobileCaption1,
              color = mobileWarning,
            )
          }
          searchResult?.let { result ->
            GrokSearchResultCard(result = result)
          }
        }
      }
      GrokWorkspaceMode.Respond -> {
        GrokSectionCard(
          title = "Direct Response",
          subtitle = "Prompt Grok directly through the same workspace client used elsewhere in the app.",
          icon = Icons.Default.AutoAwesome,
        ) {
          GrokOutlinedField(
            value = respondSystemPrompt,
            onValueChange = { respondSystemPrompt = it },
            label = "System prompt",
            singleLine = false,
          )
          GrokOutlinedField(
            value = respondUserPrompt,
            onValueChange = { respondUserPrompt = it },
            label = "User prompt",
            singleLine = false,
          )
          GrokOutlinedField(
            value = respondModel,
            onValueChange = { respondModel = it },
            label = "Model",
          )
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GrokButton(
              label = if (respondBusy) "Running…" else "Respond",
              emphasis = true,
              enabled = respondEnabled,
              onClick = {
                viewModel.runGrokRespond(
                  systemPrompt = respondSystemPrompt,
                  userPrompt = respondUserPrompt,
                  model = respondModel,
                )
              },
            )
            GrokButton(
              label = "Clear",
              enabled = respondResult != null,
              onClick = viewModel::clearGrokRespondResult,
            )
          }
          respondResult?.let { result ->
            GrokRespondResultCard(result = result)
          }
        }
      }
      GrokWorkspaceMode.Image -> {
        GrokSectionCard(
          title = "Image Studio",
          subtitle = "xAI generation with Convex gallery publish and safe preview fallback",
          icon = Icons.Default.Image,
        ) {
          GrokOutlinedField(
            value = imagePrompt,
            onValueChange = { imagePrompt = it },
            label = "Image prompt",
            singleLine = false,
          )
          Text("Aspect Ratio", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
          FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("1:1", "16:9", "9:16", "3:2", "auto").forEach { ratio ->
              GrokToggleChip(label = ratio, active = imageAspectRatio == ratio, onClick = { imageAspectRatio = ratio })
            }
          }
          Text("Resolution", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
          FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("1k", "2k").forEach { resolution ->
              GrokToggleChip(label = resolution, active = imageResolution == resolution, onClick = { imageResolution = resolution })
            }
          }
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GrokButton(
              label = if (imageBusy) "Generating…" else "Generate Image",
              emphasis = true,
              enabled = imageEnabled,
              onClick = {
                viewModel.generateGrokImage(
                  activity = activity,
                  prompt = imagePrompt,
                  aspectRatio = imageAspectRatio,
                  resolution = imageResolution,
                )
              },
            )
            GrokButton(
              label = "Clear",
              enabled = imageResult != null,
              onClick = viewModel::clearGrokImageResult,
            )
          }
          imageResult?.let { result ->
            GrokImageResultCard(result = result)
          }
          GrokGallerySection(
            feed = galleryFeed,
            busy = galleryBusy,
            statusText = galleryStatusText,
            ratingArtworkId = galleryRatingArtworkId,
            convexConfigured = convexConfigured,
            convexRegistered = convexRegisteredUser != null,
            onRefresh = viewModel::refreshGrokGalleryFeed,
            onThumbUp = { artworkId ->
              activity?.let { viewModel.rateGrokGalleryArtwork(it, artworkId, positive = true) }
            },
            onThumbDown = { artworkId ->
              activity?.let { viewModel.rateGrokGalleryArtwork(it, artworkId, positive = false) }
            },
          )
        }
      }
      GrokWorkspaceMode.Vision -> {
        LiveCameraCard(
          visionAvailable = liveCameraVisionAvailable,
          previewActive = liveCameraPreviewActive,
          busy = liveCameraBusy,
          liveEnabled = liveCameraLiveEnabled,
          statusText = liveCameraStatusText,
          latestCommentary = liveCameraLatestCommentary,
          onAttachPreview = { previewView -> viewModel.attachLiveCameraPreview(previewView) },
          onDetachPreview = { viewModel.detachLiveCameraPreview() },
          onAttachFrame = {
            val frame = viewModel.captureLiveCameraFrame()
            frameCaptureStatus = "Captured ${frame.width}×${frame.height} frame from the live preview."
          },
          onAnalyzeFrame = { viewModel.analyzeLiveCameraFrame() },
          onSetLiveEnabled = { enabled -> viewModel.setLiveCameraCommentaryEnabled(enabled) },
        )

        if (!frameCaptureStatus.isNullOrBlank()) {
          GrokSectionCard(
            title = "Captured Frame",
            subtitle = "Live runtime camera state",
            icon = Icons.Default.Image,
          ) {
            Text(frameCaptureStatus!!, style = mobileCallout, color = mobileTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
              GrokButton(
                label = "Use In Search",
                enabled = !liveCameraLatestCommentary.isNullOrBlank(),
                onClick = {
                  liveCameraLatestCommentary?.takeIf { it.isNotBlank() }?.let { commentary ->
                    searchPrompt = commentary
                    workspaceMode = GrokWorkspaceMode.Search
                  }
                },
              )
              GrokButton(
                label = "Use In Prompt",
                enabled = !liveCameraLatestCommentary.isNullOrBlank(),
                onClick = {
                  liveCameraLatestCommentary?.takeIf { it.isNotBlank() }?.let { commentary ->
                    respondUserPrompt = commentary
                    workspaceMode = GrokWorkspaceMode.Respond
                  }
                },
              )
            }
          }
        }
      }
    }

  }
}

@Composable
private fun GrokSearchResultCard(result: GrokSearchReply) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text("Search Result", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      Text(result.content, style = mobileCallout, color = mobileTextSecondary)
      if (result.citations.isNotEmpty()) {
        HorizontalDivider(color = mobileBorder)
        Text("Sources", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          result.citations.forEach { citation ->
            Text(citation, style = mobileCaption1, color = mobileAccent)
          }
        }
      }
    }
  }
}

@Composable
private fun GrokImageResultCard(result: GrokGeneratedImage) {
  val preview = rememberGrokImagePreviewState(result.base64)
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text("Generated Image", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      preview.image?.let { image ->
        Image(
          bitmap = image,
          contentDescription = result.prompt,
          modifier = Modifier.fillMaxWidth().height(240.dp),
          contentScale = ContentScale.Crop,
        )
      }
      if (preview.failed) {
        Text("Preview unavailable on this device.", style = mobileCaption1, color = mobileTextTertiary)
      }
      Text(result.prompt, style = mobileCallout, color = mobileTextSecondary)
      result.model?.takeIf { it.isNotBlank() }?.let { model ->
        Text("Model: $model", style = mobileCaption1, color = mobileTextTertiary)
      }
    }
  }
}

@Composable
private fun GrokGallerySection(
  feed: List<ConvexGalleryFeedItem>,
  busy: Boolean,
  statusText: String,
  ratingArtworkId: String?,
  convexConfigured: Boolean,
  convexRegistered: Boolean,
  onRefresh: () -> Unit,
  onThumbUp: (String) -> Unit,
  onThumbDown: (String) -> Unit,
) {
  HorizontalDivider(color = mobileBorder)
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text("Realtime Gallery", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
    GrokStatusChip(label = if (convexRegistered) "Wallet Linked" else "Shared Feed", active = convexConfigured)
  }
  Text(statusText, style = mobileCaption1, color = mobileTextSecondary)
  Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    GrokButton(
      label = if (busy) "Refreshing…" else "Refresh Feed",
      enabled = convexConfigured && !busy,
      onClick = onRefresh,
    )
  }
  if (feed.isEmpty()) {
    Text(
      "No artwork has landed in the gallery yet. Generate or upload a piece to seed the live feed.",
      style = mobileCallout,
      color = mobileTextSecondary,
    )
    return
  }
  Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
    feed.forEach { item ->
      GrokGalleryFeedCard(
        item = item,
        ratingBusy = ratingArtworkId == item.artwork.id,
        onThumbUp = { onThumbUp(item.artwork.id) },
        onThumbDown = { onThumbDown(item.artwork.id) },
      )
    }
  }
}

@Composable
private fun GrokGalleryFeedCard(
  item: ConvexGalleryFeedItem,
  ratingBusy: Boolean,
  onThumbUp: () -> Unit,
  onThumbDown: () -> Unit,
) {
  val preview = rememberRemoteImagePreviewState(item.imageUrl)
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      preview.image?.let { image ->
        Image(
          bitmap = image,
          contentDescription = item.artwork.title ?: item.artwork.caption ?: "Gallery artwork",
          modifier = Modifier.fillMaxWidth().height(220.dp),
          contentScale = ContentScale.Crop,
        )
      }
      if (preview.failed) {
        Text("Image preview unavailable. Open the feed again to retry.", style = mobileCaption1, color = mobileTextTertiary)
      }
      Text(
        item.artwork.title ?: item.artwork.sourcePrompt ?: "Untitled artwork",
        style = mobileBody.copy(fontWeight = FontWeight.SemiBold),
        color = mobileText,
      )
      Text(
        "By ${item.artist.displayName ?: item.artist.handle ?: item.artist.name ?: "Seeker Artist"}",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
      item.artwork.caption?.takeIf { it.isNotBlank() }?.let { caption ->
        Text(caption, style = mobileCallout, color = mobileTextSecondary)
      }
      item.artwork.sourcePrompt?.takeIf { it.isNotBlank() }?.let { prompt ->
        Text(prompt, style = mobileCaption1, color = mobileTextTertiary)
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        GrokStatusChip(
          label = "${item.artwork.source.uppercase()} • ${"%.1f".format(item.artwork.averageRating)} / 5",
          active = true,
        )
        Text(
          "${item.artwork.ratingCount} ratings",
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
      }
      if (!item.artwork.sourceModel.isNullOrBlank()) {
        Text("Model: ${item.artwork.sourceModel}", style = mobileCaption1, color = mobileTextTertiary)
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        GrokIconButton(
          label = if (ratingBusy) "Saving…" else "Thumbs Up",
          icon = Icons.Default.ThumbUp,
          enabled = !ratingBusy,
          accent = mobileSuccess,
          onClick = onThumbUp,
        )
        GrokIconButton(
          label = if (ratingBusy) "Saving…" else "Thumbs Down",
          icon = Icons.Default.ThumbDown,
          enabled = !ratingBusy,
          accent = mobileWarning,
          onClick = onThumbDown,
        )
      }
      item.viewerRating?.let { viewerRating ->
        Text(
          if (viewerRating >= 4) "Your vote: thumbs up" else "Your vote: thumbs down",
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
      }
    }
  }
}

@Composable
private fun GrokRespondResultCard(result: GrokTextReply) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text("Direct Response", style = mobileBody.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      Text(result.content, style = mobileCallout, color = mobileTextSecondary)
      result.model?.takeIf { it.isNotBlank() }?.let { model ->
        HorizontalDivider(color = mobileBorder)
        Text("Model: $model", style = mobileCaption1, color = mobileTextTertiary)
      }
    }
  }
}

@Composable
private fun GrokIconButton(
  label: String,
  icon: ImageVector,
  enabled: Boolean = true,
  accent: Color = mobileAccent,
  onClick: () -> Unit,
) {
  Button(
    onClick = onClick,
    enabled = enabled,
    shape = RoundedCornerShape(14.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = accent.copy(alpha = 0.14f),
        contentColor = accent,
        disabledContainerColor = mobileSurfaceStrong.copy(alpha = 0.55f),
        disabledContentColor = mobileTextTertiary,
      ),
    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
      Icon(imageVector = icon, contentDescription = null)
      Text(label, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
    }
  }
}

@Composable
private fun GrokSectionCard(
  title: String,
  subtitle: String,
  icon: ImageVector,
  content: @Composable ColumnScope.() -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(18.dp),
    color = mobileSurface,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(
          modifier = Modifier.padding(0.dp),
          shape = RoundedCornerShape(12.dp),
          color = mobileAccentSoft,
          border = BorderStroke(1.dp, mobileAccent.copy(alpha = 0.28f)),
        ) {
          Box(modifier = Modifier.padding(10.dp), contentAlignment = Alignment.Center) {
            Icon(imageVector = icon, contentDescription = null, tint = mobileAccent)
          }
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(title, style = mobileHeadline, color = mobileText)
          Text(subtitle, style = mobileCallout, color = mobileTextSecondary)
        }
      }
      content()
    }
  }
}

@Composable
private fun GrokStatusChip(label: String, active: Boolean) {
  Surface(
    shape = RoundedCornerShape(999.dp),
    color = if (active) mobileAccentSoft else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) mobileAccent.copy(alpha = 0.3f) else mobileBorderStrong),
  ) {
    Text(
      text = label,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = if (active) mobileAccent else mobileTextSecondary,
    )
  }
}

@Composable
private fun GrokToggleChip(label: String, active: Boolean, onClick: () -> Unit) {
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(999.dp),
    color = if (active) mobileSuccessSoft else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) mobileSuccess.copy(alpha = 0.35f) else mobileBorderStrong),
  ) {
    Text(
      text = label,
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = if (active) mobileSuccess else mobileTextSecondary,
    )
  }
}

@Composable
private fun GrokButton(
  label: String,
  emphasis: Boolean = false,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  Button(
    onClick = onClick,
    enabled = enabled,
    shape = RoundedCornerShape(14.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = if (emphasis) mobileAccent else mobileSurfaceStrong,
        contentColor = if (emphasis) Color.White else mobileText,
        disabledContainerColor = if (emphasis) mobileAccent.copy(alpha = 0.45f) else mobileSurfaceStrong.copy(alpha = 0.55f),
        disabledContentColor = mobileTextTertiary,
      ),
    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
  ) {
    Text(label, style = mobileCallout.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun GrokOutlinedField(
  value: String,
  onValueChange: (String) -> Unit,
  label: String,
  singleLine: Boolean = true,
  keyboardType: KeyboardType = KeyboardType.Text,
) {
  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    modifier = Modifier.fillMaxWidth(),
    label = { Text(label, style = mobileCaption1, color = mobileTextSecondary) },
    singleLine = singleLine,
    textStyle = if (singleLine) mobileBody.copy(color = mobileText) else mobileCallout.copy(color = mobileText),
    shape = RoundedCornerShape(14.dp),
    colors =
      OutlinedTextFieldDefaults.colors(
        focusedContainerColor = mobileSurfaceStrong,
        unfocusedContainerColor = mobileSurfaceStrong,
        focusedBorderColor = mobileAccent,
        unfocusedBorderColor = mobileBorderStrong,
        focusedTextColor = mobileText,
        unfocusedTextColor = mobileText,
        cursorColor = mobileAccent,
      ),
    keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
  )
}

private data class GrokImagePreviewState(
  val image: ImageBitmap?,
  val failed: Boolean,
)

private fun decodeSampledImage(bytes: ByteArray, maxDimension: Int = 1_280): ImageBitmap? {
  val bounds =
    BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }
  BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
  val maxSourceDimension = max(bounds.outWidth, bounds.outHeight).coerceAtLeast(1)
  var sampleSize = 1
  while (maxSourceDimension / sampleSize > maxDimension) {
    sampleSize *= 2
  }
  val decodeOptions =
    BitmapFactory.Options().apply {
      inSampleSize = sampleSize
      inPreferredConfig = Bitmap.Config.RGB_565
    }
  return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOptions)?.asImageBitmap()
}

@Composable
private fun rememberGrokImagePreviewState(base64: String): GrokImagePreviewState {
  var image by remember(base64) { mutableStateOf<ImageBitmap?>(null) }
  var failed by remember(base64) { mutableStateOf(false) }

  LaunchedEffect(base64) {
    failed = false
    image =
      withContext(Dispatchers.Default) {
        try {
          val bytes = Base64.decode(base64, Base64.DEFAULT)
          decodeSampledImage(bytes)
        } catch (_: Throwable) {
          null
        }
      }
    if (image == null) failed = true
  }

  return GrokImagePreviewState(image = image, failed = failed)
}

@Composable
private fun rememberRemoteImagePreviewState(url: String): GrokImagePreviewState {
  var image by remember(url) { mutableStateOf<ImageBitmap?>(null) }
  var failed by remember(url) { mutableStateOf(false) }

  LaunchedEffect(url) {
    failed = false
    image =
      withContext(Dispatchers.IO) {
        try {
          URL(url).openStream().use { stream ->
            decodeSampledImage(stream.readBytes())
          }
        } catch (_: Throwable) {
          null
        }
      }
    if (image == null) failed = true
  }

  return GrokImagePreviewState(image = image, failed = failed)
}

private fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }
