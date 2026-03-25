package ai.openclaw.app.solana

import ai.openclaw.app.BuildConfig
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Base64
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
data class JupiterSwapQuotePreview(
  val inputMint: String,
  val outputMint: String,
  val inputSymbol: String,
  val outputSymbol: String,
  val inputDecimals: Int,
  val outputDecimals: Int,
  val inputAmountUi: String,
  val outputAmountUi: String,
  val inputAmountRaw: String,
  val outputAmountRaw: String,
  val otherAmountThresholdRaw: String,
  val swapMode: String,
  val slippageBps: Int,
  val priceImpactPct: Double?,
  val routeCount: Int,
  val contextSlot: Long?,
  val quotePayload: JsonObject,
)

@Serializable
data class JupiterSwapBuildResult(
  val swapTransactionBytes: ByteArray,
  val lastValidBlockHeight: Long?,
  val prioritizationFeeLamports: Long?,
  val computeUnitLimit: Int?,
)

internal class JupiterSwapApiClient(
  private val apiBaseUrl: String = BuildConfig.JUPITER_ENDPOINT.ifBlank { "https://api.jup.ag" },
  private val apiKey: String = BuildConfig.JUPITER_API_KEY,
  private val trackingAccount: String = BuildConfig.JUPITER_REFERRAL,
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient = OkHttpClient(),
) {
  fun isConfigured(): Boolean = apiBaseUrl.trim().isNotBlank()

  suspend fun fetchQuote(
    inputMint: String,
    outputMint: String,
    inputSymbol: String,
    outputSymbol: String,
    inputDecimals: Int,
    outputDecimals: Int,
    amountUi: String,
    slippageBps: Int,
  ): JupiterSwapQuotePreview =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Jupiter swap endpoint is not configured." }
      require(inputMint.trim().isNotBlank()) { "Choose an input mint before quoting." }
      require(outputMint.trim().isNotBlank()) { "Choose an output mint before quoting." }
      require(inputDecimals >= 0) { "Input token decimals must be zero or greater." }
      require(outputDecimals >= 0) { "Output token decimals must be zero or greater." }
      require(slippageBps in 1..5_000) { "Slippage must stay between 0.01% and 50%." }

      val rawAmount = uiAmountToRaw(amountUi, inputDecimals)
      val url =
        normalizeBaseUrl(apiBaseUrl)
          .newBuilder()
          .addPathSegments("swap/v1/quote")
          .addQueryParameter("inputMint", inputMint.trim())
          .addQueryParameter("outputMint", outputMint.trim())
          .addQueryParameter("amount", rawAmount)
          .addQueryParameter("slippageBps", slippageBps.toString())
          .addQueryParameter("restrictIntermediateTokens", "true")
          .addQueryParameter("maxAccounts", "20")
          .build()
      val root = executeJsonObject(buildRequest(url).get().build())
      val resolvedInputRaw =
        root["inAmount"].asStringOrEmpty().ifBlank {
          throw IllegalStateException("Jupiter quote did not return an input amount.")
        }
      val resolvedOutputRaw =
        root["outAmount"].asStringOrEmpty().ifBlank {
          throw IllegalStateException("Jupiter quote did not return an output amount.")
        }
      JupiterSwapQuotePreview(
        inputMint = inputMint.trim(),
        outputMint = outputMint.trim(),
        inputSymbol = inputSymbol.ifBlank { shortMint(inputMint) },
        outputSymbol = outputSymbol.ifBlank { shortMint(outputMint) },
        inputDecimals = inputDecimals,
        outputDecimals = outputDecimals,
        inputAmountUi = rawAmountToUi(resolvedInputRaw, inputDecimals),
        outputAmountUi = rawAmountToUi(resolvedOutputRaw, outputDecimals),
        inputAmountRaw = resolvedInputRaw,
        outputAmountRaw = resolvedOutputRaw,
        otherAmountThresholdRaw = root["otherAmountThreshold"].asStringOrEmpty(),
        swapMode = root["swapMode"].asStringOrEmpty().ifBlank { "ExactIn" },
        slippageBps = root["slippageBps"].asIntOrNull() ?: slippageBps,
        priceImpactPct = root["priceImpactPct"].asDoubleOrNull(),
        routeCount = root["routePlan"].asArrayOrNull()?.size ?: 0,
        contextSlot = root["contextSlot"].asLongOrNull(),
        quotePayload = root,
      )
    }

  suspend fun buildSwapTransaction(
    userPublicKey: String,
    quote: JupiterSwapQuotePreview,
  ): JupiterSwapBuildResult =
    withContext(Dispatchers.IO) {
      require(isConfigured()) { "Jupiter swap endpoint is not configured." }
      require(userPublicKey.trim().isNotBlank()) { "Connect a wallet before building a Jupiter swap." }

      val body =
        buildJsonObject {
          put("userPublicKey", JsonPrimitive(userPublicKey.trim()))
          put("quoteResponse", quote.quotePayload)
          put("wrapAndUnwrapSol", JsonPrimitive(true))
          put("dynamicComputeUnitLimit", JsonPrimitive(true))
          if (trackingAccount.trim().isNotBlank()) {
            put("trackingAccount", JsonPrimitive(trackingAccount.trim()))
          }
          put(
            "prioritizationFeeLamports",
            buildJsonObject {
              put(
                "priorityLevelWithMaxLamports",
                buildJsonObject {
                  put("priorityLevel", JsonPrimitive("high"))
                  put("maxLamports", JsonPrimitive(1_000_000))
                  put("global", JsonPrimitive(false))
                },
              )
            },
          )
        }

      val url = normalizeBaseUrl(apiBaseUrl).newBuilder().addPathSegments("swap/v1/swap").build()
      val root =
        executeJsonObject(
          buildRequest(url)
            .header("Content-Type", "application/json")
            .post(body.toString().toRequestBody(jsonMediaType))
            .build(),
        )
      val swapTransactionBase64 =
        root["swapTransaction"].asStringOrEmpty().ifBlank {
          throw IllegalStateException("Jupiter swap did not return a serialized transaction.")
        }
      val simulationError = root["simulationError"]
      if (simulationError !is JsonPrimitive || simulationError.content.trim().isBlank() || simulationError.content == "null") {
        return@withContext JupiterSwapBuildResult(
          swapTransactionBytes = Base64.getDecoder().decode(swapTransactionBase64),
          lastValidBlockHeight = root["lastValidBlockHeight"].asLongOrNull(),
          prioritizationFeeLamports = root["prioritizationFeeLamports"].asLongOrNull(),
          computeUnitLimit = root["computeUnitLimit"].asIntOrNull(),
        )
      }
      throw IllegalStateException("Jupiter simulation failed: ${simulationError.content}")
    }

  private fun buildRequest(url: okhttp3.HttpUrl): Request.Builder =
    Request.Builder()
      .url(url)
      .apply {
        if (apiKey.trim().isNotBlank()) {
          header("x-api-key", apiKey.trim())
        }
      }

  private fun normalizeBaseUrl(baseUrl: String): okhttp3.HttpUrl {
    val trimmed = baseUrl.trim().trimEnd('/')
    val withScheme =
      if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
      } else {
        "https://$trimmed"
      }
    return withScheme.toHttpUrl()
  }

  private fun executeJsonObject(request: Request): JsonObject {
    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      val root =
        runCatching { json.parseToJsonElement(payload) }.getOrNull() as? JsonObject
          ?: throw IllegalStateException(payload.trim().ifEmpty { "Invalid Jupiter response." })
      if (!response.isSuccessful) {
        val error =
          root["error"].asStringOrNull()
            ?: root["message"].asStringOrNull()
            ?: payload.trim().ifEmpty { "HTTP ${response.code}" }
        throw IllegalStateException("Jupiter ${response.code}: $error")
      }
      return root
    }
  }

  private fun uiAmountToRaw(amountUi: String, decimals: Int): String {
    val normalized =
      amountUi.trim().toBigDecimalOrNull()
        ?: throw IllegalArgumentException("Enter a valid token amount.")
    require(normalized > BigDecimal.ZERO) { "Swap amount must be greater than zero." }
    val raw = normalized.movePointRight(decimals)
    require(raw.stripTrailingZeros().scale() <= 0) {
      "Swap amount has more precision than the token supports."
    }
    return raw.setScale(0, RoundingMode.UNNECESSARY).toPlainString()
  }

  private fun rawAmountToUi(rawAmount: String, decimals: Int): String {
    val resolved =
      rawAmount.toBigDecimalOrNull()
        ?: return rawAmount
    return resolved
      .movePointLeft(decimals)
      .stripTrailingZeros()
      .toPlainString()
      .ifBlank { "0" }
  }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun shortMint(value: String): String =
      if (value.length <= 10) value else "${value.take(4)}…${value.takeLast(4)}"
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asArrayOrNull(): JsonArray? = this as? JsonArray

private fun JsonElement?.asStringOrNull(): String? =
  (this as? JsonPrimitive)
    ?.content
    ?.takeUnless { it == "null" }

private fun JsonElement?.asStringOrEmpty(): String = asStringOrNull().orEmpty()

private fun JsonElement?.asIntOrNull(): Int? =
  when (val primitive = this as? JsonPrimitive) {
    null -> null
    else -> primitive.content.toIntOrNull() ?: primitive.content.toLongOrNull()?.toInt()
  }

private fun JsonElement?.asLongOrNull(): Long? =
  when (val primitive = this as? JsonPrimitive) {
    null -> null
    else -> primitive.content.toLongOrNull()
  }

private fun JsonElement?.asDoubleOrNull(): Double? =
  when (val primitive = this as? JsonPrimitive) {
    null -> null
    else -> primitive.content.toDoubleOrNull()
  }
