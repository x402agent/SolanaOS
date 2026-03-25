package ai.openclaw.app.chat

internal object ClaudeControlCommands {
  fun sessions(): String = "/claude sessions"

  fun status(): String = "/claude status"

  fun log(): String = "/claude log"

  fun stop(): String = "/claude stop"

  fun commit(extraInstruction: String? = null): String = buildPromptCommand("/claude commit", extraInstruction)

  fun start(prompt: String): String = buildPromptCommand("/claude start", prompt)

  fun continueSession(prompt: String): String = buildPromptCommand("/claude continue", prompt)

  private fun normalizedPrompt(prompt: String): String = prompt.trim().replace(Regex("\\s+"), " ")

  private fun buildPromptCommand(base: String, prompt: String?): String {
    val normalized = normalizedPrompt(prompt.orEmpty())
    return if (normalized.isEmpty()) base else "$base $normalized"
  }
}
