package ai.openclaw.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlin.math.min
import kotlin.random.Random
import kotlinx.coroutines.delay

private const val snakeBoardCols = 18
private const val snakeBoardRows = 28

internal data class SnakeCell(val x: Int, val y: Int)

internal enum class SnakeDirection {
  Up,
  Down,
  Left,
  Right,
}

internal data class SnakeAdvanceResult(
  val snake: List<SnakeCell>,
  val food: SnakeCell,
  val ateFood: Boolean,
  val crashed: Boolean,
)

internal fun advanceSnake(
  snake: List<SnakeCell>,
  direction: SnakeDirection,
  food: SnakeCell,
  cols: Int = snakeBoardCols,
  rows: Int = snakeBoardRows,
  nextFood: (List<SnakeCell>) -> SnakeCell = ::randomFood,
): SnakeAdvanceResult {
  val head = snake.firstOrNull() ?: return SnakeAdvanceResult(emptyList(), food, ateFood = false, crashed = true)
  val next =
    when (direction) {
      SnakeDirection.Up -> SnakeCell(head.x, head.y - 1)
      SnakeDirection.Down -> SnakeCell(head.x, head.y + 1)
      SnakeDirection.Left -> SnakeCell(head.x - 1, head.y)
      SnakeDirection.Right -> SnakeCell(head.x + 1, head.y)
    }

  val hitsWall = next.x !in 0 until cols || next.y !in 0 until rows
  if (hitsWall) {
    return SnakeAdvanceResult(snake = snake, food = food, ateFood = false, crashed = true)
  }

  val ateFood = next == food
  val collisionBody = if (ateFood) snake else snake.dropLast(1)
  if (collisionBody.contains(next)) {
    return SnakeAdvanceResult(snake = snake, food = food, ateFood = false, crashed = true)
  }

  val grownSnake = buildList {
    add(next)
    addAll(snake)
  }

  return if (ateFood) {
    SnakeAdvanceResult(
      snake = grownSnake,
      food = nextFood(grownSnake),
      ateFood = true,
      crashed = false,
    )
  } else {
    SnakeAdvanceResult(
      snake = grownSnake.dropLast(1),
      food = food,
      ateFood = false,
      crashed = false,
    )
  }
}

@Composable
fun ArcadeSnakeTabScreen() {
  var score by rememberSaveable { mutableIntStateOf(0) }
  var bestScore by rememberSaveable { mutableIntStateOf(0) }
  var running by rememberSaveable { mutableStateOf(false) }
  var crashed by rememberSaveable { mutableStateOf(false) }
  var tickMs by rememberSaveable { mutableIntStateOf(190) }
  var direction by remember { mutableStateOf(SnakeDirection.Right) }
  var pendingDirection by remember { mutableStateOf(SnakeDirection.Right) }
  val snake = remember { mutableStateListOf<SnakeCell>() }
  var food by remember { mutableStateOf(SnakeCell(12, 10)) }

  fun resetGame() {
    snake.clear()
    snake += SnakeCell(5, 14)
    snake += SnakeCell(4, 14)
    snake += SnakeCell(3, 14)
    direction = SnakeDirection.Right
    pendingDirection = SnakeDirection.Right
    score = 0
    tickMs = 190
    crashed = false
    running = false
    food = randomFood(excluding = snake)
  }

  fun canTurn(next: SnakeDirection): Boolean =
    when (direction) {
      SnakeDirection.Up -> next != SnakeDirection.Down
      SnakeDirection.Down -> next != SnakeDirection.Up
      SnakeDirection.Left -> next != SnakeDirection.Right
      SnakeDirection.Right -> next != SnakeDirection.Left
    }

  LaunchedEffect(Unit) {
    if (snake.isEmpty()) resetGame()
  }

  LaunchedEffect(running, crashed) {
    while (running && !crashed) {
      delay(tickMs.toLong())
      val resolvedDirection =
        if (canTurn(pendingDirection)) {
          pendingDirection
        } else {
          direction
        }
      direction = resolvedDirection

      val result =
        advanceSnake(
          snake = snake.toList(),
          direction = resolvedDirection,
          food = food,
        )

      if (result.crashed) {
        crashed = true
        running = false
        bestScore = maxOf(bestScore, score)
      } else {
        snake.clear()
        snake.addAll(result.snake)
        food = result.food
        if (result.ateFood) {
          score += 1
          bestScore = maxOf(bestScore, score)
          tickMs = maxOf(80, tickMs - 6)
        }
      }
    }
  }

  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "Arcade Runtime",
      title = "Snake",
      subtitle = "Retro terminal mode. Clean neon grid, touch controls, and no fake mobile-game chrome.",
    )

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label =
          when {
            crashed -> "Crashed"
            running -> "Live"
            else -> "Standby"
          },
        active = !crashed,
        tone = if (crashed) SolanaPanelTone.Orange else SolanaPanelTone.Green,
      )
      SolanaStatusPill(
        label = "Speed ${190 - tickMs + 1}",
        active = true,
        tone = SolanaPanelTone.Purple,
      )
    }

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaMetricTile(label = "Score", value = score.toString(), tone = SolanaPanelTone.Green, modifier = Modifier.weight(1f))
      SolanaMetricTile(label = "Best", value = bestScore.toString(), tone = SolanaPanelTone.Purple, modifier = Modifier.weight(1f))
      SolanaMetricTile(
        label = "State",
        value =
          when {
            crashed -> "DOWN"
            running -> "RUN"
            else -> "IDLE"
          },
        tone = if (crashed) SolanaPanelTone.Orange else SolanaPanelTone.Green,
        modifier = Modifier.weight(1f),
      )
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Green) {
      SolanaSectionLabel("Snake Grid")
      Box(modifier = Modifier.fillMaxWidth()) {
        val boardRatio = snakeBoardCols.toFloat() / snakeBoardRows.toFloat()
        val boardModifier =
          Modifier
            .fillMaxWidth()
            .aspectRatio(boardRatio)

        Surface(
          modifier = boardModifier,
          shape = RoundedCornerShape(6.dp),
          color = mobileCodeBg,
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Canvas(modifier = Modifier.fillMaxSize()) {
            val cell = min(size.width / snakeBoardCols, size.height / snakeBoardRows)
            val boardWidth = cell * snakeBoardCols
            val boardHeight = cell * snakeBoardRows
            val originX = (size.width - boardWidth) / 2f
            val originY = (size.height - boardHeight) / 2f

            drawRect(
              brush =
                Brush.verticalGradient(
                  listOf(
                    Color(0x0900FFAA),
                    Color.Transparent,
                    Color(0x069945FF),
                  ),
                ),
            )

            for (x in 0..snakeBoardCols) {
              val dx = originX + (x * cell)
              drawLine(
                color = mobileSuccess.copy(alpha = 0.08f),
                start = Offset(dx, originY),
                end = Offset(dx, originY + boardHeight),
                strokeWidth = 1f,
              )
            }
            for (y in 0..snakeBoardRows) {
              val dy = originY + (y * cell)
              drawLine(
                color = mobileAccent.copy(alpha = 0.08f),
                start = Offset(originX, dy),
                end = Offset(originX + boardWidth, dy),
                strokeWidth = 1f,
              )
            }

            val foodX = originX + food.x * cell + cell * 0.18f
            val foodY = originY + food.y * cell + cell * 0.18f
            drawRoundRect(
              color = mobileOrange,
              topLeft = Offset(foodX, foodY),
              size = Size(cell * 0.64f, cell * 0.64f),
              cornerRadius = CornerRadius(cell * 0.14f, cell * 0.14f),
            )

            snake.forEachIndexed { index, segment ->
              val sx = originX + segment.x * cell + cell * 0.1f
              val sy = originY + segment.y * cell + cell * 0.1f
              drawRoundRect(
                color = if (index == 0) mobileSuccess else mobileAccent,
                topLeft = Offset(sx, sy),
                size = Size(cell * 0.8f, cell * 0.8f),
                cornerRadius = CornerRadius(cell * 0.12f, cell * 0.12f),
              )
            }

            if (crashed) {
              drawRect(color = Color.Black.copy(alpha = 0.58f))
            }
          }

          if (crashed) {
            Column(
              modifier = Modifier.fillMaxSize().padding(20.dp),
              verticalArrangement = Arrangement.Center,
              horizontalAlignment = Alignment.CenterHorizontally,
            ) {
              Text("SIGNAL LOST", style = mobileTitle2, color = mobileOrange)
              Text(
                "Snake hit the frame. Reset and run it again.",
                style = mobileCallout,
                color = mobileText,
                modifier = Modifier.padding(top = 8.dp),
              )
            }
          }
        }
      }
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
      SolanaSectionLabel("Command Deck", tone = SolanaPanelTone.Purple)
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        ArcadeButton(
          label = if (running) "Pause" else if (crashed) "Resume Locked" else "Run",
          enabled = !crashed,
          tone = SolanaPanelTone.Green,
          modifier = Modifier.weight(1f),
        ) {
          if (snake.isEmpty()) resetGame()
          running = !running
        }
        ArcadeButton(
          label = "Reset",
          enabled = true,
          tone = SolanaPanelTone.Orange,
          modifier = Modifier.weight(1f),
        ) {
          resetGame()
        }
      }

      Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        ArcadeDirectionButton(
          label = "UP",
          onClick = { if (canTurn(SnakeDirection.Up)) pendingDirection = SnakeDirection.Up },
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          ArcadeDirectionButton(
            label = "LEFT",
            onClick = { if (canTurn(SnakeDirection.Left)) pendingDirection = SnakeDirection.Left },
          )
          ArcadeDirectionButton(
            label = "DOWN",
            onClick = { if (canTurn(SnakeDirection.Down)) pendingDirection = SnakeDirection.Down },
          )
          ArcadeDirectionButton(
            label = "RIGHT",
            onClick = { if (canTurn(SnakeDirection.Right)) pendingDirection = SnakeDirection.Right },
          )
        }
      }
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Orange) {
      SolanaSectionLabel("Operator Notes", tone = SolanaPanelTone.Orange)
      Text(
        "> Touch controls only.\n> Speed increases on every food pickup.\n> Pair the app for tools. Stay here for pure retro terminal play.",
        style = mobileCallout,
        color = mobileText,
      )
    }
  }
}

@Composable
private fun ArcadeButton(
  label: String,
  enabled: Boolean,
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
  onClick: () -> Unit,
) {
  val borderColor =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccess
      SolanaPanelTone.Purple -> mobileAccent
      SolanaPanelTone.Orange -> mobileOrange
      SolanaPanelTone.Neutral -> mobileBorderStrong
    }
  val bgColor =
    when (tone) {
      SolanaPanelTone.Green -> mobileSuccessSoft
      SolanaPanelTone.Purple -> mobileAccentSoft
      SolanaPanelTone.Orange -> mobileOrangeSoft
      SolanaPanelTone.Neutral -> mobileSurfaceStrong
    }
  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.height(46.dp),
    shape = RoundedCornerShape(4.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = bgColor,
        contentColor = borderColor,
        disabledContainerColor = mobileSurfaceStrong,
        disabledContentColor = mobileTextTertiary,
      ),
    border = BorderStroke(1.dp, borderColor),
  ) {
    Text(label.uppercase(), style = mobileHeadline)
  }
}

@Composable
private fun ArcadeDirectionButton(
  label: String,
  onClick: () -> Unit,
) {
  ArcadeButton(
    label = label,
    enabled = true,
    tone = SolanaPanelTone.Purple,
    modifier = Modifier.size(width = 96.dp, height = 42.dp),
    onClick = onClick,
  )
}

private fun randomFood(excluding: List<SnakeCell>): SnakeCell {
  val occupied = excluding.toSet()
  val freeCells = mutableListOf<SnakeCell>()
  for (x in 0 until snakeBoardCols) {
    for (y in 0 until snakeBoardRows) {
      val cell = SnakeCell(x, y)
      if (cell !in occupied) {
        freeCells += cell
      }
    }
  }
  return freeCells.random(Random.Default)
}
