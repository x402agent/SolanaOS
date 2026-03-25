package ai.openclaw.app.voice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
import androidx.core.content.ContextCompat
import java.util.ArrayDeque
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import kotlin.math.max
import kotlin.math.sqrt

data class XAiRealtimeVoiceSessionConfig(
  val voiceId: String,
  val vadThreshold: Double,
  val silenceDurationMs: Int,
  val sampleRate: Int,
  val webSearchEnabled: Boolean,
  val xSearchEnabled: Boolean,
  val instructions: String = defaultInstructions,
) {
  companion object {
    private const val defaultInstructions =
      "You are SolanaOS Voice on Android. Keep replies concise and conversational. " +
        "When web_search or x_search tools are enabled, use them for current information."
  }
}

class XAiRealtimeVoiceClient(
  private val context: Context,
  private val scope: CoroutineScope,
  private val apiKey: String,
  private val configProvider: () -> XAiRealtimeVoiceSessionConfig,
  private val playbackEnabledProvider: () -> Boolean,
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient =
    OkHttpClient.Builder()
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .build(),
) {
  companion object {
    private const val baseUrl = "wss://api.x.ai/v1/realtime"
    private const val maxConversationEntries = 40
    private const val bufferedAudioWindowSeconds = 10
    private val supportedSampleRates = setOf(8000, 16000, 22050, 24000, 32000, 44100, 48000)
  }

  private val _micEnabled = MutableStateFlow(false)
  val micEnabled: StateFlow<Boolean> = _micEnabled

  private val _micCooldown = MutableStateFlow(false)
  val micCooldown: StateFlow<Boolean> = _micCooldown

  private val _isListening = MutableStateFlow(false)
  val isListening: StateFlow<Boolean> = _isListening

  private val _statusText = MutableStateFlow("xAI voice idle")
  val statusText: StateFlow<String> = _statusText

  private val _liveTranscript = MutableStateFlow<String?>(null)
  val liveTranscript: StateFlow<String?> = _liveTranscript

  private val _queuedMessages = MutableStateFlow<List<String>>(emptyList())
  val queuedMessages: StateFlow<List<String>> = _queuedMessages

  private val _conversation = MutableStateFlow<List<VoiceConversationEntry>>(emptyList())
  val conversation: StateFlow<List<VoiceConversationEntry>> = _conversation

  private val _inputLevel = MutableStateFlow(0f)
  val inputLevel: StateFlow<Float> = _inputLevel

  private val _isSending = MutableStateFlow(false)
  val isSending: StateFlow<Boolean> = _isSending

  private val playbackLock = Any()
  private val bufferLock = Any()
  private val micBuffer = ArrayDeque<ByteArray>()
  private var bufferedAudioBytes = 0
  private var recordJob: Job? = null
  private var audioRecord: AudioRecord? = null
  private var audioTrack: AudioTrack? = null
  private var trackStarted = false
  private var webSocket: WebSocket? = null
  private var websocketOpen = false
  private var sessionReady = false
  private var responseInProgress = false
  private var activeSampleRate = normalizeSampleRate(configProvider().sampleRate)
  private var pendingAssistantEntryId: String? = null
  private var pendingAssistantText = StringBuilder()
  private val sessionGeneration = AtomicLong(0L)

  fun setMicEnabled(enabled: Boolean) {
    if (_micEnabled.value == enabled) return
    _micEnabled.value = enabled
    if (enabled) {
      startSession()
    } else {
      stopSession(resetConversationStreaming = true)
    }
  }

  fun setPlaybackEnabled(enabled: Boolean) {
    if (!enabled) {
      stopPlayback()
    }
  }

  fun refreshSessionConfig() {
    if (!_micEnabled.value) return
    val next = configProvider()
    val nextSampleRate = normalizeSampleRate(next.sampleRate)
    if (nextSampleRate != activeSampleRate) {
      restartActiveSession()
      return
    }
    if (!sessionReady) return
    sendSessionUpdate(next)
  }

  fun restartActiveSession() {
    if (!_micEnabled.value) return
    scope.launch {
      stopSession(resetConversationStreaming = false, clearEnabled = false)
      startSession()
    }
  }

  private fun startSession() {
    if (apiKey.isBlank()) {
      _statusText.value = "xAI API key missing"
      _micEnabled.value = false
      return
    }
    if (!hasMicPermission()) {
      _statusText.value = "Microphone permission required"
      _micEnabled.value = false
      return
    }

    stopSession(resetConversationStreaming = false, clearEnabled = false)

    val generation = sessionGeneration.incrementAndGet()
    val config = configProvider()
    activeSampleRate = normalizeSampleRate(config.sampleRate)
    sessionReady = false
    websocketOpen = false
    responseInProgress = false
    pendingAssistantEntryId = null
    pendingAssistantText = StringBuilder()
    _inputLevel.value = 0f
    _isListening.value = false
    _isSending.value = false
    _statusText.value = "Connecting to xAI realtime…"

    startMicrophoneCapture(generation, activeSampleRate)
    openWebSocket(generation, config)
  }

  private fun stopSession(
    resetConversationStreaming: Boolean,
    clearEnabled: Boolean = true,
  ) {
    sessionGeneration.incrementAndGet()
    recordJob?.cancel()
    recordJob = null
    stopRecording()
    stopPlayback()
    webSocket?.close(1000, "client closing")
    webSocket = null
    websocketOpen = false
    sessionReady = false
    responseInProgress = false
    clearMicBuffer()
    pendingAssistantEntryId = null
    pendingAssistantText = StringBuilder()
    _inputLevel.value = 0f
    _isListening.value = false
    _isSending.value = false
    if (resetConversationStreaming) {
      finalizePendingAssistant()
    }
    if (clearEnabled) {
      _micEnabled.value = false
    }
    if (!_micEnabled.value) {
      _statusText.value = "xAI voice idle"
    }
  }

  private fun openWebSocket(
    generation: Long,
    config: XAiRealtimeVoiceSessionConfig,
  ) {
    val request =
      Request.Builder()
        .url(baseUrl)
        .header("Authorization", "Bearer $apiKey")
        .header("Content-Type", "application/json")
        .build()

    webSocket =
      httpClient.newWebSocket(
        request,
        object : WebSocketListener() {
          override fun onOpen(webSocket: WebSocket, response: Response) {
            if (!isGenerationActive(generation)) {
              webSocket.close(1000, "superseded")
              return
            }
            this@XAiRealtimeVoiceClient.webSocket = webSocket
            websocketOpen = true
            _statusText.value = "Connected · configuring session…"
            sendSessionUpdate(config)
          }

          override fun onMessage(webSocket: WebSocket, text: String) {
            if (!isGenerationActive(generation)) return
            handleServerEvent(text)
          }

          override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (!isGenerationActive(generation)) return
            _statusText.value = "xAI realtime failed: ${t.message ?: "connection error"}"
            _isListening.value = false
            _isSending.value = false
            _inputLevel.value = 0f
            _micEnabled.value = false
            stopRecording()
            stopPlayback()
          }

          override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (!isGenerationActive(generation)) return
            websocketOpen = false
            sessionReady = false
            _isListening.value = false
            _isSending.value = false
            if (_micEnabled.value) {
              _statusText.value = "xAI socket closed: $code"
              _micEnabled.value = false
            } else {
              _statusText.value = "xAI voice idle"
            }
          }
        },
      )
  }

  private fun sendSessionUpdate(config: XAiRealtimeVoiceSessionConfig) {
    val payload =
      buildJsonObject {
        put("type", JsonPrimitive("session.update"))
        put(
          "session",
          buildJsonObject {
            put("instructions", JsonPrimitive(config.instructions))
            put("voice", JsonPrimitive(config.voiceId.ifBlank { "Eve" }))
            put(
              "turn_detection",
              buildJsonObject {
                put("type", JsonPrimitive("server_vad"))
                put("threshold", JsonPrimitive(config.vadThreshold))
                put("silence_duration_ms", JsonPrimitive(config.silenceDurationMs))
              },
            )
            put(
              "audio",
              buildJsonObject {
                put(
                  "input",
                  buildJsonObject {
                    put(
                      "format",
                      buildJsonObject {
                        put("type", JsonPrimitive("audio/pcm"))
                        put("rate", JsonPrimitive(config.sampleRate))
                      },
                    )
                  },
                )
                put(
                  "output",
                  buildJsonObject {
                    put(
                      "format",
                      buildJsonObject {
                        put("type", JsonPrimitive("audio/pcm"))
                        put("rate", JsonPrimitive(config.sampleRate))
                      },
                    )
                  },
                )
              },
            )
            put(
              "tools",
              buildJsonArray {
                if (config.webSearchEnabled) {
                  add(buildJsonObject { put("type", JsonPrimitive("web_search")) })
                }
                if (config.xSearchEnabled) {
                  add(buildJsonObject { put("type", JsonPrimitive("x_search")) })
                }
              },
            )
          },
        )
      }
    webSocket?.send(payload.toString())
  }

  private fun startMicrophoneCapture(
    generation: Long,
    sampleRate: Int,
  ) {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      _statusText.value = "Microphone permission required"
      _micEnabled.value = false
      return
    }
    val minBuffer =
      AudioRecord.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
    if (minBuffer <= 0) {
      _statusText.value = "AudioRecord init failed"
      _micEnabled.value = false
      return
    }
    val readSize = max(sampleRate / 25 * 2, 1920)
    val bufferSize = max(minBuffer * 2, readSize * 4)
    val record =
      AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufferSize,
      )
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      _statusText.value = "AudioRecord unavailable"
      _micEnabled.value = false
      return
    }
    audioRecord = record
    recordJob =
      scope.launch(Dispatchers.IO) {
        val buffer = ByteArray(readSize)
        try {
          record.startRecording()
          _isListening.value = true
          if (!sessionReady) {
            _statusText.value = "Listening · waiting for xAI session"
          }
          while (_micEnabled.value && isGenerationActive(generation)) {
            val read = record.read(buffer, 0, buffer.size)
            if (read <= 0) continue
            val chunk = buffer.copyOf(read)
            _inputLevel.value = computeInputLevel(chunk)
            if (sessionReady && websocketOpen) {
              sendAudioChunk(chunk)
            } else {
              bufferAudioChunk(chunk, sampleRate)
            }
          }
        } catch (_: Throwable) {
          if (_micEnabled.value && isGenerationActive(generation)) {
            _statusText.value = "Microphone capture stopped"
            _micEnabled.value = false
          }
        } finally {
          stopRecording()
          _isListening.value = false
          _inputLevel.value = 0f
        }
      }
  }

  private fun handleServerEvent(rawText: String) {
    val event =
      runCatching { json.parseToJsonElement(rawText).asObjectOrNull() }.getOrNull()
        ?: return
    when (event["type"].asStringOrNull()) {
      "session.created" -> {
        _statusText.value = "Session created · waiting for update"
      }
      "session.updated" -> {
        sessionReady = true
        _statusText.value = "Listening"
        flushBufferedAudio()
      }
      "conversation.created" -> {
        if (!sessionReady) {
          _statusText.value = "Conversation ready · configuring audio"
        }
      }
      "input_audio_buffer.speech_started" -> {
        stopPlayback()
        _statusText.value = "Listening · speech detected"
      }
      "input_audio_buffer.speech_stopped" -> {
        _isSending.value = true
        _statusText.value = "Thinking…"
      }
      "conversation.item.input_audio_transcription.completed" -> {
        val transcript = event["transcript"].asStringOrNull()?.trim().orEmpty()
        if (transcript.isNotEmpty()) {
          _liveTranscript.value = transcript
          appendUserTranscript(transcript)
        }
      }
      "response.created" -> {
        responseInProgress = true
        _isSending.value = true
        _statusText.value = "Thinking…"
      }
      "response.output_audio_transcript.delta",
      "response.text.delta" -> {
        val delta = event["delta"].asStringOrNull().orEmpty()
        if (delta.isNotEmpty()) {
          beginAssistantStreaming()
          pendingAssistantText.append(delta)
          upsertAssistantEntry(pendingAssistantText.toString(), isStreaming = true)
        }
      }
      "response.output_audio.delta" -> {
        beginAssistantStreaming()
        val base64 = event["delta"].asStringOrNull().orEmpty()
        if (base64.isNotEmpty() && playbackEnabledProvider()) {
          writeAudioDelta(base64)
        }
      }
      "response.output_audio.done",
      "response.output_audio_transcript.done",
      "response.text.done",
      "response.output_item.done" -> {
        // Response terminal handling happens on response.done.
      }
      "response.done" -> {
        responseInProgress = false
        _isSending.value = false
        finalizePendingAssistant()
        _statusText.value = if (_micEnabled.value) "Listening" else "xAI voice idle"
      }
      "error" -> {
        responseInProgress = false
        _isSending.value = false
        finalizePendingAssistant()
        val message =
          event["error"].asObjectOrNull()?.get("message").asStringOrNull()
            ?: event["message"].asStringOrNull()
            ?: "xAI realtime error"
        _statusText.value = message
        appendAssistantError(message)
      }
    }
  }

  private fun beginAssistantStreaming() {
    responseInProgress = false
    _isSending.value = false
    if (_statusText.value.startsWith("Thinking")) {
      _statusText.value = "Speaking"
    }
  }

  private fun appendUserTranscript(text: String) {
    _conversation.value =
      (_conversation.value + VoiceConversationEntry(id = "user-${System.nanoTime()}", role = VoiceConversationRole.User, text = text))
        .takeLast(maxConversationEntries)
  }

  private fun appendAssistantError(text: String) {
    _conversation.value =
      (_conversation.value + VoiceConversationEntry(id = "assistant-${System.nanoTime()}", role = VoiceConversationRole.Assistant, text = text))
        .takeLast(maxConversationEntries)
  }

  private fun upsertAssistantEntry(
    text: String,
    isStreaming: Boolean,
  ) {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return
    val currentId = pendingAssistantEntryId ?: "assistant-${System.nanoTime()}".also { pendingAssistantEntryId = it }
    val updated =
      _conversation.value
        .filterNot { it.id == currentId }
        .plus(
          VoiceConversationEntry(
            id = currentId,
            role = VoiceConversationRole.Assistant,
            text = trimmed,
            isStreaming = isStreaming,
          ),
        ).takeLast(maxConversationEntries)
    _conversation.value = updated
  }

  private fun finalizePendingAssistant() {
    val finalText = pendingAssistantText.toString().trim()
    if (pendingAssistantEntryId != null && finalText.isNotEmpty()) {
      upsertAssistantEntry(finalText, isStreaming = false)
    } else if (pendingAssistantEntryId != null) {
      val target = pendingAssistantEntryId
      _conversation.value =
        _conversation.value.map { entry ->
          if (entry.id == target) entry.copy(isStreaming = false) else entry
        }
    }
    pendingAssistantEntryId = null
    pendingAssistantText = StringBuilder()
  }

  private fun sendAudioChunk(chunk: ByteArray) {
    val encoded = Base64.encodeToString(chunk, Base64.NO_WRAP)
    val payload =
      buildJsonObject {
        put("type", JsonPrimitive("input_audio_buffer.append"))
        put("audio", JsonPrimitive(encoded))
      }
    webSocket?.send(payload.toString())
  }

  private fun bufferAudioChunk(
    chunk: ByteArray,
    sampleRate: Int,
  ) {
    val maxBytes = sampleRate * 2 * bufferedAudioWindowSeconds
    synchronized(bufferLock) {
      micBuffer.addLast(chunk)
      bufferedAudioBytes += chunk.size
      while (bufferedAudioBytes > maxBytes && micBuffer.isNotEmpty()) {
        bufferedAudioBytes -= micBuffer.removeFirst().size
      }
    }
  }

  private fun flushBufferedAudio() {
    val chunks =
      synchronized(bufferLock) {
        val buffered = micBuffer.toList()
        micBuffer.clear()
        bufferedAudioBytes = 0
        buffered
      }
    chunks.forEach(::sendAudioChunk)
  }

  private fun clearMicBuffer() {
    synchronized(bufferLock) {
      micBuffer.clear()
      bufferedAudioBytes = 0
    }
  }

  private fun writeAudioDelta(base64Delta: String) {
    val bytes = runCatching { Base64.decode(base64Delta, Base64.DEFAULT) }.getOrNull() ?: return
    if (bytes.isEmpty()) return
    val track =
      synchronized(playbackLock) {
        ensureAudioTrack(activeSampleRate)
      } ?: return

    synchronized(playbackLock) {
      if (!trackStarted) {
        track.play()
        trackStarted = true
      }
      var offset = 0
      while (offset < bytes.size) {
        val wrote = track.write(bytes, offset, bytes.size - offset)
        if (wrote <= 0) break
        offset += wrote
      }
    }
  }

  private fun ensureAudioTrack(sampleRate: Int): AudioTrack? {
    val existing = audioTrack
    if (existing != null) return existing
    val minBuffer =
      AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
    if (minBuffer <= 0) return null
    val track =
      AudioTrack(
        AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .build(),
        AudioFormat.Builder()
          .setSampleRate(sampleRate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .build(),
        max(minBuffer * 2, 8192),
        AudioTrack.MODE_STREAM,
        android.media.AudioManager.AUDIO_SESSION_ID_GENERATE,
      )
    if (track.state != AudioTrack.STATE_INITIALIZED) {
      track.release()
      return null
    }
    audioTrack = track
    trackStarted = false
    return track
  }

  private fun stopRecording() {
    val record = audioRecord ?: return
    audioRecord = null
    try {
      if (record.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
        record.stop()
      }
    } catch (_: Throwable) {
    } finally {
      record.release()
    }
  }

  private fun stopPlayback() {
    synchronized(playbackLock) {
      val track = audioTrack ?: return
      audioTrack = null
      trackStarted = false
      try {
        track.pause()
        track.flush()
        track.stop()
      } catch (_: Throwable) {
      } finally {
        track.release()
      }
    }
  }

  private fun computeInputLevel(chunk: ByteArray): Float {
    if (chunk.size < 2) return 0f
    var sumSquares = 0.0
    var count = 0
    var index = 0
    while (index + 1 < chunk.size) {
      val sample =
        ((chunk[index + 1].toInt() shl 8) or (chunk[index].toInt() and 0xFF))
          .toShort()
          .toInt() / 32768.0
      sumSquares += sample * sample
      count += 1
      index += 2
    }
    if (count == 0) return 0f
    return sqrt(sumSquares / count).toFloat().coerceIn(0f, 1f)
  }

  private fun normalizeSampleRate(raw: Int): Int =
    if (raw in supportedSampleRates) raw else 24000

  private fun hasMicPermission(): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED

  private fun isGenerationActive(generation: Long): Boolean =
    sessionGeneration.get() == generation
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asStringOrNull(): String? =
  (this as? JsonPrimitive)?.content

private fun JsonElement?.asArrayOrNull(): JsonArray? = this as? JsonArray
