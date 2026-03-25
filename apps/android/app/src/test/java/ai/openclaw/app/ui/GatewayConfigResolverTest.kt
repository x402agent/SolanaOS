package ai.openclaw.app.ui

import ai.openclaw.app.gateway.GatewayTransport
import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class GatewayConfigResolverTest {
  @Test
  fun resolveScannedSetupCodeAcceptsRawSetupCode() {
    val setupCode = encodeSetupCode("""{"url":"wss://gateway.example:18789","token":"token-1"}""")

    val resolved = resolveScannedSetupCode(setupCode)

    assertEquals(setupCode, resolved)
  }

  @Test
  fun resolveScannedSetupCodeAcceptsQrJsonPayload() {
    val setupCode = encodeSetupCode("""{"url":"wss://gateway.example:18789","password":"pw-1"}""")
    val qrJson =
      """
      {
        "setupCode": "$setupCode",
        "gatewayUrl": "wss://gateway.example:18789",
        "auth": "password",
        "urlSource": "gateway.remote.url"
      }
      """.trimIndent()

    val resolved = resolveScannedSetupCode(qrJson)

    assertEquals(setupCode, resolved)
  }

  @Test
  fun resolveScannedSetupCodeRejectsInvalidInput() {
    val resolved = resolveScannedSetupCode("not-a-valid-setup-code")
    assertNull(resolved)
  }

  @Test
  fun resolveScannedSetupCodeRejectsJsonWithInvalidSetupCode() {
    val qrJson = """{"setupCode":"invalid"}"""
    val resolved = resolveScannedSetupCode(qrJson)
    assertNull(resolved)
  }

  @Test
  fun resolveScannedSetupCodeRejectsJsonWithNonStringSetupCode() {
    val qrJson = """{"setupCode":{"nested":"value"}}"""
    val resolved = resolveScannedSetupCode(qrJson)
    assertNull(resolved)
  }

  @Test
  fun resolveScannedSetupCodeBuildsSetupCodeFromQrPayloadFields() {
    val resolved =
      resolveScannedSetupCode(
        """
        {
          "gatewayUrl": "wss://gateway.example:18789",
          "gatewayToken": "token-1"
        }
        """.trimIndent(),
      )

    assertTrue(resolved != null)
    val decoded = decodeGatewaySetupCode(resolved!!)
    assertEquals("wss://gateway.example:18789", decoded?.url)
    assertEquals("token-1", decoded?.token)
    assertNull(decoded?.password)
  }

  @Test
  fun parseGatewayEndpoint_httpUsesNativeBridgeTransport() {
    val parsed = parseGatewayEndpoint("http://gateway.example:18790")

    assertEquals(GatewayTransport.NativeJsonTcp, parsed?.transport)
    assertEquals(false, parsed?.tls)
  }

  @Test
  fun parseGatewayEndpoint_wssUsesWebsocketTransport() {
    val parsed = parseGatewayEndpoint("wss://gateway.example:18790")

    assertEquals(GatewayTransport.WebSocketRpc, parsed?.transport)
    assertEquals(true, parsed?.tls)
  }

  @Test
  fun composeGatewayManualUrl_trimsHostAndRejectsBadPort() {
    assertEquals("https://gateway.example:18790", composeGatewayManualUrl(" gateway.example ", "18790", true))
    assertNull(composeGatewayManualUrl("gateway.example", "0", true))
    assertNull(composeGatewayManualUrl("gateway.example", "99999", true))
  }

  private fun encodeSetupCode(payloadJson: String): String {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson.toByteArray(Charsets.UTF_8))
  }
}
