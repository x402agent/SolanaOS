/**
 * LangChain Chess Agent with LangSmith Tracing
 * 
 * A chess-playing agent built on LangChain with full observability
 * through LangSmith for debugging, evaluation, and improvement.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { traceable } from 'langsmith/traceable';
import { wrapOpenAI } from 'langsmith/wrappers';
import { Chess } from 'chess.js';
import { z } from 'zod';

// ============ Types ============

interface MoveAnalysis {
  move: string;
  reasoning: string;
  confidence: number;
  threats: string[];
  opportunities: string[];
}

interface GameState {
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  moveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  legalMoves: string[];
  materialBalance: number;
}

interface AgentConfig {
  model?: string;
  temperature?: number;
  thinkingBudget?: number;
  style?: 'aggressive' | 'defensive' | 'balanced';
  openingBook?: boolean;
  endgameTable?: boolean;
}

// ============ Move Schema ============

const MoveOutputSchema = z.object({
  move: z.string().describe('The chess move in algebraic notation (e.g., "e4", "Nf3", "O-O")'),
  reasoning: z.string().describe('Brief explanation of why this move was chosen'),
  confidence: z.number().min(0).max(100).describe('Confidence in this move (0-100)'),
  evaluation: z.number().describe('Position evaluation after move (-10 to +10, positive favors white)'),
  threats: z.array(z.string()).describe('Immediate threats this move creates'),
  defenses: z.array(z.string()).describe('Threats this move addresses'),
});

type MoveOutput = z.infer<typeof MoveOutputSchema>;

// ============ Chess Agent ============

export class LangChainChessAgent {
  private model: ChatAnthropic;
  private config: AgentConfig;
  private moveHistory: string[] = [];
  private outputParser: StructuredOutputParser<typeof MoveOutputSchema>;

  constructor(config: AgentConfig = {}) {
    this.config = {
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      thinkingBudget: 5000,
      style: 'balanced',
      openingBook: true,
      endgameTable: true,
      ...config,
    };

    this.model = new ChatAnthropic({
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: 2048,
    });

    this.outputParser = StructuredOutputParser.fromZodSchema(MoveOutputSchema);
  }

  // Analyze the current board position
  @traceable({ name: 'analyze_position' })
  private analyzePosition(chess: Chess): GameState {
    const board = chess.board();
    
    // Calculate material balance
    const pieceValues: Record<string, number> = {
      p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
    };
    
    let materialBalance = 0;
    for (const row of board) {
      for (const piece of row) {
        if (piece) {
          const value = pieceValues[piece.type];
          materialBalance += piece.color === 'w' ? value : -value;
        }
      }
    }

    return {
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: chess.turn(),
      moveNumber: Math.ceil(chess.history().length / 2) + 1,
      isCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
      legalMoves: chess.moves(),
      materialBalance,
    };
  }

  // Build the prompt for move selection
  private buildMovePrompt(state: GameState): string {
    const styleInstructions = {
      aggressive: 'Prioritize attacking moves, piece activity, and king safety weaknesses. Look for tactical shots and sacrifices.',
      defensive: 'Prioritize solid moves, piece safety, and king protection. Avoid unnecessary risks.',
      balanced: 'Balance between attack and defense. Look for the objectively best move.',
    };

    return `You are an expert chess engine playing as ${state.turn === 'w' ? 'White' : 'Black'}.

CURRENT POSITION (FEN): ${state.fen}

GAME HISTORY (PGN): ${state.pgn || 'Game just started'}

POSITION ANALYSIS:
- Move Number: ${state.moveNumber}
- Material Balance: ${state.materialBalance > 0 ? '+' : ''}${state.materialBalance} (positive = White advantage)
- In Check: ${state.isCheck ? 'YES' : 'No'}
- Legal Moves Available: ${state.legalMoves.length}

LEGAL MOVES: ${state.legalMoves.join(', ')}

PLAYING STYLE: ${this.config.style}
${styleInstructions[this.config.style || 'balanced']}

Analyze the position carefully and select the best move. Consider:
1. Tactical threats and opportunities
2. Piece development and activity
3. King safety
4. Pawn structure
5. Long-term positional factors

${this.outputParser.getFormatInstructions()}

Your move:`;
  }

  // Select the best move using LangChain
  @traceable({ name: 'select_move', run_type: 'llm' })
  async selectMove(fen: string): Promise<MoveOutput> {
    const chess = new Chess(fen);
    const state = this.analyzePosition(chess);

    if (state.isCheckmate || state.isDraw) {
      throw new Error('Game is already over');
    }

    if (state.legalMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    // For very simple positions, use opening book or simple logic
    if (this.config.openingBook && state.moveNumber <= 5) {
      const bookMove = this.getBookMove(state);
      if (bookMove) {
        return {
          move: bookMove,
          reasoning: 'Opening book move',
          confidence: 95,
          evaluation: 0,
          threats: [],
          defenses: [],
        };
      }
    }

    // Use LangChain to select move
    const prompt = this.buildMovePrompt(state);
    
    const chain = RunnableSequence.from([
      new RunnablePassthrough(),
      async (input: string) => {
        const response = await this.model.invoke([
          new SystemMessage('You are a chess grandmaster. Respond only with the requested JSON format.'),
          new HumanMessage(input),
        ]);
        return response.content as string;
      },
      this.outputParser,
    ]);

    try {
      const result = await chain.invoke(prompt);
      
      // Validate the move is legal
      if (!state.legalMoves.includes(result.move)) {
        // Try to find a similar legal move
        const similarMove = state.legalMoves.find(m => 
          m.toLowerCase().includes(result.move.toLowerCase().replace(/[+#]/g, ''))
        );
        
        if (similarMove) {
          result.move = similarMove;
        } else {
          // Fall back to first legal move
          result.move = state.legalMoves[0];
          result.reasoning = `AI suggested illegal move, falling back to ${result.move}`;
          result.confidence = 50;
        }
      }

      this.moveHistory.push(result.move);
      return result;
    } catch (error) {
      console.error('Error selecting move:', error);
      // Fallback to a random legal move
      const randomMove = state.legalMoves[Math.floor(Math.random() * state.legalMoves.length)];
      return {
        move: randomMove,
        reasoning: 'Error in analysis, random fallback',
        confidence: 10,
        evaluation: 0,
        threats: [],
        defenses: [],
      };
    }
  }

  // Simple opening book
  private getBookMove(state: GameState): string | null {
    const openingBook: Record<string, string[]> = {
      // Starting position
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': ['e4', 'd4', 'Nf3', 'c4'],
      // After 1.e4
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1': ['e5', 'c5', 'e6', 'c6'],
      // After 1.d4
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1': ['d5', 'Nf6', 'e6'],
      // Italian Game
      'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3': ['Bc5', 'Nf6', 'Be7'],
    };

    const moves = openingBook[state.fen.split(' ').slice(0, 4).join(' ')] || openingBook[state.fen];
    
    if (moves) {
      const legalBookMoves = moves.filter(m => state.legalMoves.includes(m));
      if (legalBookMoves.length > 0) {
        return legalBookMoves[Math.floor(Math.random() * legalBookMoves.length)];
      }
    }

    return null;
  }

  // Evaluate a position
  @traceable({ name: 'evaluate_position' })
  async evaluatePosition(fen: string): Promise<{
    evaluation: number;
    bestMove: string;
    analysis: string;
  }> {
    const chess = new Chess(fen);
    const state = this.analyzePosition(chess);

    const prompt = `Analyze this chess position:

FEN: ${state.fen}

Provide:
1. Numerical evaluation (-10 to +10, positive favors White)
2. The best move for ${state.turn === 'w' ? 'White' : 'Black'}
3. Brief analysis (2-3 sentences)

Respond in this exact format:
EVALUATION: [number]
BEST_MOVE: [move]
ANALYSIS: [text]`;

    const response = await this.model.invoke([
      new SystemMessage('You are a chess analysis engine. Be concise and precise.'),
      new HumanMessage(prompt),
    ]);

    const content = response.content as string;
    
    // Parse response
    const evalMatch = content.match(/EVALUATION:\s*([-\d.]+)/);
    const moveMatch = content.match(/BEST_MOVE:\s*(\S+)/);
    const analysisMatch = content.match(/ANALYSIS:\s*(.+)/s);

    return {
      evaluation: evalMatch ? parseFloat(evalMatch[1]) : state.materialBalance,
      bestMove: moveMatch ? moveMatch[1] : state.legalMoves[0],
      analysis: analysisMatch ? analysisMatch[1].trim() : 'Position analyzed',
    };
  }

  // Play a full game against another agent or self
  @traceable({ name: 'play_game', run_type: 'chain' })
  async playGame(options: {
    opponent?: LangChainChessAgent;
    maxMoves?: number;
    startingFen?: string;
  } = {}): Promise<{
    pgn: string;
    winner: 'white' | 'black' | 'draw';
    reason: string;
    moves: MoveOutput[];
  }> {
    const chess = new Chess(options.startingFen);
    const maxMoves = options.maxMoves || 100;
    const opponent = options.opponent || this;
    const moves: MoveOutput[] = [];

    let moveCount = 0;
    while (!chess.isGameOver() && moveCount < maxMoves) {
      const currentAgent = chess.turn() === 'w' ? this : opponent;
      
      try {
        const moveResult = await currentAgent.selectMove(chess.fen());
        chess.move(moveResult.move);
        moves.push(moveResult);
        moveCount++;
      } catch (error) {
        console.error(`Error in game at move ${moveCount}:`, error);
        break;
      }
    }

    let winner: 'white' | 'black' | 'draw' = 'draw';
    let reason = 'Unknown';

    if (chess.isCheckmate()) {
      winner = chess.turn() === 'w' ? 'black' : 'white';
      reason = 'checkmate';
    } else if (chess.isStalemate()) {
      reason = 'stalemate';
    } else if (chess.isThreefoldRepetition()) {
      reason = 'threefold repetition';
    } else if (chess.isInsufficientMaterial()) {
      reason = 'insufficient material';
    } else if (chess.isDraw()) {
      reason = 'fifty-move rule';
    } else if (moveCount >= maxMoves) {
      reason = 'move limit reached';
    }

    return {
      pgn: chess.pgn(),
      winner,
      reason,
      moves,
    };
  }

  // Get move history
  getMoveHistory(): string[] {
    return [...this.moveHistory];
  }

  // Reset the agent
  reset(): void {
    this.moveHistory = [];
  }
}

// ============ Multi-Agent Tournament ============

export class ChessTournament {
  private agents: Map<string, LangChainChessAgent> = new Map();
  private results: Map<string, { wins: number; losses: number; draws: number }> = new Map();

  addAgent(name: string, agent: LangChainChessAgent): void {
    this.agents.set(name, agent);
    this.results.set(name, { wins: 0, losses: 0, draws: 0 });
  }

  @traceable({ name: 'tournament_round' })
  async playRound(white: string, black: string): Promise<{
    white: string;
    black: string;
    result: 'white' | 'black' | 'draw';
    pgn: string;
  }> {
    const whiteAgent = this.agents.get(white);
    const blackAgent = this.agents.get(black);

    if (!whiteAgent || !blackAgent) {
      throw new Error('Agent not found');
    }

    whiteAgent.reset();
    blackAgent.reset();

    const game = await whiteAgent.playGame({ opponent: blackAgent });

    // Update standings
    const whiteResult = this.results.get(white)!;
    const blackResult = this.results.get(black)!;

    if (game.winner === 'white') {
      whiteResult.wins++;
      blackResult.losses++;
    } else if (game.winner === 'black') {
      blackResult.wins++;
      whiteResult.losses++;
    } else {
      whiteResult.draws++;
      blackResult.draws++;
    }

    return {
      white,
      black,
      result: game.winner,
      pgn: game.pgn,
    };
  }

  @traceable({ name: 'run_tournament' })
  async runRoundRobin(): Promise<Map<string, { wins: number; losses: number; draws: number; points: number }>> {
    const agentNames = Array.from(this.agents.keys());

    for (let i = 0; i < agentNames.length; i++) {
      for (let j = i + 1; j < agentNames.length; j++) {
        // Play two games (each agent plays white once)
        await this.playRound(agentNames[i], agentNames[j]);
        await this.playRound(agentNames[j], agentNames[i]);
      }
    }

    // Calculate final standings
    const standings = new Map<string, { wins: number; losses: number; draws: number; points: number }>();
    
    for (const [name, result] of this.results) {
      standings.set(name, {
        ...result,
        points: result.wins * 1 + result.draws * 0.5,
      });
    }

    return standings;
  }
}

// ============ Example Usage ============

async function main() {
  console.log('🏆 LangChain Chess Agent Demo\n');

  // Create agents with different styles
  const aggressiveAgent = new LangChainChessAgent({ style: 'aggressive' });
  const defensiveAgent = new LangChainChessAgent({ style: 'defensive' });

  // Test single move selection
  console.log('📍 Testing move selection...\n');
  
  const startingPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const move = await aggressiveAgent.selectMove(startingPosition);
  
  console.log('Selected move:', move.move);
  console.log('Reasoning:', move.reasoning);
  console.log('Confidence:', move.confidence);

  // Test position evaluation
  console.log('\n📊 Testing position evaluation...\n');
  
  const middlegame = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const evaluation = await aggressiveAgent.evaluatePosition(middlegame);
  
  console.log('Evaluation:', evaluation.evaluation);
  console.log('Best move:', evaluation.bestMove);
  console.log('Analysis:', evaluation.analysis);

  // Play a short game
  console.log('\n♟️ Playing a sample game...\n');
  
  const game = await aggressiveAgent.playGame({
    opponent: defensiveAgent,
    maxMoves: 20,
  });

  console.log('Game PGN:', game.pgn);
  console.log('Winner:', game.winner);
  console.log('Reason:', game.reason);
  console.log('Total moves:', game.moves.length);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default LangChainChessAgent;
