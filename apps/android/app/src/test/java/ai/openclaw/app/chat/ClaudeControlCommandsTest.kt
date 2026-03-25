package ai.openclaw.app.chat

import org.junit.Assert.assertEquals
import org.junit.Test

class ClaudeControlCommandsTest {
  @Test
  fun startTrimsAndCollapsesWhitespace() {
    assertEquals(
      "/claude start add auth and tests",
      ClaudeControlCommands.start("  add   auth   and tests  "),
    )
  }

  @Test
  fun continueSessionTrimsAndCollapsesWhitespace() {
    assertEquals(
      "/claude continue fix the failing wallet flow",
      ClaudeControlCommands.continueSession("  fix   the failing wallet flow "),
    )
  }

  @Test
  fun startWithBlankPromptFallsBackToBaseCommand() {
    assertEquals("/claude start", ClaudeControlCommands.start("   \n\t  "))
  }

  @Test
  fun continueSessionWithBlankPromptFallsBackToBaseCommand() {
    assertEquals("/claude continue", ClaudeControlCommands.continueSession("   "))
  }

  @Test
  fun commitWithoutExtraInstructionUsesBaseCommand() {
    assertEquals("/claude commit", ClaudeControlCommands.commit())
  }

  @Test
  fun commitWithExtraInstructionAppendsSuffix() {
    assertEquals(
      "/claude commit make one clean commit for Android Claude controls",
      ClaudeControlCommands.commit(" make one clean commit for Android Claude controls "),
    )
  }

  @Test
  fun commitNormalizesWhitespaceInExtraInstruction() {
    assertEquals(
      "/claude commit keep the change small and add tests",
      ClaudeControlCommands.commit(" keep   the change\nsmall   and add tests "),
    )
  }
}
