package ai.openclaw.app.gateway

import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetSocketAddress
import java.net.Socket
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

data class GatewayClientInfo(
  val id: String,
  val displayName: String?,
  val version: String,
  val platform: String,
  val mode: String,
  val instanceId: String?,
  val deviceFamily: String?,
  val modelIdentifier: String?,
)

data class GatewayConnectOptions(
  val role: String,
  val scopes: List<String>,
  val caps: List<String>,
  val commands: List<String>,
  val permissions: Map<String, Boolean>,
  val client: GatewayClientInfo,
  val userAgent: String? = null,
)

class GatewaySession(
  private val scope: CoroutineScope,
  private val identityStore: DeviceIdentityStore,
  private val deviceAuthStore: DeviceAuthTokenStore,
  private val onConnected: (serverName: String?, remoteAddress: String?, mainSessionKey: String?) -> Unit,
  private val onDisconnected: (message: String) -> Unit,
  private val onEvent: (event: String, payloadJson: String?) -> Unit,
  private val onInvoke: (suspend (InvokeRequest) -> InvokeResult)? = null,
  private val onInvokeDelivery: ((InvokeDeliveryUpdate) -> Unit)? = null,
  private val onTlsFingerprint: ((stableId: String, fingerprint: String) -> Unit)? = null,
) {
  private companion object {
    // Keep connect timeout above observed gateway unauthorized close on lower-end devices.
    private const val CONNECT_RPC_TIMEOUT_MS = 12_000L
  }

  data class InvokeRequest(
    val id: String,
    val nodeId: String,
    val command: String,
    val paramsJson: String?,
    val timeoutMs: Long?,
  )

  data class InvokeResult(val ok: Boolean, val payloadJson: String?, val error: ErrorShape?) {
    companion object {
      fun ok(payloadJson: String?) = InvokeResult(ok = true, payloadJson = payloadJson, error = null)
      fun error(code: String, message: String) =
        InvokeResult(ok = false, payloadJson = null, error = ErrorShape(code = code, message = message))
    }
  }

  data class ErrorShape(val code: String, val message: String)

  data class RequestResult(val ok: Boolean, val payloadJson: String?, val error: ErrorShape?)

  enum class InvokeDeliveryStage {
    Queued,
    Sent,
    Ack,
    Failed,
  }

  data class InvokeDeliveryUpdate(
    val id: String,
    val nodeId: String,
    val command: String,
    val stage: InvokeDeliveryStage,
    val transport: String,
    val ok: Boolean? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null,
    val timeoutMs: Long? = null,
    val elapsedMs: Long? = null,
    val updatedAtMs: Long = System.currentTimeMillis(),
  )

  private val json = Json { ignoreUnknownKeys = true }
  private val writeLock = Mutex()
  private val pending = ConcurrentHashMap<String, CompletableDeferred<RpcResponse>>()

  @Volatile private var canvasHostUrl: String? = null
  @Volatile private var mainSessionKey: String? = null

  private data class DesiredConnection(
    val endpoint: GatewayEndpoint,
    val token: String?,
    val password: String?,
    val options: GatewayConnectOptions,
    val tls: GatewayTlsParams?,
  )

  private var desired: DesiredConnection? = null
  private var job: Job? = null
  @Volatile private var currentConnection: SessionConnection? = null

  fun connect(
    endpoint: GatewayEndpoint,
    token: String?,
    password: String?,
    options: GatewayConnectOptions,
    tls: GatewayTlsParams? = null,
  ) {
    desired = DesiredConnection(endpoint, token, password, options, tls)
    if (job == null) {
      job = scope.launch(Dispatchers.IO) { runLoop() }
    }
  }

  fun disconnect() {
    desired = null
    currentConnection?.closeQuietly()
    scope.launch(Dispatchers.IO) {
      job?.cancelAndJoin()
      job = null
      canvasHostUrl = null
      mainSessionKey = null
      onDisconnected("Offline")
    }
  }

  fun reconnect() {
    currentConnection?.closeQuietly()
  }

  fun currentCanvasHostUrl(): String? = canvasHostUrl
  fun currentMainSessionKey(): String? = mainSessionKey

  suspend fun sendNodeEvent(event: String, payloadJson: String?): Boolean {
    val conn = currentConnection ?: return false
    return conn.sendNodeEvent(event, payloadJson)
  }

  suspend fun requestDetailed(method: String, paramsJson: String?, timeoutMs: Long = 15_000): RequestResult {
    val conn = currentConnection ?: throw IllegalStateException("not connected")
    val params =
      if (paramsJson.isNullOrBlank()) {
        null
      } else {
        json.parseToJsonElement(paramsJson)
      }
    val res = conn.request(method, params, timeoutMs)
    return RequestResult(ok = res.ok, payloadJson = res.payloadJson, error = res.error)
  }

  suspend fun request(method: String, paramsJson: String?, timeoutMs: Long = 15_000): String {
    val res = requestDetailed(method, paramsJson, timeoutMs)
    if (res.ok) return res.payloadJson ?: ""
    val err = res.error
    throw IllegalStateException("${err?.code ?: "UNAVAILABLE"}: ${err?.message ?: "request failed"}")
  }

  suspend fun refreshNodeCanvasCapability(timeoutMs: Long = 8_000): Boolean {
    val conn = currentConnection ?: return false
    val response =
      try {
        conn.request(
          "node.canvas.capability.refresh",
          params = buildJsonObject {},
          timeoutMs = timeoutMs,
        )
      } catch (err: Throwable) {
        Log.w("OpenClawGateway", "node.canvas.capability.refresh failed: ${err.message ?: err::class.java.simpleName}")
        return false
      }
    if (!response.ok) {
      val err = response.error
      Log.w(
        "OpenClawGateway",
        "node.canvas.capability.refresh rejected: ${err?.code ?: "UNAVAILABLE"}: ${err?.message ?: "request failed"}",
      )
      return false
    }
    val payloadObj = response.payloadJson?.let(::parseJsonOrNull)?.asObjectOrNull()
    val refreshedCapability = payloadObj?.get("canvasCapability").asStringOrNull()?.trim().orEmpty()
    if (refreshedCapability.isEmpty()) {
      Log.w("OpenClawGateway", "node.canvas.capability.refresh missing canvasCapability")
      return false
    }
    val scopedCanvasHostUrl = canvasHostUrl?.trim().orEmpty()
    if (scopedCanvasHostUrl.isEmpty()) {
      Log.w("OpenClawGateway", "node.canvas.capability.refresh missing local canvasHostUrl")
      return false
    }
    val refreshedUrl = replaceCanvasCapabilityInScopedHostUrl(scopedCanvasHostUrl, refreshedCapability)
    if (refreshedUrl == null) {
      Log.w("OpenClawGateway", "node.canvas.capability.refresh unable to rewrite scoped canvas URL")
      return false
    }
    canvasHostUrl = refreshedUrl
    return true
  }

  private data class RpcResponse(val id: String, val ok: Boolean, val payloadJson: String?, val error: ErrorShape?)

  private data class InvokeAckResult(
    val ok: Boolean,
    val error: ErrorShape? = null,
  )

  private interface SessionConnection {
    suspend fun connect()
    suspend fun request(method: String, params: JsonElement?, timeoutMs: Long): RpcResponse
    suspend fun sendNodeEvent(event: String, payloadJson: String?): Boolean
    suspend fun awaitClose()
    fun closeQuietly()
  }

  private inner class WebSocketConnection(
    private val endpoint: GatewayEndpoint,
    private val token: String?,
    private val password: String?,
    private val options: GatewayConnectOptions,
    private val tls: GatewayTlsParams?,
  ) : SessionConnection {
    private val connectDeferred = CompletableDeferred<Unit>()
    private val closedDeferred = CompletableDeferred<Unit>()
    private val isClosed = AtomicBoolean(false)
    private val connectNonceDeferred = CompletableDeferred<String>()
    private val client: OkHttpClient = buildClient()
    private var socket: WebSocket? = null
    private val loggerTag = "OpenClawGateway"

    val remoteAddress: String =
      if (endpoint.host.contains(":")) {
        "[${endpoint.host}]:${endpoint.port}"
      } else {
        "${endpoint.host}:${endpoint.port}"
      }

    override suspend fun connect() {
      val scheme = if (tls != null) "wss" else "ws"
      val url = "$scheme://${endpoint.host}:${endpoint.port}"
      Log.i(loggerTag, "connect:start url=$url role=${options.role} tls=${tls != null} stableId=${endpoint.stableId}")
      val request = Request.Builder().url(url).build()
      socket = client.newWebSocket(request, Listener())
      try {
        connectDeferred.await()
      } catch (err: Throwable) {
        Log.w(loggerTag, "connect:failed url=$url role=${options.role} message=${err.message ?: err::class.java.simpleName}")
        throw err
      }
    }

    override suspend fun request(method: String, params: JsonElement?, timeoutMs: Long): RpcResponse {
      val id = UUID.randomUUID().toString()
      val deferred = CompletableDeferred<RpcResponse>()
      pending[id] = deferred
      val frame =
        buildJsonObject {
          put("type", JsonPrimitive("req"))
          put("id", JsonPrimitive(id))
          put("method", JsonPrimitive(method))
          if (params != null) put("params", params)
        }
      sendJson(frame)
      return try {
        withTimeout(timeoutMs) { deferred.await() }
      } catch (err: TimeoutCancellationException) {
        pending.remove(id)
        throw IllegalStateException("request timeout")
      }
    }

    suspend fun sendJson(obj: JsonObject) {
      val jsonString = obj.toString()
      writeLock.withLock {
        socket?.send(jsonString)
      }
    }

    override suspend fun awaitClose() = closedDeferred.await()

    override fun closeQuietly() {
      if (isClosed.compareAndSet(false, true)) {
        socket?.close(1000, "bye")
        socket = null
        closedDeferred.complete(Unit)
      }
    }

    override suspend fun sendNodeEvent(event: String, payloadJson: String?): Boolean {
      val parsedPayload = payloadJson?.let { parseJsonOrNull(it) }
      val params =
        buildJsonObject {
          put("event", JsonPrimitive(event))
          if (parsedPayload != null) {
            put("payload", parsedPayload)
          } else if (payloadJson != null) {
            put("payloadJSON", JsonPrimitive(payloadJson))
          } else {
            put("payloadJSON", JsonNull)
          }
        }
      return try {
        request("node.event", params, timeoutMs = 8_000)
        true
      } catch (err: Throwable) {
        Log.w("OpenClawGateway", "node.event failed: ${err.message ?: err::class.java.simpleName}")
        false
      }
    }

    private fun buildClient(): OkHttpClient {
      val builder = OkHttpClient.Builder()
        .writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(0, java.util.concurrent.TimeUnit.SECONDS)
        .pingInterval(30, java.util.concurrent.TimeUnit.SECONDS)
      val tlsConfig = buildGatewayTlsConfig(tls) { fingerprint ->
        onTlsFingerprint?.invoke(tls?.stableId ?: endpoint.stableId, fingerprint)
      }
      if (tlsConfig != null) {
        builder.sslSocketFactory(tlsConfig.sslSocketFactory, tlsConfig.trustManager)
        builder.hostnameVerifier(tlsConfig.hostnameVerifier)
      }
      return builder.build()
    }

    private inner class Listener : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        Log.i(loggerTag, "socket:open remote=$remoteAddress role=${options.role}")
        scope.launch {
          try {
            val nonce = awaitConnectNonce()
            sendConnect(nonce)
          } catch (err: Throwable) {
            connectDeferred.completeExceptionally(err)
            closeQuietly()
          }
        }
      }

      override fun onMessage(webSocket: WebSocket, text: String) {
        scope.launch { handleMessage(text) }
      }

      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        Log.e(
          loggerTag,
          "socket:failure remote=$remoteAddress role=${options.role} code=${response?.code} message=${t.message ?: t::class.java.simpleName}",
          t,
        )
        if (!connectDeferred.isCompleted) {
          connectDeferred.completeExceptionally(t)
        }
        if (isClosed.compareAndSet(false, true)) {
          failPending()
          closedDeferred.complete(Unit)
          onDisconnected("Gateway error: ${t.message ?: t::class.java.simpleName}")
        }
      }

      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        Log.w(loggerTag, "socket:closed remote=$remoteAddress role=${options.role} code=$code reason=$reason")
        if (!connectDeferred.isCompleted) {
          connectDeferred.completeExceptionally(IllegalStateException("Gateway closed: $reason"))
        }
        if (isClosed.compareAndSet(false, true)) {
          failPending()
          closedDeferred.complete(Unit)
          onDisconnected("Gateway closed: $reason")
        }
      }
    }

    private suspend fun sendConnect(connectNonce: String) {
      val identity = identityStore.loadOrCreate()
      val storedToken = deviceAuthStore.loadToken(identity.deviceId, options.role)
      val trimmedToken = token?.trim().orEmpty()
      // QR/setup/manual shared token must take precedence; stale role tokens can survive re-onboarding.
      val authToken = if (trimmedToken.isNotBlank()) trimmedToken else storedToken.orEmpty()
      val authMode =
        when {
          authToken.isNotEmpty() -> "token"
          !password.isNullOrBlank() -> "password"
          else -> "device"
        }
      Log.i(
        loggerTag,
        "connect:auth role=${options.role} mode=$authMode deviceId=${identity.deviceId} storedToken=${storedToken?.isNotBlank() == true} setupToken=${trimmedToken.isNotBlank()}",
      )
      val payload = buildConnectParams(identity, connectNonce, authToken, password?.trim())
      val res = request("connect", payload, timeoutMs = CONNECT_RPC_TIMEOUT_MS)
      if (!res.ok) {
        val msg = res.error?.message ?: "connect failed"
        Log.w(loggerTag, "connect:rejected role=${options.role} message=$msg")
        throw IllegalStateException(msg)
      }
      handleConnectSuccess(res, identity.deviceId)
      connectDeferred.complete(Unit)
    }

    private fun handleConnectSuccess(res: RpcResponse, deviceId: String) {
      val payloadJson = res.payloadJson ?: throw IllegalStateException("connect failed: missing payload")
      val obj = json.parseToJsonElement(payloadJson).asObjectOrNull() ?: throw IllegalStateException("connect failed")
      val serverName = obj["server"].asObjectOrNull()?.get("host").asStringOrNull()
      val authObj = obj["auth"].asObjectOrNull()
      val deviceToken = authObj?.get("deviceToken").asStringOrNull()
      val authRole = authObj?.get("role").asStringOrNull() ?: options.role
      if (!deviceToken.isNullOrBlank()) {
        deviceAuthStore.saveToken(deviceId, authRole, deviceToken)
      }
      val rawCanvas = obj["canvasHostUrl"].asStringOrNull()
      canvasHostUrl = normalizeCanvasHostUrl(rawCanvas, endpoint, isTlsConnection = tls != null)
      val sessionDefaults =
        obj["snapshot"].asObjectOrNull()
          ?.get("sessionDefaults").asObjectOrNull()
      mainSessionKey = sessionDefaults?.get("mainSessionKey").asStringOrNull()
      Log.i(
        loggerTag,
        "connect:success role=${options.role} server=${serverName ?: "-"} remote=$remoteAddress authRole=$authRole canvas=${!canvasHostUrl.isNullOrBlank()} mainSession=${mainSessionKey ?: "-"}",
      )
      onConnected(serverName, remoteAddress, mainSessionKey)
    }

    private fun buildConnectParams(
      identity: DeviceIdentity,
      connectNonce: String,
      authToken: String,
      authPassword: String?,
    ): JsonObject {
      val client = options.client
      val locale = Locale.getDefault().toLanguageTag()
      val clientObj =
        buildJsonObject {
          put("id", JsonPrimitive(client.id))
          client.displayName?.let { put("displayName", JsonPrimitive(it)) }
          put("version", JsonPrimitive(client.version))
          put("platform", JsonPrimitive(client.platform))
          put("mode", JsonPrimitive(client.mode))
          client.instanceId?.let { put("instanceId", JsonPrimitive(it)) }
          client.deviceFamily?.let { put("deviceFamily", JsonPrimitive(it)) }
          client.modelIdentifier?.let { put("modelIdentifier", JsonPrimitive(it)) }
        }

      val password = authPassword?.trim().orEmpty()
      val authJson =
        when {
          authToken.isNotEmpty() ->
            buildJsonObject {
              put("token", JsonPrimitive(authToken))
            }
          password.isNotEmpty() ->
            buildJsonObject {
              put("password", JsonPrimitive(password))
            }
          else -> null
        }

      val signedAtMs = System.currentTimeMillis()
      val payload =
        DeviceAuthPayload.buildV3(
          deviceId = identity.deviceId,
          clientId = client.id,
          clientMode = client.mode,
          role = options.role,
          scopes = options.scopes,
          signedAtMs = signedAtMs,
          token = if (authToken.isNotEmpty()) authToken else null,
          nonce = connectNonce,
          platform = client.platform,
          deviceFamily = client.deviceFamily,
        )
      val signature = identityStore.signPayload(payload, identity)
      val publicKey = identityStore.publicKeyBase64Url(identity)
      val deviceJson =
        if (!signature.isNullOrBlank() && !publicKey.isNullOrBlank()) {
          buildJsonObject {
            put("id", JsonPrimitive(identity.deviceId))
            put("publicKey", JsonPrimitive(publicKey))
            put("signature", JsonPrimitive(signature))
            put("signedAt", JsonPrimitive(signedAtMs))
            put("nonce", JsonPrimitive(connectNonce))
          }
        } else {
          null
        }

      return buildJsonObject {
        put("minProtocol", JsonPrimitive(GATEWAY_PROTOCOL_VERSION))
        put("maxProtocol", JsonPrimitive(GATEWAY_PROTOCOL_VERSION))
        put("client", clientObj)
        if (options.caps.isNotEmpty()) put("caps", JsonArray(options.caps.map(::JsonPrimitive)))
        if (options.commands.isNotEmpty()) put("commands", JsonArray(options.commands.map(::JsonPrimitive)))
        if (options.permissions.isNotEmpty()) {
          put(
            "permissions",
            buildJsonObject {
              options.permissions.forEach { (key, value) ->
                put(key, JsonPrimitive(value))
              }
            },
          )
        }
        put("role", JsonPrimitive(options.role))
        if (options.scopes.isNotEmpty()) put("scopes", JsonArray(options.scopes.map(::JsonPrimitive)))
        authJson?.let { put("auth", it) }
        deviceJson?.let { put("device", it) }
        put("locale", JsonPrimitive(locale))
        options.userAgent?.trim()?.takeIf { it.isNotEmpty() }?.let {
          put("userAgent", JsonPrimitive(it))
        }
      }
    }

    private suspend fun handleMessage(text: String) {
      val frame = json.parseToJsonElement(text).asObjectOrNull() ?: return
      when (frame["type"].asStringOrNull()) {
        "res" -> handleResponse(frame)
        "event" -> handleEvent(frame)
      }
    }

    private fun handleResponse(frame: JsonObject) {
      val id = frame["id"].asStringOrNull() ?: return
      val ok = frame["ok"].asBooleanOrNull() ?: false
      val payloadJson = frame["payload"]?.let { payload -> payload.toString() }
      val error =
        frame["error"]?.asObjectOrNull()?.let { obj ->
          val code = obj["code"].asStringOrNull() ?: "UNAVAILABLE"
          val msg = obj["message"].asStringOrNull() ?: "request failed"
          ErrorShape(code, msg)
        }
      pending.remove(id)?.complete(RpcResponse(id, ok, payloadJson, error))
    }

    private fun handleEvent(frame: JsonObject) {
      val event = frame["event"].asStringOrNull() ?: return
      val payloadJson =
        frame["payload"]?.let { it.toString() } ?: frame["payloadJSON"].asStringOrNull()
      if (event == "connect.challenge") {
        val nonce = extractConnectNonce(payloadJson)
        if (!connectNonceDeferred.isCompleted && !nonce.isNullOrBlank()) {
          Log.i(loggerTag, "connect:challenge role=${options.role} nonce=${nonce.take(12)}")
          connectNonceDeferred.complete(nonce.trim())
        }
        return
      }
      if (event == "node.invoke.request" && payloadJson != null && onInvoke != null) {
        handleInvokeEvent(payloadJson)
        return
      }
      onEvent(event, payloadJson)
    }

    private suspend fun awaitConnectNonce(): String {
      return try {
        withTimeout(2_000) { connectNonceDeferred.await() }
      } catch (err: Throwable) {
        Log.w(loggerTag, "connect:challenge-timeout role=${options.role}")
        throw IllegalStateException("connect challenge timeout", err)
      }
    }

    private fun extractConnectNonce(payloadJson: String?): String? {
      if (payloadJson.isNullOrBlank()) return null
      val obj = parseJsonOrNull(payloadJson)?.asObjectOrNull() ?: return null
      return obj["nonce"].asStringOrNull()
    }

    private fun handleInvokeEvent(payloadJson: String) {
      val payload =
        try {
          json.parseToJsonElement(payloadJson).asObjectOrNull()
        } catch (_: Throwable) {
          null
        } ?: return
      val id = payload["id"].asStringOrNull() ?: return
      val nodeId = payload["nodeId"].asStringOrNull() ?: return
      val command = payload["command"].asStringOrNull() ?: return
      val params =
        payload["paramsJSON"].asStringOrNull()
          ?: payload["params"]?.let { value -> if (value is JsonNull) null else value.toString() }
      val timeoutMs = payload["timeoutMs"].asLongOrNull()
      emitInvokeDelivery(
        id = id,
        nodeId = nodeId,
        command = command,
        stage = InvokeDeliveryStage.Queued,
        timeoutMs = timeoutMs,
      )
      scope.launch {
        val startedAt = System.nanoTime()
        val result =
          try {
            onInvoke?.invoke(InvokeRequest(id, nodeId, command, params, timeoutMs))
              ?: InvokeResult.error("UNAVAILABLE", "invoke handler missing")
          } catch (err: Throwable) {
            invokeErrorFromThrowable(err)
          }
        emitInvokeDelivery(
          id = id,
          nodeId = nodeId,
          command = command,
          stage = InvokeDeliveryStage.Sent,
          ok = result.ok,
          errorCode = result.error?.code,
          errorMessage = result.error?.message,
          timeoutMs = timeoutMs,
          elapsedMs = elapsedSince(startedAt),
        )
        val ack = sendInvokeResult(id, nodeId, result, timeoutMs)
        val finalStage = if (ack.ok) InvokeDeliveryStage.Ack else InvokeDeliveryStage.Failed
        emitInvokeDelivery(
          id = id,
          nodeId = nodeId,
          command = command,
          stage = finalStage,
          ok = result.ok,
          errorCode = ack.error?.code ?: result.error?.code,
          errorMessage = ack.error?.message ?: result.error?.message,
          timeoutMs = timeoutMs,
          elapsedMs = elapsedSince(startedAt),
        )
      }
    }

    private suspend fun sendInvokeResult(
      id: String,
      nodeId: String,
      result: InvokeResult,
      invokeTimeoutMs: Long?,
    ): InvokeAckResult {
      val parsedPayload = result.payloadJson?.let { parseJsonOrNull(it) }
      val params =
        buildJsonObject {
          put("id", JsonPrimitive(id))
          put("nodeId", JsonPrimitive(nodeId))
          put("ok", JsonPrimitive(result.ok))
          if (parsedPayload != null) {
            put("payload", parsedPayload)
          } else if (result.payloadJson != null) {
            put("payloadJSON", JsonPrimitive(result.payloadJson))
          }
          result.error?.let { err ->
            put(
              "error",
              buildJsonObject {
                put("code", JsonPrimitive(err.code))
                put("message", JsonPrimitive(err.message))
              },
            )
          }
        }
      val ackTimeoutMs = resolveInvokeResultAckTimeoutMs(invokeTimeoutMs)
      try {
        val ack = requestDetailed("node.invoke.result", params.toString(), timeoutMs = ackTimeoutMs)
        return InvokeAckResult(ok = ack.ok, error = ack.error)
      } catch (err: Throwable) {
        val parsed = parseInvokeErrorFromThrowable(err, fallbackMessage = err::class.java.simpleName)
        Log.w(loggerTag, "node.invoke.result failed (ackTimeoutMs=$ackTimeoutMs): ${parsed.code}: ${parsed.message}")
        return InvokeAckResult(ok = false, error = ErrorShape(parsed.code, parsed.message))
      }
    }

    private fun invokeErrorFromThrowable(err: Throwable): InvokeResult {
      val parsed = parseInvokeErrorFromThrowable(err, fallbackMessage = err::class.java.simpleName)
      return InvokeResult.error(code = parsed.code, message = parsed.message)
    }

    private fun failPending() {
      for ((_, waiter) in pending) {
        waiter.cancel()
      }
      pending.clear()
    }

    private fun emitInvokeDelivery(
      id: String,
      nodeId: String,
      command: String,
      stage: InvokeDeliveryStage,
      ok: Boolean? = null,
      errorCode: String? = null,
      errorMessage: String? = null,
      timeoutMs: Long? = null,
      elapsedMs: Long? = null,
    ) {
      onInvokeDelivery?.invoke(
        InvokeDeliveryUpdate(
          id = id,
          nodeId = nodeId,
          command = command,
          stage = stage,
          transport = "WebSocketRpc",
          ok = ok,
          errorCode = errorCode,
          errorMessage = errorMessage,
          timeoutMs = timeoutMs,
          elapsedMs = elapsedMs,
        ),
      )
    }
  }

  private inner class NativeBridgeConnection(
    private val endpoint: GatewayEndpoint,
    private val token: String?,
    private val password: String?,
    private val options: GatewayConnectOptions,
  ) : SessionConnection {
    private val loggerTag = "OpenClawGateway"
    private val socket = Socket()
    private val closedDeferred = CompletableDeferred<Unit>()
    private val pairDeferred = CompletableDeferred<String>()
    private val helloDeferred = CompletableDeferred<String?>()
    private val isClosed = AtomicBoolean(false)

    private val remoteAddress: String =
      if (endpoint.host.contains(":")) {
        "[${endpoint.host}]:${endpoint.port}"
      } else {
        "${endpoint.host}:${endpoint.port}"
      }

    override suspend fun connect() {
      if (password?.trim().isNullOrEmpty().not()) {
        Log.w(loggerTag, "native bridge ignores password auth; pairing/token flow will be used instead")
      }
      Log.i(
        loggerTag,
        "connect:start url=tcp://${endpoint.host}:${endpoint.port} role=${options.role} native=true stableId=${endpoint.stableId}",
      )
      try {
        withContext(Dispatchers.IO) {
          socket.connect(InetSocketAddress(endpoint.host, endpoint.port), 10_000)
          socket.tcpNoDelay = true
          socket.keepAlive = true
        }
      } catch (err: Throwable) {
        Log.w(
          loggerTag,
          "connect:failed url=tcp://${endpoint.host}:${endpoint.port} role=${options.role} message=${err.message ?: err::class.java.simpleName}",
        )
        throw err
      }

      scope.launch(Dispatchers.IO) { readLoop() }

      val identity = identityStore.loadOrCreate()
      val nativeNodeId = buildNativeNodeId(identity)
      val nativeDisplayName = buildNativeDisplayName()

      var authToken = token?.trim().orEmpty()
      if (authToken.isEmpty()) {
        authToken = deviceAuthStore.loadToken(identity.deviceId, options.role).orEmpty()
      }

      if (authToken.isEmpty()) {
        sendRawFrame(buildPairRequestFrame(nativeNodeId, nativeDisplayName))
        authToken =
          try {
            withTimeout(6 * 60_000L) { pairDeferred.await() }
          } catch (err: Throwable) {
            closeQuietly()
            throw IllegalStateException("pairing timeout", err)
          }
        deviceAuthStore.saveToken(identity.deviceId, options.role, authToken)
      }

      sendRawFrame(buildHelloFrame(nativeNodeId, nativeDisplayName, authToken))
      val serverName =
        try {
          withTimeout(30_000L) { helloDeferred.await() }
        } catch (err: Throwable) {
          closeQuietly()
          throw IllegalStateException("hello timeout", err)
        }

      mainSessionKey = "main"
      Log.i(
        loggerTag,
        "connect:success role=${options.role} server=${serverName ?: "-"} remote=$remoteAddress native=true",
      )
      onConnected(serverName, remoteAddress, mainSessionKey)
    }

    override suspend fun request(method: String, params: JsonElement?, timeoutMs: Long): RpcResponse {
      return when (method) {
        "node.event" -> {
          val obj = params?.asObjectOrNull()
          val event = obj?.get("event").asStringOrNull()
          val payloadJson =
            obj?.get("payloadJSON").asStringOrNull()
              ?: obj?.get("payload")?.takeUnless { it is JsonNull }?.toString()
          val ok = if (!event.isNullOrBlank()) sendNodeEvent(event, payloadJson) else false
          RpcResponse(
            id = UUID.randomUUID().toString(),
            ok = ok,
            payloadJson = if (ok) "{}" else null,
            error = if (ok) null else ErrorShape("UNAVAILABLE", "native bridge event send failed"),
          )
        }
        else ->
          throw IllegalStateException(
            "Native SolanaOS bridge does not support RPC method `$method`",
          )
      }
    }

    override suspend fun sendNodeEvent(event: String, payloadJson: String?): Boolean {
      if (event.isBlank()) return false
      return try {
        sendRawFrame(
          buildJsonObject {
            put("type", JsonPrimitive("event"))
            put("event", JsonPrimitive(event))
            if (payloadJson != null) {
              put("payloadJSON", JsonPrimitive(payloadJson))
            }
          },
        )
        true
      } catch (err: Throwable) {
        Log.w(loggerTag, "node.event failed: ${err.message ?: err::class.java.simpleName}")
        false
      }
    }

    override suspend fun awaitClose() = closedDeferred.await()

    override fun closeQuietly() {
      if (isClosed.compareAndSet(false, true)) {
        runCatching { socket.close() }
        closedDeferred.complete(Unit)
      }
    }

    private suspend fun readLoop() {
      try {
        val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
        while (true) {
          val line = withContext(Dispatchers.IO) { reader.readLine() } ?: break
          if (line.isBlank()) continue
          handleNativeFrame(line)
        }
        if (!isClosed.get()) {
          onDisconnected("Gateway closed")
          closeQuietly()
        }
      } catch (err: Throwable) {
        if (!isClosed.get()) {
          Log.e(
            loggerTag,
            "socket:failure remote=$remoteAddress role=${options.role} code=null message=${err.message ?: err::class.java.simpleName}",
            err,
          )
          onDisconnected("Gateway error: ${err.message ?: err::class.java.simpleName}")
          closeQuietly()
        }
      }
    }

    private suspend fun handleNativeFrame(line: String) {
      val frame = parseJsonOrNull(line)?.asObjectOrNull() ?: return
      when (frame["type"].asStringOrNull()) {
        "pair-ok" -> {
          val issuedToken = frame["token"].asStringOrNull()
          if (!pairDeferred.isCompleted && !issuedToken.isNullOrBlank()) {
            pairDeferred.complete(issuedToken)
          }
        }
        "hello-ok" -> {
          val serverName = frame["serverName"].asStringOrNull()
          if (!helloDeferred.isCompleted) {
            helloDeferred.complete(serverName)
          }
        }
        "ping" -> {
          val pingId = frame["id"].asStringOrNull()
          sendRawFrame(
            buildJsonObject {
              put("type", JsonPrimitive("pong"))
              pingId?.let { put("id", JsonPrimitive(it)) }
            },
          )
        }
        "event" -> {
          val event = frame["event"].asStringOrNull() ?: return
          val payloadJson =
            frame["payloadJSON"].asStringOrNull()
              ?: frame["payload"]?.takeUnless { it is JsonNull }?.toString()
          onEvent(event, payloadJson)
        }
        "invoke" -> {
          handleNativeInvoke(frame)
        }
        "req" -> {
          val requestId = frame["id"].asStringOrNull() ?: return
          sendRawFrame(
            buildJsonObject {
              put("type", JsonPrimitive("res"))
              put("id", JsonPrimitive(requestId))
              put("ok", JsonPrimitive(false))
              put(
                "error",
                buildJsonObject {
                  put("code", JsonPrimitive("UNAVAILABLE"))
                  put("message", JsonPrimitive("native bridge has no RPC client"))
                },
              )
            },
          )
        }
        "error" -> {
          val message = frame["message"].asStringOrNull() ?: "bridge error"
          if (!pairDeferred.isCompleted) {
            pairDeferred.completeExceptionally(IllegalStateException(message))
          }
          if (!helloDeferred.isCompleted) {
            helloDeferred.completeExceptionally(IllegalStateException(message))
          }
          throw IllegalStateException(message)
        }
      }
    }

    private suspend fun handleNativeInvoke(frame: JsonObject) {
      val id = frame["id"].asStringOrNull() ?: return
      val nodeId = frame["nodeId"].asStringOrNull() ?: buildNativeNodeId(identityStore.loadOrCreate())
      val command = frame["command"].asStringOrNull() ?: return
      val paramsJson =
        frame["paramsJSON"].asStringOrNull()
          ?: frame["params"]?.takeUnless { it is JsonNull }?.toString()
      val timeoutMs = frame["timeoutMs"].asLongOrNull()
      emitNativeInvokeDelivery(
        id = id,
        nodeId = nodeId,
        command = command,
        stage = InvokeDeliveryStage.Queued,
        timeoutMs = timeoutMs,
      )
      val startedAt = System.nanoTime()
      val result =
        try {
          onInvoke?.invoke(InvokeRequest(id, nodeId, command, paramsJson, timeoutMs))
            ?: InvokeResult.error("UNAVAILABLE", "invoke handler missing")
        } catch (err: Throwable) {
          nativeInvokeErrorFromThrowable(err)
        }
      emitNativeInvokeDelivery(
        id = id,
        nodeId = nodeId,
        command = command,
        stage = InvokeDeliveryStage.Sent,
        ok = result.ok,
        errorCode = result.error?.code,
        errorMessage = result.error?.message,
        timeoutMs = timeoutMs,
        elapsedMs = elapsedSince(startedAt),
      )
      try {
        sendRawFrame(
          buildJsonObject {
            put("type", JsonPrimitive("invoke-res"))
            put("id", JsonPrimitive(id))
            put("ok", JsonPrimitive(result.ok))
            result.payloadJson?.let { payload ->
              val parsedPayload = parseJsonOrNull(payload)
              if (parsedPayload != null) {
                put("payload", parsedPayload)
              } else {
                put("payloadJSON", JsonPrimitive(payload))
              }
            }
            result.error?.let { error ->
              put(
                "error",
                buildJsonObject {
                  put("code", JsonPrimitive(error.code))
                  put("message", JsonPrimitive(error.message))
                },
              )
            }
          },
        )
        emitNativeInvokeDelivery(
          id = id,
          nodeId = nodeId,
          command = command,
          stage = InvokeDeliveryStage.Ack,
          ok = result.ok,
          errorCode = result.error?.code,
          errorMessage = result.error?.message,
          timeoutMs = timeoutMs,
          elapsedMs = elapsedSince(startedAt),
        )
      } catch (err: Throwable) {
        val parsed = parseInvokeErrorFromThrowable(err, fallbackMessage = err::class.java.simpleName)
        emitNativeInvokeDelivery(
          id = id,
          nodeId = nodeId,
          command = command,
          stage = InvokeDeliveryStage.Failed,
          ok = result.ok,
          errorCode = parsed.code,
          errorMessage = parsed.message,
          timeoutMs = timeoutMs,
          elapsedMs = elapsedSince(startedAt),
        )
        throw err
      }
    }

    private fun buildPairRequestFrame(nodeId: String, displayName: String): JsonObject {
      return buildJsonObject {
        put("type", JsonPrimitive("pair-request"))
        put("nodeId", JsonPrimitive(nodeId))
        put("displayName", JsonPrimitive(displayName))
        put("platform", JsonPrimitive(options.client.platform))
        put("version", JsonPrimitive(options.client.version))
        options.client.deviceFamily?.let { put("deviceFamily", JsonPrimitive(it)) }
        options.client.modelIdentifier?.let { put("modelIdentifier", JsonPrimitive(it)) }
        if (options.caps.isNotEmpty()) put("caps", JsonArray(options.caps.map(::JsonPrimitive)))
        if (options.commands.isNotEmpty()) put("commands", JsonArray(options.commands.map(::JsonPrimitive)))
        if (options.permissions.isNotEmpty()) {
          put(
            "permissions",
            buildJsonObject {
              options.permissions.forEach { (key, value) -> put(key, JsonPrimitive(value)) }
            },
          )
        }
      }
    }

    private fun buildHelloFrame(nodeId: String, displayName: String, authToken: String): JsonObject {
      return buildJsonObject {
        put("type", JsonPrimitive("hello"))
        put("nodeId", JsonPrimitive(nodeId))
        put("displayName", JsonPrimitive(displayName))
        put("token", JsonPrimitive(authToken))
        put("platform", JsonPrimitive(options.client.platform))
        put("version", JsonPrimitive(options.client.version))
        options.client.deviceFamily?.let { put("deviceFamily", JsonPrimitive(it)) }
        options.client.modelIdentifier?.let { put("modelIdentifier", JsonPrimitive(it)) }
        if (options.caps.isNotEmpty()) put("caps", JsonArray(options.caps.map(::JsonPrimitive)))
        if (options.commands.isNotEmpty()) put("commands", JsonArray(options.commands.map(::JsonPrimitive)))
        if (options.permissions.isNotEmpty()) {
          put(
            "permissions",
            buildJsonObject {
              options.permissions.forEach { (key, value) -> put(key, JsonPrimitive(value)) }
            },
          )
        }
      }
    }

    private suspend fun sendRawFrame(frame: JsonObject) {
      val payload = frame.toString() + "\n"
      writeLock.withLock {
        withContext(Dispatchers.IO) {
          socket.getOutputStream().write(payload.toByteArray(Charsets.UTF_8))
          socket.getOutputStream().flush()
        }
      }
    }

    private fun buildNativeNodeId(identity: DeviceIdentity): String {
      val source = options.client.instanceId?.trim().takeUnless { it.isNullOrEmpty() } ?: identity.deviceId
      val normalized = source.lowercase().replace(Regex("[^a-z0-9._-]+"), "-").trim('-')
      return "nano-android-$normalized"
    }

    private fun buildNativeDisplayName(): String {
      return options.client.displayName?.trim().takeUnless { it.isNullOrEmpty() }
        ?: options.client.modelIdentifier?.trim().takeUnless { it.isNullOrEmpty() }
        ?: "SolanaOS Android"
    }

    private fun nativeInvokeErrorFromThrowable(err: Throwable): InvokeResult {
      val parsed = parseInvokeErrorFromThrowable(err, fallbackMessage = err::class.java.simpleName)
      return InvokeResult.error(code = parsed.code, message = parsed.message)
    }

    private fun emitNativeInvokeDelivery(
      id: String,
      nodeId: String,
      command: String,
      stage: InvokeDeliveryStage,
      ok: Boolean? = null,
      errorCode: String? = null,
      errorMessage: String? = null,
      timeoutMs: Long? = null,
      elapsedMs: Long? = null,
    ) {
      onInvokeDelivery?.invoke(
        InvokeDeliveryUpdate(
          id = id,
          nodeId = nodeId,
          command = command,
          stage = stage,
          transport = "NativeJsonTcp",
          ok = ok,
          errorCode = errorCode,
          errorMessage = errorMessage,
          timeoutMs = timeoutMs,
          elapsedMs = elapsedMs,
        ),
      )
    }
  }

  private suspend fun runLoop() {
    var attempt = 0
    while (scope.isActive) {
      val target = desired
      if (target == null) {
        currentConnection?.closeQuietly()
        currentConnection = null
        delay(250)
        continue
      }

      try {
        onDisconnected(if (attempt == 0) "Connecting…" else "Reconnecting…")
        connectOnce(target)
        attempt = 0
      } catch (err: Throwable) {
        attempt += 1
        onDisconnected("Gateway error: ${err.message ?: err::class.java.simpleName}")
        val sleepMs = minOf(8_000L, (350.0 * Math.pow(1.7, attempt.toDouble())).toLong())
        delay(sleepMs)
      }
    }
  }

  private suspend fun connectOnce(target: DesiredConnection) = withContext(Dispatchers.IO) {
    val conn: SessionConnection =
      when (target.endpoint.transport) {
        GatewayTransport.NativeJsonTcp -> NativeBridgeConnection(target.endpoint, target.token, target.password, target.options)
        GatewayTransport.WebSocketRpc -> WebSocketConnection(target.endpoint, target.token, target.password, target.options, target.tls)
      }
    currentConnection = conn
    try {
      conn.connect()
      conn.awaitClose()
    } finally {
      currentConnection = null
      canvasHostUrl = null
      mainSessionKey = null
    }
  }

  private fun normalizeCanvasHostUrl(
    raw: String?,
    endpoint: GatewayEndpoint,
    isTlsConnection: Boolean,
  ): String? {
    val trimmed = raw?.trim().orEmpty()
    val parsed = trimmed.takeIf { it.isNotBlank() }?.let { runCatching { java.net.URI(it) }.getOrNull() }
    val host = parsed?.host?.trim().orEmpty()
    val port = parsed?.port ?: -1
    val scheme = parsed?.scheme?.trim().orEmpty().ifBlank { "http" }
    val suffix = buildUrlSuffix(parsed)

    // If raw URL is a non-loopback address and this connection uses TLS,
    // normalize scheme/port to the endpoint we actually connected to.
    if (trimmed.isNotBlank() && host.isNotBlank() && !isLoopbackHost(host)) {
      val needsTlsRewrite =
        isTlsConnection &&
          (
            !scheme.equals("https", ignoreCase = true) ||
              (port > 0 && port != endpoint.port) ||
              (port <= 0 && endpoint.port != 443)
            )
      if (needsTlsRewrite) {
        return buildCanvasUrl(host = host, scheme = "https", port = endpoint.port, suffix = suffix)
      }
      return trimmed
    }

    val fallbackHost =
      endpoint.tailnetDns?.trim().takeIf { !it.isNullOrEmpty() }
        ?: endpoint.lanHost?.trim().takeIf { !it.isNullOrEmpty() }
        ?: endpoint.host.trim()
    if (fallbackHost.isEmpty()) return trimmed.ifBlank { null }

    // For TLS connections, use the connected endpoint's scheme/port instead of raw canvas metadata.
    val fallbackScheme = if (isTlsConnection) "https" else scheme
    // For TLS, always use the connected endpoint port.
    val fallbackPort = if (isTlsConnection) endpoint.port else (endpoint.canvasPort ?: endpoint.port)
    return buildCanvasUrl(host = fallbackHost, scheme = fallbackScheme, port = fallbackPort, suffix = suffix)
  }

  private fun buildCanvasUrl(host: String, scheme: String, port: Int, suffix: String): String {
    val loweredScheme = scheme.lowercase()
    val formattedHost = if (host.contains(":")) "[${host}]" else host
    val portSuffix = if ((loweredScheme == "https" && port == 443) || (loweredScheme == "http" && port == 80)) "" else ":$port"
    return "$loweredScheme://$formattedHost$portSuffix$suffix"
  }

  private fun buildUrlSuffix(uri: java.net.URI?): String {
    if (uri == null) return ""
    val path = uri.rawPath?.takeIf { it.isNotBlank() } ?: ""
    val query = uri.rawQuery?.takeIf { it.isNotBlank() }?.let { "?$it" } ?: ""
    val fragment = uri.rawFragment?.takeIf { it.isNotBlank() }?.let { "#$it" } ?: ""
    return "$path$query$fragment"
  }

  private fun isLoopbackHost(raw: String?): Boolean {
    val host = raw?.trim()?.lowercase().orEmpty()
    if (host.isEmpty()) return false
    if (host == "localhost") return true
    if (host == "::1") return true
    if (host == "0.0.0.0" || host == "::") return true
    return host.startsWith("127.")
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asStringOrNull(): String? =
  when (this) {
    is JsonNull -> null
    is JsonPrimitive -> content
    else -> null
  }

private fun JsonElement?.asBooleanOrNull(): Boolean? =
  when (this) {
    is JsonPrimitive -> {
      val c = content.trim()
      when {
        c.equals("true", ignoreCase = true) -> true
        c.equals("false", ignoreCase = true) -> false
        else -> null
      }
    }
    else -> null
  }

private fun JsonElement?.asLongOrNull(): Long? =
  when (this) {
    is JsonPrimitive -> content.toLongOrNull()
    else -> null
  }

private fun parseJsonOrNull(payload: String): JsonElement? {
  val trimmed = payload.trim()
  if (trimmed.isEmpty()) return null
  return try {
    Json.parseToJsonElement(trimmed)
  } catch (_: Throwable) {
    null
  }
}

internal fun replaceCanvasCapabilityInScopedHostUrl(
  scopedUrl: String,
  capability: String,
): String? {
  val marker = "/__openclaw__/cap/"
  val markerStart = scopedUrl.indexOf(marker)
  if (markerStart < 0) return null
  val capabilityStart = markerStart + marker.length
  val slashEnd = scopedUrl.indexOf("/", capabilityStart).takeIf { it >= 0 }
  val queryEnd = scopedUrl.indexOf("?", capabilityStart).takeIf { it >= 0 }
  val fragmentEnd = scopedUrl.indexOf("#", capabilityStart).takeIf { it >= 0 }
  val capabilityEnd = listOfNotNull(slashEnd, queryEnd, fragmentEnd).minOrNull() ?: scopedUrl.length
  if (capabilityEnd <= capabilityStart) return null
  return scopedUrl.substring(0, capabilityStart) + capability + scopedUrl.substring(capabilityEnd)
}

internal fun resolveInvokeResultAckTimeoutMs(invokeTimeoutMs: Long?): Long {
  val normalized = invokeTimeoutMs?.takeIf { it > 0L } ?: 15_000L
  return normalized.coerceIn(15_000L, 120_000L)
}

private fun elapsedSince(startedAtNanos: Long): Long {
  return ((System.nanoTime() - startedAtNanos).coerceAtLeast(0L)) / 1_000_000L
}
