package ai.openclaw.app.solana

import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

@Serializable
data class SolanaTrackerDatastreamEvent(
  val stream: String,
  val headline: String,
  val detail: String,
  val channel: String?,
  val timestampMs: Long = System.currentTimeMillis(),
)

@Serializable
data class SolanaTrackerDatastreamSnapshot(
  val primaryPriceUsd: Double? = null,
  val aggregatedPriceUsd: Double? = null,
  val buys: Long? = null,
  val sells: Long? = null,
  val volumeUsd: Double? = null,
  val holders: Long? = null,
  val curvePercentage: Double? = null,
  val sniperPercentage: Double? = null,
  val insiderPercentage: Double? = null,
) {
  fun merge(next: SolanaTrackerDatastreamSnapshot): SolanaTrackerDatastreamSnapshot =
    copy(
      primaryPriceUsd = next.primaryPriceUsd ?: primaryPriceUsd,
      aggregatedPriceUsd = next.aggregatedPriceUsd ?: aggregatedPriceUsd,
      buys = next.buys ?: buys,
      sells = next.sells ?: sells,
      volumeUsd = next.volumeUsd ?: volumeUsd,
      holders = next.holders ?: holders,
      curvePercentage = next.curvePercentage ?: curvePercentage,
      sniperPercentage = next.sniperPercentage ?: sniperPercentage,
      insiderPercentage = next.insiderPercentage ?: insiderPercentage,
    )

  fun hasData(): Boolean =
    primaryPriceUsd != null ||
      aggregatedPriceUsd != null ||
      buys != null ||
      sells != null ||
      volumeUsd != null ||
      holders != null ||
      curvePercentage != null ||
      sniperPercentage != null ||
      insiderPercentage != null
}

internal class SolanaTrackerDatastreamClient(
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient =
    OkHttpClient.Builder()
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .pingInterval(30, TimeUnit.SECONDS)
      .build(),
) {
  interface Listener {
    fun onConnected()

    fun onGlobalEvent(event: SolanaTrackerDatastreamEvent)

    fun onTokenEvent(event: SolanaTrackerDatastreamEvent)

    fun onTokenSnapshot(snapshot: SolanaTrackerDatastreamSnapshot)

    fun onError(message: String)

    fun onClosed(reason: String)
  }

  @Volatile
  private var socket: WebSocket? = null

  @Volatile
  private var listener: Listener? = null

  @Volatile
  private var focusedTokenMint: String? = null

  fun connect(datastreamKey: String, listener: Listener) {
    val normalizedKey = datastreamKey.trim()
    require(normalizedKey.isNotBlank()) { "Solana Tracker datastream key is not configured." }
    disconnect()
    this.listener = listener
    val request =
      Request.Builder()
        .url("wss://datastream.solanatracker.io/$normalizedKey")
        .build()
    socket =
      httpClient.newWebSocket(
        request,
        object : WebSocketListener() {
          override fun onOpen(webSocket: WebSocket, response: Response) {
            joinGlobalFeeds(webSocket)
            focusedTokenMint?.let { joinFocusedToken(webSocket, it) }
            listener.onConnected()
          }

          override fun onMessage(webSocket: WebSocket, text: String) {
            handleMessage(text)
          }

          override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            socket = null
            listener.onError(t.message ?: "datastream connection failed")
          }

          override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            socket = null
            listener.onClosed(reason.ifBlank { "datastream closed ($code)" })
          }
        },
      )
  }

  fun focusToken(mint: String?) {
    val normalizedMint = mint?.trim()?.ifBlank { null }
    val previousMint = focusedTokenMint
    focusedTokenMint = normalizedMint
    val currentSocket = socket ?: return
    if (previousMint != null && previousMint != normalizedMint) {
      leaveFocusedToken(currentSocket, previousMint)
    }
    if (normalizedMint != null && normalizedMint != previousMint) {
      joinFocusedToken(currentSocket, normalizedMint)
    }
  }

  fun disconnect() {
    socket?.close(1000, "bye")
    socket = null
  }

  private fun handleMessage(text: String) {
    val root = runCatching { json.parseToJsonElement(text) }.getOrNull()?.asObjectOrNull() ?: return
    val type = root["type"].asStringOrNull() ?: return
    val channel = root["channel"].asStringOrNull()
    val data = root["data"]
    when (type) {
      "latestMessage",
      "graduatingMessage",
      "graduatedMessage" ->
        parseEvent(type, channel, data)?.let { listener?.onGlobalEvent(it) }

      "priceTokenMessage",
      "priceAggregatedMessage",
      "tokenTxMessage",
      "tokenStatsMessage",
      "metadataMessage",
      "holdersMessage",
      "tokenChangesMessage",
      "curveMessage",
      "sniperMessage",
      "insiderMessage" -> {
        parseSnapshot(type, data)?.let { listener?.onTokenSnapshot(it) }
        parseEvent(type, channel, data)?.let { listener?.onTokenEvent(it) }
      }
    }
  }

  private fun joinGlobalFeeds(webSocket: WebSocket) {
    send(webSocket, "joinLatest")
    send(webSocket, "joinGraduating")
    send(webSocket, "joinGraduated")
  }

  private fun joinFocusedToken(webSocket: WebSocket, mint: String) {
    send(webSocket, "joinPriceToken", mint)
    send(webSocket, "joinPriceAggregated", mint)
    send(webSocket, "joinTokenTx", mint)
    send(webSocket, "joinTokenStats", mint)
    send(webSocket, "joinMetadata", mint)
    send(webSocket, "joinHolders", mint)
    send(webSocket, "joinTokenChanges", mint)
    send(webSocket, "joinCurve", mint)
    send(webSocket, "joinSniper", mint)
    send(webSocket, "joinInsider", mint)
  }

  private fun leaveFocusedToken(webSocket: WebSocket, mint: String) {
    send(webSocket, "leavePriceToken", mint)
    send(webSocket, "leavePriceAggregated", mint)
    send(webSocket, "leaveTokenTx", mint)
    send(webSocket, "leaveTokenStats", mint)
    send(webSocket, "leaveMetadata", mint)
    send(webSocket, "leaveHolders", mint)
    send(webSocket, "leaveTokenChanges", mint)
    send(webSocket, "leaveCurve", mint)
    send(webSocket, "leaveSniper", mint)
    send(webSocket, "leaveInsider", mint)
  }

  private fun send(webSocket: WebSocket, type: String, channel: String? = null) {
    val payload =
      buildJsonObject {
        put("type", type)
        channel?.let { put("channel", it) }
      }
    webSocket.send(payload.toString())
  }

  private fun parseEvent(
    type: String,
    channel: String?,
    data: JsonElement?,
  ): SolanaTrackerDatastreamEvent? {
    val label =
      data.findString("symbol", "name") ?: channel?.let(::shortAddress) ?: "Tracker update"
    val price = data.findDouble("priceUsd", "price", "value")
    val volume = data.findDouble("volumeUsd", "volume", "amountUsd")
    val curve = data.findDouble("curvePercentage", "percentage")
    val holders = data.findLong("holders", "holderCount", "count")
    val txType = data.findString("type")
    val wallet = data.findString("wallet", "owner")
    val buys = data.findLong("buys")
    val sells = data.findLong("sells")
    val market = data.findString("market", "program")
    val headline =
      when (type) {
        "latestMessage" -> "$label listed"
        "graduatingMessage" -> "$label graduating"
        "graduatedMessage" -> "$label graduated"
        "priceTokenMessage" -> "$label primary price update"
        "priceAggregatedMessage" -> "$label aggregated price update"
        "tokenTxMessage" -> buildString {
          append(label)
          append(" ")
          append(txType?.uppercase() ?: "trade")
        }
        "tokenStatsMessage" -> "$label stats update"
        "metadataMessage" -> "$label metadata update"
        "holdersMessage" -> "$label holder update"
        "tokenChangesMessage" -> "$label token change"
        "curveMessage" -> "$label curve alert"
        "sniperMessage" -> "$label sniper tracking"
        "insiderMessage" -> "$label insider tracking"
        else -> "$label live update"
      }
    val detailParts =
      buildList {
        market?.let { add(it) }
        price?.let { add("price ${formatUsdCompact(it)}") }
        volume?.let { add("vol ${formatUsdCompact(it)}") }
        if (buys != null || sells != null) {
          add("buys ${buys ?: 0} • sells ${sells ?: 0}")
        }
        holders?.let { add("holders ${formatCompact(it)}") }
        curve?.let { add("curve ${formatPercentCompact(it)}") }
        wallet?.let { add(shortAddress(it)) }
      }
    return SolanaTrackerDatastreamEvent(
      stream = type.removeSuffix("Message"),
      headline = headline,
      detail = detailParts.joinToString(" • ").ifBlank { "Channel ${channel ?: "global"}" },
      channel = channel,
    )
  }

  private fun parseSnapshot(type: String, data: JsonElement?): SolanaTrackerDatastreamSnapshot? =
    when (type) {
      "priceTokenMessage" ->
        SolanaTrackerDatastreamSnapshot(primaryPriceUsd = data.findDouble("priceUsd", "price", "value"))
      "priceAggregatedMessage" ->
        SolanaTrackerDatastreamSnapshot(aggregatedPriceUsd = data.findDouble("priceUsd", "price", "value"))
      "tokenStatsMessage" ->
        SolanaTrackerDatastreamSnapshot(
          buys = data.findLong("buys"),
          sells = data.findLong("sells"),
          volumeUsd = data.findDouble("volumeUsd", "volume", "amountUsd"),
        )
      "holdersMessage" ->
        SolanaTrackerDatastreamSnapshot(holders = data.findLong("holders", "holderCount", "count"))
      "curveMessage" ->
        SolanaTrackerDatastreamSnapshot(curvePercentage = data.findDouble("curvePercentage", "percentage"))
      "sniperMessage" ->
        SolanaTrackerDatastreamSnapshot(sniperPercentage = data.findDouble("totalPercentage", "percentage"))
      "insiderMessage" ->
        SolanaTrackerDatastreamSnapshot(insiderPercentage = data.findDouble("totalPercentage", "percentage"))
      else -> null
    }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asPrimitiveOrNull(): JsonPrimitive? = this as? JsonPrimitive

private fun JsonElement?.asStringOrNull(): String? =
  asPrimitiveOrNull()?.content?.takeUnless { it == "null" }

private fun JsonElement?.asDoubleOrNull(): Double? = asPrimitiveOrNull()?.content?.toDoubleOrNull()

private fun JsonElement?.asLongOrNull(): Long? = asPrimitiveOrNull()?.content?.toLongOrNull()

private fun JsonElement?.findString(vararg keys: String): String? {
  val target = asObjectOrNull() ?: return asStringOrNull()
  keys.forEach { key ->
    target[key]?.asStringOrNull()?.let { return it }
  }
  target.values.forEach { child ->
    child.findString(*keys)?.let { return it }
  }
  return null
}

private fun JsonElement?.findDouble(vararg keys: String): Double? {
  val target = asObjectOrNull() ?: return asDoubleOrNull()
  keys.forEach { key ->
    target[key]?.asDoubleOrNull()?.let { return it }
  }
  target.values.forEach { child ->
    child.findDouble(*keys)?.let { return it }
  }
  return null
}

private fun JsonElement?.findLong(vararg keys: String): Long? {
  val target = asObjectOrNull() ?: return asLongOrNull()
  keys.forEach { key ->
    target[key]?.asLongOrNull()?.let { return it }
  }
  target.values.forEach { child ->
    child.findLong(*keys)?.let { return it }
  }
  return null
}

private fun shortAddress(value: String): String =
  if (value.length <= 10) {
    value
  } else {
    "${value.take(4)}…${value.takeLast(4)}"
  }

private fun formatUsdCompact(value: Double): String =
  when {
    value >= 1_000_000_000.0 -> "$" + String.format(java.util.Locale.US, "%.2fB", value / 1_000_000_000.0)
    value >= 1_000_000.0 -> "$" + String.format(java.util.Locale.US, "%.2fM", value / 1_000_000.0)
    value >= 1_000.0 -> "$" + String.format(java.util.Locale.US, "%.1fK", value / 1_000.0)
    value >= 1.0 -> "$" + String.format(java.util.Locale.US, "%.4f", value)
    value > 0.0 -> "$" + String.format(java.util.Locale.US, "%.8f", value)
    else -> "$0"
  }

private fun formatPercentCompact(value: Double): String =
  String.format(java.util.Locale.US, "%.2f%%", value)

private fun formatCompact(value: Long): String =
  when {
    value >= 1_000_000_000L -> String.format(java.util.Locale.US, "%.2fB", value / 1_000_000_000.0)
    value >= 1_000_000L -> String.format(java.util.Locale.US, "%.2fM", value / 1_000_000.0)
    value >= 1_000L -> String.format(java.util.Locale.US, "%.1fK", value / 1_000.0)
    else -> value.toString()
  }
