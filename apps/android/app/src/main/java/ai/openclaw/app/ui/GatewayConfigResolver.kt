package ai.openclaw.app.ui

import androidx.core.net.toUri
import ai.openclaw.app.gateway.GatewayTransport
import java.util.Base64
import java.util.Locale
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

internal data class GatewayEndpointConfig(
  val host: String,
  val port: Int,
  val tls: Boolean,
  val transport: GatewayTransport,
  val displayUrl: String,
)

internal data class GatewaySetupCode(
  val url: String,
  val token: String?,
  val password: String?,
)

internal data class GatewayConnectConfig(
  val host: String,
  val port: Int,
  val tls: Boolean,
  val transport: GatewayTransport,
  val token: String,
  val password: String,
)

private val gatewaySetupJson = Json { ignoreUnknownKeys = true }

internal fun resolveGatewayConnectConfig(
  useSetupCode: Boolean,
  setupCode: String,
  manualHost: String,
  manualPort: String,
  manualTls: Boolean,
  manualTransport: GatewayTransport,
  fallbackToken: String,
  fallbackPassword: String,
): GatewayConnectConfig? {
  if (useSetupCode) {
    val setup = decodeGatewaySetupCode(setupCode) ?: return null
    val parsed = parseGatewayEndpoint(setup.url) ?: return null
    return GatewayConnectConfig(
      host = parsed.host,
      port = parsed.port,
      tls = parsed.tls,
      transport = parsed.transport,
      token = setup.token ?: fallbackToken.trim(),
      password = setup.password ?: fallbackPassword.trim(),
    )
  }

  val manualUrl = composeGatewayManualUrl(manualHost, manualPort, manualTls) ?: return null
  val parsed = parseGatewayEndpoint(manualUrl) ?: return null
  return GatewayConnectConfig(
    host = parsed.host,
    port = parsed.port,
    tls = parsed.tls,
    transport = manualTransport,
    token = fallbackToken.trim(),
    password = fallbackPassword.trim(),
  )
}

internal fun parseGatewayEndpoint(rawInput: String): GatewayEndpointConfig? {
  val raw = rawInput.trim()
  if (raw.isEmpty()) return null

  val normalized = if (raw.contains("://")) raw else "https://$raw"
  val uri = normalized.toUri()
  val host = uri.host?.trim().orEmpty()
  if (host.isEmpty()) return null

  val scheme = uri.scheme?.trim()?.lowercase(Locale.US).orEmpty()
  val tls =
    when (scheme) {
      "ws", "http" -> false
      "wss", "https" -> true
      else -> true
    }
  val transport =
    when (scheme) {
      "http" -> GatewayTransport.NativeJsonTcp
      "ws", "wss", "https" -> GatewayTransport.WebSocketRpc
      else -> GatewayTransport.WebSocketRpc
    }
  val port = uri.port.takeIf { it in 1..65535 } ?: 18790
  val displayUrl = "${if (tls) "https" else "http"}://$host:$port"

  return GatewayEndpointConfig(
    host = host,
    port = port,
    tls = tls,
    transport = transport,
    displayUrl = displayUrl,
  )
}

internal fun decodeGatewaySetupCode(rawInput: String): GatewaySetupCode? {
  val trimmed = rawInput.trim()
  if (trimmed.isEmpty()) return null

  val padded =
    trimmed
      .replace('-', '+')
      .replace('_', '/')
      .let { normalized ->
        val remainder = normalized.length % 4
        if (remainder == 0) normalized else normalized + "=".repeat(4 - remainder)
      }

  return try {
    val decoded = String(Base64.getDecoder().decode(padded), Charsets.UTF_8)
    val obj = parseJsonObject(decoded) ?: return null
    val url = jsonField(obj, "url").orEmpty()
    if (url.isEmpty()) return null
    val token = jsonField(obj, "token")
    val password = jsonField(obj, "password")
    GatewaySetupCode(url = url, token = token, password = password)
  } catch (_: IllegalArgumentException) {
    null
  }
}

internal fun resolveScannedSetupCode(rawInput: String): String? {
  val setupCode = resolveSetupCodeCandidate(rawInput) ?: return null
  return setupCode.takeIf { decodeGatewaySetupCode(it) != null }
}

internal fun composeGatewayManualUrl(hostInput: String, portInput: String, tls: Boolean): String? {
  val host = hostInput.trim()
  val port = portInput.trim().toIntOrNull() ?: return null
  if (host.isEmpty() || port !in 1..65535) return null
  val scheme = if (tls) "https" else "http"
  return "$scheme://$host:$port"
}

private fun parseJsonObject(input: String): JsonObject? {
  return runCatching { gatewaySetupJson.parseToJsonElement(input).jsonObject }.getOrNull()
}

private fun resolveSetupCodeCandidate(rawInput: String): String? {
  val trimmed = rawInput.trim()
  if (trimmed.isEmpty()) return null
  val jsonObj = parseJsonObject(trimmed)
  val qrSetupCode = jsonObj?.let { jsonField(it, "setupCode") }
  if (!qrSetupCode.isNullOrEmpty()) {
    return qrSetupCode
  }
  jsonObj?.let(::buildSetupCodeFromQrPayload)?.let { return it }
  return trimmed
}

private fun jsonField(obj: JsonObject, key: String): String? {
  val value = (obj[key] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
  return value.ifEmpty { null }
}

private fun buildSetupCodeFromQrPayload(obj: JsonObject): String? {
  val url = jsonField(obj, "gatewayUrl") ?: jsonField(obj, "url")
  if (url.isNullOrBlank()) return null
  val token = jsonField(obj, "gatewayToken") ?: jsonField(obj, "token")
  val password = jsonField(obj, "gatewayPassword") ?: jsonField(obj, "password")
  val payload =
    buildJsonObject {
      put("url", JsonPrimitive(url))
      token?.let { put("token", JsonPrimitive(it)) }
      password?.let { put("password", JsonPrimitive(it)) }
    }
  return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.toString().toByteArray(Charsets.UTF_8))
}
