package ai.openclaw.app.ui

enum class ChessColor {
  White,
  Black,
  ;

  fun opposite(): ChessColor = if (this == White) Black else White
}

enum class ChessPieceType {
  King,
  Queen,
  Rook,
  Bishop,
  Knight,
  Pawn,
}

data class ChessPiece(
  val color: ChessColor,
  val type: ChessPieceType,
)

data class ChessCastlingRights(
  val whiteKingSide: Boolean = true,
  val whiteQueenSide: Boolean = true,
  val blackKingSide: Boolean = true,
  val blackQueenSide: Boolean = true,
)

data class ChessMove(
  val from: Int,
  val to: Int,
  val piece: ChessPiece,
  val captured: ChessPiece? = null,
  val promotion: ChessPieceType? = null,
  val isEnPassant: Boolean = false,
  val enPassantCaptureIndex: Int? = null,
  val isCastleKingSide: Boolean = false,
  val isCastleQueenSide: Boolean = false,
)

enum class ChessPositionStatus {
  Normal,
  Check,
  Checkmate,
  Stalemate,
}

data class ChessPosition(
  val board: List<ChessPiece?>,
  val turn: ChessColor,
  val castlingRights: ChessCastlingRights = ChessCastlingRights(),
  val enPassantTarget: Int? = null,
  val status: ChessPositionStatus = ChessPositionStatus.Normal,
) {
  companion object {
    fun initial(): ChessPosition {
      val board = MutableList<ChessPiece?>(64) { null }

      fun place(row: Int, col: Int, piece: ChessPiece) {
        board[chessIndex(row, col)] = piece
      }

      val backRank =
        listOf(
          ChessPieceType.Rook,
          ChessPieceType.Knight,
          ChessPieceType.Bishop,
          ChessPieceType.Queen,
          ChessPieceType.King,
          ChessPieceType.Bishop,
          ChessPieceType.Knight,
          ChessPieceType.Rook,
        )

      backRank.forEachIndexed { col, type ->
        place(0, col, ChessPiece(ChessColor.Black, type))
        place(1, col, ChessPiece(ChessColor.Black, ChessPieceType.Pawn))
        place(6, col, ChessPiece(ChessColor.White, ChessPieceType.Pawn))
        place(7, col, ChessPiece(ChessColor.White, type))
      }

      return ChessPosition(
        board = board,
        turn = ChessColor.White,
      ).withEvaluatedStatus()
    }
  }
}

data class ChessGameState(
  val position: ChessPosition = ChessPosition.initial(),
  val selectedIndex: Int? = null,
  val legalTargets: Set<Int> = emptySet(),
  val history: List<ChessPosition> = emptyList(),
  val moveLog: List<String> = emptyList(),
  val flipped: Boolean = false,
)

fun chessIndex(row: Int, col: Int): Int = row * 8 + col

fun chessRow(index: Int): Int = index / 8

fun chessCol(index: Int): Int = index % 8

fun chessNotation(index: Int): String {
  val file = 'a' + chessCol(index)
  val rank = 8 - chessRow(index)
  return "$file$rank"
}

fun pieceGlyph(piece: ChessPiece): String =
  when (piece.color) {
    ChessColor.White ->
      when (piece.type) {
        ChessPieceType.King -> "♔"
        ChessPieceType.Queen -> "♕"
        ChessPieceType.Rook -> "♖"
        ChessPieceType.Bishop -> "♗"
        ChessPieceType.Knight -> "♘"
        ChessPieceType.Pawn -> "♙"
      }

    ChessColor.Black ->
      when (piece.type) {
        ChessPieceType.King -> "♚"
        ChessPieceType.Queen -> "♛"
        ChessPieceType.Rook -> "♜"
        ChessPieceType.Bishop -> "♝"
        ChessPieceType.Knight -> "♞"
        ChessPieceType.Pawn -> "♟"
      }
  }

fun toggleChessFlip(state: ChessGameState): ChessGameState = state.copy(flipped = !state.flipped)

fun resetChessGame(): ChessGameState = ChessGameState()

fun chessIndexFromNotation(notation: String): Int? {
  val trimmed = notation.trim().lowercase()
  if (trimmed.length != 2) return null
  val file = trimmed[0]
  val rank = trimmed[1]
  if (file !in 'a'..'h' || rank !in '1'..'8') return null
  val col = file - 'a'
  val row = 8 - (rank.digitToIntOrNull() ?: return null)
  return chessIndex(row, col)
}

fun chessMoveToken(move: ChessMove): String {
  val promotionSuffix =
    when (move.promotion) {
      ChessPieceType.Queen -> "q"
      ChessPieceType.Rook -> "r"
      ChessPieceType.Bishop -> "b"
      ChessPieceType.Knight -> "n"
      else -> ""
    }
  return "${chessNotation(move.from)}${chessNotation(move.to)}$promotionSuffix"
}

fun chessBoardAscii(position: ChessPosition): String =
  buildString {
    for (row in 0..7) {
      append(8 - row)
      append(' ')
      for (col in 0..7) {
        val piece = position.board[chessIndex(row, col)]
        append(
          when (piece?.type) {
            ChessPieceType.King -> if (piece.color == ChessColor.White) 'K' else 'k'
            ChessPieceType.Queen -> if (piece.color == ChessColor.White) 'Q' else 'q'
            ChessPieceType.Rook -> if (piece.color == ChessColor.White) 'R' else 'r'
            ChessPieceType.Bishop -> if (piece.color == ChessColor.White) 'B' else 'b'
            ChessPieceType.Knight -> if (piece.color == ChessColor.White) 'N' else 'n'
            ChessPieceType.Pawn -> if (piece.color == ChessColor.White) 'P' else 'p'
            null -> '.'
          },
        )
        if (col < 7) append(' ')
      }
      if (row < 7) append('\n')
    }
    append("\n  a b c d e f g h")
  }

fun chessPositionFingerprint(position: ChessPosition): String =
  buildString {
    position.board.forEach { piece ->
      append(
        when (piece?.type) {
          ChessPieceType.King -> if (piece.color == ChessColor.White) 'K' else 'k'
          ChessPieceType.Queen -> if (piece.color == ChessColor.White) 'Q' else 'q'
          ChessPieceType.Rook -> if (piece.color == ChessColor.White) 'R' else 'r'
          ChessPieceType.Bishop -> if (piece.color == ChessColor.White) 'B' else 'b'
          ChessPieceType.Knight -> if (piece.color == ChessColor.White) 'N' else 'n'
          ChessPieceType.Pawn -> if (piece.color == ChessColor.White) 'P' else 'p'
          null -> '.'
        },
      )
    }
    append('|')
    append(position.turn.name)
    append('|')
    append(if (position.castlingRights.whiteKingSide) 'K' else '-')
    append(if (position.castlingRights.whiteQueenSide) 'Q' else '-')
    append(if (position.castlingRights.blackKingSide) 'k' else '-')
    append(if (position.castlingRights.blackQueenSide) 'q' else '-')
    append('|')
    append(position.enPassantTarget?.let(::chessNotation) ?: "-")
  }

fun selectChessSquare(state: ChessGameState, index: Int): ChessGameState {
  val pieceAtTap = state.position.board[index]
  if (pieceAtTap == null || pieceAtTap.color != state.position.turn) {
    return state.copy(selectedIndex = null, legalTargets = emptySet())
  }
  val targets = legalMovesFrom(state.position, index).map { it.to }.toSet()
  return state.copy(selectedIndex = index, legalTargets = targets)
}

fun resolveChessMove(state: ChessGameState, targetIndex: Int): ChessMove? {
  val selected = state.selectedIndex ?: return null
  if (targetIndex !in state.legalTargets) return null
  return legalMovesFrom(state.position, selected).firstOrNull { it.to == targetIndex }
}

fun applyChessMoveToGame(state: ChessGameState, move: ChessMove): ChessGameState {
  val nextPosition = applyChessMove(state.position, move).withEvaluatedStatus()
  return state.copy(
    position = nextPosition,
    selectedIndex = null,
    legalTargets = emptySet(),
    history = state.history + state.position,
    moveLog = state.moveLog + moveToDisplayString(move),
  )
}

fun findLegalMoveByToken(position: ChessPosition, token: String): ChessMove? {
  val normalized = token.trim().lowercase()
  if (normalized.length !in 4..5) return null
  val from = chessIndexFromNotation(normalized.take(2)) ?: return null
  val to = chessIndexFromNotation(normalized.substring(2, 4)) ?: return null
  val promotion =
    when (normalized.getOrNull(4)) {
      'q' -> ChessPieceType.Queen
      'r' -> ChessPieceType.Rook
      'b' -> ChessPieceType.Bishop
      'n' -> ChessPieceType.Knight
      null -> null
      else -> return null
    }
  return legalMovesFrom(position, from).firstOrNull { move ->
    move.to == to && (move.promotion ?: ChessPieceType.Queen) == (promotion ?: move.promotion ?: ChessPieceType.Queen)
  }
}

fun undoChessMove(state: ChessGameState): ChessGameState {
  val previous = state.history.lastOrNull() ?: return state
  return state.copy(
    position = previous,
    selectedIndex = null,
    legalTargets = emptySet(),
    history = state.history.dropLast(1),
    moveLog = if (state.moveLog.isNotEmpty()) state.moveLog.dropLast(1) else emptyList(),
  )
}

fun handleChessTap(state: ChessGameState, index: Int): ChessGameState {
  resolveChessMove(state, index)?.let { move ->
    return applyChessMoveToGame(state, move)
  }
  return selectChessSquare(state, index)
}

fun legalMovesFrom(position: ChessPosition, from: Int): List<ChessMove> {
  val piece = position.board.getOrNull(from) ?: return emptyList()
  if (piece.color != position.turn) return emptyList()
  return pseudoLegalMoves(position, from, piece).filter { move ->
    val next = applyChessMove(position, move, evaluateStatus = false)
    !isKingInCheck(next, piece.color)
  }
}

fun allLegalMoves(position: ChessPosition, color: ChessColor = position.turn): List<ChessMove> =
  position.board.indices
    .filter { index -> position.board[index]?.color == color }
    .flatMap { index ->
      val piece = position.board[index] ?: return@flatMap emptyList()
      if (piece.color != color) emptyList()
      else {
        pseudoLegalMoves(position.copy(turn = color), index, piece).filter { move ->
          val next = applyChessMove(position.copy(turn = color), move, evaluateStatus = false)
          !isKingInCheck(next, color)
        }
      }
    }

private fun pseudoLegalMoves(position: ChessPosition, from: Int, piece: ChessPiece): List<ChessMove> {
  val row = chessRow(from)
  val col = chessCol(from)
  return when (piece.type) {
    ChessPieceType.Pawn -> pawnMoves(position, from, row, col, piece)
    ChessPieceType.Knight -> knightMoves(position, from, row, col, piece)
    ChessPieceType.Bishop -> slidingMoves(position, from, row, col, piece, listOf(-1 to -1, -1 to 1, 1 to -1, 1 to 1))
    ChessPieceType.Rook -> slidingMoves(position, from, row, col, piece, listOf(-1 to 0, 1 to 0, 0 to -1, 0 to 1))
    ChessPieceType.Queen -> slidingMoves(position, from, row, col, piece, listOf(-1 to -1, -1 to 1, 1 to -1, 1 to 1, -1 to 0, 1 to 0, 0 to -1, 0 to 1))
    ChessPieceType.King -> kingMoves(position, from, row, col, piece)
  }
}

private fun pawnMoves(position: ChessPosition, from: Int, row: Int, col: Int, piece: ChessPiece): List<ChessMove> {
  val moves = mutableListOf<ChessMove>()
  val direction = if (piece.color == ChessColor.White) -1 else 1
  val startRow = if (piece.color == ChessColor.White) 6 else 1
  val promotionRow = if (piece.color == ChessColor.White) 0 else 7

  val oneForwardRow = row + direction
  if (oneForwardRow in 0..7) {
    val oneForward = chessIndex(oneForwardRow, col)
    if (position.board[oneForward] == null) {
      moves +=
        ChessMove(
          from = from,
          to = oneForward,
          piece = piece,
          promotion = if (oneForwardRow == promotionRow) ChessPieceType.Queen else null,
        )

      val twoForwardRow = row + (direction * 2)
      if (row == startRow && twoForwardRow in 0..7) {
        val twoForward = chessIndex(twoForwardRow, col)
        if (position.board[twoForward] == null) {
          moves += ChessMove(from = from, to = twoForward, piece = piece)
        }
      }
    }
  }

  listOf(col - 1, col + 1)
    .filter { it in 0..7 }
    .forEach { targetCol ->
      val targetRow = row + direction
      if (targetRow !in 0..7) return@forEach
      val targetIndex = chessIndex(targetRow, targetCol)
      val occupant = position.board[targetIndex]
      if (occupant != null && occupant.color != piece.color) {
        moves +=
          ChessMove(
            from = from,
            to = targetIndex,
            piece = piece,
            captured = occupant,
            promotion = if (targetRow == promotionRow) ChessPieceType.Queen else null,
          )
      } else if (position.enPassantTarget == targetIndex) {
        val captureIndex = chessIndex(row, targetCol)
        val capturedPiece = position.board[captureIndex]
        if (capturedPiece?.type == ChessPieceType.Pawn && capturedPiece.color != piece.color) {
          moves +=
            ChessMove(
              from = from,
              to = targetIndex,
              piece = piece,
              captured = capturedPiece,
              isEnPassant = true,
              enPassantCaptureIndex = captureIndex,
            )
        }
      }
    }

  return moves
}

private fun knightMoves(position: ChessPosition, from: Int, row: Int, col: Int, piece: ChessPiece): List<ChessMove> {
  val offsets =
    listOf(
      -2 to -1,
      -2 to 1,
      -1 to -2,
      -1 to 2,
      1 to -2,
      1 to 2,
      2 to -1,
      2 to 1,
    )
  return offsets.mapNotNull { (dr, dc) ->
    val targetRow = row + dr
    val targetCol = col + dc
    if (targetRow !in 0..7 || targetCol !in 0..7) return@mapNotNull null
    val targetIndex = chessIndex(targetRow, targetCol)
    val occupant = position.board[targetIndex]
    when {
      occupant == null -> ChessMove(from = from, to = targetIndex, piece = piece)
      occupant.color != piece.color -> ChessMove(from = from, to = targetIndex, piece = piece, captured = occupant)
      else -> null
    }
  }
}

private fun slidingMoves(
  position: ChessPosition,
  from: Int,
  row: Int,
  col: Int,
  piece: ChessPiece,
  directions: List<Pair<Int, Int>>,
): List<ChessMove> {
  val moves = mutableListOf<ChessMove>()
  directions.forEach { (dr, dc) ->
    var nextRow = row + dr
    var nextCol = col + dc
    while (nextRow in 0..7 && nextCol in 0..7) {
      val targetIndex = chessIndex(nextRow, nextCol)
      val occupant = position.board[targetIndex]
      if (occupant == null) {
        moves += ChessMove(from = from, to = targetIndex, piece = piece)
      } else {
        if (occupant.color != piece.color) {
          moves += ChessMove(from = from, to = targetIndex, piece = piece, captured = occupant)
        }
        break
      }
      nextRow += dr
      nextCol += dc
    }
  }
  return moves
}

private fun kingMoves(position: ChessPosition, from: Int, row: Int, col: Int, piece: ChessPiece): List<ChessMove> {
  val moves = mutableListOf<ChessMove>()
  for (dr in -1..1) {
    for (dc in -1..1) {
      if (dr == 0 && dc == 0) continue
      val targetRow = row + dr
      val targetCol = col + dc
      if (targetRow !in 0..7 || targetCol !in 0..7) continue
      val targetIndex = chessIndex(targetRow, targetCol)
      val occupant = position.board[targetIndex]
      if (occupant == null || occupant.color != piece.color) {
        moves += ChessMove(from = from, to = targetIndex, piece = piece, captured = occupant)
      }
    }
  }

  moves += castleMoves(position, from, piece)
  return moves
}

private fun castleMoves(position: ChessPosition, from: Int, piece: ChessPiece): List<ChessMove> {
  if (piece.type != ChessPieceType.King) return emptyList()
  if (isKingInCheck(position, piece.color)) return emptyList()

  val row = if (piece.color == ChessColor.White) 7 else 0
  val kingStart = chessIndex(row, 4)
  if (from != kingStart) return emptyList()

  val rights = position.castlingRights
  val moves = mutableListOf<ChessMove>()
  val kingSideAllowed = if (piece.color == ChessColor.White) rights.whiteKingSide else rights.blackKingSide
  val queenSideAllowed = if (piece.color == ChessColor.White) rights.whiteQueenSide else rights.blackQueenSide

  if (kingSideAllowed) {
    val f = chessIndex(row, 5)
    val g = chessIndex(row, 6)
    val rookIndex = chessIndex(row, 7)
    val rook = position.board[rookIndex]
    if (
      position.board[f] == null &&
      position.board[g] == null &&
      rook?.type == ChessPieceType.Rook &&
      rook.color == piece.color &&
      !isSquareAttacked(position, f, piece.color.opposite()) &&
      !isSquareAttacked(position, g, piece.color.opposite())
    ) {
      moves += ChessMove(from = from, to = g, piece = piece, isCastleKingSide = true)
    }
  }

  if (queenSideAllowed) {
    val b = chessIndex(row, 1)
    val c = chessIndex(row, 2)
    val d = chessIndex(row, 3)
    val rookIndex = chessIndex(row, 0)
    val rook = position.board[rookIndex]
    if (
      position.board[b] == null &&
      position.board[c] == null &&
      position.board[d] == null &&
      rook?.type == ChessPieceType.Rook &&
      rook.color == piece.color &&
      !isSquareAttacked(position, c, piece.color.opposite()) &&
      !isSquareAttacked(position, d, piece.color.opposite())
    ) {
      moves += ChessMove(from = from, to = c, piece = piece, isCastleQueenSide = true)
    }
  }

  return moves
}

fun applyChessMove(position: ChessPosition, move: ChessMove, evaluateStatus: Boolean = true): ChessPosition {
  val board = position.board.toMutableList()
  val movingPiece =
    board[move.from] ?: move.piece

  board[move.from] = null

  if (move.isEnPassant) {
    move.enPassantCaptureIndex?.let { board[it] = null }
  }

  if (move.isCastleKingSide || move.isCastleQueenSide) {
    val row = chessRow(move.from)
    if (move.isCastleKingSide) {
      val rookFrom = chessIndex(row, 7)
      val rookTo = chessIndex(row, 5)
      board[rookTo] = board[rookFrom]
      board[rookFrom] = null
    } else if (move.isCastleQueenSide) {
      val rookFrom = chessIndex(row, 0)
      val rookTo = chessIndex(row, 3)
      board[rookTo] = board[rookFrom]
      board[rookFrom] = null
    }
  }

  val placedPiece =
    if (move.promotion != null) {
      ChessPiece(movingPiece.color, move.promotion)
    } else {
      movingPiece
    }

  board[move.to] = placedPiece

  val castlingRights =
    updateCastlingRights(
      rights = position.castlingRights,
      move = move,
      boardBefore = position.board,
    )

  val enPassantTarget =
    if (movingPiece.type == ChessPieceType.Pawn && kotlin.math.abs(chessRow(move.to) - chessRow(move.from)) == 2) {
      chessIndex((chessRow(move.to) + chessRow(move.from)) / 2, chessCol(move.from))
    } else {
      null
    }

  val next =
    ChessPosition(
      board = board,
      turn = position.turn.opposite(),
      castlingRights = castlingRights,
      enPassantTarget = enPassantTarget,
      status = ChessPositionStatus.Normal,
    )

  return if (evaluateStatus) next.withEvaluatedStatus() else next
}

private fun updateCastlingRights(
  rights: ChessCastlingRights,
  move: ChessMove,
  boardBefore: List<ChessPiece?>,
): ChessCastlingRights {
  val movingPiece = move.piece
  val captured = move.captured
  var updated = rights

  if (movingPiece.type == ChessPieceType.King) {
    updated =
      if (movingPiece.color == ChessColor.White) {
        updated.copy(whiteKingSide = false, whiteQueenSide = false)
      } else {
        updated.copy(blackKingSide = false, blackQueenSide = false)
      }
  }

  if (movingPiece.type == ChessPieceType.Rook) {
    updated =
      when (move.from) {
        chessIndex(7, 0) -> updated.copy(whiteQueenSide = false)
        chessIndex(7, 7) -> updated.copy(whiteKingSide = false)
        chessIndex(0, 0) -> updated.copy(blackQueenSide = false)
        chessIndex(0, 7) -> updated.copy(blackKingSide = false)
        else -> updated
      }
  }

  if (captured?.type == ChessPieceType.Rook) {
    updated =
      when (move.to) {
        chessIndex(7, 0) -> updated.copy(whiteQueenSide = false)
        chessIndex(7, 7) -> updated.copy(whiteKingSide = false)
        chessIndex(0, 0) -> updated.copy(blackQueenSide = false)
        chessIndex(0, 7) -> updated.copy(blackKingSide = false)
        else -> updated
      }
  }

  if (move.isEnPassant) {
    val capturedIndex = move.enPassantCaptureIndex
    val capturedPiece = capturedIndex?.let { boardBefore[it] }
    if (capturedPiece?.type == ChessPieceType.Rook) {
      updated =
        when (capturedIndex) {
          chessIndex(7, 0) -> updated.copy(whiteQueenSide = false)
          chessIndex(7, 7) -> updated.copy(whiteKingSide = false)
          chessIndex(0, 0) -> updated.copy(blackQueenSide = false)
          chessIndex(0, 7) -> updated.copy(blackKingSide = false)
          else -> updated
        }
    }
  }

  return updated
}

private fun ChessPosition.withEvaluatedStatus(): ChessPosition {
  val legal = allLegalMoves(this, turn)
  val inCheck = isKingInCheck(this, turn)
  val nextStatus =
    when {
      legal.isEmpty() && inCheck -> ChessPositionStatus.Checkmate
      legal.isEmpty() -> ChessPositionStatus.Stalemate
      inCheck -> ChessPositionStatus.Check
      else -> ChessPositionStatus.Normal
    }
  return copy(status = nextStatus)
}

fun isKingInCheck(position: ChessPosition, color: ChessColor): Boolean {
  val kingIndex =
    position.board.indexOfFirst { piece ->
      piece?.color == color && piece.type == ChessPieceType.King
    }
  if (kingIndex < 0) return false
  return isSquareAttacked(position, kingIndex, color.opposite())
}

private fun isSquareAttacked(position: ChessPosition, target: Int, byColor: ChessColor): Boolean {
  position.board.forEachIndexed { index, piece ->
    if (piece?.color != byColor) return@forEachIndexed
    if (attacksSquare(position, index, target, piece)) return true
  }
  return false
}

private fun attacksSquare(position: ChessPosition, from: Int, target: Int, piece: ChessPiece): Boolean {
  val fromRow = chessRow(from)
  val fromCol = chessCol(from)
  val targetRow = chessRow(target)
  val targetCol = chessCol(target)
  val rowDelta = targetRow - fromRow
  val colDelta = targetCol - fromCol

  return when (piece.type) {
    ChessPieceType.Pawn -> {
      val direction = if (piece.color == ChessColor.White) -1 else 1
      rowDelta == direction && kotlin.math.abs(colDelta) == 1
    }

    ChessPieceType.Knight ->
      (kotlin.math.abs(rowDelta) == 2 && kotlin.math.abs(colDelta) == 1) ||
        (kotlin.math.abs(rowDelta) == 1 && kotlin.math.abs(colDelta) == 2)

    ChessPieceType.Bishop -> diagonalClear(position, from, target)
    ChessPieceType.Rook -> straightClear(position, from, target)
    ChessPieceType.Queen -> diagonalClear(position, from, target) || straightClear(position, from, target)
    ChessPieceType.King -> kotlin.math.abs(rowDelta) <= 1 && kotlin.math.abs(colDelta) <= 1
  }
}

private fun diagonalClear(position: ChessPosition, from: Int, target: Int): Boolean {
  val rowDelta = chessRow(target) - chessRow(from)
  val colDelta = chessCol(target) - chessCol(from)
  if (kotlin.math.abs(rowDelta) != kotlin.math.abs(colDelta) || rowDelta == 0) return false
  val stepRow = if (rowDelta > 0) 1 else -1
  val stepCol = if (colDelta > 0) 1 else -1
  var row = chessRow(from) + stepRow
  var col = chessCol(from) + stepCol
  while (row != chessRow(target) && col != chessCol(target)) {
    if (position.board[chessIndex(row, col)] != null) return false
    row += stepRow
    col += stepCol
  }
  return true
}

private fun straightClear(position: ChessPosition, from: Int, target: Int): Boolean {
  val fromRow = chessRow(from)
  val fromCol = chessCol(from)
  val targetRow = chessRow(target)
  val targetCol = chessCol(target)
  if (fromRow != targetRow && fromCol != targetCol) return false

  val stepRow = targetRow.compareTo(fromRow)
  val stepCol = targetCol.compareTo(fromCol)
  var row = fromRow + stepRow
  var col = fromCol + stepCol
  while (row != targetRow || col != targetCol) {
    if (position.board[chessIndex(row, col)] != null) return false
    row += stepRow
    col += stepCol
  }
  return true
}

fun moveToDisplayString(move: ChessMove): String =
  when {
    move.isCastleKingSide -> "O-O"
    move.isCastleQueenSide -> "O-O-O"
    else -> {
      val separator = if (move.captured != null || move.isEnPassant) "x" else "-"
      val suffix =
        move.promotion?.let {
          "=Q"
        }.orEmpty()
      "${chessNotation(move.from)}$separator${chessNotation(move.to)}$suffix"
    }
  }
