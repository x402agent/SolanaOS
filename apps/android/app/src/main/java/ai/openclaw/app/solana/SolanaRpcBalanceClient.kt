package ai.openclaw.app.solana

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

data class SolanaRpcBalanceSnapshot(
  val lamports: Long,
) {
  val sol: Double
    get() = lamports.toDouble() / 1_000_000_000.0
}

internal class SolanaRpcBalanceClient(
  private val rpcUrl: String,
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient = OkHttpClient(),
) {
  fun isConfigured(): Boolean = rpcUrl.isNotBlank()

  suspend fun fetchBalance(address: String): SolanaRpcBalanceSnapshot =
    withContext(Dispatchers.IO) {
      val trimmedAddress = address.trim()
      require(trimmedAddress.isNotBlank()) { "Wallet address is required." }
      require(isConfigured()) { "Mainnet RPC URL is not configured." }

      val body =
        buildJsonObject {
          put("jsonrpc", JsonPrimitive("2.0"))
          put("id", JsonPrimitive(1))
          put("method", JsonPrimitive("getBalance"))
          put(
            "params",
            JsonArray(
              listOf(
                JsonPrimitive(trimmedAddress),
                buildJsonObject {
                  put("commitment", JsonPrimitive("confirmed"))
                },
              ),
            ),
          )
        }

      val request =
        Request.Builder()
          .url(rpcUrl)
          .header("Content-Type", "application/json")
          .post(body.toString().toRequestBody(jsonMediaType))
          .build()

      val payload =
        httpClient.newCall(request).execute().use { response ->
          if (!response.isSuccessful) {
            throw IllegalStateException("Balance RPC failed with HTTP ${response.code}.")
          }
          response.body?.string().orEmpty()
        }

      val root = json.parseToJsonElement(payload).jsonObject
      val result = root["result"]?.jsonObject
        ?: throw IllegalStateException("Balance RPC returned no result.")
      val value = result["value"]?.jsonPrimitive?.longOrNull
        ?: throw IllegalStateException("Balance RPC returned no lamport balance.")
      SolanaRpcBalanceSnapshot(lamports = value)
    }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}
