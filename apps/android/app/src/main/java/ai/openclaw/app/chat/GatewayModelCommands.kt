package ai.openclaw.app.chat

internal object GatewayModelCommands {
  fun status(): String = "/model"

  fun switch(backend: String, model: String): String {
    val normalizedBackend = normalize(backend)
    val normalizedModel = normalize(model)
    return when {
      normalizedBackend.isEmpty() && normalizedModel.isEmpty() -> "/model"
      normalizedBackend.isEmpty() -> "/model $normalizedModel"
      normalizedModel.isEmpty() -> "/model $normalizedBackend"
      else -> "/model $normalizedBackend $normalizedModel"
    }
  }

  fun ollama(model: String): String = switch("ollama", model)

  fun openRouter(model: String): String = switch("openrouter", model)

  fun xai(model: String): String = switch("xai", model)

  private fun normalize(value: String): String = value.trim().replace(Regex("\\s+"), " ")
}
