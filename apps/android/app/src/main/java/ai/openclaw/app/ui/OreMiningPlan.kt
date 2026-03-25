package ai.openclaw.app.ui

import kotlin.math.roundToInt

data class OreMiningPlan(
  val amountPerBlockSol: Double?,
  val occupiedBlocks: Int?,
  val totalDeploymentSol: Double?,
  val winningCoveragePct: Double?,
  val strategyLabel: String,
  val strategySummary: String,
  val riskSummary: String,
)

fun calculateOreMiningPlan(
  amountPerBlockInput: String,
  occupiedBlocksInput: String,
): OreMiningPlan {
  val amountPerBlockSol = amountPerBlockInput.trim().toDoubleOrNull()?.takeIf { it > 0.0 }
  val occupiedBlocks = occupiedBlocksInput.trim().toIntOrNull()?.takeIf { it in 1..25 }
  val totalDeploymentSol =
    if (amountPerBlockSol != null && occupiedBlocks != null) {
      amountPerBlockSol * occupiedBlocks.toDouble()
    } else {
      null
    }
  val winningCoveragePct =
    occupiedBlocks?.let { blockCount ->
      (blockCount.toDouble() / 25.0) * 100.0
    }

  val strategyLabel =
    when {
      occupiedBlocks == null -> "Invalid"
      occupiedBlocks == 1 -> "Single Block"
      occupiedBlocks in 2..5 -> "Concentrated"
      occupiedBlocks in 6..9 -> "Balanced"
      occupiedBlocks in 10..15 -> "Diversified"
      else -> "Wide Coverage"
    }

  val strategySummary =
    when {
      occupiedBlocks == null -> "Choose between 1 and 25 blocks to estimate your round exposure."
      occupiedBlocks == 1 -> "Maximum concentration. Lowest hit rate, highest variance if your block lands."
      occupiedBlocks in 2..5 -> "Lower win frequency with larger swings when your chosen block wins."
      occupiedBlocks in 6..9 -> "Middle-ground spread. Less concentrated than pure conviction mining."
      occupiedBlocks in 10..15 -> "Higher round coverage with smaller per-block conviction and steadier variance."
      else -> "Very broad coverage. Better hit rate, but each winning share is thinner."
    }

  val riskSummary =
    when {
      totalDeploymentSol == null ->
        "Enter a positive SOL amount and 1-25 blocks. Most rounds lose deployed SOL on non-winning blocks."
      totalDeploymentSol < 0.05 ->
        "Light exposure. Good for learning the grid mechanics before scaling."
      totalDeploymentSol < 0.25 ->
        "Moderate exposure. Keep enough SOL reserved for fees and repeated rounds."
      totalDeploymentSol < 1.0 ->
        "Meaningful round risk. Use only what you are comfortable losing across repeated rounds."
      else ->
        "High exposure. ORE v2 is loss-heavy between wins, so size down unless you want large variance."
    }

  return OreMiningPlan(
    amountPerBlockSol = amountPerBlockSol,
    occupiedBlocks = occupiedBlocks,
    totalDeploymentSol = totalDeploymentSol,
    winningCoveragePct = winningCoveragePct,
    strategyLabel = strategyLabel,
    strategySummary = strategySummary,
    riskSummary = riskSummary,
  )
}

fun formatOrePlanNumber(value: Double, digits: Int = 3): String =
  "%.${digits}f".format(value).trimEnd('0').trimEnd('.')

fun formatOreCoverage(value: Double): String = "${value.roundToInt()}%"
