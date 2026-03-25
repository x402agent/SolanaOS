package ai.openclaw.app.gateway

internal object DeviceAuthPayload {
  fun buildV3(
    deviceId: String,
    clientId: String,
    clientMode: String,
    role: String,
    scopes: List<String>,
    signedAtMs: Long,
    token: String?,
    nonce: String,
    platform: String?,
    deviceFamily: String?,
  ): String {
    val scopeString = normalizeScopes(scopes).joinToString(",")
    val authToken = token?.trim().orEmpty()
    val platformNorm = normalizeMetadataField(platform)
    val deviceFamilyNorm = normalizeMetadataField(deviceFamily)
    return listOf(
      "v3",
      deviceId.trim(),
      clientId.trim(),
      clientMode.trim(),
      role.trim(),
      scopeString,
      signedAtMs.toString(),
      authToken,
      nonce.trim(),
      platformNorm,
      deviceFamilyNorm,
    ).joinToString("|")
  }

  private fun normalizeScopes(scopes: List<String>): List<String> =
    scopes
      .asSequence()
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .distinct()
      .toList()

  internal fun normalizeMetadataField(value: String?): String {
    val trimmed = value?.trim().orEmpty()
    if (trimmed.isEmpty()) {
      return ""
    }
    // Keep cross-runtime normalization deterministic (TS/Swift/Kotlin):
    // lowercase ASCII A-Z only for auth payload metadata fields.
    val out = StringBuilder(trimmed.length)
    for (ch in trimmed) {
      if (ch in 'A'..'Z') {
        out.append((ch.code + 32).toChar())
      } else {
        out.append(ch)
      }
    }
    return out.toString()
  }
}
