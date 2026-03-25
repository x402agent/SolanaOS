package ai.openclaw.app.grok

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

data class GrokSearchReply(
  val content: String,
  val citations: List<String> = emptyList(),
)

data class GrokGeneratedImage(
  val prompt: String,
  val base64: String,
  val model: String? = null,
)

data class GrokTextReply(
  val content: String,
  val model: String? = null,
)

internal class XAiDirectClient(
  private val apiKey: String,
  private val searchModel: String,
  private val imageModel: String,
  private val json: Json = Json { ignoreUnknownKeys = true },
  private val httpClient: OkHttpClient =
    OkHttpClient.Builder()
      .connectTimeout(20, TimeUnit.SECONDS)
      .writeTimeout(60, TimeUnit.SECONDS)
      .readTimeout(60, TimeUnit.SECONDS)
      .callTimeout(90, TimeUnit.SECONDS)
      .build(),
  private val responsesUrl: String = "https://api.x.ai/v1/responses",
  private val imageGenerationUrl: String = "https://api.x.ai/v1/images/generations",
) {
  fun isConfigured(): Boolean = apiKey.isNotBlank() && searchModel.isNotBlank() && imageModel.isNotBlank()

  fun search(
    prompt: String,
    useWebSearch: Boolean,
    useXSearch: Boolean,
    enableImageUnderstanding: Boolean,
  ): GrokSearchReply {
    check(isConfigured()) { "xAI is not configured." }
    val trimmedPrompt = prompt.trim()
    require(trimmedPrompt.isNotBlank()) { "Enter a prompt before running Grok search." }
    require(useWebSearch || useXSearch) { "Enable Web Search or X Search first." }

    val body =
      buildJsonObject {
        put("model", JsonPrimitive(searchModel))
        put(
          "input",
          buildJsonArray {
            add(
              buildJsonObject {
                put("role", JsonPrimitive("user"))
                put("content", JsonPrimitive(trimmedPrompt))
              },
            )
          },
        )
        put(
          "tools",
          buildJsonArray {
            if (useWebSearch) {
              add(
                buildJsonObject {
                  put("type", JsonPrimitive("web_search"))
                  if (enableImageUnderstanding) {
                    put("enable_image_understanding", JsonPrimitive(true))
                  }
                },
              )
            }
            if (useXSearch) {
              add(
                buildJsonObject {
                  put("type", JsonPrimitive("x_search"))
                  if (enableImageUnderstanding) {
                    put("enable_image_understanding", JsonPrimitive(true))
                  }
                },
              )
            }
          },
        )
      }

    val request =
      Request.Builder()
        .url(responsesUrl)
        .header("Authorization", "Bearer $apiKey")
        .header("Content-Type", "application/json")
        .post(body.toString().toRequestBody(jsonMediaType))
        .build()

    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        throw IllegalStateException("xAI ${response.code}: ${payload.take(220)}")
      }
      val root = json.parseToJsonElement(payload).asObjectOrNull()
        ?: throw IllegalStateException("xAI returned an invalid search response.")
      val content = extractResponseText(root)
      if (content.isBlank()) {
        throw IllegalStateException("xAI returned an empty Grok search response.")
      }
      return GrokSearchReply(
        content = content,
        citations = extractUrls(root).take(8),
      )
    }
  }

  fun generateImage(
    prompt: String,
    aspectRatio: String,
    resolution: String,
  ): GrokGeneratedImage {
    check(isConfigured()) { "xAI is not configured." }
    val trimmedPrompt = prompt.trim()
    require(trimmedPrompt.isNotBlank()) { "Enter a prompt before generating an image." }

    val body =
      buildJsonObject {
        put("model", JsonPrimitive(imageModel))
        put("prompt", JsonPrimitive(trimmedPrompt))
        put("response_format", JsonPrimitive("b64_json"))
        if (aspectRatio.isNotBlank()) {
          put("aspect_ratio", JsonPrimitive(aspectRatio))
        }
        if (resolution.isNotBlank()) {
          put("resolution", JsonPrimitive(resolution))
        }
      }

    val request =
      Request.Builder()
        .url(imageGenerationUrl)
        .header("Authorization", "Bearer $apiKey")
        .header("Content-Type", "application/json")
        .post(body.toString().toRequestBody(jsonMediaType))
        .build()

    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        throw IllegalStateException("xAI ${response.code}: ${payload.take(220)}")
      }
      val root = json.parseToJsonElement(payload).asObjectOrNull()
        ?: throw IllegalStateException("xAI returned an invalid image response.")
      val imageObject =
        root["data"].asArrayOrNull()?.firstOrNull()?.asObjectOrNull()
          ?: throw IllegalStateException("xAI returned no image payload.")
      val base64 =
        imageObject["b64_json"].asStringOrNull()
          ?: throw IllegalStateException("xAI did not return base64 image data.")
      return GrokGeneratedImage(
        prompt = trimmedPrompt,
        base64 = base64,
        model = root["model"].asStringOrNull() ?: imageObject["model"].asStringOrNull(),
      )
    }
  }

  fun respond(
    systemPrompt: String,
    userPrompt: String,
    model: String = searchModel,
  ): GrokTextReply {
    check(apiKey.isNotBlank() && model.isNotBlank()) { "xAI is not configured." }
    val trimmedSystemPrompt = systemPrompt.trim()
    val trimmedUserPrompt = userPrompt.trim()
    require(trimmedSystemPrompt.isNotBlank()) { "System prompt is required." }
    require(trimmedUserPrompt.isNotBlank()) { "User prompt is required." }

    val body =
      buildJsonObject {
        put("model", JsonPrimitive(model))
        put("store", JsonPrimitive(false))
        put(
          "input",
          buildJsonArray {
            add(
              buildJsonObject {
                put("role", JsonPrimitive("developer"))
                put("content", JsonPrimitive(trimmedSystemPrompt))
              },
            )
            add(
              buildJsonObject {
                put("role", JsonPrimitive("user"))
                put("content", JsonPrimitive(trimmedUserPrompt))
              },
            )
          },
        )
      }

    val request =
      Request.Builder()
        .url(responsesUrl)
        .header("Authorization", "Bearer $apiKey")
        .header("Content-Type", "application/json")
        .post(body.toString().toRequestBody(jsonMediaType))
        .build()

    httpClient.newCall(request).execute().use { response ->
      val payload = response.body?.string().orEmpty()
      if (!response.isSuccessful) {
        throw IllegalStateException("xAI ${response.code}: ${payload.take(220)}")
      }
      val root =
        json.parseToJsonElement(payload).asObjectOrNull()
          ?: throw IllegalStateException("xAI returned an invalid text response.")
      val content = extractResponseText(root)
      if (content.isBlank()) {
        throw IllegalStateException("xAI returned an empty Grok response.")
      }
      return GrokTextReply(
        content = content,
        model = root["model"].asStringOrNull(),
      )
    }
  }

  private fun extractResponseText(root: JsonObject): String {
    root["output_text"].asStringOrNull()?.takeIf { it.isNotBlank() }?.let { return it }
    val outputItems = root["output"].asArrayOrNull().orEmpty()
    val text =
      outputItems
        .mapNotNull { item ->
          val obj = item.asObjectOrNull() ?: return@mapNotNull null
          if (obj["role"].asStringOrNull() != "assistant" && obj["type"].asStringOrNull() != "message") {
            return@mapNotNull null
          }
          obj["content"].asArrayOrNull()
            ?.mapNotNull { part ->
              val partObj = part.asObjectOrNull() ?: return@mapNotNull null
              partObj["text"].asStringOrNull()
            }?.joinToString("\n")
        }.filter { it.isNotBlank() }
        .joinToString("\n\n")
    return text
  }

  private fun extractUrls(element: JsonElement?): List<String> {
    val urls = linkedSetOf<String>()

    fun walk(node: JsonElement?) {
      when (node) {
        is JsonObject -> {
          node.forEach { (key, value) ->
            if (key == "url") {
              value.asStringOrNull()?.takeIf { it.startsWith("http://") || it.startsWith("https://") }?.let(urls::add)
            }
            walk(value)
          }
        }
        is JsonArray -> node.forEach(::walk)
        else -> Unit
      }
    }

    walk(element)
    return urls.toList()
  }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}

private fun JsonElement?.asObjectOrNull(): JsonObject? = this as? JsonObject

private fun JsonElement?.asArrayOrNull(): JsonArray? = this as? JsonArray

private fun JsonElement?.asStringOrNull(): String? =
  when (this) {
    is JsonPrimitive -> content
    else -> null
  }
