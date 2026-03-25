package ai.openclaw.app.node

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.net.toUri
import ai.openclaw.app.NodeApp
import ai.openclaw.app.SecurePrefs
import ai.openclaw.app.nanoSolanaBrandName
import ai.openclaw.app.nanoSolanaHubUrl
import ai.openclaw.app.nanoSolanaSkillsUrl
import ai.openclaw.app.solana.MobileWalletAuthActivity
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

private const val compatBridgePort = 8765
private const val maxCompatBridgeHeaderBytes = 16 * 1024
private const val maxCompatBridgeBodyBytes = 128 * 1024
private const val compatBridgeTag = "SolanaOsCompatBridge"

class SolanaOsCompatBridgeServer(
  private val appContext: Context,
  private val scope: CoroutineScope,
  private val prefs: SecurePrefs,
  private val deviceHandler: DeviceHandler,
  private val cameraHandler: CameraHandler,
  private val contactsHandler: ContactsHandler,
  private val smsManager: SmsManager,
  private val locationCaptureManager: LocationCaptureManager,
  private val locationPreciseEnabled: () -> Boolean,
) {
  private data class BridgeRequest(
    val method: String,
    val path: String,
    val body: String,
  )

  private data class BridgeResponse(
    val statusCode: Int,
    val body: String,
  )

  private val json = Json { ignoreUnknownKeys = true }
  private val messageReportCount = AtomicLong(0)
  @Volatile private var serverSocket: ServerSocket? = null
  @Volatile private var acceptJob: Job? = null
  @Volatile private var textToSpeech: TextToSpeech? = null

  fun start() {
    if (acceptJob != null) return
    acceptJob =
      scope.launch(Dispatchers.IO) {
        runServer()
      }
  }

  suspend fun stop() {
    serverSocket?.closeQuietly()
    serverSocket = null
    acceptJob?.cancelAndJoin()
    acceptJob = null
    withContext(Dispatchers.Main) {
      textToSpeech?.shutdown()
      textToSpeech = null
    }
  }

  private suspend fun runServer() {
    val socket =
      try {
        ServerSocket().apply {
          reuseAddress = true
          bind(InetSocketAddress(InetAddress.getLoopbackAddress(), compatBridgePort))
        }
      } catch (err: Throwable) {
        Log.w(compatBridgeTag, "bridge shim unavailable: ${err.message ?: err::class.java.simpleName}")
        return
      }
    serverSocket = socket
    Log.i(compatBridgeTag, "compat bridge listening on 127.0.0.1:$compatBridgePort")
    try {
      coroutineScope {
        while (isActive) {
          val client =
            try {
              socket.accept()
            } catch (_: SocketException) {
              break
            }
          launch(Dispatchers.IO) {
            handleClient(client)
          }
        }
      }
    } finally {
      socket.closeQuietly()
      serverSocket = null
    }
  }

  private suspend fun handleClient(client: Socket) {
    client.use { socket ->
      val response =
        try {
          when (val request = readRequest(socket)) {
            null -> BridgeResponse(400, errorJson("INVALID_REQUEST", "missing request"))
            is BridgeResponse -> request
            is BridgeRequest -> routeRequest(request)
            else -> BridgeResponse(400, errorJson("INVALID_REQUEST", "unsupported request"))
          }
        } catch (err: Throwable) {
          BridgeResponse(500, errorJson("UNAVAILABLE", err.message ?: "bridge failure"))
        }
      writeResponse(socket, response)
    }
  }

  private suspend fun routeRequest(request: BridgeRequest): BridgeResponse {
    return when (request.path) {
      "/" -> BridgeResponse(200, bridgeInfoJson())
      "/ping" -> BridgeResponse(200, bridgeInfoJson())
      "/health" -> BridgeResponse(200, bridgeInfoJson())
      "/battery" -> BridgeResponse(200, batteryJson())
      "/storage" -> BridgeResponse(200, storageJson())
      "/location" -> handleLocation(request.body)
      "/clipboard/get" -> BridgeResponse(200, clipboardJson())
      "/clipboard/set" -> handleClipboardSet(request.body)
      "/contacts/search" -> handleContactsSearch(request.body)
      "/sms" -> handleSms(request.body)
      "/call" -> handleCall(request.body)
      "/camera/capture" -> handleCameraCapture(request.body)
      "/apps/list" -> handleAppsList()
      "/apps/launch" -> handleAppsLaunch(request.body)
      "/config/save-owner" -> handleSaveOwner(request.body)
      "/solana/authorize" -> handleWalletAuthorize()
      "/solana/sign-only" -> handleWalletSignOnly(request.body)
      "/solana/sign" -> handleWalletSignAndSend(request.body)
      "/tts" -> handleTts(request.body)
      "/stats/message" -> BridgeResponse(200, statsMessageJson())
      else -> BridgeResponse(404, errorJson("NOT_FOUND", "unknown bridge path"))
    }
  }

  private fun readRequest(socket: Socket): Any? {
    val input = BufferedInputStream(socket.getInputStream())
    val headerBytes = ByteArrayOutputStream()
    var match = 0
    while (headerBytes.size() < maxCompatBridgeHeaderBytes) {
      val value = input.read()
      if (value < 0) break
      headerBytes.write(value)
      match =
        when {
          match == 0 && value == '\r'.code -> 1
          match == 1 && value == '\n'.code -> 2
          match == 2 && value == '\r'.code -> 3
          match == 3 && value == '\n'.code -> 4
          value == '\r'.code -> 1
          else -> 0
        }
      if (match == 4) break
    }
    if (headerBytes.size() == 0) return null
    if (match != 4) return BridgeResponse(400, errorJson("INVALID_REQUEST", "headers too large or incomplete"))
    val headerText = headerBytes.toString(StandardCharsets.UTF_8.name())
    val headerPart = headerText.substringBefore("\r\n\r\n")
    val lines = headerPart.split("\r\n")
    val requestLine = lines.firstOrNull()?.trim().orEmpty()
    val parts = requestLine.split(' ')
    if (parts.size < 2) return BridgeResponse(400, errorJson("INVALID_REQUEST", "invalid request line"))
    val method = parts[0].uppercase(Locale.US)
    val path = parts[1].substringBefore('?')
    val headers =
      lines
        .drop(1)
        .mapNotNull { line ->
          val idx = line.indexOf(':')
          if (idx <= 0) return@mapNotNull null
          line.substring(0, idx).trim().lowercase(Locale.US) to line.substring(idx + 1).trim()
        }.toMap()
    val contentLength =
      headers["content-length"]
        ?.toIntOrNull()
        ?.coerceIn(0, maxCompatBridgeBodyBytes)
        ?: 0
    val bodyBytes = ByteArray(contentLength)
    var read = 0
    while (read < contentLength) {
      val count = input.read(bodyBytes, read, contentLength - read)
      if (count < 0) break
      read += count
    }
    val body = String(bodyBytes, 0, read, StandardCharsets.UTF_8)
    return BridgeRequest(method = method, path = path, body = body)
  }

  private fun writeResponse(socket: Socket, response: BridgeResponse) {
    val bytes = response.body.toByteArray(StandardCharsets.UTF_8)
    val statusText =
      when (response.statusCode) {
        200 -> "OK"
        400 -> "Bad Request"
        404 -> "Not Found"
        503 -> "Service Unavailable"
        else -> "Internal Server Error"
      }
    val output = BufferedOutputStream(socket.getOutputStream())
    output.write("HTTP/1.1 ${response.statusCode} $statusText\r\n".toByteArray(StandardCharsets.UTF_8))
    output.write("Content-Type: application/json; charset=utf-8\r\n".toByteArray(StandardCharsets.UTF_8))
    output.write("Cache-Control: no-store\r\n".toByteArray(StandardCharsets.UTF_8))
    output.write("Content-Length: ${bytes.size}\r\n".toByteArray(StandardCharsets.UTF_8))
    output.write("Connection: close\r\n\r\n".toByteArray(StandardCharsets.UTF_8))
    output.write(bytes)
    output.flush()
  }

  private fun bridgeInfoJson(): String {
    return buildJsonObject {
      put("ok", JsonPrimitive(true))
      put("service", JsonPrimitive("solanaos-bridge"))
      put("app", JsonPrimitive(nanoSolanaBrandName))
      put("siteUrl", JsonPrimitive(nanoSolanaHubUrl))
      put("skillsUrl", JsonPrimitive(nanoSolanaSkillsUrl))
      put("messageReports", JsonPrimitive(messageReportCount.get()))
    }.toString()
  }

  private fun batteryJson(): String {
    val battery = deviceHandler.legacyBatteryStatus()
    return buildJsonObject {
      put("level", JsonPrimitive(battery.level))
      put("isCharging", JsonPrimitive(battery.isCharging))
      put("chargeType", JsonPrimitive(battery.chargeType))
    }.toString()
  }

  private fun storageJson(): String {
    val storage = deviceHandler.legacyStorageInfo()
    return buildJsonObject {
      put("totalGb", JsonPrimitive(storage.totalGb))
      put("availableGb", JsonPrimitive(storage.availableGb))
      put("usedPercent", JsonPrimitive(storage.usedPercent))
    }.toString()
  }

  private suspend fun handleLocation(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val timeoutMs = parseJsonInt(params, "timeoutMs")?.toLong()?.coerceIn(1_000L, 60_000L) ?: 10_000L
    val maxAgeMs = parseJsonInt(params, "maxAgeMs")?.toLong()
    val desiredAccuracy = parseJsonString(params, "desiredAccuracy")?.trim()?.lowercase(Locale.US)
    val preciseEnabled = locationPreciseEnabled()
    val preciseRequested = desiredAccuracy != "coarse" && preciseEnabled
    val providers =
      if (preciseRequested) {
        listOf(android.location.LocationManager.GPS_PROVIDER, android.location.LocationManager.NETWORK_PROVIDER)
      } else {
        listOf(android.location.LocationManager.NETWORK_PROVIDER, android.location.LocationManager.GPS_PROVIDER)
      }
    return try {
      val payload =
        locationCaptureManager.getLocation(
          desiredProviders = providers,
          maxAgeMs = maxAgeMs,
          timeoutMs = timeoutMs,
          isPrecise = preciseRequested,
        )
      val root = json.parseToJsonElement(payload.payloadJson).asObjectOrNull()
      val time =
        parseJsonString(root, "timestamp")
          ?: Instant.now().toString()
      BridgeResponse(
        200,
        buildJsonObject {
          put("latitude", JsonPrimitive(parseJsonDouble(root, "lat") ?: 0.0))
          put("longitude", JsonPrimitive(parseJsonDouble(root, "lon") ?: 0.0))
          put("accuracy", JsonPrimitive(parseJsonDouble(root, "accuracyMeters") ?: 0.0))
          put("time", JsonPrimitive(time))
        }.toString(),
      )
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("LOCATION_UNAVAILABLE", err.message ?: "location unavailable"))
    }
  }

  private suspend fun clipboardJson(): String {
    val text =
      withContext(Dispatchers.Main) {
        val clipboard = appContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        clipboard?.primaryClip
          ?.takeIf { it.itemCount > 0 }
          ?.getItemAt(0)
          ?.coerceToText(appContext)
          ?.toString()
          .orEmpty()
      }
    return buildJsonObject {
      put("text", JsonPrimitive(text))
      put("siteUrl", JsonPrimitive(nanoSolanaHubUrl))
      put("skillsUrl", JsonPrimitive(nanoSolanaSkillsUrl))
    }.toString()
  }

  private suspend fun handleClipboardSet(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val text =
      parseJsonString(params, "text")?.trim()
        ?: parseJsonString(params, "content")?.trim()
        ?: ""
    withContext(Dispatchers.Main) {
      val clipboard = appContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
      clipboard?.setPrimaryClip(ClipData.newPlainText("solanaos-bridge", text))
    }
    return BridgeResponse(
      200,
      buildJsonObject {
        put("ok", JsonPrimitive(true))
        put("length", JsonPrimitive(text.length))
      }.toString(),
    )
  }

  private fun handleContactsSearch(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val normalizedBody =
      buildJsonObject {
        parseJsonString(params, "query")?.let { put("query", JsonPrimitive(it)) }
        put("limit", JsonPrimitive(parseJsonInt(params, "limit") ?: 10))
      }.toString()
    val result = contactsHandler.handleContactsSearch(normalizedBody)
    return invokeResultToBridgeResponse(result)
  }

  private suspend fun handleSms(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val phone =
      parseJsonString(params, "to")?.trim()
        ?: parseJsonString(params, "phone")?.trim()
        ?: ""
    val message = parseJsonString(params, "message")?.trim().orEmpty()
    val result =
      smsManager.send(
        buildJsonObject {
          put("to", JsonPrimitive(phone))
          put("message", JsonPrimitive(message))
        }.toString(),
      )
    return if (result.ok) {
      BridgeResponse(200, result.payloadJson)
    } else {
      BridgeResponse(503, errorJson("SMS_SEND_FAILED", result.error ?: "sms send failed"))
    }
  }

  private suspend fun handleCall(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val phone =
      parseJsonString(params, "phone")?.trim()
        ?: parseJsonString(params, "to")?.trim()
        ?: ""
    if (phone.isEmpty()) {
      return BridgeResponse(400, errorJson("INVALID_REQUEST", "phone required"))
    }
    return try {
      withContext(Dispatchers.Main) {
        val intent =
          Intent(Intent.ACTION_DIAL, "tel:$phone".toUri()).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        appContext.startActivity(intent)
      }
      BridgeResponse(
        200,
        buildJsonObject {
          put("ok", JsonPrimitive(true))
          put("phone", JsonPrimitive(phone))
        }.toString(),
      )
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("CALL_UNAVAILABLE", err.message ?: "dialer unavailable"))
    }
  }

  private suspend fun handleCameraCapture(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val lens =
      when (parseJsonString(params, "lens")?.trim()?.lowercase(Locale.US)) {
        "front" -> "front"
        else -> "back"
      }
    val result =
      cameraHandler.handleSnap(
        buildJsonObject {
          put("facing", JsonPrimitive(lens))
        }.toString(),
      )
    if (!result.ok || result.payloadJson.isNullOrBlank()) {
      return invokeResultToBridgeResponse(result)
    }
    return try {
      val payload = json.parseToJsonElement(result.payloadJson).asObjectOrNull()
      val base64 = parseJsonString(payload, "base64").orEmpty()
      if (base64.isEmpty()) {
        return BridgeResponse(503, errorJson("CAMERA_UNAVAILABLE", "camera payload missing image data"))
      }
      val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
      val outDir = File(appContext.cacheDir, "compat-bridge-captures").apply { mkdirs() }
      val file = File(outDir, "capture-${System.currentTimeMillis()}.jpg")
      withContext(Dispatchers.IO) {
        file.writeBytes(bytes)
      }
      BridgeResponse(
        200,
        buildJsonObject {
          put("success", JsonPrimitive(true))
          put("lens", JsonPrimitive(lens))
          put("capturedAt", JsonPrimitive(Instant.now().toString()))
          put("path", JsonPrimitive(file.absolutePath))
          put("base64", JsonPrimitive(base64))
          put("width", JsonPrimitive(parseJsonInt(payload, "width") ?: 0))
          put("height", JsonPrimitive(parseJsonInt(payload, "height") ?: 0))
        }.toString(),
      )
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("CAMERA_UNAVAILABLE", err.message ?: "camera capture failed"))
    }
  }

  private suspend fun handleAppsList(): BridgeResponse {
    return try {
      val payload =
        withContext(Dispatchers.Default) {
          val pm = appContext.packageManager
          val launcherIntent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
          val apps =
            pm.queryIntentActivities(launcherIntent, 0)
              .map { info ->
                val appInfo = info.activityInfo.applicationInfo
                buildJsonObject {
                  put("package", JsonPrimitive(info.activityInfo.packageName))
                  put("activity", JsonPrimitive(info.activityInfo.name))
                  put("label", JsonPrimitive(pm.getApplicationLabel(appInfo).toString()))
                }
              }.sortedBy { parseJsonString(it, "label").orEmpty().lowercase(Locale.US) }
          buildJsonObject {
            put("apps", kotlinx.serialization.json.buildJsonArray { apps.forEach { add(it) } })
          }.toString()
        }
      BridgeResponse(200, payload)
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("APPS_UNAVAILABLE", err.message ?: "apps unavailable"))
    }
  }

  private suspend fun handleAppsLaunch(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val packageName = parseJsonString(params, "package")?.trim().orEmpty()
    if (packageName.isEmpty()) {
      return BridgeResponse(400, errorJson("INVALID_REQUEST", "package required"))
    }
    return try {
      withContext(Dispatchers.Main) {
        val launchIntent = appContext.packageManager.getLaunchIntentForPackage(packageName)
          ?: throw IllegalStateException("package not launchable")
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        appContext.startActivity(launchIntent)
      }
      BridgeResponse(
        200,
        buildJsonObject {
          put("ok", JsonPrimitive(true))
          put("package", JsonPrimitive(packageName))
        }.toString(),
      )
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("APP_LAUNCH_FAILED", err.message ?: "app launch failed"))
    }
  }

  private fun handleSaveOwner(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val ownerId = parseJsonString(params, "ownerId")?.trim().orEmpty()
    if (ownerId.isEmpty()) {
      return BridgeResponse(400, errorJson("INVALID_REQUEST", "ownerId required"))
    }
    prefs.putString("compat.ownerId", ownerId)
    return BridgeResponse(
      200,
      buildJsonObject {
        put("ok", JsonPrimitive(true))
        put("ownerId", JsonPrimitive(ownerId))
      }.toString(),
    )
  }

  private suspend fun handleWalletAuthorize(): BridgeResponse {
    return bridgeWalletResult(MobileWalletAuthActivity.ACTION_AUTHORIZE)
  }

  private suspend fun handleWalletSignOnly(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val transaction = parseJsonString(params, "transaction")?.trim().orEmpty()
    if (transaction.isEmpty()) {
      return BridgeResponse(400, errorJson("INVALID_REQUEST", "transaction required"))
    }
    return bridgeWalletResult(
      action = MobileWalletAuthActivity.ACTION_SIGN_TRANSACTION,
      transactionBase64 = transaction,
    )
  }

  private suspend fun handleWalletSignAndSend(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val transaction = parseJsonString(params, "transaction")?.trim().orEmpty()
    if (transaction.isEmpty()) {
      return BridgeResponse(400, errorJson("INVALID_REQUEST", "transaction required"))
    }
    return bridgeWalletResult(
      action = MobileWalletAuthActivity.ACTION_SIGN_AND_SEND_TRANSACTION,
      transactionBase64 = transaction,
    )
  }

  private suspend fun handleTts(body: String): BridgeResponse {
    val params = parseJsonParamsObject(body.ifBlank { null })
    val text = parseJsonString(params, "text")?.trim().orEmpty()
    if (text.isEmpty()) {
      return BridgeResponse(400, errorJson("INVALID_REQUEST", "text required"))
    }
    val speed = parseJsonDouble(params, "speed")?.toFloat()?.coerceIn(0.25f, 2.0f) ?: 1.0f
    val pitch = parseJsonDouble(params, "pitch")?.toFloat()?.coerceIn(0.25f, 2.0f) ?: 1.0f
    return try {
      val tts = ensureTextToSpeech()
      withContext(Dispatchers.Main) {
        tts.setSpeechRate(speed)
        tts.setPitch(pitch)
        val status =
          tts.speak(
            text,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "solanaos-bridge-${SystemClock.elapsedRealtime()}",
          )
        if (status == TextToSpeech.ERROR) {
          throw IllegalStateException("tts speak failed")
        }
      }
      BridgeResponse(
        200,
        buildJsonObject {
          put("ok", JsonPrimitive(true))
          put("spoken", JsonPrimitive(text))
        }.toString(),
      )
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("UNAVAILABLE", err.message ?: "tts unavailable"))
    }
  }

  private fun statsMessageJson(): String {
    val total = messageReportCount.incrementAndGet()
    return buildJsonObject {
      put("ok", JsonPrimitive(true))
      put("messagesReported", JsonPrimitive(total))
    }.toString()
  }

  private suspend fun ensureTextToSpeech(): TextToSpeech {
    textToSpeech?.let { return it }
    return withContext(Dispatchers.Main) {
      textToSpeech?.let { return@withContext it }
      val ready = CompletableDeferred<Boolean>()
      var created: TextToSpeech? = null
      created =
        TextToSpeech(appContext) { status ->
          ready.complete(status == TextToSpeech.SUCCESS)
        }
      val tts = created ?: throw IllegalStateException("tts unavailable")
      val ok = ready.await()
      if (!ok) {
        tts.shutdown()
        throw IllegalStateException("tts unavailable")
      }
      tts.language = Locale.getDefault()
      textToSpeech = tts
      tts
    }
  }

  private suspend fun bridgeWalletResult(
    action: String,
    message: String? = null,
    transactionBase64: String? = null,
  ): BridgeResponse {
    return try {
      val requestId = UUID.randomUUID().toString()
      val resultFile = File(File(appContext.filesDir, MobileWalletAuthActivity.RESULTS_DIR), "$requestId.json")
      withContext(Dispatchers.Main) {
        val intent =
          Intent(appContext, MobileWalletAuthActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra(MobileWalletAuthActivity.EXTRA_ACTION, action)
            putExtra(MobileWalletAuthActivity.EXTRA_REQUEST_ID, requestId)
            if (!message.isNullOrBlank()) {
              putExtra(MobileWalletAuthActivity.EXTRA_MESSAGE, message)
            }
            if (!transactionBase64.isNullOrBlank()) {
              putExtra(
                MobileWalletAuthActivity.EXTRA_TRANSACTION,
                android.util.Base64.decode(transactionBase64, android.util.Base64.DEFAULT),
              )
            }
          }
        appContext.startActivity(intent)
      }
      val payload = awaitWalletBridgeResult(resultFile)
      BridgeResponse(200, payload.toString())
    } catch (err: Throwable) {
      BridgeResponse(503, errorJson("WALLET_UNAVAILABLE", err.message ?: "wallet bridge unavailable"))
    }
  }

  private suspend fun awaitWalletBridgeResult(resultFile: File): JsonObject {
    repeat(240) {
      if (resultFile.exists()) {
        val parsed = runCatching {
          json.parseToJsonElement(resultFile.readText()).asObjectOrNull()
        }.getOrNull()
        resultFile.delete()
        if (parsed != null) return parsed
        throw IllegalStateException("wallet request returned invalid JSON")
      }
      delay(500)
    }
    throw IllegalStateException("wallet request timed out")
  }

  private fun invokeResultToBridgeResponse(result: ai.openclaw.app.gateway.GatewaySession.InvokeResult): BridgeResponse {
    return if (result.ok) {
      BridgeResponse(200, result.payloadJson ?: """{"ok":true}""")
    } else {
      BridgeResponse(
        503,
        errorJson(
          result.error?.code ?: "UNAVAILABLE",
          result.error?.message ?: "bridge request failed",
        ),
      )
    }
  }

  private fun errorJson(code: String, message: String): String {
    return buildJsonObject {
      put("error", JsonPrimitive(code))
      put("message", JsonPrimitive(message))
      put("siteUrl", JsonPrimitive(nanoSolanaHubUrl))
      put("skillsUrl", JsonPrimitive(nanoSolanaSkillsUrl))
    }.toString()
  }

  private fun ServerSocket.closeQuietly() {
    runCatching { close() }
  }
}
