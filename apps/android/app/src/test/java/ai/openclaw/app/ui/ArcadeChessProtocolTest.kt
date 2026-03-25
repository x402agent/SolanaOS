package ai.openclaw.app.ui

import com.funkatronics.encoders.Base58
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.SecureRandom
import kotlinx.serialization.encodeToString

class ArcadeChessProtocolTest {
  @Test
  fun invitePacketRoundTripsAndVerifies() {
    val inviter = generateWalletIdentity()
    val invite = newWalletChessInvite(localAddress = inviter.addressBase58, localLabel = "8Bit", localColor = ChessColor.White)
    val inviteJson = walletChessJson().encodeToString(WalletChessInvitePayload.serializer(), invite)
    val packet =
      walletChessBuildSignedInvite(
        payload = invite,
        signatureBase58 = signWalletMessage(inviter.privateKey, walletChessSignableMessage("invite", inviteJson)),
      )

    val encoded = walletChessEncodePacket(packet)
    val decoded = walletChessDecodePacket(encoded)

    assertTrue(walletChessVerifyPacket(decoded))
    assertEquals(inviter.addressBase58, walletChessDecodeInvite(decoded).inviterAddress)
  }

  @Test
  fun importedMoveAdvancesWalletMatch() {
    val inviter = generateWalletIdentity()
    val localPlayer = generateWalletIdentity()
    val invite = newWalletChessInvite(localAddress = inviter.addressBase58, localLabel = "Host", localColor = ChessColor.White)
    val invitePacket =
      walletChessBuildSignedInvite(
        payload = invite,
        signatureBase58 =
          signWalletMessage(
            inviter.privateKey,
            walletChessSignableMessage("invite", walletChessJson().encodeToString(WalletChessInvitePayload.serializer(), invite)),
          ),
      )

    val joined =
      importWalletChessPacket(
        raw = walletChessEncodePacket(invitePacket),
        currentSession = null,
        currentGame = resetChessGame(),
        localAddress = localPlayer.addressBase58,
      )

    val move = findLegalMoveByToken(joined.game.position, "e2e4")
    assertNotNull(move)
    val remoteMove = requireNotNull(move)
    val movePayload =
      WalletChessMovePayload(
        matchId = joined.session.matchId,
        ply = 1,
        signerAddress = inviter.addressBase58,
        move = "e2e4",
        moveDisplay = moveToDisplayString(remoteMove),
        beforeFingerprint = chessPositionFingerprint(joined.game.position),
        afterFingerprint = chessPositionFingerprint(applyChessMove(joined.game.position, remoteMove)),
        sentAtMs = 1L,
      )
    val movePacket =
      walletChessBuildSignedMove(
        payload = movePayload,
        signatureBase58 =
          signWalletMessage(
            inviter.privateKey,
            walletChessSignableMessage("move", walletChessJson().encodeToString(WalletChessMovePayload.serializer(), movePayload)),
          ),
      )

    val result =
      importWalletChessPacket(
        raw = walletChessEncodePacket(movePacket),
        currentSession = joined.session,
        currentGame = joined.game,
        localAddress = localPlayer.addressBase58,
      )

    assertEquals(listOf("e2-e4"), result.game.moveLog)
    assertEquals("Black", result.game.position.turn.name)
  }

  @Test
  fun parseGrokChoiceAcceptsCompactJson() {
    val parsed = parseGrokChessMoveChoice("""{"move":"g1f3","comment":"develops the knight"}""")

    assertEquals("g1f3", parsed?.move)
    assertEquals("develops the knight", parsed?.comment)
  }

  private data class WalletIdentity(
    val addressBase58: String,
    val privateKey: org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters,
  )

  private fun generateWalletIdentity(): WalletIdentity {
    val generator = org.bouncycastle.crypto.generators.Ed25519KeyPairGenerator()
    generator.init(org.bouncycastle.crypto.params.Ed25519KeyGenerationParameters(SecureRandom()))
    val pair = generator.generateKeyPair()
    val publicKey = pair.public as org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
    val privateKey = pair.private as org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
    return WalletIdentity(
      addressBase58 = Base58.encodeToString(publicKey.encoded),
      privateKey = privateKey,
    )
  }

  private fun signWalletMessage(
    privateKey: org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters,
    message: String,
  ): String {
    val signer = org.bouncycastle.crypto.signers.Ed25519Signer()
    signer.init(true, privateKey)
    val bytes = message.toByteArray(Charsets.UTF_8)
    signer.update(bytes, 0, bytes.size)
    return Base58.encodeToString(signer.generateSignature())
  }

  private fun walletChessJson() =
    kotlinx.serialization.json.Json {
      ignoreUnknownKeys = true
      explicitNulls = false
    }
}
