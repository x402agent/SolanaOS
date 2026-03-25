package ai.openclaw.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArcadePlatformerEngineTest {
  @Test
  fun parseClassicPhysicsProfile_readsSourceValues() {
    val physics =
      parseClassicPhysicsProfile(
        """
        {
          "AIR_ACCEL": 3.8076,
          "FALL_GRAVITY": 25,
          "RUN_SPEED": 175,
          "WALK_SPEED": 106
        }
        """.trimIndent(),
      )

    assertTrue(physics.airAccel > 3.8f)
    assertTrue(physics.fallGravity == 25f)
    assertTrue(physics.runSpeed == 175f)
    assertTrue(physics.walkSpeed == 106f)
  }

  @Test
  fun parseClassicPlatformerLevel_buildsPlatformerStateFromAssetPayload() {
    val level =
      parseClassicPlatformerLevel(
        """
        {
          "name": "Imported Training Run",
          "worldWidth": 512,
          "worldHeight": 240,
          "goalX": 476,
          "spawn": { "x": 18, "y": 188 },
          "platforms": [{ "x": 0, "y": 208, "width": 128, "height": 32 }],
          "coins": [{ "x": 42, "y": 180 }],
          "enemies": [{ "x": 96, "y": 196, "patrolMinX": 80, "patrolMaxX": 132 }]
        }
        """.trimIndent(),
      )

    val state = level.toPlatformerState()

    assertTrue(level.name == "Imported Training Run")
    assertTrue(state.worldWidth == 512f)
    assertTrue(state.goalX == 476f)
    assertTrue(state.player.x == 18f)
    assertTrue(state.player.y == 188f)
    assertTrue(state.platforms.single().width == 128f)
    assertTrue(state.coins.single().x == 42f)
    assertTrue(state.enemies.single().patrolMaxX == 132f)
  }

  @Test
  fun stepPlatformer_movesRightWhenInputHeld() {
    val state =
      PlatformerState(
        player = PlatformerPlayer(x = 12f, y = 24f, onGround = true),
        platforms = listOf(PlatformerRect(x = 0f, y = 40f, width = 200f, height = 20f)),
        coins = emptyList(),
        enemies = emptyList(),
        worldWidth = 240f,
        worldHeight = 240f,
        goalX = 220f,
      )

    val next =
      stepPlatformer(
        state = state,
        input = PlatformerInput(rightHeld = true),
        physics = ClassicPhysicsProfile(),
        dt = 1f / 60f,
      )

    assertTrue(next.player.x > state.player.x)
    assertTrue(next.player.vx > 0f)
    assertFalse(next.crashed)
  }

  @Test
  fun stepPlatformer_collectsCoinWhenPlayerOverlapsIt() {
    val state =
      PlatformerState(
        player = PlatformerPlayer(x = 10f, y = 10f, onGround = true),
        platforms = listOf(PlatformerRect(x = 0f, y = 40f, width = 200f, height = 20f)),
        coins = listOf(PlatformerCoin(x = 14f, y = 14f)),
        enemies = emptyList(),
        worldWidth = 240f,
        worldHeight = 240f,
        goalX = 220f,
      )

    val next =
      stepPlatformer(
        state = state,
        input = PlatformerInput(),
        physics = ClassicPhysicsProfile(),
        dt = 1f / 60f,
      )

    assertTrue(next.coins.single().collected)
    assertTrue(next.score == 1)
  }

  @Test
  fun stepPlatformer_crashesOnSideHitEnemy() {
    val state =
      PlatformerState(
        player = PlatformerPlayer(x = 12f, y = 20f, onGround = true),
        platforms = listOf(PlatformerRect(x = 0f, y = 40f, width = 200f, height = 20f)),
        coins = emptyList(),
        enemies = listOf(PlatformerEnemy(x = 18f, y = 20f, patrolMinX = 18f, patrolMaxX = 18f)),
        worldWidth = 240f,
        worldHeight = 240f,
        goalX = 220f,
      )

    val next =
      stepPlatformer(
        state = state,
        input = PlatformerInput(),
        physics = ClassicPhysicsProfile(),
        dt = 1f / 60f,
      )

    assertTrue(next.crashed)
  }
}
