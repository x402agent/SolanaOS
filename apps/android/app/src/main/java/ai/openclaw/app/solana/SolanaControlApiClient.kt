package ai.openclaw.app.solana

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
data class SolanaControlOpenRouterConfig(
  val enabled: Boolean = false,
  val model: String = "",
  val grokModel: String = "",
)

@Serializable
data class SolanaControlStatus(
  val service: String = "",
  val openRouter: SolanaControlOpenRouterConfig = SolanaControlOpenRouterConfig(),
  val threadCount: Int = 0,
  val stagedIntentCount: Int = 0,
  val features: List<String> = emptyList(),
)

@Serializable
data class SolanaControlThreadItem(
  val id: String,
  val author: String,
  val headline: String,
  val body: String,
  val kind: String,
  val stats: String,
  val createdAt: String,
)

@Serializable
data class SolanaControlStagedIntent(
  val id: String,
  val kind: String,
  val status: String,
  val summary: String,
  val createdAt: String,
)

@Serializable
data class SolanaControlTradeQuote(
  val provider: String = "",
  val inputMint: String = "",
  val outputMint: String = "",
  val inAmount: String = "",
  val outAmount: String = "",
  val otherAmount: String = "",
  val swapMode: String = "",
  val priceImpact: String = "",
  val routeCount: Int = 0,
)

@Serializable
private data class ControlCreateThreadRequest(
  val author: String,
  val headline: String,
  val body: String,
  val kind: String,
  val stats: String,
)

@Serializable
private data class ControlPumpfunLaunchRequest(
  val name: String,
  val symbol: String,
  val description: String,
  val amountSol: Double,
)

@Serializable
private data class ControlPumpfunSwapRequest(
  val tokenAddress: String,
  val amountSol: Double,
)

@Serializable
private data class ControlTokenMillMarketRequest(
  val name: String,
  val curvePreset: String,
  val seedSol: Double,
)

@Serializable
private data class ControlTradeQuoteRequest(
  val fromToken: String,
  val toToken: String,
  val amount: Double,
  val slippageBps: Int,
)

@Serializable
private data class ControlTradeStageRequest(
  val fromToken: String,
  val toToken: String,
  val amount: Double,
  val slippageBps: Int,
)

internal class SolanaControlApiClient(
  private val httpClient: OkHttpClient = OkHttpClient(),
  private val json: Json = Json { ignoreUnknownKeys = true },
) {
  suspend fun fetchStatus(baseUrl: String): SolanaControlStatus =
    get(baseUrl = baseUrl, path = "/api/control/status")

  suspend fun listThreads(baseUrl: String): List<SolanaControlThreadItem> =
    get(baseUrl = baseUrl, path = "/api/control/threads")

  suspend fun createThread(
    baseUrl: String,
    author: String,
    headline: String,
    body: String,
    kind: String,
    stats: String,
  ): SolanaControlThreadItem =
    post(
      baseUrl = baseUrl,
      path = "/api/control/threads",
      payload =
        ControlCreateThreadRequest(
          author = author,
          headline = headline,
          body = body,
          kind = kind,
          stats = stats,
        ),
    )

  suspend fun launchPumpfun(
    baseUrl: String,
    name: String,
    symbol: String,
    description: String,
    amountSol: Double,
  ): SolanaControlStagedIntent =
    post(
      baseUrl = baseUrl,
      path = "/api/control/pumpfun/launch",
      payload =
        ControlPumpfunLaunchRequest(
          name = name,
          symbol = symbol,
          description = description,
          amountSol = amountSol,
        ),
    )

  suspend fun buyPumpfun(baseUrl: String, tokenAddress: String, amountSol: Double): SolanaControlStagedIntent =
    post(
      baseUrl = baseUrl,
      path = "/api/control/pumpfun/buy",
      payload = ControlPumpfunSwapRequest(tokenAddress = tokenAddress, amountSol = amountSol),
    )

  suspend fun sellPumpfun(baseUrl: String, tokenAddress: String, amountSol: Double): SolanaControlStagedIntent =
    post(
      baseUrl = baseUrl,
      path = "/api/control/pumpfun/sell",
      payload = ControlPumpfunSwapRequest(tokenAddress = tokenAddress, amountSol = amountSol),
    )

  suspend fun createTokenMillMarket(
    baseUrl: String,
    name: String,
    curvePreset: String,
    seedSol: Double,
  ): SolanaControlStagedIntent =
    post(
      baseUrl = baseUrl,
      path = "/api/control/tokenmill/market",
      payload =
        ControlTokenMillMarketRequest(
          name = name,
          curvePreset = curvePreset,
          seedSol = seedSol,
        ),
    )

  suspend fun quoteTrade(
    baseUrl: String,
    fromToken: String,
    toToken: String,
    amount: Double,
    slippageBps: Int,
  ): SolanaControlTradeQuote =
    post(
      baseUrl = baseUrl,
      path = "/api/control/trade/quote",
      payload =
        ControlTradeQuoteRequest(
          fromToken = fromToken,
          toToken = toToken,
          amount = amount,
          slippageBps = slippageBps,
        ),
    )

  suspend fun stageTrade(
    baseUrl: String,
    fromToken: String,
    toToken: String,
    amount: Double,
    slippageBps: Int,
  ): SolanaControlStagedIntent =
    post(
      baseUrl = baseUrl,
      path = "/api/control/trade/stage",
      payload =
        ControlTradeStageRequest(
          fromToken = fromToken,
          toToken = toToken,
          amount = amount,
          slippageBps = slippageBps,
        ),
    )

  private suspend inline fun <reified T> get(baseUrl: String, path: String): T =
    withContext(Dispatchers.IO) {
      execute(
        Request.Builder()
          .url(normalizeBaseUrl(baseUrl) + path)
          .get()
          .build(),
      )
    }

  private suspend inline fun <reified T, reified B> post(baseUrl: String, path: String, payload: B): T =
    withContext(Dispatchers.IO) {
      execute(
        Request.Builder()
          .url(normalizeBaseUrl(baseUrl) + path)
          .header("Content-Type", "application/json")
          .post(json.encodeToString(payload).toRequestBody(jsonMediaType))
          .build(),
      )
    }

  private inline fun <reified T> execute(request: Request): T {
    httpClient.newCall(request).execute().use { response ->
      val body = response.body?.string().orEmpty()
      val root =
        runCatching { json.parseToJsonElement(body) }.getOrNull() as? JsonObject
          ?: throw IllegalStateException(body.trim().ifEmpty { "Invalid server response" })
      if (!response.isSuccessful) {
        throw IllegalStateException(root["error"].stringOrNull() ?: body.trim().ifEmpty { "HTTP ${response.code}" })
      }
      if (root["success"].stringOrNull() == "false") {
        throw IllegalStateException(root["error"].stringOrNull() ?: "Request failed")
      }
      val data = root["data"] ?: throw IllegalStateException("Server returned no data")
      return json.decodeFromJsonElement(data)
    }
  }

  private fun normalizeBaseUrl(baseUrl: String): String {
    val trimmed = baseUrl.trim()
    val withScheme =
      if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
      } else {
        "http://$trimmed"
      }
    return withScheme.trimEnd('/')
  }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}

private fun JsonElement?.stringOrNull(): String? =
  when (this) {
    is kotlinx.serialization.json.JsonPrimitive -> content
    else -> null
  }
