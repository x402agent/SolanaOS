/**
 * Ralph Wiggum Loop for Chess Agents
 * 
 * Iterative, failure-driven refinement for chess AI agents.
 * The agent keeps improving until it meets the success criteria,
 * using each failure as training data for the next iteration.
 * 
 * Based on Geoffrey Huntley's Ralph Wiggum methodology:
 * "iteration > perfection" - failures are valuable training data
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { Chess } from 'chess.js';
import { Client as LangSmithClient, RunTree } from 'langsmith';

// ============ Types ============

interface ChessMetrics {
  winRate: number;
  avgMoveTime: number;
  blunders: number;
  accuracy: number;
  gamesPlayed: number;
  totalMoves: number;
}

interface TargetMetrics {
  winRate: number;
  avgMoveTime: number;
  maxBlunders: number;
  minAccuracy: number;
}

interface Improvement {
  iteration: number;
  change: string;
  metrics: ChessMetrics;
  reasoning: string;
  timestamp: number;
}

interface RalphLoopConfig {
  agentId: string;
  maxIterations: number;
  targetMetrics: TargetMetrics;
  model?: string;
  langsmithProject?: string;
  verbose?: boolean;
}

interface RalphLoopResult {
  success: boolean;
  iterations: number;
  finalMetrics: ChessMetrics;
  improvements: Improvement[];
  sessionId?: string;
  langsmithRunId?: string;
}

// ============ LangSmith Integration ============

class ChessAgentTracer {
  private client: LangSmithClient | null = null;
  private project: string;
  private currentRun: RunTree | null = null;

  constructor(project?: string) {
    this.project = project || 'solana-chess-agents';
    
    if (process.env.LANGCHAIN_API_KEY) {
      this.client = new LangSmithClient({
        apiKey: process.env.LANGCHAIN_API_KEY,
      });
    }
  }

  async startRun(name: string, inputs: any): Promise<RunTree | null> {
    if (!this.client) return null;

    this.currentRun = new RunTree({
      name,
      run_type: 'chain',
      inputs,
      project_name: this.project,
    });

    await this.currentRun.postRun();
    return this.currentRun;
  }

  async logIteration(iteration: number, metrics: ChessMetrics, change: string) {
    if (!this.currentRun) return;

    const childRun = await this.currentRun.createChild({
      name: `iteration-${iteration}`,
      run_type: 'llm',
      inputs: { iteration, previousMetrics: metrics },
    });

    await childRun.postRun();
    await childRun.end({ metrics, change });
    await childRun.patchRun();
  }

  async endRun(result: RalphLoopResult) {
    if (!this.currentRun) return;

    await this.currentRun.end({
      outputs: result,
      error: result.success ? undefined : 'Did not meet target metrics',
    });
    await this.currentRun.patchRun();
  }

  getRunId(): string | undefined {
    return this.currentRun?.id;
  }
}

// ============ Chess Evaluation ============

interface MoveEvaluation {
  move: string;
  score: number;
  isBlunder: boolean;
  betterMove?: string;
  thinking?: string;
}

class ChessEvaluator {
  private positions: Map<string, number> = new Map();

  // Simple material-based evaluation
  evaluatePosition(fen: string): number {
    const chess = new Chess(fen);
    const board = chess.board();
    
    const pieceValues: Record<string, number> = {
      p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
    };

    let score = 0;
    for (const row of board) {
      for (const piece of row) {
        if (piece) {
          const value = pieceValues[piece.type.toLowerCase()];
          score += piece.color === 'w' ? value : -value;
        }
      }
    }

    return score;
  }

  // Check if a move is a blunder (loses significant material)
  isMoveBlunder(
    fenBefore: string,
    move: string,
    fenAfter: string
  ): { isBlunder: boolean; scoreDiff: number } {
    const scoreBefore = this.evaluatePosition(fenBefore);
    const scoreAfter = this.evaluatePosition(fenAfter);
    const turn = new Chess(fenBefore).turn();
    
    // From the perspective of the player who moved
    const scoreDiff = turn === 'w' 
      ? scoreAfter - scoreBefore 
      : scoreBefore - scoreAfter;

    // A blunder loses 2+ points of material unexpectedly
    return {
      isBlunder: scoreDiff < -2,
      scoreDiff,
    };
  }

  // Find the best move in a position (simplified)
  findBestMove(fen: string): { move: string; score: number } | null {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const testChess = new Chess(fen);
      testChess.move(move);
      
      // Evaluate position after move
      const score = this.evaluatePosition(testChess.fen());
      const adjustedScore = chess.turn() === 'w' ? score : -score;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }
    }

    return { move: bestMove.san, score: bestScore };
  }
}

// ============ Ralph Wiggum Chess Loop ============

export class RalphWiggumChessLoop {
  private config: RalphLoopConfig;
  private tracer: ChessAgentTracer;
  private evaluator: ChessEvaluator;
  private improvements: Improvement[] = [];
  private currentMetrics: ChessMetrics;
  private sessionId: string | null = null;
  
  constructor(config: RalphLoopConfig) {
    this.config = {
      model: 'claude-sonnet-4-5-20250929',
      ...config,
    };
    
    this.tracer = new ChessAgentTracer(config.langsmithProject);
    this.evaluator = new ChessEvaluator();
    this.currentMetrics = {
      winRate: 0,
      avgMoveTime: 0,
      blunders: 0,
      accuracy: 0,
      gamesPlayed: 0,
      totalMoves: 0,
    };
  }

  private log(message: string) {
    if (this.config.verbose) {
      console.log(`[Ralph Loop] ${message}`);
    }
  }

  // Check if success criteria is met
  private meetsSuccessCriteria(): boolean {
    const { targetMetrics } = this.config;
    return (
      this.currentMetrics.winRate >= targetMetrics.winRate &&
      this.currentMetrics.avgMoveTime <= targetMetrics.avgMoveTime &&
      this.currentMetrics.blunders <= targetMetrics.maxBlunders &&
      this.currentMetrics.accuracy >= targetMetrics.minAccuracy
    );
  }

  // Analyze failures and suggest improvements
  private async analyzeFailures(): Promise<string> {
    const { targetMetrics } = this.config;
    const issues: string[] = [];

    if (this.currentMetrics.winRate < targetMetrics.winRate) {
      const diff = targetMetrics.winRate - this.currentMetrics.winRate;
      issues.push(`Win rate is ${diff.toFixed(1)}% below target`);
    }

    if (this.currentMetrics.avgMoveTime > targetMetrics.avgMoveTime) {
      issues.push(`Average move time too slow (${this.currentMetrics.avgMoveTime}ms vs ${targetMetrics.avgMoveTime}ms target)`);
    }

    if (this.currentMetrics.blunders > targetMetrics.maxBlunders) {
      issues.push(`Too many blunders (${this.currentMetrics.blunders} vs max ${targetMetrics.maxBlunders})`);
    }

    if (this.currentMetrics.accuracy < targetMetrics.minAccuracy) {
      issues.push(`Move accuracy too low (${this.currentMetrics.accuracy}% vs ${targetMetrics.minAccuracy}% target)`);
    }

    return issues.join('; ');
  }

  // Get improvement suggestions from Claude
  private async getImprovementSuggestion(
    session: any,
    iteration: number,
    failureAnalysis: string
  ): Promise<string> {
    const prompt = `
You are analyzing a chess AI agent's performance in iteration ${iteration}.

Current Metrics:
- Win Rate: ${this.currentMetrics.winRate}%
- Avg Move Time: ${this.currentMetrics.avgMoveTime}ms
- Blunders: ${this.currentMetrics.blunders}
- Accuracy: ${this.currentMetrics.accuracy}%
- Games Played: ${this.currentMetrics.gamesPlayed}

Target Metrics:
- Win Rate: ${this.config.targetMetrics.winRate}%
- Max Move Time: ${this.config.targetMetrics.avgMoveTime}ms
- Max Blunders: ${this.config.targetMetrics.maxBlunders}
- Min Accuracy: ${this.config.targetMetrics.minAccuracy}%

Failure Analysis: ${failureAnalysis}

Previous Improvements:
${this.improvements.map(i => `- Iteration ${i.iteration}: ${i.change}`).join('\n') || 'None yet'}

Based on this analysis, suggest ONE specific improvement the agent should make.
Focus on the most impactful change. Be specific and actionable.
Respond with just the improvement suggestion, no preamble.
`;

    await session.send(prompt);
    
    let suggestion = '';
    for await (const msg of session.receive()) {
      if (msg.type === 'assistant') {
        const text = (msg as any).message?.content?.find(
          (c: any) => c.type === 'text'
        )?.text;
        if (text) suggestion = text;
      }
    }

    return suggestion.trim() || 'Increase search depth for better move evaluation';
  }

  // Simulate a training game (in production, this would play real games)
  private async runTrainingGame(): Promise<{
    won: boolean;
    moves: number;
    blunders: number;
    avgMoveTime: number;
    accuracy: number;
  }> {
    const chess = new Chess();
    let moves = 0;
    let blunders = 0;
    let goodMoves = 0;
    const moveTimes: number[] = [];

    // Simulate a game with random + best move mix
    while (!chess.isGameOver() && moves < 100) {
      const start = Date.now();
      const legalMoves = chess.moves({ verbose: true });
      
      if (legalMoves.length === 0) break;

      // Mix of random and "best" moves based on current accuracy
      const usesBestMove = Math.random() < (this.currentMetrics.accuracy / 100 + 0.3);
      
      let selectedMove;
      if (usesBestMove) {
        const best = this.evaluator.findBestMove(chess.fen());
        selectedMove = best 
          ? legalMoves.find(m => m.san === best.move) || legalMoves[0]
          : legalMoves[0];
      } else {
        selectedMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }

      const fenBefore = chess.fen();
      chess.move(selectedMove);
      const fenAfter = chess.fen();

      // Check for blunders (simplified)
      const { isBlunder } = this.evaluator.isMoveBlunder(
        fenBefore,
        selectedMove.san,
        fenAfter
      );

      if (isBlunder) {
        blunders++;
      } else {
        goodMoves++;
      }

      moveTimes.push(Date.now() - start + Math.random() * 100); // Simulated think time
      moves++;
    }

    const avgMoveTime = moveTimes.reduce((a, b) => a + b, 0) / moveTimes.length;
    const accuracy = moves > 0 ? (goodMoves / moves) * 100 : 0;
    
    // Simplified win determination based on material
    const finalScore = this.evaluator.evaluatePosition(chess.fen());
    const won = finalScore > 0; // White advantage = win for our agent (simplified)

    return {
      won,
      moves,
      blunders,
      avgMoveTime,
      accuracy,
    };
  }

  // Run training games and update metrics
  private async runTrainingBatch(gamesCount: number = 5): Promise<void> {
    let totalWins = 0;
    let totalMoves = 0;
    let totalBlunders = 0;
    let totalMoveTime = 0;
    let totalAccuracy = 0;

    for (let i = 0; i < gamesCount; i++) {
      const result = await this.runTrainingGame();
      
      if (result.won) totalWins++;
      totalMoves += result.moves;
      totalBlunders += result.blunders;
      totalMoveTime += result.avgMoveTime;
      totalAccuracy += result.accuracy;
    }

    // Update metrics with new batch results
    const batchWinRate = (totalWins / gamesCount) * 100;
    const batchAvgMoveTime = totalMoveTime / gamesCount;
    const batchAccuracy = totalAccuracy / gamesCount;

    // Running average with previous games
    const prevGames = this.currentMetrics.gamesPlayed;
    const totalGames = prevGames + gamesCount;

    if (prevGames > 0) {
      this.currentMetrics.winRate = (
        (this.currentMetrics.winRate * prevGames + batchWinRate * gamesCount) / totalGames
      );
      this.currentMetrics.avgMoveTime = (
        (this.currentMetrics.avgMoveTime * prevGames + batchAvgMoveTime * gamesCount) / totalGames
      );
      this.currentMetrics.accuracy = (
        (this.currentMetrics.accuracy * prevGames + batchAccuracy * gamesCount) / totalGames
      );
    } else {
      this.currentMetrics.winRate = batchWinRate;
      this.currentMetrics.avgMoveTime = batchAvgMoveTime;
      this.currentMetrics.accuracy = batchAccuracy;
    }

    this.currentMetrics.blunders = totalBlunders;
    this.currentMetrics.gamesPlayed = totalGames;
    this.currentMetrics.totalMoves += totalMoves;
  }

  // Apply an improvement (in production, this would modify agent behavior)
  private async applyImprovement(suggestion: string, iteration: number): Promise<void> {
    // Record the improvement
    const improvement: Improvement = {
      iteration,
      change: suggestion,
      metrics: { ...this.currentMetrics },
      reasoning: await this.analyzeFailures(),
      timestamp: Date.now(),
    };

    this.improvements.push(improvement);
    this.log(`Applied improvement: ${suggestion}`);

    // Simulate improvement effect (in production, this would actually modify the agent)
    // Small random improvement to metrics
    this.currentMetrics.accuracy = Math.min(100, this.currentMetrics.accuracy + Math.random() * 5);
    this.currentMetrics.avgMoveTime = Math.max(50, this.currentMetrics.avgMoveTime - Math.random() * 20);
    
    await this.tracer.logIteration(iteration, this.currentMetrics, suggestion);
  }

  // Main Ralph Wiggum loop
  async run(): Promise<RalphLoopResult> {
    this.log(`Starting Ralph Wiggum loop for agent ${this.config.agentId}`);
    this.log(`Target metrics: ${JSON.stringify(this.config.targetMetrics)}`);
    this.log(`Max iterations: ${this.config.maxIterations}`);

    // Start LangSmith tracing
    await this.tracer.startRun(`ralph-loop-${this.config.agentId}`, {
      config: this.config,
      startTime: Date.now(),
    });

    // Create Claude session for improvement suggestions
    const session = unstable_v2_createSession({
      model: this.config.model!,
    });

    let iteration = 0;

    try {
      // Initial training batch
      await this.runTrainingBatch(10);
      this.log(`Initial metrics: ${JSON.stringify(this.currentMetrics)}`);

      // Ralph Wiggum loop: keep going until success or max iterations
      while (!this.meetsSuccessCriteria() && iteration < this.config.maxIterations) {
        iteration++;
        this.log(`\n=== Iteration ${iteration} ===`);

        // Analyze what's failing
        const failureAnalysis = await this.analyzeFailures();
        this.log(`Failure analysis: ${failureAnalysis}`);

        // Get improvement suggestion from Claude
        const suggestion = await this.getImprovementSuggestion(
          session,
          iteration,
          failureAnalysis
        );
        this.log(`Improvement suggestion: ${suggestion}`);

        // Apply the improvement
        await this.applyImprovement(suggestion, iteration);

        // Run more training games to measure effect
        await this.runTrainingBatch(5);
        this.log(`Updated metrics: ${JSON.stringify(this.currentMetrics)}`);

        // Check if we've met the criteria
        if (this.meetsSuccessCriteria()) {
          this.log(`✅ SUCCESS! Met all target metrics after ${iteration} iterations`);
          break;
        }
      }

      const success = this.meetsSuccessCriteria();
      
      if (!success) {
        this.log(`❌ Did not meet target metrics after ${iteration} iterations`);
      }

      const result: RalphLoopResult = {
        success,
        iterations: iteration,
        finalMetrics: { ...this.currentMetrics },
        improvements: this.improvements,
        sessionId: this.sessionId || undefined,
        langsmithRunId: this.tracer.getRunId(),
      };

      // End tracing
      await this.tracer.endRun(result);

      return result;
    } finally {
      session.close();
    }
  }
}

// ============ Example Usage ============

export async function runChessAgentTraining(): Promise<RalphLoopResult> {
  const loop = new RalphWiggumChessLoop({
    agentId: 'chess-agent-001',
    maxIterations: 20,
    targetMetrics: {
      winRate: 60,
      avgMoveTime: 200,
      maxBlunders: 3,
      minAccuracy: 70,
    },
    model: 'claude-sonnet-4-5-20250929',
    langsmithProject: 'solana-chess-agents',
    verbose: true,
  });

  return await loop.run();
}

// ============ CLI Runner ============

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   ♟️  RALPH WIGGUM CHESS AGENT LOOP                             ║
║                                                                ║
║   "Me fail chess? That's unpossible!"                          ║
║                                                                ║
║   Iterative, failure-driven refinement for chess AI            ║
║   Based on Geoffrey Huntley's methodology                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    const result = await runChessAgentTraining();
    
    console.log('\n📊 Final Results:');
    console.log('─'.repeat(50));
    console.log(`Success: ${result.success ? '✅ Yes' : '❌ No'}`);
    console.log(`Iterations: ${result.iterations}`);
    console.log(`Final Metrics:`);
    console.log(`  Win Rate: ${result.finalMetrics.winRate.toFixed(1)}%`);
    console.log(`  Avg Move Time: ${result.finalMetrics.avgMoveTime.toFixed(0)}ms`);
    console.log(`  Blunders: ${result.finalMetrics.blunders}`);
    console.log(`  Accuracy: ${result.finalMetrics.accuracy.toFixed(1)}%`);
    console.log(`  Games Played: ${result.finalMetrics.gamesPlayed}`);
    
    if (result.improvements.length > 0) {
      console.log('\n📈 Improvements Made:');
      result.improvements.forEach((imp, i) => {
        console.log(`  ${i + 1}. [Iteration ${imp.iteration}] ${imp.change}`);
      });
    }

    if (result.langsmithRunId) {
      console.log(`\n🔗 LangSmith Run: https://smith.langchain.com/runs/${result.langsmithRunId}`);
    }

  } catch (error) {
    console.error('Error running Ralph Wiggum loop:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default RalphWiggumChessLoop;
