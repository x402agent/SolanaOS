package ai.openclaw.app.gateway

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayInvokeClientTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test
  fun catalogCoversAllTwentyNineCommands() {
    assertEquals(29, GatewayInvokeCatalog.all.size)
    assertNotNull(GatewayInvokeCatalog.find("device.status"))
    assertNotNull(GatewayInvokeCatalog.find("debug.ed25519"))
  }

  @Test
  fun invokeBuildsNodeInvokeRequestPayload() = runTest {
    var capturedMethod: String? = null
    var capturedParamsJson: String? = null
    var capturedTimeoutMs: Long? = null
    val client =
      GatewayInvokeClient(
        json = json,
        requestDetailed = { method, paramsJson, timeoutMs ->
          capturedMethod = method
          capturedParamsJson = paramsJson
          capturedTimeoutMs = timeoutMs
          GatewaySession.RequestResult(ok = true, payloadJson = """{"ok":true}""", error = null)
        },
        targetNodeId = { "nano-android-test" },
      )

    val result = client.invoke("device.status", """{"verbose":true}""", timeoutMs = 7000)

    assertTrue(result.ok)
    assertEquals("device.status", result.command)
    assertEquals("node.invoke.request", capturedMethod)
    assertEquals(9000L, capturedTimeoutMs)
    val payload = json.parseToJsonElement(capturedParamsJson!!).jsonObject
    assertEquals("device.status", payload["command"]?.toString()?.trim('"'))
    assertEquals("nano-android-test", payload["nodeId"]?.toString()?.trim('"'))
    assertEquals("7000", payload["timeoutMs"]?.toString())
    assertEquals("true", payload["params"]?.jsonObject?.get("verbose")?.toString())
    assertNotNull(payload["id"])
  }
}
