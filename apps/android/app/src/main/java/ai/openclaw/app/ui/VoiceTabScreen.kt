package ai.openclaw.app.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.SettingsEthernet
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.voice.VoiceConversationRole
import kotlin.math.max

private data class GrokVoicePreset(
  val id: String,
  val tone: String,
  val type: String,
)

private val grokVoicePresets =
  listOf(
    GrokVoicePreset(id = "Eve", tone = "Energetic, upbeat", type = "Female"),
    GrokVoicePreset(id = "Ara", tone = "Warm, friendly", type = "Female"),
    GrokVoicePreset(id = "Rex", tone = "Confident, clear", type = "Male"),
    GrokVoicePreset(id = "Sal", tone = "Smooth, balanced", type = "Neutral"),
    GrokVoicePreset(id = "Leo", tone = "Authoritative", type = "Male"),
  )

@Composable
fun VoiceTabScreen(viewModel: MainViewModel) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  val activity = remember(context) { context.findActivity() }

  val gatewayStatus by viewModel.statusText.collectAsState()
  val gatewayConnected by viewModel.isConnected.collectAsState()
  val micEnabled by viewModel.micEnabled.collectAsState()
  val micCooldown by viewModel.micCooldown.collectAsState()
  val speakerEnabled by viewModel.speakerEnabled.collectAsState()
  val micStatusText by viewModel.micStatusText.collectAsState()
  val micLiveTranscript by viewModel.micLiveTranscript.collectAsState()
  val micQueuedMessages by viewModel.micQueuedMessages.collectAsState()
  val micConversation by viewModel.micConversation.collectAsState()
  val micInputLevel by viewModel.micInputLevel.collectAsState()
  val micIsSending by viewModel.micIsSending.collectAsState()
  val selectedVoice by viewModel.grokVoiceId.collectAsState()
  val vadThreshold by viewModel.grokVadThreshold.collectAsState()
  val silenceDuration by viewModel.grokSilenceDurationMs.collectAsState()
  val sampleRate by viewModel.grokSampleRate.collectAsState()
  val webToolEnabled by viewModel.grokWebSearchEnabled.collectAsState()
  val xToolEnabled by viewModel.grokXSearchEnabled.collectAsState()
  val xAiVoiceConfigured by viewModel.xAiVoiceConfigured.collectAsState()
  val liveCameraVisionAvailable by viewModel.liveCameraVisionAvailable.collectAsState()
  val liveCameraStatusText by viewModel.liveCameraStatusText.collectAsState()

  var hasMicPermission by remember { mutableStateOf(context.hasRecordAudioPermission()) }
  var pendingMicEnable by remember { mutableStateOf(false) }
  var pulse by remember { mutableFloatStateOf(0f) }

  var showConfig by rememberSaveable { mutableStateOf(false) }
  var showProtocol by rememberSaveable { mutableStateOf(false) }

  val hasStreamingAssistant =
    micConversation.any { it.role == VoiceConversationRole.Assistant && it.isStreaming }
  val phase =
    when {
      micIsSending -> "thinking"
      hasStreamingAssistant -> "speaking"
      micEnabled -> "listening"
      micCooldown -> "cooldown"
      xAiVoiceConfigured || gatewayConnected -> "idle"
      else -> "offline"
    }
  val phaseLabel =
    when (phase) {
      "thinking" -> "Thinking"
      "speaking" -> "Speaking"
      "listening" -> "Listening"
      "cooldown" -> "Cooldown"
      "idle" -> "Standby"
      else -> "Offline"
    }
  val orbColor =
    when (phase) {
      "listening" -> mobileSuccess
      "speaking" -> mobileAccent
      "thinking", "cooldown" -> mobileOrange
      "idle" -> mobileAccent
      else -> mobileDanger
    }
  val inputDrive = if (micEnabled) max(micInputLevel.coerceIn(0f, 1f), 0.08f) else 0.08f
  val ringOneScale = 1.02f + pulse * 0.18f + inputDrive * 0.06f
  val ringTwoScale = 1.16f + pulse * 0.32f + inputDrive * 0.10f
  val ringOneAlpha = (0.32f - pulse * 0.12f).coerceAtLeast(0.10f)
  val ringTwoAlpha = (0.22f - pulse * 0.10f).coerceAtLeast(0.07f)
  val transportLabel = if (xAiVoiceConfigured) "Realtime" else if (gatewayConnected) "Gateway" else "Offline"
  val sessionPreview =
    buildString {
      append("""{"type":"session.update","session":{"voice":"$selectedVoice","turn_detection":{"type":"server_vad","threshold":$vadThreshold,"silence_duration_ms":$silenceDuration},"tools":[""")
      if (webToolEnabled) append("web_search")
      if (webToolEnabled && xToolEnabled) append(",")
      if (xToolEnabled) append("x_search")
      append(""""],"audio":{"input":{"format":{"type":"audio/pcm","rate":$sampleRate}},"output":{"format":{"type":"audio/pcm","rate":$sampleRate}}}}}""")
    }

  DisposableEffect(lifecycleOwner, context) {
    val observer =
      LifecycleEventObserver { _, event ->
        if (event == Lifecycle.Event.ON_RESUME) {
          hasMicPermission = context.hasRecordAudioPermission()
        }
      }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
      viewModel.setVoiceScreenActive(false)
    }
  }

  LaunchedEffect(Unit) {
    viewModel.setVoiceScreenActive(true)
  }

  LaunchedEffect(Unit) {
    while (true) {
      pulse = (pulse + 0.02f) % 1f
      kotlinx.coroutines.delay(16L)
    }
  }

  val requestMicPermission =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      hasMicPermission = granted
      if (granted && pendingMicEnable) {
        viewModel.setMicEnabled(true)
      }
      pendingMicEnable = false
    }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .background(mobileBackgroundGradient)
        .imePadding()
        .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom))
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "Voice Assistant",
      title = "Grok Voice",
      subtitle = "Use one live voice surface for listening, speaking, and hands-on runtime assistance.",
    )

    SolanaBackplaneCard(
      title = "Voice Backplane",
      subtitle = "The Voice tab now drives a native xAI websocket session from Android instead of the older gateway chat voice loop.",
      links =
        listOf(
          SolanaBackendLink(
            label = "Realtime Voice",
            state = if (xAiVoiceConfigured) "Ready" else "Missing",
            detail = if (xAiVoiceConfigured) micStatusText else "Realtime voice is unavailable in this build.",
            tone = SolanaPanelTone.Green,
            active = xAiVoiceConfigured,
          ),
          SolanaBackendLink(
            label = "Gateway Runtime",
            state = if (gatewayConnected) "Online" else "Optional",
            detail = if (gatewayConnected) gatewayStatus else "Voice can still run without a paired runtime when realtime voice is available.",
            tone = SolanaPanelTone.Purple,
            active = gatewayConnected,
          ),
          SolanaBackendLink(
            label = "Mic Capture",
            state = phaseLabel,
            detail = micStatusText,
            tone = if (micEnabled || micIsSending) SolanaPanelTone.Green else SolanaPanelTone.Orange,
            active = micEnabled || micIsSending || micCooldown,
          ),
          SolanaBackendLink(
            label = "Speaker",
            state = if (speakerEnabled) "On" else "Muted",
            detail = if (xAiVoiceConfigured) "Realtime playback is active for assistant responses." else "Assistant playback follows the standard voice reply path.",
            tone = SolanaPanelTone.Orange,
            active = speakerEnabled,
          ),
          SolanaBackendLink(
            label = "Vision Commentary",
            state = if (liveCameraVisionAvailable) "Ready" else "Off",
            detail = liveCameraStatusText,
            tone = SolanaPanelTone.Purple,
            active = liveCameraVisionAvailable,
          ),
        ),
    )

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaMetricTile(
        label = "Phase",
        value = phaseLabel.uppercase(),
        tone =
          when (phase) {
            "listening" -> SolanaPanelTone.Green
            "speaking" -> SolanaPanelTone.Purple
            "thinking", "cooldown" -> SolanaPanelTone.Orange
            else -> SolanaPanelTone.Neutral
          },
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Queue",
        value = micQueuedMessages.size.toString(),
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Transport",
        value = transportLabel.uppercase(),
        tone = if (xAiVoiceConfigured) SolanaPanelTone.Green else SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
      )
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(18.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            SolanaSectionLabel("Grok Voice Agent", tone = SolanaPanelTone.Purple)
            Text(
              if (xAiVoiceConfigured) "Live voice transport is ready on this device" else "Live voice transport is unavailable in this build",
              style = mobileCaption1,
              color = mobileTextSecondary,
            )
          }
          VoicePhaseBadge(label = phaseLabel, color = orbColor)
        }

        Text(
          "Voice $selectedVoice · PCM ${sampleRate}Hz · $transportLabel transport",
          style = mobileCaption1,
          color = mobileTextSecondary,
        )

        GrokVoiceOrb(
          color = orbColor,
          ringOneScale = ringOneScale,
          ringTwoScale = ringTwoScale,
          ringOneAlpha = ringOneAlpha,
          ringTwoAlpha = ringTwoAlpha,
          label =
            when (phase) {
              "offline" -> "Runtime offline"
              "idle" -> "Tap connect to start"
              "listening" -> "Listening"
              "speaking" -> "Speaking · $selectedVoice"
              "thinking" -> "Thinking"
              else -> "Cooldown"
            },
          sublabel =
            if (xAiVoiceConfigured) {
              "Live voice capture and assistant playback are active."
            } else {
              "Voice services are unavailable in this build."
            },
        )

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          VoiceActionButton(
            label = if (micEnabled) "HOT MIC" else "CONNECT",
            modifier = Modifier.weight(1f),
            tone = SolanaPanelTone.Green,
            enabled = !micCooldown,
            onClick = {
              if (micEnabled) {
                viewModel.setMicEnabled(false)
              } else if (hasMicPermission) {
                viewModel.setMicEnabled(true)
              } else {
                pendingMicEnable = true
                requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
              }
            },
          )
          VoiceActionButton(
            label = if (speakerEnabled) "MUTE" else "UNMUTE",
            modifier = Modifier.weight(1f),
            tone = SolanaPanelTone.Purple,
            onClick = { viewModel.setSpeakerEnabled(!speakerEnabled) },
          )
          VoiceActionButton(
            label = "DISCONNECT",
            modifier = Modifier.weight(1f),
            tone = SolanaPanelTone.Orange,
            enabled = micEnabled || micCooldown,
            onClick = {
              viewModel.setMicEnabled(false)
              viewModel.setVoiceScreenActive(false)
            },
          )
        }

        if (!hasMicPermission) {
          val showRationale =
            if (activity == null) {
              false
            } else {
              ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.RECORD_AUDIO)
            }
          Text(
            if (showRationale) {
              "Microphone permission is required before Android can start the live voice session."
            } else {
              "Microphone access is blocked. Open app settings to enable live voice capture."
            },
            style = mobileCaption1,
            color = mobileWarning,
            textAlign = TextAlign.Center,
          )
          VoiceActionButton(
            label = "OPEN SETTINGS",
            tone = SolanaPanelTone.Orange,
            onClick = { openAppSettings(context) },
          )
        }
      }
    }

    FlowRow(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(6.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
          grokVoicePresets.forEach { preset ->
        VoicePresetChip(
          preset = preset,
          selected = selectedVoice == preset.id,
          onClick = { viewModel.setGrokVoiceId(preset.id) },
        )
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(18.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          VoiceSectionToggle(
            label = "SESSION CONFIG",
            expanded = showConfig,
            modifier = Modifier.weight(1f),
            icon = Icons.Default.SettingsEthernet,
            onClick = { showConfig = !showConfig },
          )
          VoiceSectionToggle(
            label = "PROTOCOL REF",
            expanded = showProtocol,
            modifier = Modifier.weight(1f),
            icon = Icons.Default.AutoAwesome,
            onClick = { showProtocol = !showProtocol },
          )
        }

        if (showConfig) {
          SolanaSectionLabel("Session Config", tone = SolanaPanelTone.Purple)
          Text(
            "These controls shape the active live voice session for this device.",
            style = mobileCaption1,
            color = mobileTextSecondary,
          )
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
          ) {
            VoiceConfigField(
              value = vadThreshold,
              onValueChange = viewModel::setGrokVadThreshold,
              label = "VAD Threshold",
              modifier = Modifier.weight(1f),
            )
            VoiceConfigField(
              value = silenceDuration,
              onValueChange = viewModel::setGrokSilenceDurationMs,
              label = "Silence ms",
              modifier = Modifier.weight(1f),
            )
          }
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Audio Rate", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
              listOf("8000", "16000", "22050", "24000", "32000", "44100", "48000").forEach { rate ->
                VoiceMiniChip(
                  label = rate,
                  active = sampleRate == rate,
                  tone = SolanaPanelTone.Purple,
                  onClick = { viewModel.setGrokSampleRate(rate) },
                )
              }
            }
          }
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Tools", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              VoiceMiniChip(
                label = if (webToolEnabled) "Web Search ✓" else "Web Search ○",
                active = webToolEnabled,
                tone = SolanaPanelTone.Green,
                modifier = Modifier.weight(1f),
                onClick = { viewModel.setGrokWebSearchEnabled(!webToolEnabled) },
              )
              VoiceMiniChip(
                label = if (xToolEnabled) "X Search ✓" else "X Search ○",
                active = xToolEnabled,
                tone = SolanaPanelTone.Green,
                modifier = Modifier.weight(1f),
                onClick = { viewModel.setGrokXSearchEnabled(!xToolEnabled) },
              )
            }
          }
          Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            color = mobileSurfaceStrong,
            border = BorderStroke(1.dp, mobileBorderStrong),
          ) {
            Text(
              text = sessionPreview,
              modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
              style = mobileCaption1,
              color = mobileTextSecondary,
            )
          }
        }

        if (showProtocol) {
          SolanaSectionLabel("Realtime Protocol", tone = SolanaPanelTone.Orange)
          VoiceProtocolLine("→", "session.update", "Configure voice, server_vad, tools, and PCM input/output formats.")
          VoiceProtocolLine("→", "input_audio_buffer.append", "Append base64 PCM16 chunks captured natively from AudioRecord.")
          VoiceProtocolLine("←", "session.created", "Socket established and session bootstrap started.")
          VoiceProtocolLine("←", "session.updated", "xAI accepted the active session configuration.")
          VoiceProtocolLine("←", "input_audio_buffer.speech_started", "Server VAD detected speech.")
          VoiceProtocolLine("←", "conversation.item.input_audio_transcription.completed", "Input turn transcript completed.")
          VoiceProtocolLine("←", "response.output_audio.delta", "Audio chunk emitted by the assistant.")
          VoiceProtocolLine("←", "response.output_audio_transcript.delta", "Transcript text delta emitted.")
          VoiceProtocolLine("←", "response.done", "Assistant response reached terminal state.")
          Text(
            if (xAiVoiceConfigured) {
              "This tab streams microphone audio into the live voice session and plays assistant responses locally."
            } else {
              "Live voice transport is unavailable in this build."
            },
            style = mobileCaption1,
            color = mobileTextTertiary,
          )
        }
      }
    }

    if (!micLiveTranscript.isNullOrBlank()) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = mobileAccentSoft,
        border = BorderStroke(1.dp, mobileAccent.copy(alpha = 0.22f)),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
          verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
          Text("Live Transcript", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileAccent)
          Text(micLiveTranscript!!.trim(), style = mobileBody, color = mobileText)
        }
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(18.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          SolanaSectionLabel("Voice Log", tone = SolanaPanelTone.Purple)
          VoicePhaseBadge(
            label = if (micQueuedMessages.isEmpty()) "Queue ${micQueuedMessages.size}" else "${micQueuedMessages.size} queued",
            color = if (micQueuedMessages.isEmpty()) mobileTextSecondary else mobileOrange,
          )
        }

        Column(
          modifier =
            Modifier
              .fillMaxWidth()
              .heightIn(min = 140.dp, max = 320.dp)
              .verticalScroll(rememberScrollState()),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          if (micConversation.isEmpty() && !micIsSending) {
            Text(
              if (xAiVoiceConfigured) {
                "Open the mic to start a live voice session on Android."
              } else {
                "Voice services are unavailable in this build."
              },
              style = mobileCallout,
              color = mobileTextSecondary,
            )
          }

          micQueuedMessages.forEachIndexed { index, queued ->
            VoiceLogRow(
              role = "QUEUE",
              text = queued,
              tone = SolanaPanelTone.Orange,
              key = "queued-$index",
            )
          }

          micConversation.forEach { entry ->
            VoiceLogRow(
              role = if (entry.role == VoiceConversationRole.User) "YOU" else selectedVoice.uppercase(),
              text = if (entry.isStreaming && entry.text.isBlank()) "Listening response…" else entry.text,
              tone = if (entry.role == VoiceConversationRole.User) SolanaPanelTone.Green else SolanaPanelTone.Purple,
              key = entry.id,
            )
          }

          if (micIsSending && !hasStreamingAssistant) {
            VoiceLogRow(
              role = "SYS",
              text = "Thinking… runtime is assembling the next assistant turn.",
              tone = SolanaPanelTone.Orange,
              key = "thinking",
            )
          }
        }
      }
    }
  }
}

@Composable
private fun GrokVoiceOrb(
  color: Color,
  ringOneScale: Float,
  ringTwoScale: Float,
  ringOneAlpha: Float,
  ringTwoAlpha: Float,
  label: String,
  sublabel: String,
) {
  val radialBrush =
    Brush.radialGradient(
      colors =
        listOf(
          color.copy(alpha = 0.92f),
          mobileAccent.copy(alpha = 0.45f),
          mobileSurface.copy(alpha = 0.88f),
        ),
    )

  Column(
    modifier = Modifier.fillMaxWidth(),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Box(modifier = Modifier.size(220.dp), contentAlignment = Alignment.Center) {
      Box(
        modifier =
          Modifier
            .size(180.dp * ringTwoScale)
            .alpha(ringTwoAlpha)
            .background(Color.Transparent, CircleShape),
      ) {
        Surface(
          modifier = Modifier.fillMaxSize(),
          shape = CircleShape,
          color = Color.Transparent,
          border = BorderStroke(2.dp, color.copy(alpha = 0.9f)),
        ) {}
      }
      Box(
        modifier =
          Modifier
            .size(180.dp * ringOneScale)
            .alpha(ringOneAlpha)
            .background(Color.Transparent, CircleShape),
      ) {
        Surface(
          modifier = Modifier.fillMaxSize(),
          shape = CircleShape,
          color = Color.Transparent,
          border = BorderStroke(2.dp, color.copy(alpha = 0.95f)),
        ) {}
      }
      Surface(
        modifier = Modifier.size(176.dp),
        shape = CircleShape,
        color = Color.Transparent,
        border = BorderStroke(1.dp, color.copy(alpha = 0.35f)),
      ) {
        Box(
          modifier = Modifier.fillMaxSize().background(radialBrush, CircleShape),
          contentAlignment = Alignment.Center,
        ) {
          Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(
              imageVector = Icons.Default.Mic,
              contentDescription = null,
              modifier = Modifier.size(28.dp),
              tint = Color.White.copy(alpha = 0.92f),
            )
            Text(label, style = mobileHeadline, color = mobileText, textAlign = TextAlign.Center)
          }
        }
      }
    }

    Surface(
      shape = RoundedCornerShape(999.dp),
      color = color.copy(alpha = 0.12f),
      border = BorderStroke(1.dp, color.copy(alpha = 0.28f)),
    ) {
      Text(
        text = label,
        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        style = mobileBody.copy(fontWeight = FontWeight.SemiBold),
        color = mobileText,
      )
    }
    Text(
      text = sublabel,
      style = mobileCaption1,
      color = mobileTextSecondary,
      textAlign = TextAlign.Center,
    )
  }
}

@Composable
private fun VoicePresetChip(
  preset: GrokVoicePreset,
  selected: Boolean,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(10.dp),
    color = if (selected) mobileAccentSoft else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (selected) mobileAccent.copy(alpha = 0.4f) else mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
      Text(
        preset.id,
        style = mobileBody.copy(fontWeight = FontWeight.Bold),
        color = if (selected) mobileAccent else mobileText,
      )
      Text(
        "${preset.type} · ${preset.tone}",
        style = mobileCaption2,
        color = mobileTextSecondary,
      )
    }
  }
}

@Composable
private fun VoiceActionButton(
  label: String,
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  val container =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccess
      SolanaPanelTone.Purple -> mobileAccent
      SolanaPanelTone.Orange -> mobileOrange
      SolanaPanelTone.Neutral -> mobileSurfaceStrong
    }
  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier,
    shape = RoundedCornerShape(12.dp),
    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = container,
        contentColor = Color.White,
        disabledContainerColor = container.copy(alpha = 0.35f),
        disabledContentColor = Color.White.copy(alpha = 0.55f),
      ),
  ) {
    Text(label, style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.7.sp))
  }
}

@Composable
private fun VoiceSectionToggle(
  label: String,
  expanded: Boolean,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  modifier: Modifier = Modifier,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = modifier,
    shape = RoundedCornerShape(12.dp),
    color = if (expanded) mobileAccentSoft else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (expanded) mobileAccent.copy(alpha = 0.3f) else mobileBorderStrong),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = if (expanded) mobileAccent else mobileTextSecondary, modifier = Modifier.size(16.dp))
        Text(label, style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = if (expanded) mobileAccent else mobileText)
      }
      Text(if (expanded) "▲" else "▼", style = mobileCaption1, color = mobileTextSecondary)
    }
  }
}

@Composable
private fun VoiceConfigField(
  value: String,
  onValueChange: (String) -> Unit,
  label: String,
  modifier: Modifier = Modifier,
) {
  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    modifier = modifier,
    label = { Text(label, style = mobileCaption2, color = mobileTextSecondary) },
    singleLine = true,
    textStyle = mobileBody.copy(color = mobileText),
    shape = RoundedCornerShape(12.dp),
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
  )
}

@Composable
private fun VoiceMiniChip(
  label: String,
  active: Boolean,
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
  onClick: () -> Unit,
) {
  val accent =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccess
      SolanaPanelTone.Purple -> mobileAccent
      SolanaPanelTone.Orange -> mobileOrange
      SolanaPanelTone.Neutral -> mobileTextSecondary
    }
  Surface(
    onClick = onClick,
    modifier = modifier,
    shape = RoundedCornerShape(999.dp),
    color = if (active) accent.copy(alpha = 0.12f) else mobileSurfaceStrong,
    border = BorderStroke(1.dp, if (active) accent.copy(alpha = 0.35f) else mobileBorderStrong),
  ) {
    Text(
      text = label,
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
      color = if (active) accent else mobileTextSecondary,
      textAlign = TextAlign.Center,
    )
  }
}

@Composable
private fun VoiceProtocolLine(direction: String, event: String, detail: String) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
    verticalAlignment = Alignment.Top,
  ) {
    Text(
      direction,
      modifier = Modifier.width(14.dp),
      style = mobileBody.copy(fontWeight = FontWeight.Bold),
      color = if (direction == "→") mobileSuccess else mobileOrange,
      textAlign = TextAlign.Center,
    )
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(event, style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileText)
      Text(detail, style = mobileCaption1, color = mobileTextSecondary)
    }
  }
}

@Composable
private fun VoiceLogRow(
  role: String,
  text: String,
  tone: SolanaPanelTone,
  key: String,
) {
  val accent =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccess
      SolanaPanelTone.Purple -> mobileAccent
      SolanaPanelTone.Orange -> mobileOrange
      SolanaPanelTone.Neutral -> mobileTextSecondary
    }
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, accent.copy(alpha = 0.22f)),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        "$role · $key".uppercase(),
        style = mobileCaption2.copy(fontWeight = FontWeight.SemiBold),
        color = accent,
      )
      Text(text.ifBlank { "…" }, style = mobileCallout, color = mobileText)
    }
  }
}

@Composable
private fun VoicePhaseBadge(label: String, color: Color) {
  Surface(
    shape = RoundedCornerShape(999.dp),
    color = color.copy(alpha = 0.12f),
    border = BorderStroke(1.dp, color.copy(alpha = 0.28f)),
  ) {
    Text(
      text = label.uppercase(),
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = mobileCaption2.copy(fontWeight = FontWeight.SemiBold),
      color = color,
    )
  }
}

private fun Context.hasRecordAudioPermission(): Boolean {
  return (
    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED
    )
}

private fun Context.findActivity(): Activity? =
  when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
  }

private fun openAppSettings(context: Context) {
  val intent =
    Intent(
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
      Uri.fromParts("package", context.packageName, null),
    )
  context.startActivity(intent)
}
