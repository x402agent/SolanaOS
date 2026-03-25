package ai.openclaw.app.chat

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

internal data class OpenRouterConversationTurn(
  val role: String,
  val content: String,
  val images: List<OpenRouterImageAttachment> = emptyList(),
  val reasoningDetails: JsonElement? = null,
  val timestampMs: Long = System.currentTimeMillis(),
)

internal data class OpenRouterImageAttachment(
  val mimeType: String,
  val base64: String,
)

internal data class OpenRouterReply(
  val content: String,
  val reasoningDetails: JsonElement? = null,
)

internal interface HostedDirectChatClient {
  fun isConfigured(): Boolean

  fun modelName(): String

  fun providerLabel(): String

  fun complete(
    systemPrompt: String,
    messages: List<OpenRouterConversationTurn>,
    reasoningEnabled: Boolean,
  ): OpenRouterReply
}

internal class OpenRouterDirectChatClient(
  private val apiKeyProvider: () -> String,
  private val modelProvider: () -> String,
  private val json: Json,
  private val httpClient: OkHttpClient = OkHttpClient(),
  private val endpointUrl: String = "https://openrouter.ai/api/v1/chat/completions",
  private val providerName: String = "OpenRouter",
  private val providerLabel: String = "OpenRouter",
  private val includeOpenRouterTitle: Boolean = true,
) : HostedDirectChatClient {
  constructor(
    apiKey: String,
    model: String,
    json: Json,
    httpClient: OkHttpClient = OkHttpClient(),
    endpointUrl: String = "https://openrouter.ai/api/v1/chat/completions",
  ) : this(
    apiKeyProvider = { apiKey },
    modelProvider = { model },
    json = json,
    httpClient = httpClient,
    endpointUrl = endpointUrl,
  )

  override fun isConfigured(): Boolean = currentApiKey().isNotBlank() && currentModel().isNotBlank()

  override fun modelName(): String = currentModel()

  override fun providerLabel(): String = providerLabel

  override fun complete(
    systemPrompt: String,
    messages: List<OpenRouterConversationTurn>,
    reasoningEnabled: Boolean,
  ): OpenRouterReply {
    check(isConfigured()) { "$providerName is not configured." }
    val apiKey = currentApiKey()
    val model = currentModel()

    val body =
      buildJsonObject {
        put("model", JsonPrimitive(model))
        put(
          "messages",
          buildJsonArray {
            if (systemPrompt.isNotBlank()) {
              add(
                buildJsonObject {
                  put("role", JsonPrimitive("system"))
                  put("content", JsonPrimitive(systemPrompt))
                },
              )
            }
            for (message in messages) {
              add(
                buildJsonObject {
                  put("role", JsonPrimitive(message.role))
                  if (message.images.isNotEmpty() && message.role == "user") {
                    put(
                      "content",
                      buildJsonArray {
                        if (message.content.isNotBlank()) {
                          add(
                            buildJsonObject {
                              put("type", JsonPrimitive("text"))
                              put("text", JsonPrimitive(message.content))
                            },
                          )
                        }
                        for (image in message.images) {
                          add(
                            buildJsonObject {
                              put("type", JsonPrimitive("image_url"))
                              put(
                                "image_url",
                                buildJsonObject {
                                  put(
                                    "url",
                                    JsonPrimitive("data:${image.mimeType};base64,${image.base64}"),
                                  )
                                },
                              )
                            },
                          )
                        }
                      },
                    )
                  } else {
                    put("content", JsonPrimitive(message.content))
                  }
                  message.reasoningDetails?.let { put("reasoning_details", it) }
                },
              )
            }
          },
        )
        if (reasoningEnabled) {
          put(
            "reasoning",
            buildJsonObject {
              put("enabled", JsonPrimitive(true))
            },
          )
        }
      }

    val requestBuilder =
      Request.Builder()
        .url(endpointUrl)
        .header("Authorization", "Bearer $apiKey")
        .header("Content-Type", "application/json")
    if (includeOpenRouterTitle) {
      requestBuilder.header("X-OpenRouter-Title", "SolanaOS Seeker")
    }
    val request =
      requestBuilder
        .post(body.toString().toRequestBody("application/json".toMediaType()))
        .build()

    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        throw IllegalStateException("$providerName ${response.code}: ${payload.take(180)}")
      }

      val root = json.parseToJsonElement(payload).asObjectOrNull()
        ?: throw IllegalStateException("$providerName returned an invalid response.")
      val choice =
        root["choices"].asArrayOrNull()?.firstOrNull()?.asObjectOrNull()
          ?: throw IllegalStateException("$providerName returned no choices.")
      val message =
        choice["message"].asObjectOrNull()
          ?: throw IllegalStateException("$providerName returned no assistant message.")
      val content = extractAssistantContent(message)
      if (content.isBlank()) {
        throw IllegalStateException("$providerName returned an empty assistant message.")
      }
      return OpenRouterReply(
        content = content,
        reasoningDetails = message["reasoning_details"],
      )
    }
  }

  private fun extractAssistantContent(message: JsonObject): String {
    val content = message["content"]
    return when (content) {
      is JsonPrimitive -> content.content
      is JsonArray ->
        content.mapNotNull { item ->
          val obj = item.asObjectOrNull() ?: return@mapNotNull null
          when (obj["type"].asStringOrNull()) {
            "text", null -> obj["text"].asStringOrNull()
            else -> null
          }
        }.joinToString("")
      else -> ""
    }
  }

  private fun currentApiKey(): String = apiKeyProvider().trim()

  private fun currentModel(): String = modelProvider().trim()
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asArrayOrNull(): JsonArray? = this as? JsonArray

private fun JsonElement?.asStringOrNull(): String? =
  when (this) {
    is JsonPrimitive -> content
    else -> null
  }
