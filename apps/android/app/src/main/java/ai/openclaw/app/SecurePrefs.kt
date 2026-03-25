@file:Suppress("DEPRECATION")

package ai.openclaw.app

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.core.net.toUri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import ai.openclaw.app.gateway.GatewayEndpoint
import ai.openclaw.app.gateway.GatewayTransport
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.Serializable
import java.util.UUID

class SecurePrefs(context: Context) {
  companion object {
    val defaultWakeWords: List<String> = listOf("nanosolana", "seeker")
    private const val displayNameKey = "node.displayName"
    private const val locationModeKey = "location.enabledMode"
    private const val voiceWakeModeKey = "voiceWake.mode"
    private const val grokVoiceIdKey = "voice.grok.selectedVoice"
    private const val grokVadThresholdKey = "voice.grok.vadThreshold"
    private const val grokSilenceDurationMsKey = "voice.grok.silenceDurationMs"
    private const val grokSampleRateKey = "voice.grok.sampleRate"
    private const val grokWebSearchEnabledKey = "voice.grok.webSearchEnabled"
    private const val grokXSearchEnabledKey = "voice.grok.xSearchEnabled"
    private const val plainPrefsName = "openclaw.node"
    private const val securePrefsName = "openclaw.node.secure"
    private const val defaultGrokVoiceId = "Eve"
    private const val defaultGrokVadThreshold = "0.85"
    private const val defaultGrokSilenceDurationMs = "800"
    private const val defaultGrokSampleRate = "24000"
    private const val pendingConvexPairingTokenKey = "convex.pairing.pendingToken"
    private const val lastConnectedGatewayEndpointKey = "gateway.lastConnectedEndpoint"
    private const val convexSessionTokenKey = "convex.session.token"
    private const val convexSessionWalletAddressKey = "convex.session.walletAddress"
    private const val convexSessionDisplayNameKey = "convex.session.displayName"
    private const val convexSessionExpiresAtKey = "convex.session.expiresAt"
  }

  @Serializable
  private data class PersistedGatewayEndpoint(
    val stableId: String,
    val name: String,
    val host: String,
    val port: Int,
    val transport: String,
    val lanHost: String? = null,
    val tailnetDns: String? = null,
    val gatewayPort: Int? = null,
    val canvasPort: Int? = null,
    val tlsEnabled: Boolean = false,
    val tlsFingerprintSha256: String? = null,
  )

  data class PersistedConvexSession(
    val walletAddress: String,
    val displayName: String?,
    val sessionToken: String,
    val sessionExpiresAt: Long,
  )

  private val appContext = context.applicationContext
  private val json = Json { ignoreUnknownKeys = true }
  private val plainPrefs: SharedPreferences =
    appContext.getSharedPreferences(plainPrefsName, Context.MODE_PRIVATE)

  private val masterKey by lazy {
    MasterKey.Builder(appContext)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()
  }
  private val securePrefs: SharedPreferences by lazy { createSecurePrefs(appContext, securePrefsName) }

  private val _instanceId = MutableStateFlow(loadOrCreateInstanceId())
  val instanceId: StateFlow<String> = _instanceId

  private val _displayName =
    MutableStateFlow(loadOrMigrateDisplayName(context = context))
  val displayName: StateFlow<String> = _displayName

  private val _cameraEnabled = MutableStateFlow(plainPrefs.getBoolean("camera.enabled", true))
  val cameraEnabled: StateFlow<Boolean> = _cameraEnabled

  private val _locationMode = MutableStateFlow(loadLocationMode())
  val locationMode: StateFlow<LocationMode> = _locationMode

  private val _locationPreciseEnabled =
    MutableStateFlow(plainPrefs.getBoolean("location.preciseEnabled", true))
  val locationPreciseEnabled: StateFlow<Boolean> = _locationPreciseEnabled

  private val _preventSleep = MutableStateFlow(plainPrefs.getBoolean("screen.preventSleep", true))
  val preventSleep: StateFlow<Boolean> = _preventSleep

  private val _autoStartOnBoot =
    MutableStateFlow(plainPrefs.getBoolean("service.autoStartOnBoot", true))
  val autoStartOnBoot: StateFlow<Boolean> = _autoStartOnBoot

  private val _manualEnabled =
    MutableStateFlow(plainPrefs.getBoolean("gateway.manual.enabled", false))
  val manualEnabled: StateFlow<Boolean> = _manualEnabled

  private val _manualHost =
    MutableStateFlow(plainPrefs.getString("gateway.manual.host", "") ?: "")
  val manualHost: StateFlow<String> = _manualHost

  private val _manualPort =
    MutableStateFlow(plainPrefs.getInt("gateway.manual.port", 18790))
  val manualPort: StateFlow<Int> = _manualPort

  private val _manualTls =
    MutableStateFlow(plainPrefs.getBoolean("gateway.manual.tls", true))
  val manualTls: StateFlow<Boolean> = _manualTls

  private val _manualTransport =
    MutableStateFlow(
      parseGatewayTransport(plainPrefs.getString("gateway.manual.transport", null))
        ?: if (_manualTls.value) GatewayTransport.WebSocketRpc else GatewayTransport.NativeJsonTcp,
    )
  val manualTransport: StateFlow<GatewayTransport> = _manualTransport

  private val _bitaxeApiBaseUrl =
    MutableStateFlow(plainPrefs.getString("bitaxe.api.baseUrl", "") ?: "")
  val bitaxeApiBaseUrl: StateFlow<String> = _bitaxeApiBaseUrl

  private val _controlApiBaseUrl =
    MutableStateFlow(plainPrefs.getString("control.api.baseUrl", "") ?: "")
  val controlApiBaseUrl: StateFlow<String> = _controlApiBaseUrl

  private val _gatewayToken = MutableStateFlow("")
  val gatewayToken: StateFlow<String> = _gatewayToken

  private val _bitaxeApiKey = MutableStateFlow("")
  val bitaxeApiKey: StateFlow<String> = _bitaxeApiKey

  private val _openRouterApiKey = MutableStateFlow("")
  val openRouterApiKey: StateFlow<String> = _openRouterApiKey

  private val _openRouterModel =
    MutableStateFlow(plainPrefs.getString("openrouter.direct.model", "") ?: "")
  val openRouterModel: StateFlow<String> = _openRouterModel

  private val _togetherApiKey = MutableStateFlow("")
  val togetherApiKey: StateFlow<String> = _togetherApiKey

  private val _togetherModel =
    MutableStateFlow(plainPrefs.getString("together.direct.model", "") ?: "")
  val togetherModel: StateFlow<String> = _togetherModel

  private val _onboardingCompleted =
    MutableStateFlow(plainPrefs.getBoolean("onboarding.completed", false))
  val onboardingCompleted: StateFlow<Boolean> = _onboardingCompleted

  private val _lastDiscoveredStableId =
    MutableStateFlow(
      plainPrefs.getString("gateway.lastDiscoveredStableID", "") ?: "",
    )
  val lastDiscoveredStableId: StateFlow<String> = _lastDiscoveredStableId

  private val _canvasDebugStatusEnabled =
    MutableStateFlow(plainPrefs.getBoolean("canvas.debugStatusEnabled", false))
  val canvasDebugStatusEnabled: StateFlow<Boolean> = _canvasDebugStatusEnabled

  private val _rewardsWaitlistJoined =
    MutableStateFlow(plainPrefs.getBoolean("rewards.waitlist.joined", false))
  val rewardsWaitlistJoined: StateFlow<Boolean> = _rewardsWaitlistJoined

  private val _wakeWords = MutableStateFlow(loadWakeWords())
  val wakeWords: StateFlow<List<String>> = _wakeWords

  private val _voiceWakeMode = MutableStateFlow(loadVoiceWakeMode())
  val voiceWakeMode: StateFlow<VoiceWakeMode> = _voiceWakeMode

  private val _talkEnabled = MutableStateFlow(plainPrefs.getBoolean("talk.enabled", false))
  val talkEnabled: StateFlow<Boolean> = _talkEnabled

  private val _speakerEnabled = MutableStateFlow(plainPrefs.getBoolean("voice.speakerEnabled", true))
  val speakerEnabled: StateFlow<Boolean> = _speakerEnabled

  private val _grokVoiceId =
    MutableStateFlow(plainPrefs.getString(grokVoiceIdKey, defaultGrokVoiceId) ?: defaultGrokVoiceId)
  val grokVoiceId: StateFlow<String> = _grokVoiceId

  private val _grokVadThreshold =
    MutableStateFlow(plainPrefs.getString(grokVadThresholdKey, defaultGrokVadThreshold) ?: defaultGrokVadThreshold)
  val grokVadThreshold: StateFlow<String> = _grokVadThreshold

  private val _grokSilenceDurationMs =
    MutableStateFlow(
      plainPrefs.getString(grokSilenceDurationMsKey, defaultGrokSilenceDurationMs) ?: defaultGrokSilenceDurationMs,
    )
  val grokSilenceDurationMs: StateFlow<String> = _grokSilenceDurationMs

  private val _grokSampleRate =
    MutableStateFlow(plainPrefs.getString(grokSampleRateKey, defaultGrokSampleRate) ?: defaultGrokSampleRate)
  val grokSampleRate: StateFlow<String> = _grokSampleRate

  private val _grokWebSearchEnabled =
    MutableStateFlow(plainPrefs.getBoolean(grokWebSearchEnabledKey, true))
  val grokWebSearchEnabled: StateFlow<Boolean> = _grokWebSearchEnabled

  private val _grokXSearchEnabled =
    MutableStateFlow(plainPrefs.getBoolean(grokXSearchEnabledKey, true))
  val grokXSearchEnabled: StateFlow<Boolean> = _grokXSearchEnabled

  fun setLastDiscoveredStableId(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString("gateway.lastDiscoveredStableID", trimmed) }
    _lastDiscoveredStableId.value = trimmed
  }

  fun setDisplayName(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString(displayNameKey, trimmed) }
    _displayName.value = trimmed
  }

  fun setCameraEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean("camera.enabled", value) }
    _cameraEnabled.value = value
  }

  fun setLocationMode(mode: LocationMode) {
    plainPrefs.edit { putString(locationModeKey, mode.rawValue) }
    _locationMode.value = mode
  }

  fun setLocationPreciseEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean("location.preciseEnabled", value) }
    _locationPreciseEnabled.value = value
  }

  fun setPreventSleep(value: Boolean) {
    plainPrefs.edit { putBoolean("screen.preventSleep", value) }
    _preventSleep.value = value
  }

  fun setAutoStartOnBoot(value: Boolean) {
    plainPrefs.edit { putBoolean("service.autoStartOnBoot", value) }
    _autoStartOnBoot.value = value
  }

  fun setManualEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean("gateway.manual.enabled", value) }
    _manualEnabled.value = value
  }

  fun setManualHost(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString("gateway.manual.host", trimmed) }
    _manualHost.value = trimmed
  }

  fun setManualPort(value: Int) {
    plainPrefs.edit { putInt("gateway.manual.port", value) }
    _manualPort.value = value
  }

  fun setManualTls(value: Boolean) {
    plainPrefs.edit { putBoolean("gateway.manual.tls", value) }
    _manualTls.value = value
  }

  fun setManualTransport(value: GatewayTransport) {
    plainPrefs.edit { putString("gateway.manual.transport", value.name) }
    _manualTransport.value = value
  }

  fun setBitaxeApiBaseUrl(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString("bitaxe.api.baseUrl", trimmed) }
    _bitaxeApiBaseUrl.value = trimmed
  }

  fun setControlApiBaseUrl(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString("control.api.baseUrl", trimmed) }
    _controlApiBaseUrl.value = trimmed
  }

  fun setGatewayToken(value: String) {
    val trimmed = value.trim()
    securePrefs.edit { putString("gateway.manual.token", trimmed) }
    _gatewayToken.value = trimmed
  }

  fun setBitaxeApiKey(value: String) {
    val trimmed = value.trim()
    securePrefs.edit { putString("bitaxe.api.key", trimmed) }
    _bitaxeApiKey.value = trimmed
  }

  fun setOpenRouterApiKey(value: String) {
    val trimmed = value.trim()
    securePrefs.edit { putString("openrouter.direct.apiKey", trimmed) }
    _openRouterApiKey.value = trimmed
  }

  fun setOpenRouterModel(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString("openrouter.direct.model", trimmed) }
    _openRouterModel.value = trimmed
  }

  fun setTogetherApiKey(value: String) {
    val trimmed = value.trim()
    securePrefs.edit { putString("together.direct.apiKey", trimmed) }
    _togetherApiKey.value = trimmed
  }

  fun setTogetherModel(value: String) {
    val trimmed = value.trim()
    plainPrefs.edit { putString("together.direct.model", trimmed) }
    _togetherModel.value = trimmed
  }

  fun setGatewayPassword(value: String) {
    saveGatewayPassword(value)
  }

  fun setOnboardingCompleted(value: Boolean) {
    plainPrefs.edit { putBoolean("onboarding.completed", value) }
    _onboardingCompleted.value = value
  }

  fun getPendingConvexPairingToken(): String? =
    plainPrefs.getString(pendingConvexPairingTokenKey, null)?.trim()?.ifBlank { null }

  fun setPendingConvexPairingToken(value: String?) {
    val normalized = value?.trim()?.ifBlank { null }
    plainPrefs.edit {
      if (normalized == null) {
        remove(pendingConvexPairingTokenKey)
      } else {
        putString(pendingConvexPairingTokenKey, normalized)
      }
    }
  }

  fun loadConvexSession(): PersistedConvexSession? {
    val token = securePrefs.getString(convexSessionTokenKey, null)?.trim().orEmpty()
    val walletAddress = plainPrefs.getString(convexSessionWalletAddressKey, null)?.trim().orEmpty()
    val expiresAt = plainPrefs.getLong(convexSessionExpiresAtKey, 0L)
    if (token.isBlank() || walletAddress.isBlank() || expiresAt <= 0L) return null
    return PersistedConvexSession(
      walletAddress = walletAddress,
      displayName = plainPrefs.getString(convexSessionDisplayNameKey, null)?.trim()?.ifBlank { null },
      sessionToken = token,
      sessionExpiresAt = expiresAt,
    )
  }

  fun saveConvexSession(
    walletAddress: String,
    displayName: String?,
    sessionToken: String,
    sessionExpiresAt: Long,
  ) {
    val normalizedWallet = walletAddress.trim()
    val normalizedDisplay = displayName?.trim()?.ifBlank { null }
    val normalizedToken = sessionToken.trim()
    if (normalizedWallet.isBlank() || normalizedToken.isBlank() || sessionExpiresAt <= 0L) {
      clearConvexSession()
      return
    }
    plainPrefs.edit {
      putString(convexSessionWalletAddressKey, normalizedWallet)
      putString(convexSessionDisplayNameKey, normalizedDisplay)
      putLong(convexSessionExpiresAtKey, sessionExpiresAt)
    }
    securePrefs.edit {
      putString(convexSessionTokenKey, normalizedToken)
    }
  }

  fun clearConvexSession() {
    plainPrefs.edit {
      remove(convexSessionWalletAddressKey)
      remove(convexSessionDisplayNameKey)
      remove(convexSessionExpiresAtKey)
    }
    securePrefs.edit {
      remove(convexSessionTokenKey)
    }
  }

  fun loadScreenHubUrl(defaultSiteUrl: String): String {
    val session = loadConvexSession()
    if (session == null || session.sessionExpiresAt <= System.currentTimeMillis()) {
      if (session != null) clearConvexSession()
      return defaultSiteUrl
    }
    return defaultSiteUrl.toUri()
      .buildUpon()
      .appendEncodedPath("dashboard")
      .appendQueryParameter("sessionToken", session.sessionToken)
      .appendQueryParameter("walletAddress", session.walletAddress)
      .appendQueryParameter("sessionExpiresAt", session.sessionExpiresAt.toString())
      .apply {
        session.displayName?.let { appendQueryParameter("displayName", it) }
      }
      .build()
      .toString()
  }

  fun setCanvasDebugStatusEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean("canvas.debugStatusEnabled", value) }
    _canvasDebugStatusEnabled.value = value
  }

  fun setRewardsWaitlistJoined(value: Boolean) {
    plainPrefs.edit { putBoolean("rewards.waitlist.joined", value) }
    _rewardsWaitlistJoined.value = value
  }

  fun loadGatewayToken(): String? {
    val manual =
      _gatewayToken.value.trim().ifEmpty {
        val stored = securePrefs.getString("gateway.manual.token", null)?.trim().orEmpty()
        if (stored.isNotEmpty()) _gatewayToken.value = stored
        stored
      }
    if (manual.isNotEmpty()) return manual
    val key = "gateway.token.${_instanceId.value}"
    val stored = securePrefs.getString(key, null)?.trim()
    return stored?.takeIf { it.isNotEmpty() }
  }

  fun loadBitaxeApiKey(): String? {
    val stored = _bitaxeApiKey.value.trim().ifEmpty {
      val persisted = securePrefs.getString("bitaxe.api.key", null)?.trim().orEmpty()
      if (persisted.isNotEmpty()) _bitaxeApiKey.value = persisted
      persisted
    }
    return stored.ifEmpty { null }
  }

  fun loadOpenRouterApiKey(): String? {
    val stored = _openRouterApiKey.value.trim().ifEmpty {
      val persisted = securePrefs.getString("openrouter.direct.apiKey", null)?.trim().orEmpty()
      if (persisted.isNotEmpty()) _openRouterApiKey.value = persisted
      persisted
    }
    return stored.ifEmpty { null }
  }

  fun loadOpenRouterModel(): String? {
    val stored = _openRouterModel.value.trim().ifEmpty {
      val persisted = plainPrefs.getString("openrouter.direct.model", null)?.trim().orEmpty()
      if (persisted.isNotEmpty()) _openRouterModel.value = persisted
      persisted
    }
    return stored.ifEmpty { null }
  }

  fun loadTogetherApiKey(): String? {
    val stored = _togetherApiKey.value.trim().ifEmpty {
      val persisted = securePrefs.getString("together.direct.apiKey", null)?.trim().orEmpty()
      if (persisted.isNotEmpty()) _togetherApiKey.value = persisted
      persisted
    }
    return stored.ifEmpty { null }
  }

  fun loadTogetherModel(): String? {
    val stored = _togetherModel.value.trim().ifEmpty {
      val persisted = plainPrefs.getString("together.direct.model", null)?.trim().orEmpty()
      if (persisted.isNotEmpty()) _togetherModel.value = persisted
      persisted
    }
    return stored.ifEmpty { null }
  }

  fun saveGatewayToken(token: String) {
    val key = "gateway.token.${_instanceId.value}"
    securePrefs.edit { putString(key, token.trim()) }
  }

  fun loadGatewayPassword(): String? {
    val key = "gateway.password.${_instanceId.value}"
    val stored = securePrefs.getString(key, null)?.trim()
    return stored?.takeIf { it.isNotEmpty() }
  }

  fun saveGatewayPassword(password: String) {
    val key = "gateway.password.${_instanceId.value}"
    securePrefs.edit { putString(key, password.trim()) }
  }

  fun loadGatewayTlsFingerprint(stableId: String): String? {
    val key = "gateway.tls.$stableId"
    return plainPrefs.getString(key, null)?.trim()?.takeIf { it.isNotEmpty() }
  }

  private fun parseGatewayTransport(raw: String?): GatewayTransport? {
    val normalized = raw?.trim().orEmpty()
    if (normalized.isEmpty()) return null
    return GatewayTransport.entries.firstOrNull { it.name.equals(normalized, ignoreCase = true) }
  }

  fun saveGatewayTlsFingerprint(stableId: String, fingerprint: String) {
    val key = "gateway.tls.$stableId"
    plainPrefs.edit { putString(key, fingerprint.trim()) }
  }

  fun loadLastConnectedGatewayEndpoint(): GatewayEndpoint? {
    val raw = plainPrefs.getString(lastConnectedGatewayEndpointKey, null)?.trim().orEmpty()
    if (raw.isEmpty()) return null
    return runCatching {
      val persisted = json.decodeFromString<PersistedGatewayEndpoint>(raw)
      val transport =
        parseGatewayTransport(persisted.transport)?.takeIf { persisted.port in 1..65535 } ?: return null
      GatewayEndpoint(
        stableId = persisted.stableId,
        name = persisted.name,
        host = persisted.host,
        port = persisted.port,
        transport = transport,
        lanHost = persisted.lanHost,
        tailnetDns = persisted.tailnetDns,
        gatewayPort = persisted.gatewayPort,
        canvasPort = persisted.canvasPort,
        tlsEnabled = persisted.tlsEnabled,
        tlsFingerprintSha256 = persisted.tlsFingerprintSha256,
      )
    }.getOrNull()
  }

  fun saveLastConnectedGatewayEndpoint(endpoint: GatewayEndpoint) {
    val payload =
      PersistedGatewayEndpoint(
        stableId = endpoint.stableId,
        name = endpoint.name,
        host = endpoint.host,
        port = endpoint.port,
        transport = endpoint.transport.name,
        lanHost = endpoint.lanHost,
        tailnetDns = endpoint.tailnetDns,
        gatewayPort = endpoint.gatewayPort,
        canvasPort = endpoint.canvasPort,
        tlsEnabled = endpoint.tlsEnabled,
        tlsFingerprintSha256 = endpoint.tlsFingerprintSha256,
      )
    plainPrefs.edit { putString(lastConnectedGatewayEndpointKey, json.encodeToString(PersistedGatewayEndpoint.serializer(), payload)) }
  }

  fun clearLastConnectedGatewayEndpoint() {
    plainPrefs.edit { remove(lastConnectedGatewayEndpointKey) }
  }

  fun getString(key: String): String? {
    return securePrefs.getString(key, null)
  }

  fun putString(key: String, value: String) {
    securePrefs.edit { putString(key, value) }
  }

  fun remove(key: String) {
    securePrefs.edit { remove(key) }
  }

  private fun createSecurePrefs(context: Context, name: String): SharedPreferences {
    return EncryptedSharedPreferences.create(
      context,
      name,
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
  }

  private fun loadOrCreateInstanceId(): String {
    val existing = plainPrefs.getString("node.instanceId", null)?.trim()
    if (!existing.isNullOrBlank()) return existing
    val fresh = UUID.randomUUID().toString()
    plainPrefs.edit { putString("node.instanceId", fresh) }
    return fresh
  }

  private fun loadOrMigrateDisplayName(context: Context): String {
    val existing = plainPrefs.getString(displayNameKey, null)?.trim().orEmpty()
    if (existing.isNotEmpty() && existing != "Android Node") return existing

    val candidate = DeviceNames.bestDefaultNodeName(context).trim()
    val resolved = candidate.ifEmpty { "Android Node" }

    plainPrefs.edit { putString(displayNameKey, resolved) }
    return resolved
  }

  fun setWakeWords(words: List<String>) {
    val sanitized = WakeWords.sanitize(words, defaultWakeWords)
    val encoded =
      JsonArray(sanitized.map { JsonPrimitive(it) }).toString()
    plainPrefs.edit { putString("voiceWake.triggerWords", encoded) }
    _wakeWords.value = sanitized
  }

  fun setVoiceWakeMode(mode: VoiceWakeMode) {
    plainPrefs.edit { putString(voiceWakeModeKey, mode.rawValue) }
    _voiceWakeMode.value = mode
  }

  fun setTalkEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean("talk.enabled", value) }
    _talkEnabled.value = value
  }

  fun setSpeakerEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean("voice.speakerEnabled", value) }
    _speakerEnabled.value = value
  }

  fun setGrokVoiceId(value: String) {
    val resolved = value.trim().ifEmpty { defaultGrokVoiceId }
    plainPrefs.edit { putString(grokVoiceIdKey, resolved) }
    _grokVoiceId.value = resolved
  }

  fun setGrokVadThreshold(value: String) {
    val resolved = value.trim().ifEmpty { defaultGrokVadThreshold }
    plainPrefs.edit { putString(grokVadThresholdKey, resolved) }
    _grokVadThreshold.value = resolved
  }

  fun setGrokSilenceDurationMs(value: String) {
    val resolved = value.trim().ifEmpty { defaultGrokSilenceDurationMs }
    plainPrefs.edit { putString(grokSilenceDurationMsKey, resolved) }
    _grokSilenceDurationMs.value = resolved
  }

  fun setGrokSampleRate(value: String) {
    val resolved = value.trim().ifEmpty { defaultGrokSampleRate }
    plainPrefs.edit { putString(grokSampleRateKey, resolved) }
    _grokSampleRate.value = resolved
  }

  fun setGrokWebSearchEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean(grokWebSearchEnabledKey, value) }
    _grokWebSearchEnabled.value = value
  }

  fun setGrokXSearchEnabled(value: Boolean) {
    plainPrefs.edit { putBoolean(grokXSearchEnabledKey, value) }
    _grokXSearchEnabled.value = value
  }

  private fun loadVoiceWakeMode(): VoiceWakeMode {
    val raw = plainPrefs.getString(voiceWakeModeKey, null)
    val resolved = VoiceWakeMode.fromRawValue(raw)

    // Default ON (foreground) when unset.
    if (raw.isNullOrBlank()) {
      plainPrefs.edit { putString(voiceWakeModeKey, resolved.rawValue) }
    }

    return resolved
  }

  private fun loadLocationMode(): LocationMode {
    val raw = plainPrefs.getString(locationModeKey, "off")
    val resolved = LocationMode.fromRawValue(raw)
    if (raw?.trim()?.lowercase() == "always") {
      plainPrefs.edit { putString(locationModeKey, resolved.rawValue) }
    }
    return resolved
  }

  private fun loadWakeWords(): List<String> {
    val raw = plainPrefs.getString("voiceWake.triggerWords", null)?.trim()
    if (raw.isNullOrEmpty()) return defaultWakeWords
    return try {
      val element = json.parseToJsonElement(raw)
      val array = element as? JsonArray ?: return defaultWakeWords
      val decoded =
        array.mapNotNull { item ->
          when (item) {
            is JsonNull -> null
            is JsonPrimitive -> item.content.trim().takeIf { it.isNotEmpty() }
            else -> null
          }
        }
      WakeWords.sanitize(decoded, defaultWakeWords)
    } catch (_: Throwable) {
      defaultWakeWords
    }
  }
}
