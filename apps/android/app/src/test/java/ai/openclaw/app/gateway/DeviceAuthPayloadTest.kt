package ai.openclaw.app.gateway

import org.junit.Assert.assertEquals
import org.junit.Test

class DeviceAuthPayloadTest {
  @Test
  fun buildV3_matchesCanonicalVector() {
    val payload =
      DeviceAuthPayload.buildV3(
        deviceId = "dev-1",
        clientId = "openclaw-macos",
        clientMode = "ui",
        role = "operator",
        scopes = listOf("operator.admin", "operator.read"),
        signedAtMs = 1_700_000_000_000,
        token = "tok-123",
        nonce = "nonce-abc",
        platform = "  IOS  ",
        deviceFamily = "  iPhone  ",
      )

    assertEquals(
      "v3|dev-1|openclaw-macos|ui|operator|operator.admin,operator.read|1700000000000|tok-123|nonce-abc|ios|iphone",
      payload,
    )
  }

  @Test
  fun normalizeMetadataField_asciiOnlyLowercase() {
    assertEquals("İos", DeviceAuthPayload.normalizeMetadataField("  İOS  "))
    assertEquals("mac", DeviceAuthPayload.normalizeMetadataField("  MAC  "))
    assertEquals("", DeviceAuthPayload.normalizeMetadataField(null))
  }

  @Test
  fun buildV3_trimsFieldsFiltersBlankScopesAndDedupes() {
    val payload =
      DeviceAuthPayload.buildV3(
        deviceId = " dev-1 ",
        clientId = " openclaw-android ",
        clientMode = " node ",
        role = " operator ",
        scopes = listOf(" operator.read ", "", "operator.write", "operator.read"),
        signedAtMs = 1L,
        token = " tok-123 ",
        nonce = " nonce-abc ",
        platform = " ANDROID ",
        deviceFamily = " Pixel ",
      )

    assertEquals(
      "v3|dev-1|openclaw-android|node|operator|operator.read,operator.write|1|tok-123|nonce-abc|android|pixel",
      payload,
    )
  }
}
