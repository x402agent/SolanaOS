package ai.openclaw.app.chat

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenRouterDirectChatClientTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test
  fun complete_preservesReasoningDetailsAcrossTurns() {
    val server = MockWebServer()
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """
        {
          "choices": [
            {
              "message": {
                "role": "assistant",
                "content": "There are 3 r's in strawberry.",
                "reasoning_details": [
                  { "type": "reasoning.text", "text": "counted carefully" }
                ]
              }
            }
          ]
        }
        """.trimIndent(),
      ),
    )
    server.start()

    try {
      val client =
        OpenRouterDirectChatClient(
          apiKey = "test-key",
          model = "minimax/minimax-m2.7",
          json = json,
          httpClient = OkHttpClient(),
          endpointUrl = server.url("/api/v1/chat/completions").toString(),
        )

      val reply =
        client.complete(
          systemPrompt = "",
          messages =
            listOf(
              OpenRouterConversationTurn(
                role = "user",
                content = "How many r's are in strawberry?",
              ),
              OpenRouterConversationTurn(
                role = "assistant",
                content = "There are 3 r's in strawberry.",
                reasoningDetails =
                  json.parseToJsonElement(
                    """[{"type":"reasoning.text","text":"counted carefully"}]""",
                  ),
              ),
              OpenRouterConversationTurn(
                role = "user",
                content = "Are you sure? Think carefully.",
              ),
            ),
          reasoningEnabled = true,
        )

      val request = server.takeRequest()
      val body = json.parseToJsonElement(request.body.readUtf8()).jsonObject
      val messages = body["messages"]!!.jsonArray

      assertEquals("minimax/minimax-m2.7", body["model"]!!.jsonPrimitive.content)
      assertEquals(true, body["reasoning"]!!.jsonObject["enabled"]!!.jsonPrimitive.boolean)
      assertEquals("assistant", messages[1].jsonObject["role"]!!.jsonPrimitive.content)
      assertNotNull(messages[1].jsonObject["reasoning_details"])
      assertEquals(
        "counted carefully",
        messages[1].jsonObject["reasoning_details"]!!
          .jsonArray[0]
          .jsonObject["text"]!!
          .jsonPrimitive.content,
      )
      assertEquals("There are 3 r's in strawberry.", reply.content)
      assertNotNull(reply.reasoningDetails)
    } finally {
      server.shutdown()
    }
  }

  @Test
  fun client_usesLiveConfigProviders() {
    var apiKey = ""
    var model = ""
    val client =
      OpenRouterDirectChatClient(
        apiKeyProvider = { apiKey },
        modelProvider = { model },
        json = json,
      )

    assertEquals(false, client.isConfigured())

    apiKey = "test-key"
    model = "xiaomi/mimo-v2-pro"

    assertEquals(true, client.isConfigured())
    assertEquals("xiaomi/mimo-v2-pro", client.modelName())
  }

  @Test
  fun complete_serializesUserImageAttachmentsAsMultimodalContent() {
    val server = MockWebServer()
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """
        {
          "choices": [
            {
              "message": {
                "role": "assistant",
                "content": "Camera frame received."
              }
            }
          ]
        }
        """.trimIndent(),
      ),
    )
    server.start()

    try {
      val client =
        OpenRouterDirectChatClient(
          apiKey = "test-key",
          model = "x-ai/grok-4.20-beta",
          json = json,
          httpClient = OkHttpClient(),
          endpointUrl = server.url("/api/v1/chat/completions").toString(),
        )

      client.complete(
        systemPrompt = "Vision system prompt",
        messages =
          listOf(
            OpenRouterConversationTurn(
              role = "user",
              content = "What do you see?",
              images =
                listOf(
                  OpenRouterImageAttachment(
                    mimeType = "image/jpeg",
                    base64 = "ZmFrZS1pbWFnZS1ieXRlcw==",
                  ),
                ),
            ),
          ),
        reasoningEnabled = true,
      )

      val request = server.takeRequest()
      val body = json.parseToJsonElement(request.body.readUtf8()).jsonObject
      val userMessage = body["messages"]!!.jsonArray[1].jsonObject
      val content = userMessage["content"]!!.jsonArray

      assertEquals("user", userMessage["role"]!!.jsonPrimitive.content)
      assertEquals("text", content[0].jsonObject["type"]!!.jsonPrimitive.content)
      assertEquals("What do you see?", content[0].jsonObject["text"]!!.jsonPrimitive.content)
      assertEquals("image_url", content[1].jsonObject["type"]!!.jsonPrimitive.content)
      assertEquals(
        "data:image/jpeg;base64,ZmFrZS1pbWFnZS1ieXRlcw==",
        content[1].jsonObject["image_url"]!!.jsonObject["url"]!!.jsonPrimitive.content,
      )
    } finally {
      server.shutdown()
    }
  }

  @Test
  fun complete_omitsReasoningObjectWhenDisabledAndSkipsBlankSystemPrompt() {
    val server = MockWebServer()
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """
        {
          "choices": [
            {
              "message": {
                "role": "assistant",
                "content": [
                  { "type": "text", "text": "First line. " },
                  { "type": "text", "text": "Second line." }
                ]
              }
            }
          ]
        }
        """.trimIndent(),
      ),
    )
    server.start()

    try {
      val client =
        OpenRouterDirectChatClient(
          apiKey = "test-key",
          model = "xiaomi/mimo-v2-pro",
          json = json,
          httpClient = OkHttpClient(),
          endpointUrl = server.url("/api/v1/chat/completions").toString(),
        )

      val reply =
        client.complete(
          systemPrompt = "   ",
          messages =
            listOf(
              OpenRouterConversationTurn(
                role = "user",
                content = "Summarize the chart",
              ),
            ),
          reasoningEnabled = false,
        )

      val request = server.takeRequest()
      val body = json.parseToJsonElement(request.body.readUtf8()).jsonObject
      val messages = body["messages"]!!.jsonArray

      assertEquals("Bearer test-key", request.getHeader("Authorization"))
      assertEquals("SolanaOS Seeker", request.getHeader("X-OpenRouter-Title"))
      assertNull(body["reasoning"])
      assertEquals(1, messages.size)
      assertEquals("user", messages[0].jsonObject["role"]!!.jsonPrimitive.content)
      assertEquals("Summarize the chart", messages[0].jsonObject["content"]!!.jsonPrimitive.content)
      assertEquals("First line. Second line.", reply.content)
      assertNull(reply.reasoningDetails)
    } finally {
      server.shutdown()
    }
  }

  @Test
  fun complete_throwsReadableErrorForHttpFailure() {
    val server = MockWebServer()
    server.enqueue(
      MockResponse().setResponseCode(429).setBody("""{"error":{"message":"rate limited"}}"""),
    )
    server.start()

    try {
      val client =
        OpenRouterDirectChatClient(
          apiKey = "test-key",
          model = "xiaomi/mimo-v2-pro",
          json = json,
          httpClient = OkHttpClient(),
          endpointUrl = server.url("/api/v1/chat/completions").toString(),
        )

      val error =
        runCatching {
          client.complete(
            systemPrompt = "",
            messages = listOf(OpenRouterConversationTurn(role = "user", content = "hello")),
            reasoningEnabled = true,
          )
        }.exceptionOrNull()

      assertNotNull(error)
      assertTrue(error!!.message!!.contains("OpenRouter 429"))
      assertTrue(error.message!!.contains("rate limited"))
    } finally {
      server.shutdown()
    }
  }
}
