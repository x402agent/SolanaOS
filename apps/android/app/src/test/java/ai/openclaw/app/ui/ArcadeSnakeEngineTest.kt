package ai.openclaw.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArcadeSnakeEngineTest {
  @Test
  fun advanceSnake_movesForwardWithoutGrowing() {
    val snake = listOf(SnakeCell(5, 5), SnakeCell(4, 5), SnakeCell(3, 5))

    val result =
      advanceSnake(
        snake = snake,
        direction = SnakeDirection.Right,
        food = SnakeCell(10, 10),
      )

    assertFalse(result.crashed)
    assertFalse(result.ateFood)
    assertEquals(listOf(SnakeCell(6, 5), SnakeCell(5, 5), SnakeCell(4, 5)), result.snake)
    assertEquals(SnakeCell(10, 10), result.food)
  }

  @Test
  fun advanceSnake_growsAndRequestsNewFoodWhenEating() {
    val snake = listOf(SnakeCell(5, 5), SnakeCell(4, 5), SnakeCell(3, 5))

    val result =
      advanceSnake(
        snake = snake,
        direction = SnakeDirection.Right,
        food = SnakeCell(6, 5),
        nextFood = { SnakeCell(1, 1) },
      )

    assertFalse(result.crashed)
    assertTrue(result.ateFood)
    assertEquals(listOf(SnakeCell(6, 5), SnakeCell(5, 5), SnakeCell(4, 5), SnakeCell(3, 5)), result.snake)
    assertEquals(SnakeCell(1, 1), result.food)
  }

  @Test
  fun advanceSnake_allowsMovingIntoFormerTailCell() {
    val snake = listOf(
      SnakeCell(2, 1),
      SnakeCell(2, 2),
      SnakeCell(1, 2),
      SnakeCell(1, 1),
    )

    val result =
      advanceSnake(
        snake = snake,
        direction = SnakeDirection.Left,
        food = SnakeCell(9, 9),
      )

    assertFalse(result.crashed)
    assertEquals(
      listOf(
        SnakeCell(1, 1),
        SnakeCell(2, 1),
        SnakeCell(2, 2),
        SnakeCell(1, 2),
      ),
      result.snake,
    )
  }

  @Test
  fun advanceSnake_crashesOnWall() {
    val snake = listOf(SnakeCell(0, 0), SnakeCell(0, 1), SnakeCell(0, 2))

    val result =
      advanceSnake(
        snake = snake,
        direction = SnakeDirection.Left,
        food = SnakeCell(9, 9),
      )

    assertTrue(result.crashed)
    assertFalse(result.ateFood)
    assertEquals(snake, result.snake)
  }
}
