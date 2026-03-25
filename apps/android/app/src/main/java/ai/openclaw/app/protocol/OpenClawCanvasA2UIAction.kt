package ai.openclaw.app.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

object OpenClawCanvasA2UIAction {
  private val json: Json = Json { ignoreUnknownKeys = true }

  fun extractActionName(userAction: JsonObject): String? {
    val candidateKeys = listOf("name", "action", "event", "type")
    for (key in candidateKeys) {
      val value =
        (userAction[key] as? JsonPrimitive)
          ?.content
          ?.trim()
          .orEmpty()
      if (value.isNotEmpty()) return value
    }
    return null
  }

  fun sanitizeTagValue(value: String): String {
    val trimmed = value.trim().ifEmpty { "-" }
    val normalized = trimmed.replace(" ", "_")
    val out = StringBuilder(normalized.length)
    for (c in normalized) {
      val ok =
        c.isLetterOrDigit() ||
          c == '_' ||
          c == '-' ||
          c == '.' ||
          c == ':'
      out.append(if (ok) c else '_')
    }
    return out.toString().take(128).ifEmpty { "-" }
  }

  fun formatAgentMessage(
    actionName: String,
    sessionKey: String,
    surfaceId: String,
    sourceComponentId: String,
    host: String,
    instanceId: String,
    contextJson: String?,
  ): String {
    val ctxSuffix =
      normalizeInlineContext(contextJson)
        ?.takeIf { it.isNotBlank() }
        ?.let { " ctx=$it" }
        .orEmpty()
    return listOf(
      "CANVAS_A2UI",
      "action=${sanitizeTagValue(actionName)}",
      "session=${sanitizeTagValue(sessionKey)}",
      "surface=${sanitizeTagValue(surfaceId)}",
      "component=${sanitizeTagValue(sourceComponentId)}",
      "host=${sanitizeTagValue(host)}",
      "instance=${sanitizeTagValue(instanceId)}$ctxSuffix",
      "default=update_canvas",
    ).joinToString(separator = " ")
  }

  fun jsDispatchA2UIActionStatus(actionId: String, ok: Boolean, error: String?): String {
    val err = escapeJsStringLiteral(error.orEmpty())
    val okLiteral = if (ok) "true" else "false"
    val idEscaped = escapeJsStringLiteral(actionId)
    return "window.dispatchEvent(new CustomEvent('openclaw:a2ui-action-status', { detail: { id: \"${idEscaped}\", ok: ${okLiteral}, error: \"${err}\" } }));"
  }

  private fun normalizeInlineContext(contextJson: String?): String? {
    val trimmed = contextJson?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    return try {
      json.parseToJsonElement(trimmed).toString()
    } catch (_: Throwable) {
      trimmed
        .replace("\r", " ")
        .replace("\n", " ")
        .replace(Regex("\\s+"), " ")
        .trim()
    }
  }

  private fun escapeJsStringLiteral(value: String): String {
    return buildString(value.length + 8) {
      for (ch in value) {
        when (ch) {
          '\\' -> append("\\\\")
          '"' -> append("\\\"")
          '\n' -> append("\\n")
          '\r' -> append("\\r")
          '\t' -> append("\\t")
          else -> append(ch)
        }
      }
    }
  }
}
