package ai.openclaw.app.solana

import android.net.Uri
import androidx.core.net.toUri

sealed interface SolanaPayRequest {
  val rawUri: String

  data class Transfer(
    override val rawUri: String,
    val recipient: String,
    val amount: String?,
    val splTokenMint: String?,
    val references: List<String>,
    val label: String?,
    val message: String?,
    val memo: String?,
  ) : SolanaPayRequest

  data class Transaction(
    override val rawUri: String,
    val link: String,
  ) : SolanaPayRequest

  companion object {
    private const val scheme = "solana"
    private const val amountParam = "amount"
    private const val splTokenParam = "spl-token"
    private const val referenceParam = "reference"
    private const val labelParam = "label"
    private const val messageParam = "message"
    private const val memoParam = "memo"
    private val base58PublicKeyRegex = Regex("^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32,44}$")
    private val amountRegex = Regex("^\\d+(?:\\.\\d+)?$")

    fun parse(raw: String): SolanaPayRequest = parse(raw.toUri())

    fun parse(uri: Uri): SolanaPayRequest {
      require(uri.scheme.equals(scheme, ignoreCase = true)) { "$uri is not a valid Solana Pay URI" }

      return runCatching { parseTransaction(uri) }
        .recoverCatching { parseTransfer(uri) }
        .getOrElse { throw IllegalArgumentException("Unable to parse $uri as a Solana Pay URI") }
    }

    private fun parseTransaction(uri: Uri): Transaction {
      val primaryPart = primaryPart(uri)
      val link = Uri.decode(primaryPart).toUri()
      require(link.scheme.equals("https", ignoreCase = true)) { "Link scheme must be an https URL" }
      return Transaction(
        rawUri = uri.toString(),
        link = link.toString(),
      )
    }

    private fun parseTransfer(uri: Uri): Transfer {
      val queryUri = queryUri(uri)
      val recipient = primaryPart(uri)
      require(recipient.matches(base58PublicKeyRegex)) { "Recipient must be a base58-encoded public key" }

      val amount = singleOptional(queryUri, amountParam)
      if (amount != null) {
        require(amount.matches(amountRegex)) { "$amountParam must be a positive integer or decimal value" }
      }

      val splTokenMint = singleOptional(queryUri, splTokenParam)
      if (splTokenMint != null) {
        require(splTokenMint.matches(base58PublicKeyRegex)) { "$splTokenParam must be a base58-encoded public key" }
      }

      val references = queryUri.getQueryParameters(referenceParam)
      references.forEach { reference ->
        require(reference.matches(base58PublicKeyRegex)) { "$referenceParam must be a base58-encoded public key" }
      }

      return Transfer(
        rawUri = uri.toString(),
        recipient = recipient,
        amount = amount,
        splTokenMint = splTokenMint,
        references = references,
        label = singleOptional(queryUri, labelParam),
        message = singleOptional(queryUri, messageParam),
        memo = singleOptional(queryUri, memoParam),
      )
    }

    private fun queryUri(uri: Uri): Uri {
      val ssp = uri.encodedSchemeSpecificPart.orEmpty()
      val querySeparator = ssp.indexOf('?')
      if (querySeparator == -1 || querySeparator == ssp.lastIndex) {
        return Uri.EMPTY
      }
      return "?${ssp.substring(querySeparator + 1)}".toUri()
    }

    private fun primaryPart(uri: Uri): String {
      val ssp = uri.encodedSchemeSpecificPart.orEmpty()
      val querySeparator = ssp.indexOf('?')
      val primary = if (querySeparator == -1) ssp else ssp.substring(0, querySeparator)
      return Uri.decode(primary)
    }

    private fun singleOptional(queryUri: Uri, name: String): String? {
      val values = queryUri.getQueryParameters(name)
      require(values.size <= 1) { "$name query parameter should appear at most once" }
      return values.firstOrNull()
    }
  }
}
