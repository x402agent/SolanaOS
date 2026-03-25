package ai.openclaw.app.chat

import org.junit.Assert.assertEquals
import org.junit.Test

class GatewayModelCommandsTest {
  @Test
  fun statusUsesBaseModelCommand() {
    assertEquals("/model", GatewayModelCommands.status())
  }

  @Test
  fun ollamaBuildsExpectedCommand() {
    assertEquals("/model ollama 8bit/DeepSolana", GatewayModelCommands.ollama("8bit/DeepSolana"))
  }

  @Test
  fun switchNormalizesWhitespace() {
    assertEquals(
      "/model ollama 8bit/DeepSolana",
      GatewayModelCommands.switch(" ollama ", " 8bit/DeepSolana "),
    )
  }

  @Test
  fun switchFallsBackToStatusWhenBlank() {
    assertEquals("/model", GatewayModelCommands.switch("   ", "   "))
  }
}
