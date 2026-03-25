package ai.openclaw.app.solana

import ai.openclaw.app.BuildConfig
import com.funkatronics.encoders.Base58
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.RoundingMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class SolanaPayTransferExecutor(
  private val httpClient: OkHttpClient = OkHttpClient(),
  private val rpcUrl: String = BuildConfig.DEFAULT_SOLANA_RPC_URL.ifBlank { "https://api.mainnet-beta.solana.com" },
) {
  companion object {
    private const val lamportsPerSol = 1_000_000_000L
    private const val systemTransferInstruction = 2
    private const val transactionId = 1
    private const val systemProgramId = "11111111111111111111111111111111"
    private const val memoProgramId = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
  }

  private val json = Json { ignoreUnknownKeys = true }
  private val systemProgramKey by lazy { decodeBase58(systemProgramId, "system program") }
  private val memoProgramKey by lazy { decodeBase58(memoProgramId, "memo program") }

  suspend fun buildUnsignedTransaction(
    senderAddress: String,
    request: SolanaPayRequest.Transfer,
  ): Result<ByteArray> =
    withContext(Dispatchers.IO) {
      runCatching {
        require(request.splTokenMint == null) { "SPL token transfer requests are preview-only for now." }
        val amountText = request.amount ?: throw IllegalStateException("This Solana Pay transfer does not specify an amount.")
        val lamports = parseLamports(amountText)
        val recentBlockhash = fetchLatestBlockhash()
        serializeLegacyTransfer(
          sender = decodeBase58(senderAddress, "sender"),
          recipient = decodeBase58(request.recipient, "recipient"),
          references = request.references.mapIndexed { index, reference ->
            decodeBase58(reference, "reference[$index]")
          },
          recentBlockhash = recentBlockhash,
          lamports = lamports,
          memo = request.memo?.trim().orEmpty().ifBlank { null },
        )
      }
    }

  private fun serializeLegacyTransfer(
    sender: ByteArray,
    recipient: ByteArray,
    references: List<ByteArray>,
    recentBlockhash: ByteArray,
    lamports: Long,
    memo: String?,
  ): ByteArray {
    require(sender.size == 32) { "Sender address must decode to 32 bytes." }
    require(recipient.size == 32) { "Recipient address must decode to 32 bytes." }
    require(recentBlockhash.size == 32) { "Recent blockhash must decode to 32 bytes." }

    val accountKeys =
      buildList {
        add(sender)
        add(recipient)
        addAll(references)
        add(systemProgramKey)
        if (memo != null) {
          add(memoProgramKey)
        }
      }
    val referenceOffset = 2
    val systemProgramIndex = referenceOffset + references.size
    val memoProgramIndex = if (memo != null) systemProgramIndex + 1 else -1

    val transferInstructionData =
      ByteArrayOutputStream().apply {
        writeLittleEndianInt(systemTransferInstruction)
        writeLittleEndianLong(lamports)
      }.toByteArray()

    val message =
      ByteArrayOutputStream().apply {
        write(byteArrayOf(1, 0, (references.size + 1 + if (memo != null) 1 else 0).toByte()))
        writeShortVec(accountKeys.size)
        accountKeys.forEach(::write)
        write(recentBlockhash)

        val instructionCount = if (memo != null) 2 else 1
        writeShortVec(instructionCount)

        val transferAccountIndexes =
          buildList {
            add(0)
            add(1)
            references.indices.forEach { add(referenceOffset + it) }
          }
        writeInstruction(
          programIdIndex = systemProgramIndex,
          accountIndexes = transferAccountIndexes,
          data = transferInstructionData,
        )

        if (memo != null) {
          writeInstruction(
            programIdIndex = memoProgramIndex,
            accountIndexes = emptyList(),
            data = memo.encodeToByteArray(),
          )
        }
      }.toByteArray()

    return ByteArrayOutputStream().apply {
      writeShortVec(1)
      write(ByteArray(64))
      write(message)
    }.toByteArray()
  }

  private fun ByteArrayOutputStream.writeInstruction(
    programIdIndex: Int,
    accountIndexes: List<Int>,
    data: ByteArray,
  ) {
    write(programIdIndex)
    writeShortVec(accountIndexes.size)
    accountIndexes.forEach(::write)
    writeShortVec(data.size)
    write(data)
  }

  private fun ByteArrayOutputStream.writeShortVec(value: Int) {
    require(value >= 0) { "ShortVec value must be non-negative." }
    var remaining = value
    while (true) {
      var next = remaining and 0x7f
      remaining = remaining ushr 7
      if (remaining != 0) {
        next = next or 0x80
      }
      write(next)
      if (remaining == 0) return
    }
  }

  private fun ByteArrayOutputStream.writeLittleEndianInt(value: Int) {
    write(value and 0xff)
    write((value ushr 8) and 0xff)
    write((value ushr 16) and 0xff)
    write((value ushr 24) and 0xff)
  }

  private fun ByteArrayOutputStream.writeLittleEndianLong(value: Long) {
    repeat(8) { shift ->
      write(((value ushr (shift * 8)) and 0xff).toInt())
    }
  }

  private fun parseLamports(amountText: String): Long {
    val solAmount =
      amountText.toBigDecimalOrNull()
        ?: throw IllegalArgumentException("Unable to parse SOL amount '$amountText'.")
    require(solAmount > BigDecimal.ZERO) { "Transfer amount must be positive." }
    val lamportsDecimal = solAmount.movePointRight(9)
    require(lamportsDecimal.stripTrailingZeros().scale() <= 0) {
      "Transfer amount must resolve to whole lamports."
    }
    return lamportsDecimal.setScale(0, RoundingMode.UNNECESSARY).longValueExact()
  }

  private fun fetchLatestBlockhash(): ByteArray {
    val requestBody =
      """
      {"jsonrpc":"2.0","id":$transactionId,"method":"getLatestBlockhash","params":[{"commitment":"finalized"}]}
      """.trimIndent()
    val request =
      Request.Builder()
        .url(rpcUrl)
        .post(requestBody.toRequestBody("application/json".toMediaType()))
        .build()

    httpClient.newCall(request).execute().use { response ->
      check(response.isSuccessful) { "RPC latest blockhash request failed with ${response.code}." }
      val body = response.body.string()
      val blockhash =
        json.parseToJsonElement(body)
          .jsonObject["result"]
          ?.jsonObject
          ?.get("value")
          ?.jsonObject
          ?.get("blockhash")
          ?.jsonPrimitive
          ?.content
          ?: throw IllegalStateException("RPC response did not contain a blockhash.")
      return decodeBase58(blockhash, "recent blockhash")
    }
  }

  private fun decodeBase58(value: String, field: String): ByteArray {
    val decoded =
      try {
        Base58.decode(value)
      } catch (err: Throwable) {
        throw IllegalArgumentException("Unable to decode $field as base58.", err)
      }
    require(decoded.isNotEmpty()) { "$field decoded to an empty byte array." }
    return decoded
  }
}
