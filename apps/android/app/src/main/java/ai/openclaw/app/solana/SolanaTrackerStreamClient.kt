package ai.openclaw.app.solana

import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

internal class SolanaTrackerStreamClient(
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient =
    OkHttpClient.Builder()
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .pingInterval(30, TimeUnit.SECONDS)
      .build(),
) {
  interface Listener {
    fun onConnected()

    fun onSlot(slot: Long)

    fun onError(message: String)

    fun onClosed(reason: String)
  }

  @Volatile
  private var socket: WebSocket? = null

  fun connect(url: String, listener: Listener) {
    val normalizedUrl = normalizeWebSocketUrl(url)
    disconnect()
    val request = Request.Builder().url(normalizedUrl).build()
    socket =
      httpClient.newWebSocket(
        request,
        object : WebSocketListener() {
          override fun onOpen(webSocket: WebSocket, response: Response) {
            webSocket.send("""{"jsonrpc":"2.0","id":1,"method":"slotSubscribe"}""")
            listener.onConnected()
          }

          override fun onMessage(webSocket: WebSocket, text: String) {
            val root = runCatching { json.parseToJsonElement(text) }.getOrNull()?.asObjectOrNull() ?: return
            if (root["method"].asStringOrNull() != "slotNotification") return
            val slot = root["params"].nestedObject("result")?.get("slot").asLongOrNull() ?: return
            listener.onSlot(slot)
          }

          override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            socket = null
            listener.onError(t.message ?: "slot stream failed")
          }

          override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            socket = null
            listener.onClosed(reason.ifBlank { "slot stream closed ($code)" })
          }
        },
      )
  }

  fun disconnect() {
    socket?.close(1000, "bye")
    socket = null
  }

  private fun normalizeWebSocketUrl(rawUrl: String): String {
    val trimmed = rawUrl.trim()
    require(trimmed.isNotBlank()) { "Solana Tracker WebSocket URL is not configured." }
    return when {
      trimmed.startsWith("ws://", ignoreCase = true) || trimmed.startsWith("wss://", ignoreCase = true) -> trimmed
      trimmed.startsWith("https://", ignoreCase = true) -> "wss://${trimmed.removePrefix("https://")}"
      trimmed.startsWith("http://", ignoreCase = true) -> "ws://${trimmed.removePrefix("http://")}"
      else -> "wss://$trimmed"
    }
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asStringOrNull(): String? = (this as? kotlinx.serialization.json.JsonPrimitive)?.content

private fun JsonElement?.asLongOrNull(): Long? = (this as? kotlinx.serialization.json.JsonPrimitive)?.content?.toLongOrNull()

private fun JsonElement?.nestedObject(key: String): JsonObject? = asObjectOrNull()?.get(key).asObjectOrNull()
