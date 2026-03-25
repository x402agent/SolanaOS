package ai.openclaw.app.gateway

data class ParsedInvokeError(
  val code: String,
  val message: String,
  val hadExplicitCode: Boolean,
) {
  val prefixedMessage: String
    get() = "$code: $message"
}

private val explicitInvokeErrorCodeRegex = Regex("^[A-Z][A-Z0-9_]*$")
private val invokeWhitespaceRegex = Regex("\\s+")

fun parseInvokeErrorMessage(raw: String): ParsedInvokeError {
  val trimmed = normalizeInvokeErrorText(raw)
  if (trimmed.isEmpty()) {
    return ParsedInvokeError(code = "UNAVAILABLE", message = "error", hadExplicitCode = false)
  }

  parseExplicitInvokeError(trimmed)?.let { return it }

  val nestedCandidate = trimmed.substringAfter(':', missingDelimiterValue = "").trim()
  if (nestedCandidate.isNotEmpty()) {
    parseExplicitInvokeError(nestedCandidate)?.let { return it }
  }

  return ParsedInvokeError(code = "UNAVAILABLE", message = trimmed, hadExplicitCode = false)
}

fun parseInvokeErrorFromThrowable(
  err: Throwable,
  fallbackMessage: String = "error",
): ParsedInvokeError {
  var current: Throwable? = err
  var firstMessage: String? = null
  repeat(6) {
    val candidate = current?.message?.trim().takeIf { !it.isNullOrEmpty() }
    if (!candidate.isNullOrEmpty()) {
      if (firstMessage == null) {
        firstMessage = candidate
      }
      val parsed = parseInvokeErrorMessage(candidate)
      if (parsed.hadExplicitCode) {
        return parsed
      }
    }
    current = current?.cause
  }
  return parseInvokeErrorMessage(firstMessage ?: fallbackMessage)
}

private fun parseExplicitInvokeError(raw: String): ParsedInvokeError? {
  val colonParts = raw.split(":", limit = 2)
  if (colonParts.size == 2) {
    val code = colonParts[0].trim()
    val rest = normalizeInvokeErrorText(colonParts[1])
    if (explicitInvokeErrorCodeRegex.matches(code)) {
      return ParsedInvokeError(
        code = code,
        message = rest.ifEmpty { humanizeInvokeErrorCode(code) },
        hadExplicitCode = true,
      )
    }
  }

  val bracketMatch = Regex("^\\[([A-Z][A-Z0-9_]*)]\\s*(.*)$").matchEntire(raw)
  if (bracketMatch != null) {
    val code = bracketMatch.groupValues[1]
    val rest = normalizeInvokeErrorText(bracketMatch.groupValues[2])
    return ParsedInvokeError(
      code = code,
      message = rest.ifEmpty { humanizeInvokeErrorCode(code) },
      hadExplicitCode = true,
    )
  }

  return null
}

private fun normalizeInvokeErrorText(raw: String): String = raw.trim().replace(invokeWhitespaceRegex, " ")

private fun humanizeInvokeErrorCode(code: String): String =
  code
    .lowercase()
    .split('_')
    .filter { it.isNotBlank() }
    .joinToString(" ") { token -> token.replaceFirstChar { ch -> ch.titlecase() } }
