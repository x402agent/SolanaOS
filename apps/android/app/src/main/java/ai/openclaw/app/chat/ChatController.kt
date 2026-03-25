package ai.openclaw.app.chat

import ai.openclaw.app.gateway.GatewaySession
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

internal class ChatController(
  private val scope: CoroutineScope,
  private val session: GatewaySession,
  private val json: Json,
  private val supportsChatSubscribe: Boolean,
  private val isGatewayRpcConnected: () -> Boolean,
  private val directChatClient: HostedDirectChatClient? = null,
) {
  private val _sessionKey = MutableStateFlow("main")
  val sessionKey: StateFlow<String> = _sessionKey.asStateFlow()

  private val _sessionId = MutableStateFlow<String?>(null)
  val sessionId: StateFlow<String?> = _sessionId.asStateFlow()

  private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
  val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

  private val _errorText = MutableStateFlow<String?>(null)
  val errorText: StateFlow<String?> = _errorText.asStateFlow()

  private val _healthOk = MutableStateFlow(false)
  val healthOk: StateFlow<Boolean> = _healthOk.asStateFlow()

  private val _transportMode = MutableStateFlow(ChatTransportMode.Offline)
  val transportMode: StateFlow<ChatTransportMode> = _transportMode.asStateFlow()

  private val _gatewayRpcAvailable = MutableStateFlow(false)
  val gatewayRpcAvailable: StateFlow<Boolean> = _gatewayRpcAvailable.asStateFlow()

  private val _openRouterAvailable = MutableStateFlow(directChatAvailable())
  val openRouterAvailable: StateFlow<Boolean> = _openRouterAvailable.asStateFlow()

  private val _statusText = MutableStateFlow("")
  val statusText: StateFlow<String> = _statusText.asStateFlow()

  private val _thinkingLevel = MutableStateFlow(if (directChatClient?.isConfigured() == true) "medium" else "off")
  val thinkingLevel: StateFlow<String> = _thinkingLevel.asStateFlow()

  private val _pendingRunCount = MutableStateFlow(0)
  val pendingRunCount: StateFlow<Int> = _pendingRunCount.asStateFlow()

  private val _streamingAssistantText = MutableStateFlow<String?>(null)
  val streamingAssistantText: StateFlow<String?> = _streamingAssistantText.asStateFlow()

  private val pendingToolCallsById = ConcurrentHashMap<String, ChatPendingToolCall>()
  private val _pendingToolCalls = MutableStateFlow<List<ChatPendingToolCall>>(emptyList())
  val pendingToolCalls: StateFlow<List<ChatPendingToolCall>> = _pendingToolCalls.asStateFlow()

  private val _toolActivity = MutableStateFlow<List<ChatToolActivityEntry>>(emptyList())
  val toolActivity: StateFlow<List<ChatToolActivityEntry>> = _toolActivity.asStateFlow()

  private val _sessions = MutableStateFlow<List<ChatSessionEntry>>(emptyList())
  val sessions: StateFlow<List<ChatSessionEntry>> = _sessions.asStateFlow()

  private val pendingRuns = mutableSetOf<String>()
  private val pendingRunTimeoutJobs = ConcurrentHashMap<String, Job>()
  private val pendingRunTimeoutMs = 120_000L

  private var lastHealthPollAtMs: Long? = null
  private val directConversationBySession =
    ConcurrentHashMap<String, MutableList<OpenRouterConversationTurn>>()
  private val directSessionUpdatedAtMs = ConcurrentHashMap<String, Long>()

  companion object {
    private const val directAgentDisplayName = "SolanaOS Agent"
    private const val directSystemPrompt =
      "You are SolanaOS Agent, the default assistant inside the SolanaOS Seeker app. " +
        "Be concise, useful, and action-oriented. Prioritize mobile clarity. " +
        "When device or gateway capabilities are unavailable, say so plainly and offer the next best action. " +
        "Treat the user as operating a SolanaOS / OpenClaw environment with optional Bitaxe and gateway tooling."
  }

  fun onDisconnected(message: String) {
    _healthOk.value = directChatAvailable()
    _transportMode.value = if (directChatAvailable()) ChatTransportMode.OpenRouter else ChatTransportMode.Offline
    // Not an error; keep connection status in the UI pill.
    _errorText.value = null
    clearPendingRuns()
    pendingToolCallsById.clear()
    publishPendingToolCalls()
    _toolActivity.value = emptyList()
    _streamingAssistantText.value = null
    _sessionId.value = null
    publishAvailability()
  }

  fun load(sessionKey: String) {
    val key = sessionKey.trim().ifEmpty { "main" }
    _sessionKey.value = key
    scope.launch { bootstrap(forceHealth = true) }
  }

  fun applyMainSessionKey(mainSessionKey: String) {
    val trimmed = mainSessionKey.trim()
    if (trimmed.isEmpty()) return
    if (_sessionKey.value == trimmed) return
    if (_sessionKey.value != "main") return
    _sessionKey.value = trimmed
    scope.launch { bootstrap(forceHealth = true) }
  }

  fun refresh() {
    scope.launch { bootstrap(forceHealth = true) }
  }

  fun refreshSessions(limit: Int? = null) {
    scope.launch { fetchSessions(limit = limit) }
  }

  fun setThinkingLevel(thinkingLevel: String) {
    val normalized = normalizeThinking(thinkingLevel)
    if (normalized == _thinkingLevel.value) return
    _thinkingLevel.value = normalized
  }

  fun switchSession(sessionKey: String) {
    val key = sessionKey.trim()
    if (key.isEmpty()) return
    if (key == _sessionKey.value) return
    _sessionKey.value = key
    scope.launch { bootstrap(forceHealth = true) }
  }

  fun sendMessage(
    message: String,
    thinkingLevel: String,
    attachments: List<OutgoingAttachment>,
    forceGatewayTransport: Boolean = false,
  ) {
    val trimmed = message.trim()
    if (trimmed.isEmpty() && attachments.isEmpty()) return
    val transportMode =
      when {
        forceGatewayTransport && isGatewayRpcConnected() -> ChatTransportMode.Gateway
        forceGatewayTransport -> ChatTransportMode.Offline
        else -> resolveTransportMode()
      }
    if (transportMode == ChatTransportMode.Offline) {
      _errorText.value =
        if (forceGatewayTransport) {
          "Gateway chat RPC is unavailable on this connection."
        } else {
          "Chat is unavailable on this connection."
        }
      publishAvailability()
      return
    }
    val runId = UUID.randomUUID().toString()
    val text = if (trimmed.isEmpty() && attachments.isNotEmpty()) "See attached." else trimmed
    val sessionKey = _sessionKey.value
    val thinking = normalizeThinking(thinkingLevel)

    // Optimistic user message.
    val userContent =
      buildList {
        add(ChatMessageContent(type = "text", text = text))
        for (att in attachments) {
          add(
            ChatMessageContent(
              type = att.type,
              mimeType = att.mimeType,
              fileName = att.fileName,
              base64 = att.base64,
            ),
          )
        }
      }
    _messages.value =
      _messages.value +
        ChatMessage(
          id = UUID.randomUUID().toString(),
          role = "user",
          content = userContent,
          timestampMs = System.currentTimeMillis(),
        )

    armPendingRunTimeout(runId)
    synchronized(pendingRuns) {
      pendingRuns.add(runId)
      _pendingRunCount.value = pendingRuns.size
    }

    _errorText.value = null
    _streamingAssistantText.value = null
    pendingToolCallsById.clear()
    publishPendingToolCalls()

    scope.launch {
      try {
        if (transportMode == ChatTransportMode.OpenRouter) {
          sendDirectMessage(
            sessionKey = sessionKey,
            text = text,
            thinking = thinking,
            attachments = attachments,
            runId = runId,
          )
        } else {
          val params =
            buildJsonObject {
              put("sessionKey", JsonPrimitive(sessionKey))
              put("message", JsonPrimitive(text))
              put("thinking", JsonPrimitive(thinking))
              put("timeoutMs", JsonPrimitive(30_000))
              put("idempotencyKey", JsonPrimitive(runId))
              if (attachments.isNotEmpty()) {
                put(
                  "attachments",
                  JsonArray(
                    attachments.map { att ->
                      buildJsonObject {
                        put("type", JsonPrimitive(att.type))
                        put("mimeType", JsonPrimitive(att.mimeType))
                        put("fileName", JsonPrimitive(att.fileName))
                        put("content", JsonPrimitive(att.base64))
                      }
                    },
                  ),
                )
              }
            }
          val res = session.request("chat.send", params.toString())
          val actualRunId = parseRunId(res) ?: runId
          if (actualRunId != runId) {
            clearPendingRun(runId)
            armPendingRunTimeout(actualRunId)
            synchronized(pendingRuns) {
              pendingRuns.add(actualRunId)
              _pendingRunCount.value = pendingRuns.size
            }
          }
        }
      } catch (err: Throwable) {
        clearPendingRun(runId)
        _errorText.value = err.message
        publishAvailability()
      }
    }
  }

  fun sendGatewayMessage(message: String, thinkingLevel: String = "low") {
    sendMessage(
      message = message,
      thinkingLevel = thinkingLevel,
      attachments = emptyList(),
      forceGatewayTransport = true,
    )
  }

  fun abort() {
    val runIds =
      synchronized(pendingRuns) {
        pendingRuns.toList()
      }
    if (runIds.isEmpty()) return
    scope.launch {
      for (runId in runIds) {
        try {
          val params =
            buildJsonObject {
              put("sessionKey", JsonPrimitive(_sessionKey.value))
              put("runId", JsonPrimitive(runId))
            }
          session.request("chat.abort", params.toString())
        } catch (_: Throwable) {
          // best-effort
        }
      }
    }
  }

  fun handleGatewayEvent(event: String, payloadJson: String?) {
    when (event) {
      "tick" -> {
        scope.launch { pollHealthIfNeeded(force = false) }
      }
      "health" -> {
        // If we receive a health snapshot, the gateway is reachable.
        _healthOk.value = true
        publishAvailability()
      }
      "seqGap" -> {
        _errorText.value = "Event stream interrupted; try refreshing."
        clearPendingRuns()
      }
      "chat" -> {
        if (payloadJson.isNullOrBlank()) return
        handleChatEvent(payloadJson)
      }
      "agent" -> {
        if (payloadJson.isNullOrBlank()) return
        handleAgentEvent(payloadJson)
      }
    }
  }

  private suspend fun bootstrap(forceHealth: Boolean) {
    _errorText.value = null
    _healthOk.value = false
    clearPendingRuns()
    pendingToolCallsById.clear()
    publishPendingToolCalls()
    _toolActivity.value = emptyList()
    _streamingAssistantText.value = null
    _sessionId.value = null

    val key = _sessionKey.value
    if (preferDirectAgent()) {
      loadDirectSession(key)
      _errorText.value = null
      _healthOk.value = true
      _transportMode.value = ChatTransportMode.OpenRouter
      fetchSessions(limit = 50)
      publishAvailability()
      return
    }
    try {
      if (supportsChatSubscribe) {
        session.sendNodeEvent("chat.subscribe", """{"sessionKey":"$key"}""")
      }

      val historyJson = session.request("chat.history", """{"sessionKey":"$key"}""")
      val history = parseHistory(historyJson, sessionKey = key)
      _messages.value = history.messages
      _sessionId.value = history.sessionId
      _transportMode.value = ChatTransportMode.Gateway
      history.thinkingLevel?.trim()?.takeIf { it.isNotEmpty() }?.let { _thinkingLevel.value = it }

      pollHealthIfNeeded(force = forceHealth)
      fetchSessions(limit = 50)
      publishAvailability()
    } catch (err: Throwable) {
      if (directChatAvailable()) {
        loadDirectSession(key)
        _errorText.value = null
        _healthOk.value = true
        _transportMode.value = ChatTransportMode.OpenRouter
        fetchSessions(limit = 50)
        publishAvailability()
      } else {
        _transportMode.value = ChatTransportMode.Offline
        _errorText.value = err.message
        publishAvailability()
      }
    }
  }

  private suspend fun fetchSessions(limit: Int?) {
    if (_transportMode.value == ChatTransportMode.OpenRouter) {
      val keys =
        buildSet {
          add(_sessionKey.value)
          addAll(directConversationBySession.keys)
        }
      val sessions =
        keys.map { key ->
          ChatSessionEntry(
            key = key,
            updatedAtMs = directSessionUpdatedAtMs[key],
            displayName =
              if (key == "main") {
                directAgentDisplayName
              } else {
                "$directAgentDisplayName · $key"
              },
          )
        }.sortedByDescending { it.updatedAtMs ?: 0L }
      _sessions.value = if (limit != null && limit > 0) sessions.take(limit) else sessions
      return
    }
    try {
      val params =
        buildJsonObject {
          put("includeGlobal", JsonPrimitive(true))
          put("includeUnknown", JsonPrimitive(false))
          if (limit != null && limit > 0) put("limit", JsonPrimitive(limit))
        }
      val res = session.request("sessions.list", params.toString())
      _sessions.value = parseSessions(res)
    } catch (_: Throwable) {
      // best-effort
    }
  }

  private suspend fun pollHealthIfNeeded(force: Boolean) {
    if (preferDirectAgent() && directChatAvailable()) {
      _healthOk.value = true
      _transportMode.value = ChatTransportMode.OpenRouter
      publishAvailability()
      return
    }
    val now = System.currentTimeMillis()
    val last = lastHealthPollAtMs
    if (!force && last != null && now - last < 10_000) return
    lastHealthPollAtMs = now
    try {
      session.request("health", null)
      _healthOk.value = true
      _transportMode.value = ChatTransportMode.Gateway
    } catch (_: Throwable) {
      if (directChatAvailable()) {
        _healthOk.value = true
        _transportMode.value = ChatTransportMode.OpenRouter
      } else {
        _healthOk.value = false
        _transportMode.value = ChatTransportMode.Offline
      }
    }
    publishAvailability()
  }

  private fun handleChatEvent(payloadJson: String) {
    val payload = json.parseToJsonElement(payloadJson).asObjectOrNull() ?: return
    val sessionKey = payload["sessionKey"].asStringOrNull()?.trim()
    if (!sessionKey.isNullOrEmpty() && sessionKey != _sessionKey.value) return

    val runId = payload["runId"].asStringOrNull()
    val isPending =
      if (runId != null) synchronized(pendingRuns) { pendingRuns.contains(runId) } else true

    val state = payload["state"].asStringOrNull()
    when (state) {
      "delta" -> {
        // Only show streaming text for runs we initiated
        if (!isPending) return
        val text = parseAssistantDeltaText(payload)
        if (!text.isNullOrEmpty()) {
          _streamingAssistantText.value = text
        }
      }
      "final", "aborted", "error" -> {
        if (state == "error") {
          _errorText.value = payload["errorMessage"].asStringOrNull() ?: "Chat failed"
        }
        if (runId != null) clearPendingRun(runId) else clearPendingRuns()
        pendingToolCallsById.clear()
        publishPendingToolCalls()
        _streamingAssistantText.value = null
        scope.launch {
          try {
            val historyJson =
              session.request("chat.history", """{"sessionKey":"${_sessionKey.value}"}""")
            val history = parseHistory(historyJson, sessionKey = _sessionKey.value)
            _messages.value = history.messages
            _sessionId.value = history.sessionId
            history.thinkingLevel?.trim()?.takeIf { it.isNotEmpty() }?.let { _thinkingLevel.value = it }
          } catch (_: Throwable) {
            // best-effort
          }
        }
      }
    }
  }

  private fun handleAgentEvent(payloadJson: String) {
    val payload = json.parseToJsonElement(payloadJson).asObjectOrNull() ?: return
    val sessionKey = payload["sessionKey"].asStringOrNull()?.trim()
    if (!sessionKey.isNullOrEmpty() && sessionKey != _sessionKey.value) return

    val stream = payload["stream"].asStringOrNull()
    val data = payload["data"].asObjectOrNull()
    val type = payload["type"].asStringOrNull()

    when (stream) {
      "assistant" -> {
        val text = data?.get("text")?.asStringOrNull()
        if (!text.isNullOrEmpty()) {
          _streamingAssistantText.value = text
        }
      }
      "tool" -> {
        handleToolStreamEvent(payload = payload, data = data)
      }
      "error" -> {
        _errorText.value = "Event stream interrupted; try refreshing."
        clearPendingRuns()
        pendingToolCallsById.clear()
        publishPendingToolCalls()
        _streamingAssistantText.value = null
      }
      else -> {
        if (!type.isNullOrBlank()) {
          handleRawAgentEvent(payload = payload, type = type)
        }
      }
    }
  }

  private fun parseAssistantDeltaText(payload: JsonObject): String? {
    val message = payload["message"].asObjectOrNull() ?: return null
    if (message["role"].asStringOrNull() != "assistant") return null
    val content = message["content"].asArrayOrNull() ?: return null
    for (item in content) {
      val obj = item.asObjectOrNull() ?: continue
      if (obj["type"].asStringOrNull() != "text") continue
      val text = obj["text"].asStringOrNull()
      if (!text.isNullOrEmpty()) {
        return text
      }
    }
    return null
  }

  private fun publishPendingToolCalls() {
    _pendingToolCalls.value =
      pendingToolCallsById.values.sortedBy { it.startedAtMs }
  }

  private fun handleToolStreamEvent(payload: JsonObject, data: JsonObject?) {
    val phase = canonicalToolPhase(data?.get("phase").asStringOrNull()) ?: return
    val name = data?.get("name")?.asStringOrNull()?.trim().orEmpty()
    if (name.isEmpty()) return
    val ts = payload["ts"].asLongOrNull() ?: System.currentTimeMillis()
    val args = data?.get("args").asObjectOrNull()
    val rawToolCallId =
      data?.get("toolCallId").asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
        ?: data?.get("id").asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
    val toolCallId = resolveToolCallId(name = name, rawToolCallId = rawToolCallId, phase = phase, timestampMs = ts)
    val detail =
      data?.get("message").asStringOrNull()
        ?: data?.get("warning").asStringOrNull()
        ?: data?.get("error").asStringOrNull()
        ?: data?.get("result").asStringOrNull()

    handleToolEvent(
      phase = phase,
      name = name,
      toolCallId = toolCallId,
      args = args,
      timestampMs = ts,
      detail = detail,
    )
  }

  private fun handleRawAgentEvent(payload: JsonObject, type: String) {
    val phase = canonicalToolPhase(type) ?: return
    val name = payload["tool"].asStringOrNull()?.trim().orEmpty()
    if (name.isEmpty()) return
    val ts = payload["ts"].asLongOrNull() ?: System.currentTimeMillis()
    val args = payload["args"].asObjectOrNull()
    val rawToolCallId =
      payload["toolCallId"].asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
        ?: payload["id"].asStringOrNull()?.trim()?.takeIf { it.isNotEmpty() }
    val toolCallId = resolveToolCallId(name = name, rawToolCallId = rawToolCallId, phase = phase, timestampMs = ts)
    val detail =
      payload["message"].asStringOrNull()
        ?: payload["warning"].asStringOrNull()
        ?: payload["error"].asStringOrNull()
        ?: payload["result"].asStringOrNull()

    handleToolEvent(
      phase = phase,
      name = name,
      toolCallId = toolCallId,
      args = args,
      timestampMs = ts,
      detail = detail,
    )
  }

  private fun handleToolEvent(
    phase: String,
    name: String,
    toolCallId: String,
    args: JsonObject?,
    timestampMs: Long,
    detail: String?,
  ) {
    when (phase) {
      "start" -> {
        pendingToolCallsById[toolCallId] =
          ChatPendingToolCall(
            toolCallId = toolCallId,
            name = name,
            args = args,
            startedAtMs = timestampMs,
            isError = null,
          )
        publishPendingToolCalls()
      }
      "result", "error", "denied", "limit" -> {
        pendingToolCallsById.remove(toolCallId)
        publishPendingToolCalls()
      }
      "approval" -> {
        if (!pendingToolCallsById.containsKey(toolCallId)) {
          pendingToolCallsById[toolCallId] =
            ChatPendingToolCall(
              toolCallId = toolCallId,
              name = name,
              args = args,
              startedAtMs = timestampMs,
              isError = false,
            )
          publishPendingToolCalls()
        }
      }
    }

    appendToolActivity(
      ChatToolActivityEntry(
        eventId = "$toolCallId:$phase:$timestampMs",
        toolCallId = toolCallId,
        name = name,
        args = args,
        phase = phase,
        detail = detail?.trim()?.ifEmpty { null },
        timestampMs = timestampMs,
        isError = phase == "error" || phase == "denied",
      ),
    )
  }

  private fun appendToolActivity(entry: ChatToolActivityEntry) {
    _toolActivity.value = (_toolActivity.value + entry).takeLast(24)
  }

  private fun resolveToolCallId(
    name: String,
    rawToolCallId: String?,
    phase: String,
    timestampMs: Long,
  ): String {
    if (!rawToolCallId.isNullOrBlank()) return rawToolCallId
    if (phase == "start" || phase == "approval") {
      return "${name.lowercase()}-$timestampMs"
    }
    return pendingToolCallsById.values
      .filter { it.name.equals(name, ignoreCase = true) }
      .minByOrNull { it.startedAtMs }
      ?.toolCallId
      ?: "${name.lowercase()}-$timestampMs"
  }

  private fun canonicalToolPhase(raw: String?): String? {
    return when (raw?.trim()?.lowercase()) {
      "start", "tool_start" -> "start"
      "result", "end", "done", "tool_end" -> "result"
      "error", "tool_error" -> "error"
      "approval", "tool_approval" -> "approval"
      "denied", "tool_denied" -> "denied"
      "limit", "tool_limit" -> "limit"
      else -> null
    }
  }

  private fun armPendingRunTimeout(runId: String) {
    pendingRunTimeoutJobs[runId]?.cancel()
    pendingRunTimeoutJobs[runId] =
      scope.launch {
        delay(pendingRunTimeoutMs)
        val stillPending =
          synchronized(pendingRuns) {
            pendingRuns.contains(runId)
          }
        if (!stillPending) return@launch
        clearPendingRun(runId)
        _errorText.value = "Timed out waiting for a reply; try again or refresh."
      }
  }

  private fun clearPendingRun(runId: String) {
    pendingRunTimeoutJobs.remove(runId)?.cancel()
    synchronized(pendingRuns) {
      pendingRuns.remove(runId)
      _pendingRunCount.value = pendingRuns.size
    }
  }

  private fun clearPendingRuns() {
    for ((_, job) in pendingRunTimeoutJobs) {
      job.cancel()
    }
    pendingRunTimeoutJobs.clear()
    synchronized(pendingRuns) {
      pendingRuns.clear()
      _pendingRunCount.value = 0
    }
  }

  private fun parseHistory(historyJson: String, sessionKey: String): ChatHistory {
    val root = json.parseToJsonElement(historyJson).asObjectOrNull() ?: return ChatHistory(sessionKey, null, null, emptyList())
    val sid = root["sessionId"].asStringOrNull()
    val thinkingLevel = root["thinkingLevel"].asStringOrNull()
    val array = root["messages"].asArrayOrNull() ?: JsonArray(emptyList())

    val messages =
      array.mapNotNull { item ->
        val obj = item.asObjectOrNull() ?: return@mapNotNull null
        val role = obj["role"].asStringOrNull() ?: return@mapNotNull null
        val content = obj["content"].asArrayOrNull()?.mapNotNull(::parseMessageContent) ?: emptyList()
        val ts = obj["timestamp"].asLongOrNull()
        ChatMessage(
          id = UUID.randomUUID().toString(),
          role = role,
          content = content,
          timestampMs = ts,
        )
      }

    return ChatHistory(sessionKey = sessionKey, sessionId = sid, thinkingLevel = thinkingLevel, messages = messages)
  }

  private fun parseMessageContent(el: JsonElement): ChatMessageContent? {
    val obj = el.asObjectOrNull() ?: return null
    val type = obj["type"].asStringOrNull() ?: "text"
    return if (type == "text") {
      ChatMessageContent(type = "text", text = obj["text"].asStringOrNull())
    } else {
      ChatMessageContent(
        type = type,
        mimeType = obj["mimeType"].asStringOrNull(),
        fileName = obj["fileName"].asStringOrNull(),
        base64 = obj["content"].asStringOrNull(),
      )
    }
  }

  private fun parseSessions(jsonString: String): List<ChatSessionEntry> {
    val root = json.parseToJsonElement(jsonString).asObjectOrNull() ?: return emptyList()
    val sessions = root["sessions"].asArrayOrNull() ?: return emptyList()
    return sessions.mapNotNull { item ->
      val obj = item.asObjectOrNull() ?: return@mapNotNull null
      val key = obj["key"].asStringOrNull()?.trim().orEmpty()
      if (key.isEmpty()) return@mapNotNull null
      val updatedAt = obj["updatedAt"].asLongOrNull()
      val displayName = obj["displayName"].asStringOrNull()?.trim()
      ChatSessionEntry(key = key, updatedAtMs = updatedAt, displayName = displayName)
    }
  }

  private fun parseRunId(resJson: String): String? {
    return try {
      json.parseToJsonElement(resJson).asObjectOrNull()?.get("runId").asStringOrNull()
    } catch (_: Throwable) {
      null
    }
  }

  private fun normalizeThinking(raw: String): String {
    return when (raw.trim().lowercase()) {
      "low" -> "low"
      "medium" -> "medium"
      "high" -> "high"
      else -> "off"
    }
  }

  private fun directChatAvailable(): Boolean = directChatClient?.isConfigured() == true

  private fun preferDirectAgent(): Boolean = !isGatewayRpcConnected() && directChatAvailable()

  private fun resolveTransportMode(): ChatTransportMode {
    return when {
      preferDirectAgent() && directChatAvailable() -> ChatTransportMode.OpenRouter
      _transportMode.value == ChatTransportMode.Gateway && _healthOk.value -> ChatTransportMode.Gateway
      directChatAvailable() -> ChatTransportMode.OpenRouter
      else -> ChatTransportMode.Offline
    }
  }

  private fun loadDirectSession(sessionKey: String) {
    val turns = directConversationBySession[sessionKey].orEmpty()
    _messages.value =
      turns.map { turn ->
        ChatMessage(
          id = UUID.randomUUID().toString(),
          role = turn.role,
          content =
            buildList {
              if (turn.content.isNotBlank()) {
                add(ChatMessageContent(type = "text", text = turn.content))
              }
              for ((index, image) in turn.images.withIndex()) {
                add(
                  ChatMessageContent(
                    type = "image",
                    mimeType = image.mimeType,
                    fileName = "image-${index + 1}.jpg",
                    base64 = image.base64,
                  ),
                )
              }
            },
          timestampMs = turn.timestampMs,
        )
      }
    _sessionId.value = null
  }

  private fun appendDirectTurn(sessionKey: String, turn: OpenRouterConversationTurn) {
    val updated =
      directConversationBySession.compute(sessionKey) { _, existing ->
        val base = existing ?: mutableListOf()
        base.add(turn)
        base
      } ?: mutableListOf(turn)
    directSessionUpdatedAtMs[sessionKey] = turn.timestampMs
    _messages.value =
      updated.map { item ->
        ChatMessage(
          id = UUID.randomUUID().toString(),
          role = item.role,
          content =
            buildList {
              if (item.content.isNotBlank()) {
                add(ChatMessageContent(type = "text", text = item.content))
              }
              for ((index, image) in item.images.withIndex()) {
                add(
                  ChatMessageContent(
                    type = "image",
                    mimeType = image.mimeType,
                    fileName = "image-${index + 1}.jpg",
                    base64 = image.base64,
                  ),
                )
              }
            },
          timestampMs = item.timestampMs,
        )
      }
  }

  private fun sendDirectMessage(
    sessionKey: String,
    text: String,
    thinking: String,
    attachments: List<OutgoingAttachment>,
    runId: String,
  ) {
    val direct = directChatClient ?: error("Hosted direct chat is unavailable.")
    val images =
      attachments
        .filter { it.type == "image" && it.mimeType.startsWith("image/") && it.base64.isNotBlank() }
        .map { attachment ->
          OpenRouterImageAttachment(
            mimeType = attachment.mimeType,
            base64 = attachment.base64,
          )
        }
    appendDirectTurn(
      sessionKey = sessionKey,
      turn = OpenRouterConversationTurn(role = "user", content = text, images = images),
    )
    _streamingAssistantText.value = "Thinking with ${direct.providerLabel()} · ${direct.modelName()}…"

    val response =
      direct.complete(
        systemPrompt = directSystemPrompt,
        messages = directConversationBySession[sessionKey].orEmpty(),
        reasoningEnabled = thinking != "off",
      )

    appendDirectTurn(
      sessionKey = sessionKey,
      turn =
        OpenRouterConversationTurn(
          role = "assistant",
          content = response.content,
          reasoningDetails = response.reasoningDetails,
        ),
    )
    _transportMode.value = ChatTransportMode.OpenRouter
    _healthOk.value = true
    _errorText.value = null
    clearPendingRun(runId)
    _streamingAssistantText.value = null
    publishAvailability()
  }

  private fun publishAvailability() {
    val gateway = isGatewayRpcConnected()
    val direct = directChatAvailable()
    _gatewayRpcAvailable.value = gateway
    _openRouterAvailable.value = direct
    _statusText.value =
      when {
        gateway && _transportMode.value == ChatTransportMode.Gateway && _healthOk.value -> "Gateway chat ready with live tool streaming"
        direct && gateway && _transportMode.value == ChatTransportMode.OpenRouter -> "Gateway chat is unavailable right now, but the hosted SolanaOS agent is ready"
        preferDirectAgent() && direct -> "Hosted SolanaOS agent is ready"
        _transportMode.value == ChatTransportMode.Gateway && _healthOk.value -> "Gateway chat ready"
        _transportMode.value == ChatTransportMode.OpenRouter && _healthOk.value -> "Hosted SolanaOS agent is ready"
        gateway && direct -> "Gateway chat is unavailable right now, but the hosted SolanaOS agent is ready"
        gateway -> "Gateway connected, but chat RPC is not ready"
        direct -> "Hosted SolanaOS agent is available"
        else -> "No chat backend is ready yet. Pair a SolanaOS runtime to start chatting."
      }
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asArrayOrNull(): JsonArray? = this as? JsonArray

private fun JsonElement?.asStringOrNull(): String? =
  when (this) {
    is JsonNull -> null
    is JsonPrimitive -> content
    else -> null
  }

private fun JsonElement?.asLongOrNull(): Long? =
  when (this) {
    is JsonPrimitive -> content.toLongOrNull()
    else -> null
  }
