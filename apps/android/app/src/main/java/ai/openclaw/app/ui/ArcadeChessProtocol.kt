package ai.openclaw.app.ui

import com.funkatronics.encoders.Base58
import java.util.UUID
import java.util.Base64
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val chessProtocolJson =
  Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }

private const val chessInviteKind = "invite"
private const val chessMoveKind = "move"

enum class ChessAiProvider(val label: String) {
  Grok("Grok"),
  OpenAI("OpenAI"),
}

@Serializable
data class WalletChessSignedPacket(
  val kind: String,
  val signerAddress: String,
  val payloadJson: String,
  val signatureBase58: String,
)

@Serializable
data class WalletChessInvitePayload(
  val matchId: String,
  val inviterAddress: String,
  val inviterLabel: String,
  val inviterColor: ChessColor,
  val createdAtMs: Long,
  val startFingerprint: String = chessPositionFingerprint(ChessPosition.initial()),
)

@Serializable
data class WalletChessMovePayload(
  val matchId: String,
  val ply: Int,
  val signerAddress: String,
  val move: String,
  val moveDisplay: String,
  val beforeFingerprint: String,
  val afterFingerprint: String,
  val sentAtMs: Long,
)

@Serializable
data class GrokChessMoveChoice(
  val move: String,
  @SerialName("comment")
  val comment: String = "",
)

data class WalletChessSession(
  val matchId: String,
  val localAddress: String,
  val remoteAddress: String? = null,
  val localColor: ChessColor,
  val inviterAddress: String,
)

fun newWalletChessInvite(
  localAddress: String,
  localLabel: String,
  localColor: ChessColor,
): WalletChessInvitePayload =
  WalletChessInvitePayload(
    matchId = UUID.randomUUID().toString(),
    inviterAddress = localAddress,
    inviterLabel = localLabel.trim().ifBlank { shortChessWallet(localAddress) },
    inviterColor = localColor,
    createdAtMs = System.currentTimeMillis(),
  )

fun walletChessSignableMessage(
  kind: String,
  payloadJson: String,
): String = "solanaos-chess:$kind:$payloadJson"

fun walletChessEncodePacket(packet: WalletChessSignedPacket): String {
  val encoded = chessProtocolJson.encodeToString(packet)
  val packed = Base64.getUrlEncoder().withoutPadding().encodeToString(encoded.toByteArray(Charsets.UTF_8))
  return "solanaos://arcade/chess?packet=$packed"
}

fun walletChessDecodePacket(raw: String): WalletChessSignedPacket {
  val trimmed = raw.trim()
  val packed =
    when {
      trimmed.startsWith("solanaos://", ignoreCase = true) ||
        trimmed.startsWith("nanosolana://", ignoreCase = true) ||
        trimmed.startsWith("com.nanosolana.solanaos://", ignoreCase = true) -> {
          trimmed.substringAfter("packet=", "").substringBefore('&').trim()
        }
      else -> trimmed
    }
  require(packed.isNotBlank()) { "Paste a SolanaOS chess invite or move packet first." }
  val decodedBytes = Base64.getUrlDecoder().decode(normalizeBase64Url(packed))
  val decoded = decodedBytes.toString(Charsets.UTF_8)
  return chessProtocolJson.decodeFromString<WalletChessSignedPacket>(decoded)
}

fun walletChessVerifyPacket(packet: WalletChessSignedPacket): Boolean {
  if (packet.kind != chessInviteKind && packet.kind != chessMoveKind) return false
  val signer = packet.signerAddress.trim()
  val signature = packet.signatureBase58.trim()
  if (signer.isBlank() || signature.isBlank() || packet.payloadJson.isBlank()) return false

  return try {
    val rawPublicKey = Base58.decode(signer)
    val rawSignature = Base58.decode(signature)
    val verifier = org.bouncycastle.crypto.signers.Ed25519Signer()
    verifier.init(false, org.bouncycastle.crypto.params.Ed25519PublicKeyParameters(rawPublicKey, 0))
    val payload = walletChessSignableMessage(packet.kind, packet.payloadJson).toByteArray(Charsets.UTF_8)
    verifier.update(payload, 0, payload.size)
    verifier.verifySignature(rawSignature)
  } catch (_: Throwable) {
    false
  }
}

fun walletChessDecodeInvite(packet: WalletChessSignedPacket): WalletChessInvitePayload {
  require(packet.kind == chessInviteKind) { "That packet is not a chess invite." }
  val payload = chessProtocolJson.decodeFromString<WalletChessInvitePayload>(packet.payloadJson)
  require(payload.inviterAddress == packet.signerAddress) { "Invite signer does not match inviter address." }
  require(payload.startFingerprint == chessPositionFingerprint(ChessPosition.initial())) { "Invite start position is invalid." }
  return payload
}

fun walletChessDecodeMove(packet: WalletChessSignedPacket): WalletChessMovePayload {
  require(packet.kind == chessMoveKind) { "That packet is not a chess move." }
  val payload = chessProtocolJson.decodeFromString<WalletChessMovePayload>(packet.payloadJson)
  require(payload.signerAddress == packet.signerAddress) { "Move signer does not match payload signer." }
  return payload
}

fun walletChessBuildSignedInvite(
  payload: WalletChessInvitePayload,
  signatureBase58: String,
): WalletChessSignedPacket =
  WalletChessSignedPacket(
    kind = chessInviteKind,
    signerAddress = payload.inviterAddress,
    payloadJson = chessProtocolJson.encodeToString(payload),
    signatureBase58 = signatureBase58,
  )

fun walletChessBuildSignedMove(
  payload: WalletChessMovePayload,
  signatureBase58: String,
): WalletChessSignedPacket =
  WalletChessSignedPacket(
    kind = chessMoveKind,
    signerAddress = payload.signerAddress,
    payloadJson = chessProtocolJson.encodeToString(payload),
    signatureBase58 = signatureBase58,
  )

fun shortChessWallet(address: String): String =
  if (address.length <= 10) {
    address
  } else {
    "${address.take(4)}…${address.takeLast(4)}"
  }

fun normalizeGrokChessMove(raw: String): String =
  raw.trim().lowercase().replace(Regex("[^a-h1-8qrbn]"), "")

fun parseGrokChessMoveChoice(raw: String): GrokChessMoveChoice? {
  val trimmed = raw.trim()
  if (trimmed.isBlank()) return null
  val start = trimmed.indexOf('{')
  val end = trimmed.lastIndexOf('}')
  val jsonCandidate = if (start >= 0 && end > start) trimmed.substring(start, end + 1) else null
  if (jsonCandidate != null) {
    runCatching { chessProtocolJson.decodeFromString<GrokChessMoveChoice>(jsonCandidate) }
      .getOrNull()
      ?.let { return it.copy(move = normalizeGrokChessMove(it.move)) }
  }
  val directMove = normalizeGrokChessMove(trimmed)
  return directMove.takeIf { it.length in 4..5 }?.let { GrokChessMoveChoice(move = it) }
}

private fun normalizeBase64Url(value: String): String {
  val trimmed = value.trim()
  val padding = "=".repeat((4 - trimmed.length % 4) % 4)
  return trimmed + padding
}
