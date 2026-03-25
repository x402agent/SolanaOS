package ai.openclaw.app.chat

import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient

internal class TogetherDirectChatClient(
  private val apiKeyProvider: () -> String,
  private val modelProvider: () -> String,
  json: Json,
  httpClient: OkHttpClient = OkHttpClient(),
) : HostedDirectChatClient {
  private val delegate =
    OpenRouterDirectChatClient(
      apiKeyProvider = apiKeyProvider,
      modelProvider = modelProvider,
      json = json,
      httpClient = httpClient,
      endpointUrl = "https://api.together.xyz/v1/chat/completions",
      providerName = "Together",
      providerLabel = "Together",
      includeOpenRouterTitle = false,
    )

  override fun isConfigured(): Boolean = delegate.isConfigured()

  override fun modelName(): String = delegate.modelName()

  override fun providerLabel(): String = "Together"

  override fun complete(
    systemPrompt: String,
    messages: List<OpenRouterConversationTurn>,
    reasoningEnabled: Boolean,
  ): OpenRouterReply = delegate.complete(systemPrompt = systemPrompt, messages = messages, reasoningEnabled = reasoningEnabled)
}

internal class HostedDirectChatRouter(
  private val providers: List<HostedDirectChatClient>,
) : HostedDirectChatClient {
  private fun activeProvider(): HostedDirectChatClient? = providers.firstOrNull { it.isConfigured() }

  override fun isConfigured(): Boolean = activeProvider() != null

  override fun modelName(): String = activeProvider()?.modelName().orEmpty()

  override fun providerLabel(): String = activeProvider()?.providerLabel() ?: "Hosted"

  override fun complete(
    systemPrompt: String,
    messages: List<OpenRouterConversationTurn>,
    reasoningEnabled: Boolean,
  ): OpenRouterReply {
    val provider = activeProvider() ?: error("Hosted chat is not configured.")
    return provider.complete(systemPrompt = systemPrompt, messages = messages, reasoningEnabled = reasoningEnabled)
  }
}
