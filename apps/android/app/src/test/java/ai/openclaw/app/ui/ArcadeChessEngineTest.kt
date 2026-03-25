package ai.openclaw.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArcadeChessEngineTest {
  @Test
  fun initialPositionHasTwentyLegalMovesForWhite() {
    val position = ChessPosition.initial()

    val legalMoves = allLegalMoves(position)

    assertEquals(20, legalMoves.size)
  }

  @Test
  fun whitePawnCanAdvanceTwoSquaresFromStart() {
    val position = ChessPosition.initial()

    val pawnMoves = legalMovesFrom(position, chessIndex(6, 4))

    assertTrue(pawnMoves.any { chessNotation(it.to) == "e3" })
    assertTrue(pawnMoves.any { chessNotation(it.to) == "e4" })
  }

  @Test
  fun knightCanJumpOverPieces() {
    val position = ChessPosition.initial()

    val knightMoves = legalMovesFrom(position, chessIndex(7, 6))

    assertTrue(knightMoves.any { chessNotation(it.to) == "f3" })
    assertTrue(knightMoves.any { chessNotation(it.to) == "h3" })
  }

  @Test
  fun castlingAppearsWhenPathIsClearAndSafe() {
    var position = ChessPosition.initial()
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(6, 4)).first { chessNotation(it.to) == "e4" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(1, 4)).first { chessNotation(it.to) == "e5" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(7, 6)).first { chessNotation(it.to) == "f3" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(0, 1)).first { chessNotation(it.to) == "c6" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(7, 5)).first { chessNotation(it.to) == "c4" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(0, 6)).first { chessNotation(it.to) == "f6" },
      )

    val kingMoves = legalMovesFrom(position, chessIndex(7, 4))

    assertTrue(kingMoves.any { it.isCastleKingSide })
  }

  @Test
  fun enPassantAppearsAfterDoublePawnAdvance() {
    var position = ChessPosition.initial()
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(6, 4)).first { chessNotation(it.to) == "e4" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(1, 0)).first { chessNotation(it.to) == "a6" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(4, 4)).first { chessNotation(it.to) == "e5" },
      )
    position =
      applyChessMove(
        position,
        legalMovesFrom(position, chessIndex(1, 3)).first { chessNotation(it.to) == "d5" },
      )

    val pawnMoves = legalMovesFrom(position, chessIndex(3, 4))

    assertTrue(pawnMoves.any { it.isEnPassant && chessNotation(it.to) == "d6" })
  }

  @Test
  fun sideInCheckCannotMakeIllegalPinnedMove() {
    val board = MutableList<ChessPiece?>(64) { null }
    board[chessIndex(7, 4)] = ChessPiece(ChessColor.White, ChessPieceType.King)
    board[chessIndex(6, 4)] = ChessPiece(ChessColor.White, ChessPieceType.Rook)
    board[chessIndex(0, 4)] = ChessPiece(ChessColor.Black, ChessPieceType.Rook)
    board[chessIndex(0, 0)] = ChessPiece(ChessColor.Black, ChessPieceType.King)
    val position = ChessPosition(board = board, turn = ChessColor.White).withTestStatus()

    val rookMoves = legalMovesFrom(position, chessIndex(6, 4))

    assertFalse(rookMoves.any { chessNotation(it.to) == "d2" })
    assertTrue(rookMoves.any { chessNotation(it.to) == "e3" })
  }

  private fun ChessPosition.withTestStatus(): ChessPosition {
    val legal = allLegalMoves(this, turn)
    val inCheck = isKingInCheck(this, turn)
    return copy(
      status =
        when {
          legal.isEmpty() && inCheck -> ChessPositionStatus.Checkmate
          legal.isEmpty() -> ChessPositionStatus.Stalemate
          inCheck -> ChessPositionStatus.Check
          else -> ChessPositionStatus.Normal
        },
    )
  }
}
