package ai.openclaw.app.protocol

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

class OpenClawCanvasA2UIActionTest {
  @Test
  fun extractActionNameAcceptsNameOrAction() {
    val nameObj = Json.parseToJsonElement("{\"name\":\"Hello\"}").jsonObject
    assertEquals("Hello", OpenClawCanvasA2UIAction.extractActionName(nameObj))

    val actionObj = Json.parseToJsonElement("{\"action\":\"Wave\"}").jsonObject
    assertEquals("Wave", OpenClawCanvasA2UIAction.extractActionName(actionObj))

    val fallbackObj =
      Json.parseToJsonElement("{\"name\":\"  \",\"action\":\"Fallback\"}").jsonObject
    assertEquals("Fallback", OpenClawCanvasA2UIAction.extractActionName(fallbackObj))

    val eventObj = Json.parseToJsonElement("{\"event\":\"Tap\"}").jsonObject
    assertEquals("Tap", OpenClawCanvasA2UIAction.extractActionName(eventObj))
  }

  @Test
  fun formatAgentMessageMatchesSharedSpec() {
    val msg =
      OpenClawCanvasA2UIAction.formatAgentMessage(
        actionName = "Get Weather",
        sessionKey = "main",
        surfaceId = "main",
        sourceComponentId = "btnWeather",
        host = "Peter’s iPad",
        instanceId = "ipad16,6",
        contextJson = "{\"city\":\"Vienna\"}",
      )

    assertEquals(
      "CANVAS_A2UI action=Get_Weather session=main surface=main component=btnWeather host=Peter_s_iPad instance=ipad16_6 ctx={\"city\":\"Vienna\"} default=update_canvas",
      msg,
    )
  }

  @Test
  fun jsDispatchA2uiStatusIsStable() {
    val js = OpenClawCanvasA2UIAction.jsDispatchA2UIActionStatus(actionId = "a1", ok = true, error = null)
    assertEquals(
      "window.dispatchEvent(new CustomEvent('openclaw:a2ui-action-status', { detail: { id: \"a1\", ok: true, error: \"\" } }));",
      js,
    )
  }

  @Test
  fun formatAgentMessageCompactsContextWhitespace() {
    val msg =
      OpenClawCanvasA2UIAction.formatAgentMessage(
        actionName = "Launch",
        sessionKey = "main",
        surfaceId = "main",
        sourceComponentId = "cta",
        host = "Seeker Phone",
        instanceId = "pixel 9 pro",
        contextJson = "{\n  \"mint\": \"abc\",\n  \"amount\": 1\n}",
      )

    assertEquals(
      "CANVAS_A2UI action=Launch session=main surface=main component=cta host=Seeker_Phone instance=pixel_9_pro ctx={\"mint\":\"abc\",\"amount\":1} default=update_canvas",
      msg,
    )
  }

  @Test
  fun jsDispatchA2uiStatusEscapesControlCharacters() {
    val js =
      OpenClawCanvasA2UIAction.jsDispatchA2UIActionStatus(
        actionId = "a\"\n1",
        ok = false,
        error = "bad\nrequest",
      )
    assertEquals(
      "window.dispatchEvent(new CustomEvent('openclaw:a2ui-action-status', { detail: { id: \"a\\\"\\n1\", ok: false, error: \"bad\\nrequest\" } }));",
      js,
    )
  }
}
