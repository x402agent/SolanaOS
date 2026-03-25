package ai.openclaw.app.bitaxe

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Serializable
private data class FanSpeedRequest(val fanSpeed: Int)

@Serializable
private data class PoolUpdateRequest(
  val poolUrl: String,
  val poolPort: Int,
  val poolUser: String,
  val poolPass: String,
)

@Serializable
private data class OverclockRequest(
  val frequencyMHz: Int,
  val coreVoltage: Int? = null,
)

@Serializable
data class BitaxeFleetSnapshot(
  val totalDevices: Int = 0,
  val onlineDevices: Int = 0,
  val totalHashRate: Double = 0.0,
  val avgTemp: Double = 0.0,
  val totalPower: Double = 0.0,
  val totalShares: Int = 0,
  val devices: List<BitaxeDeviceSnapshot> = emptyList(),
)

@Serializable
data class BitaxeDeviceSnapshot(
  val id: String,
  val ip: String = "",
  val state: String = "",
  val health: String = "",
  val poolUrl: String = "",
  val poolPort: Int = 0,
  val poolUser: String = "",
  val hashRate: Double = 0.0,
  val temp: Double = 0.0,
  val power: Double = 0.0,
  @SerialName("frequencyMHz") val frequencyMHz: Int = 0,
  val fanSpeed: Int = 0,
  val fanRPM: Int = 0,
  val sharesAccepted: Int = 0,
  val sharesRejected: Int = 0,
  val uptimeHours: Double = 0.0,
)

class BitaxeApiClient(
  private val httpClient: OkHttpClient = OkHttpClient(),
  private val json: Json = Json { ignoreUnknownKeys = true },
) {
  suspend fun fetchFleet(baseUrl: String, apiKey: String?): BitaxeFleetSnapshot =
    withContext(Dispatchers.IO) {
      executeJson(
        request = requestBuilder(baseUrl = baseUrl, path = "/api/fleet", apiKey = apiKey).get().build(),
        decode = { body -> json.decodeFromString<BitaxeFleetSnapshot>(body) },
      )
    }

  suspend fun restartDevice(baseUrl: String, apiKey: String?, deviceId: String) {
    postAction(
      baseUrl = baseUrl,
      apiKey = apiKey,
      path = "/api/fleet/device/$deviceId/restart",
      payloadJson = "{}",
    )
  }

  suspend fun identifyDevice(baseUrl: String, apiKey: String?, deviceId: String) {
    postAction(
      baseUrl = baseUrl,
      apiKey = apiKey,
      path = "/api/fleet/device/$deviceId/identify",
      payloadJson = "{}",
    )
  }

  suspend fun setFanSpeed(baseUrl: String, apiKey: String?, deviceId: String, fanSpeed: Int) {
    patchAction(
      baseUrl = baseUrl,
      apiKey = apiKey,
      path = "/api/fleet/device/$deviceId/fan",
      payloadJson = json.encodeToString(FanSpeedRequest(fanSpeed = fanSpeed)),
    )
  }

  suspend fun setPool(
    baseUrl: String,
    apiKey: String?,
    deviceId: String,
    poolUrl: String,
    poolPort: Int,
    poolUser: String,
    poolPass: String,
  ) {
    patchAction(
      baseUrl = baseUrl,
      apiKey = apiKey,
      path = "/api/fleet/device/$deviceId/pool",
      payloadJson =
        json.encodeToString(
          PoolUpdateRequest(
            poolUrl = poolUrl,
            poolPort = poolPort,
            poolUser = poolUser,
            poolPass = poolPass,
          ),
        ),
    )
  }

  suspend fun setOverclock(
    baseUrl: String,
    apiKey: String?,
    deviceId: String,
    frequencyMHz: Int,
    coreVoltage: Int?,
  ) {
    patchAction(
      baseUrl = baseUrl,
      apiKey = apiKey,
      path = "/api/fleet/device/$deviceId/overclock",
      payloadJson =
        json.encodeToString(
          OverclockRequest(
            frequencyMHz = frequencyMHz,
            coreVoltage = coreVoltage,
          ),
        ),
    )
  }

  private suspend fun postAction(baseUrl: String, apiKey: String?, path: String, payloadJson: String) =
    withContext(Dispatchers.IO) {
      executeJson(
        request =
          requestBuilder(baseUrl = baseUrl, path = path, apiKey = apiKey)
            .post(payloadJson.toRequestBody(jsonMediaType))
            .build(),
        decode = {},
      )
    }

  private suspend fun patchAction(baseUrl: String, apiKey: String?, path: String, payloadJson: String) =
    withContext(Dispatchers.IO) {
      executeJson(
        request =
          requestBuilder(baseUrl = baseUrl, path = path, apiKey = apiKey)
            .patch(payloadJson.toRequestBody(jsonMediaType))
            .build(),
        decode = {},
      )
    }

  private fun requestBuilder(baseUrl: String, path: String, apiKey: String?): Request.Builder {
    val normalizedBase = normalizeBaseUrl(baseUrl)
    return Request.Builder()
      .url(normalizedBase + path)
      .apply {
        if (!apiKey.isNullOrBlank()) {
          header("X-API-Key", apiKey.trim())
        }
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

  private fun <T> executeJson(request: Request, decode: (String) -> T): T {
    httpClient.newCall(request).execute().use { response ->
      val body = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        val message = body.trim().ifEmpty { "HTTP ${response.code}" }
        throw IllegalStateException(message)
      }
      return decode(body)
    }
  }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}
