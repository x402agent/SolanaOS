package ai.openclaw.app.chat

import ai.openclaw.app.node.CameraCaptureManager
import androidx.camera.view.PreviewView
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal class LiveCameraCommentaryController(
  private val scope: CoroutineScope,
  private val camera: CameraCaptureManager,
  private val grokClient: OpenRouterDirectChatClient?,
) {
  private val captureMutex = Mutex()
  private val previewViewRef = AtomicReference<PreviewView?>(null)
  private var liveJob: Job? = null
  private val conversation = ArrayDeque<OpenRouterConversationTurn>()

  private val _available = MutableStateFlow(grokClient?.isConfigured() == true)
  val available: StateFlow<Boolean> = _available.asStateFlow()

  private val _previewActive = MutableStateFlow(false)
  val previewActive: StateFlow<Boolean> = _previewActive.asStateFlow()

  private val _busy = MutableStateFlow(false)
  val busy: StateFlow<Boolean> = _busy.asStateFlow()

  private val _liveEnabled = MutableStateFlow(false)
  val liveEnabled: StateFlow<Boolean> = _liveEnabled.asStateFlow()

  private val _statusText = MutableStateFlow(initialStatusText())
  val statusText: StateFlow<String> = _statusText.asStateFlow()

  private val _latestCommentary = MutableStateFlow<String?>(null)
  val latestCommentary: StateFlow<String?> = _latestCommentary.asStateFlow()

  fun attachPreview(previewView: PreviewView) {
    if (previewViewRef.get() === previewView && _previewActive.value) return
    previewViewRef.set(previewView)
    scope.launch {
      try {
        camera.bindPreview(previewView = previewView, facing = "back")
        _previewActive.value = true
        _statusText.value = if (_liveEnabled.value) "Live commentary active" else "Live camera ready"
      } catch (err: Throwable) {
        _previewActive.value = false
        _statusText.value = err.message ?: "Camera preview unavailable"
      }
    }
  }

  fun detachPreview() {
    previewViewRef.set(null)
    setLiveEnabled(false)
    scope.launch {
      runCatching { camera.unbindPreview() }
      _previewActive.value = false
      _statusText.value = initialStatusText()
    }
  }

  suspend fun captureFrameForAttachment(): CameraCaptureManager.JpegFrame =
    captureMutex.withLock {
      _statusText.value = "Capturing current frame…"
      try {
        val frame = camera.capturePreviewFrame()
        _statusText.value = if (_liveEnabled.value) "Live commentary active" else "Frame ready to attach"
        frame
      } catch (err: Throwable) {
        _statusText.value = err.message ?: "Failed to capture frame"
        throw err
      }
    }

  fun analyzeCurrentFrame() {
    scope.launch {
      analyzeFrame(
        prompt =
          "Describe this camera frame with concise, concrete commentary. " +
            "Call out notable motion, objects, hazards, or opportunities. " +
            "Keep it short and useful for a mobile user.",
        keepLiveStatus = false,
      )
    }
  }

  fun setLiveEnabled(enabled: Boolean) {
    if (!enabled) {
      liveJob?.cancel()
      liveJob = null
      _liveEnabled.value = false
      _statusText.value =
        when {
          _previewActive.value -> "Live camera ready"
          else -> initialStatusText()
        }
      return
    }

    if (!_available.value) {
      _statusText.value = "Grok vision is unavailable in this build"
      return
    }
    if (!_previewActive.value) {
      _statusText.value = "Start the live camera preview first"
      return
    }

    _liveEnabled.value = true
    liveJob?.cancel()
    liveJob =
      scope.launch {
        while (isActive && _liveEnabled.value) {
          analyzeFrame(
            prompt =
              "Review the newest live camera frame and continue the running commentary. " +
                "Mention what changed since the prior frame if something important changed. " +
                "Keep it to 2 short sentences max.",
            keepLiveStatus = true,
          )
          delay(8_000)
        }
      }
  }

  private suspend fun analyzeFrame(prompt: String, keepLiveStatus: Boolean) {
    val client = grokClient
    if (client == null || !client.isConfigured()) {
      _statusText.value = "Grok vision is unavailable in this build"
      return
    }

    captureMutex.withLock {
      _busy.value = true
      _statusText.value = if (keepLiveStatus) "Watching live camera…" else "Analyzing current frame…"
      try {
        val frame = camera.capturePreviewFrame()
        appendTurn(
          OpenRouterConversationTurn(
            role = "user",
            content = prompt,
            images =
              listOf(
                OpenRouterImageAttachment(
                  mimeType = frame.mimeType,
                  base64 = frame.base64,
                ),
              ),
          ),
        )
        val reply =
          client.complete(
            systemPrompt =
              "You are SolanaOS Vision, a concise visual copilot for a mobile device. " +
                "You see periodic camera snapshots. Give concrete scene commentary, mention meaningful changes, " +
                "and suggest the next best action when appropriate. If uncertain, say so plainly.",
            messages = conversation.toList(),
            reasoningEnabled = true,
          )
        appendTurn(
          OpenRouterConversationTurn(
            role = "assistant",
            content = reply.content,
            reasoningDetails = reply.reasoningDetails,
          ),
        )
        _latestCommentary.value = reply.content
        _statusText.value = if (keepLiveStatus && _liveEnabled.value) "Live commentary active" else "Analysis ready"
      } catch (err: Throwable) {
        _statusText.value = err.message ?: "Camera analysis failed"
      } finally {
        _busy.value = false
      }
    }
  }

  private fun appendTurn(turn: OpenRouterConversationTurn) {
    conversation.addLast(turn)
    while (conversation.size > 8) {
      conversation.removeFirst()
    }
  }

  private fun initialStatusText(): String =
    if (_available.value) {
      "Live camera ready when preview starts"
    } else {
      "Live camera commentary is unavailable in this build"
    }
}
