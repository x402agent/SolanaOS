package ai.openclaw.app.solana

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
data class SolanaTrackerMarketToken(
  val mint: String,
  val name: String,
  val symbol: String,
  val decimals: Int?,
  val market: String,
  val poolAddress: String?,
  val image: String?,
  val priceUsd: Double?,
  val liquidityUsd: Double?,
  val marketCapUsd: Double?,
  val volume24h: Double?,
  val holders: Int?,
  val riskScore: Double?,
  val priceChange24h: Double?,
  val status: String? = null,
  val curvePercentage: Double? = null,
  val buys: Int? = null,
  val sells: Int? = null,
  val totalTransactions: Int? = null,
  val createdAt: Long? = null,
)

@Serializable
data class SolanaTrackerDexOverview(
  val latest: List<SolanaTrackerMarketToken>,
  val graduating: List<SolanaTrackerMarketToken>,
  val graduated: List<SolanaTrackerMarketToken>,
)

@Serializable
data class SolanaTrackerPoolSnapshot(
  val poolId: String,
  val market: String,
  val quoteToken: String?,
  val liquidityUsd: Double?,
  val priceUsd: Double?,
  val marketCapUsd: Double?,
  val buys: Int?,
  val sells: Int?,
  val volume24h: Double?,
)

@Serializable
data class SolanaTrackerPriceChanges(
  val m1: Double?,
  val m5: Double?,
  val h1: Double?,
  val h24: Double?,
)

@Serializable
data class SolanaTrackerRiskSummary(
  val score: Int?,
  val rugged: Boolean,
  val top10: Double?,
  val devPercentage: Double?,
  val bundlerPercentage: Double?,
  val sniperPercentage: Double?,
)

@Serializable
data class SolanaTrackerTokenDetail(
  val mint: String,
  val name: String,
  val symbol: String,
  val decimals: Int?,
  val image: String?,
  val description: String?,
  val holders: Int?,
  val buys: Int?,
  val sells: Int?,
  val txns: Int?,
  val priceChanges: SolanaTrackerPriceChanges,
  val pools: List<SolanaTrackerPoolSnapshot>,
  val risk: SolanaTrackerRiskSummary,
)

@Serializable
data class SolanaTrackerTrade(
  val tx: String,
  val type: String,
  val wallet: String,
  val amount: Double?,
  val priceUsd: Double?,
  val volumeUsd: Double?,
  val volumeSol: Double?,
  val time: Long?,
  val program: String?,
)

@Serializable
data class SolanaTrackerHolder(
  val address: String,
  val amount: Double?,
  val percentage: Double?,
  val valueUsd: Double?,
)

@Serializable
data class SolanaTrackerOhlcvPoint(
  val open: Double?,
  val close: Double?,
  val low: Double?,
  val high: Double?,
  val volume: Double?,
  val time: Long?,
)

internal class SolanaTrackerApiClient(
  private val rpcUrl: String,
  private val dataApiKey: String,
  private val dataBaseUrl: String = "https://data.solanatracker.io",
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient = OkHttpClient(),
) {
  fun hasMarketData(): Boolean = dataApiKey.isNotBlank()

  fun hasRpc(): Boolean = rpcUrl.isNotBlank()

  fun isConfigured(): Boolean = hasMarketData() && hasRpc()

  suspend fun fetchCurrentSlot(): Long =
    withContext(Dispatchers.IO) {
      require(hasRpc()) { "Solana Tracker RPC URL is not configured." }
      val body =
        buildJsonObject {
          put("jsonrpc", JsonPrimitive("2.0"))
          put("id", JsonPrimitive(1))
          put("method", JsonPrimitive("getSlot"))
          put(
            "params",
            JsonArray(
              listOf(
                buildJsonObject {
                  put("commitment", JsonPrimitive("processed"))
                },
              ),
            ),
          )
        }
      val payload =
        executeRaw(
          Request.Builder()
            .url(rpcUrl)
            .header("Content-Type", "application/json")
            .post(body.toString().toRequestBody(jsonMediaType))
            .build(),
        )
      val root = json.parseToJsonElement(payload).asObjectOrNull()
        ?: throw IllegalStateException("Solana Tracker RPC returned invalid JSON.")
      root["result"].asLongOrNull()
        ?: throw IllegalStateException("Solana Tracker RPC did not return a slot.")
    }

  suspend fun fetchDexBoard(limit: Int = 12): List<SolanaTrackerMarketToken> =
    searchTokens(
      query = null,
      limit = limit,
      sortBy = "volume_24h",
      sortOrder = "desc",
      minLiquidityUsd = 10_000.0,
    )

  suspend fun searchTokens(
    query: String?,
    limit: Int = 12,
    sortBy: String = "createdAt",
    sortOrder: String = "desc",
    minLiquidityUsd: Double? = null,
  ): List<SolanaTrackerMarketToken> =
    withContext(Dispatchers.IO) {
      require(hasMarketData()) { "Solana Tracker data API key is not configured." }
      val url =
        "$dataBaseUrl/search".toHttpUrl().newBuilder().apply {
          addQueryParameter("page", "1")
          addQueryParameter("limit", limit.coerceIn(1, 100).toString())
          addQueryParameter("sortBy", sortBy)
          addQueryParameter("sortOrder", sortOrder)
          addQueryParameter("showPriceChanges", "true")
          query?.trim()?.takeIf { it.isNotBlank() }?.let { addQueryParameter("query", it) }
          minLiquidityUsd?.let { addQueryParameter("minLiquidity", it.toString()) }
        }.build()
      val root = executeJsonObject(buildDataRequest(url).get().build())
      root["data"].asArrayOrNull().orEmpty().mapNotNull(::parseMarketToken)
    }

  suspend fun fetchTrendingTokens(
    limit: Int = 18,
    timeframe: String = "1h",
  ): List<SolanaTrackerMarketToken> =
    withContext(Dispatchers.IO) {
      require(hasMarketData()) { "Solana Tracker data API key is not configured." }
      val normalizedTimeframe = timeframe.trim().ifBlank { "1h" }
      val path =
        if (normalizedTimeframe == "1h") {
          "$dataBaseUrl/tokens/trending"
        } else {
          "$dataBaseUrl/tokens/trending/$normalizedTimeframe"
        }
      executeJsonElement(buildDataRequest(path).get().build())
        .asArrayOrNull().orEmpty()
        .mapNotNull(::parseTrendingToken)
        .take(limit.coerceIn(1, 100))
    }

  suspend fun fetchDexOverview(
    limit: Int = 24,
    minCurve: Double = 40.0,
    minHolders: Int = 20,
    reduceSpam: Boolean = true,
  ): SolanaTrackerDexOverview =
    withContext(Dispatchers.IO) {
      require(hasMarketData()) { "Solana Tracker data API key is not configured." }
      val url =
        "$dataBaseUrl/tokens/multi/all".toHttpUrl().newBuilder().apply {
          addQueryParameter("limit", limit.coerceIn(1, 100).toString())
          addQueryParameter("minCurve", minCurve.toString())
          addQueryParameter("minHolders", minHolders.toString())
          addQueryParameter("reduceSpam", reduceSpam.toString())
        }.build()
      val root = executeJsonObject(buildDataRequest(url).get().build())
      SolanaTrackerDexOverview(
        latest = root["latest"].asArrayOrNull().orEmpty().mapNotNull(::parseOverviewToken),
        graduating = root["graduating"].asArrayOrNull().orEmpty().mapNotNull(::parseOverviewToken),
        graduated = root["graduated"].asArrayOrNull().orEmpty().mapNotNull(::parseOverviewToken),
      )
    }

  suspend fun fetchTokenDetail(mint: String): SolanaTrackerTokenDetail =
    withContext(Dispatchers.IO) {
      val root = executeJsonObject(buildDataRequest("$dataBaseUrl/tokens/${mint.trim()}").get().build())
      val token = root["token"].asObjectOrNull()
        ?: throw IllegalStateException("Solana Tracker returned no token payload.")
      val events = root["events"].asObjectOrNull().orEmpty()
      val risk = root["risk"].asObjectOrNull().orEmpty()
      val pools =
        root["pools"].asArrayOrNull().orEmpty().mapNotNull(::parsePoolSnapshot)
          .sortedByDescending { it.liquidityUsd ?: 0.0 }
      SolanaTrackerTokenDetail(
        mint = token["mint"].asStringOrEmpty(),
        name = token["name"].asStringOrEmpty(),
        symbol = token["symbol"].asStringOrEmpty(),
        decimals = token["decimals"].asIntOrNull(),
        image = token["image"].asStringOrNull(),
        description = token["description"].asStringOrNull(),
        holders = root["holders"].asIntOrNull(),
        buys = root["buys"].asIntOrNull(),
        sells = root["sells"].asIntOrNull(),
        txns = root["txns"].asIntOrNull(),
        priceChanges =
          SolanaTrackerPriceChanges(
            m1 = events["1m"].nestedNumber("priceChangePercentage"),
            m5 = events["5m"].nestedNumber("priceChangePercentage"),
            h1 = events["1h"].nestedNumber("priceChangePercentage"),
            h24 = events["24h"].nestedNumber("priceChangePercentage"),
          ),
        pools = pools,
        risk =
          SolanaTrackerRiskSummary(
            score = risk["score"].asIntOrNull(),
            rugged = risk["rugged"].asBooleanOrFalse(),
            top10 = risk["top10"].asDoubleOrNull(),
            devPercentage = risk["dev"].nestedNumber("percentage"),
            bundlerPercentage = risk["bundlers"].nestedNumber("totalPercentage"),
            sniperPercentage = risk["snipers"].nestedNumber("totalPercentage"),
          ),
      )
    }

  suspend fun fetchTokenTrades(mint: String, limit: Int = 12): List<SolanaTrackerTrade> =
    withContext(Dispatchers.IO) {
      val url =
        "$dataBaseUrl/trades/${mint.trim()}".toHttpUrl().newBuilder().apply {
          addQueryParameter("sortDirection", "DESC")
          addQueryParameter("hideArb", "true")
          addQueryParameter("parseJupiter", "true")
        }.build()
      val root = executeJsonObject(buildDataRequest(url).get().build())
      root["trades"].asArrayOrNull().orEmpty().mapNotNull(::parseTrade).take(limit)
    }

  suspend fun fetchTopHolders(mint: String, limit: Int = 10): List<SolanaTrackerHolder> =
    withContext(Dispatchers.IO) {
      val payload = executeJsonElement(buildDataRequest("$dataBaseUrl/tokens/${mint.trim()}/holders/top").get().build())
      payload.asArrayOrNull().orEmpty().mapNotNull(::parseHolder).take(limit)
    }

  suspend fun fetchChart(mint: String, candleType: String = "1m", limit: Int = 24): List<SolanaTrackerOhlcvPoint> =
    withContext(Dispatchers.IO) {
      val url =
        "$dataBaseUrl/chart/${mint.trim()}".toHttpUrl().newBuilder().apply {
          addQueryParameter("type", candleType)
          addQueryParameter("currency", "usd")
          addQueryParameter("removeOutliers", "true")
          addQueryParameter("dynamicPools", "true")
          addQueryParameter("fastCache", "true")
        }.build()
      val root = executeJsonObject(buildDataRequest(url).get().build())
      root["oclhv"].asArrayOrNull().orEmpty().mapNotNull(::parseCandle).takeLast(limit)
    }

  private fun buildDataRequest(url: String): Request.Builder = buildDataRequest(url.toHttpUrl())

  private fun buildDataRequest(url: okhttp3.HttpUrl): Request.Builder =
    Request.Builder()
      .url(url)
      .header("x-api-key", dataApiKey)

  private fun executeJsonObject(request: Request): JsonObject {
    val payload = executeRaw(request)
    return json.parseToJsonElement(payload).asObjectOrNull()
      ?: throw IllegalStateException("Solana Tracker returned invalid JSON.")
  }

  private fun executeJsonElement(request: Request): JsonElement {
    val payload = executeRaw(request)
    return json.parseToJsonElement(payload)
  }

  private fun executeRaw(request: Request): String =
    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        throw IllegalStateException("Solana Tracker ${response.code}: ${payload.take(220)}")
      }
      payload
    }

  private fun parseMarketToken(element: JsonElement): SolanaTrackerMarketToken? {
    val obj = element.asObjectOrNull() ?: return null
    val mint = obj["mint"].asStringOrEmpty()
    if (mint.isBlank()) return null
    return SolanaTrackerMarketToken(
      mint = mint,
      name = obj["name"].asStringOrEmpty(),
      symbol = obj["symbol"].asStringOrEmpty(),
      decimals = obj["decimals"].asIntOrNull(),
      market = obj["market"].asStringOrEmpty(),
      poolAddress = obj["poolAddress"].asStringOrNull(),
      image = obj["image"].asStringOrNull(),
      priceUsd = obj["priceUsd"].asDoubleOrNull(),
      liquidityUsd = obj["liquidityUsd"].asDoubleOrNull(),
      marketCapUsd = obj["marketCapUsd"].asDoubleOrNull(),
      volume24h = obj["volume_24h"].asDoubleOrNull() ?: obj["volume"].asDoubleOrNull(),
      holders = obj["holders"].asIntOrNull(),
      riskScore = obj["riskScore"].asDoubleOrNull(),
      priceChange24h =
        obj["events"].nestedObject("24h")?.get("priceChangePercentage").asDoubleOrNull()
          ?: obj["priceChange24h"].asDoubleOrNull()
          ?: obj["priceChange"].asDoubleOrNull(),
      status = obj["status"].asStringOrNull(),
      curvePercentage = obj["launchpad"].nestedNumber("curvePercentage") ?: obj["curvePercentage"].asDoubleOrNull(),
      buys = obj["buys"].asIntOrNull(),
      sells = obj["sells"].asIntOrNull(),
      totalTransactions = obj["totalTransactions"].asIntOrNull(),
      createdAt = obj["createdAt"].asLongOrNull(),
    )
  }

  private fun parseTrendingToken(element: JsonElement): SolanaTrackerMarketToken? {
    val obj = element.asObjectOrNull() ?: return null
    val token = obj["token"].asObjectOrNull() ?: return null
    val mint = token["mint"].asStringOrEmpty()
    if (mint.isBlank()) return null
    val bestPool =
      obj["pools"].asArrayOrNull().orEmpty()
        .mapNotNull(::parsePoolSnapshot)
        .maxByOrNull { it.liquidityUsd ?: 0.0 }
    val risk = obj["risk"].asObjectOrNull().orEmpty()
    val curvePercentage =
      obj["pools"].asArrayOrNull().orEmpty()
        .mapNotNull { pool ->
          pool.asObjectOrNull()?.get("curvePercentage").asDoubleOrNull()
            ?: pool.asObjectOrNull()?.get("launchpad").nestedNumber("curvePercentage")
        }.maxOrNull()
    return SolanaTrackerMarketToken(
      mint = mint,
      name = token["name"].asStringOrEmpty(),
      symbol = token["symbol"].asStringOrEmpty(),
      decimals = token["decimals"].asIntOrNull(),
      market = bestPool?.market.orEmpty(),
      poolAddress = bestPool?.poolId,
      image = token["image"].asStringOrNull(),
      priceUsd = bestPool?.priceUsd,
      liquidityUsd = bestPool?.liquidityUsd,
      marketCapUsd = bestPool?.marketCapUsd,
      volume24h = bestPool?.volume24h,
      holders = obj["holders"].asIntOrNull(),
      riskScore = risk["score"].asDoubleOrNull(),
      priceChange24h = obj["events"].nestedObject("24h")?.get("priceChangePercentage").asDoubleOrNull(),
      status = token["status"].asStringOrNull(),
      curvePercentage = curvePercentage,
      buys = obj["buys"].asIntOrNull(),
      sells = obj["sells"].asIntOrNull(),
      totalTransactions = obj["txns"].asIntOrNull(),
      createdAt = token["creation"].nestedNumber("created_time")?.toLong(),
    )
  }

  private fun parseOverviewToken(element: JsonElement): SolanaTrackerMarketToken? {
    val obj = element.asObjectOrNull() ?: return null
    val token = obj["token"].asObjectOrNull() ?: return null
    val mint = token["mint"].asStringOrEmpty()
    if (mint.isBlank()) return null
    val bestPool =
      obj["pools"].asArrayOrNull().orEmpty()
        .mapNotNull(::parsePoolSnapshot)
        .maxByOrNull { it.liquidityUsd ?: 0.0 }
    val risk = obj["risk"].asObjectOrNull().orEmpty()
    val curvePercentage =
      obj["pools"].asArrayOrNull().orEmpty()
        .mapNotNull { pool ->
          pool.asObjectOrNull()?.get("curvePercentage").asDoubleOrNull()
            ?: pool.asObjectOrNull()?.get("launchpad").nestedNumber("curvePercentage")
        }.maxOrNull()
    return SolanaTrackerMarketToken(
      mint = mint,
      name = token["name"].asStringOrEmpty(),
      symbol = token["symbol"].asStringOrEmpty(),
      decimals = token["decimals"].asIntOrNull(),
      market = bestPool?.market.orEmpty(),
      poolAddress = bestPool?.poolId,
      image = token["image"].asStringOrNull(),
      priceUsd = bestPool?.priceUsd,
      liquidityUsd = bestPool?.liquidityUsd,
      marketCapUsd = bestPool?.marketCapUsd,
      volume24h = bestPool?.volume24h,
      holders = obj["holders"].asIntOrNull(),
      riskScore = risk["score"].asDoubleOrNull(),
      priceChange24h = obj["events"].nestedObject("24h")?.get("priceChangePercentage").asDoubleOrNull(),
      status = token["status"].asStringOrNull(),
      curvePercentage = curvePercentage,
      buys = obj["buys"].asIntOrNull(),
      sells = obj["sells"].asIntOrNull(),
      totalTransactions = obj["txns"].asIntOrNull(),
      createdAt = token["creation"].nestedNumber("created_time")?.toLong(),
    )
  }

  private fun parsePoolSnapshot(element: JsonElement): SolanaTrackerPoolSnapshot? {
    val obj = element.asObjectOrNull() ?: return null
    val poolId = obj["poolId"].asStringOrEmpty()
    if (poolId.isBlank()) return null
    val txns = obj["txns"].asObjectOrNull().orEmpty()
    return SolanaTrackerPoolSnapshot(
      poolId = poolId,
      market = obj["market"].asStringOrEmpty(),
      quoteToken = obj["quoteToken"].asStringOrNull(),
      liquidityUsd = obj["liquidity"].nestedNumber("usd"),
      priceUsd = obj["price"].nestedNumber("usd"),
      marketCapUsd = obj["marketCap"].nestedNumber("usd"),
      buys = txns["buys"].asIntOrNull(),
      sells = txns["sells"].asIntOrNull(),
      volume24h = txns["volume24h"].asDoubleOrNull(),
    )
  }

  private fun parseTrade(element: JsonElement): SolanaTrackerTrade? {
    val obj = element.asObjectOrNull() ?: return null
    val tx = obj["tx"].asStringOrEmpty()
    if (tx.isBlank()) return null
    return SolanaTrackerTrade(
      tx = tx,
      type = obj["type"].asStringOrEmpty(),
      wallet = obj["wallet"].asStringOrEmpty(),
      amount = obj["amount"].asDoubleOrNull(),
      priceUsd = obj["priceUsd"].asDoubleOrNull(),
      volumeUsd = obj["volume"].asDoubleOrNull(),
      volumeSol = obj["volumeSol"].asDoubleOrNull(),
      time = obj["time"].asLongOrNull(),
      program = obj["program"].asStringOrNull(),
    )
  }

  private fun parseHolder(element: JsonElement): SolanaTrackerHolder? {
    val obj = element.asObjectOrNull() ?: return null
    val address = obj["address"].asStringOrEmpty()
    if (address.isBlank()) return null
    return SolanaTrackerHolder(
      address = address,
      amount = obj["amount"].asDoubleOrNull(),
      percentage = obj["percentage"].asDoubleOrNull(),
      valueUsd = obj["value"].nestedNumber("usd") ?: obj["value"].nestedNumber("quote"),
    )
  }

  private fun parseCandle(element: JsonElement): SolanaTrackerOhlcvPoint? {
    val obj = element.asObjectOrNull() ?: return null
    return SolanaTrackerOhlcvPoint(
      open = obj["open"].asDoubleOrNull(),
      close = obj["close"].asDoubleOrNull(),
      low = obj["low"].asDoubleOrNull(),
      high = obj["high"].asDoubleOrNull(),
      volume = obj["volume"].asDoubleOrNull(),
      time = obj["time"].asLongOrNull(),
    )
  }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asArrayOrNull(): JsonArray? = this as? JsonArray

private fun JsonElement?.asStringOrNull(): String? =
  when (this) {
    is JsonPrimitive -> content
    else -> null
  }

private fun JsonElement?.asStringOrEmpty(): String = asStringOrNull().orEmpty()

private fun JsonElement?.asDoubleOrNull(): Double? =
  when (this) {
    is JsonPrimitive -> content.toDoubleOrNull()
    else -> null
  }

private fun JsonElement?.asLongOrNull(): Long? =
  when (this) {
    is JsonPrimitive -> content.toLongOrNull()
    else -> null
  }

private fun JsonElement?.asIntOrNull(): Int? =
  when (this) {
    is JsonPrimitive -> content.toIntOrNull()
    else -> null
  }

private fun JsonElement?.asBooleanOrFalse(): Boolean =
  when (this) {
    is JsonPrimitive -> content.toBooleanStrictOrNull() ?: false
    else -> false
  }

private fun JsonElement?.nestedNumber(key: String): Double? = asObjectOrNull()?.get(key).asDoubleOrNull()

private fun JsonElement?.nestedObject(key: String): JsonObject? = asObjectOrNull()?.get(key).asObjectOrNull()
