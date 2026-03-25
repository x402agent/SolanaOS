package ai.openclaw.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OreMiningPlanTest {
  @Test
  fun calculatesBalancedPlan() {
    val plan = calculateOreMiningPlan(amountPerBlockInput = "0.01", occupiedBlocksInput = "5")

    assertEquals(0.01, plan.amountPerBlockSol)
    assertEquals(5, plan.occupiedBlocks)
    assertEquals(0.05, plan.totalDeploymentSol)
    assertEquals(20.0, plan.winningCoveragePct)
    assertEquals("Concentrated", plan.strategyLabel)
  }

  @Test
  fun rejectsOutOfRangeBlocks() {
    val plan = calculateOreMiningPlan(amountPerBlockInput = "0.01", occupiedBlocksInput = "30")

    assertEquals(0.01, plan.amountPerBlockSol)
    assertNull(plan.occupiedBlocks)
    assertNull(plan.totalDeploymentSol)
    assertNull(plan.winningCoveragePct)
    assertEquals("Invalid", plan.strategyLabel)
  }

  @Test
  fun formatsCoverageAndNumbers() {
    assertEquals("0.125", formatOrePlanNumber(0.125))
    assertEquals("20%", formatOreCoverage(20.0))
  }
}
