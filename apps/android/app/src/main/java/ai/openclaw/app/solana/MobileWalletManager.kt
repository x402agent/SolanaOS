package ai.openclaw.app.solana

import ai.openclaw.app.SecurePrefs
import ai.openclaw.app.nanoSolanaAppName
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import com.funkatronics.encoders.Base58
import com.solana.mobilewalletadapter.common.signin.SignInWithSolana
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.Solana
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import com.solana.mobilewalletadapter.clientlib.protocol.MobileWalletAdapterClient
import java.util.Base64
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class MobileWalletUiState(
  val statusText: String = "No wallet authorization yet.",
  val authorizedAddress: String? = null,
  val hasStoredAuthorization: Boolean = false,
  val isBusy: Boolean = false,
  val errorText: String? = null,
  val infoText: String? = null,
)

data class MobileWalletAuthorizationPayload(
  val addressBase58: String?,
)

data class MobileWalletDetachedMessagePayload(
  val addressBase58: String,
  val signatureBase58: String?,
)

data class MobileWalletSignedTransactionPayload(
  val addressBase58: String,
  val signedTransactionBytes: ByteArray?,
)

data class MobileWalletSentTransactionPayload(
  val addressBase58: String,
  val signatureBytes: ByteArray?,
)

class MobileWalletManager(private val prefs: SecurePrefs) {
  companion object {
    private const val authTokenKey = "solana.mwa.authToken"
    private const val authorizedAddressKey = "solana.mwa.authorizedAddress"
    private const val identityDomain = "tech.solanaos.net"
    private val identityUri: Uri = "https://$identityDomain".toUri()
    private val identityIconUri: Uri = "android-chrome-512x512.png".toUri()
  }

  private val walletAdapter =
    MobileWalletAdapter(
      connectionIdentity =
        ConnectionIdentity(
          identityUri = identityUri,
          iconUri = identityIconUri,
          identityName = nanoSolanaAppName,
        ),
    )

  private var attachedActivity: ComponentActivity? = null
  private var activityResultSender: ActivityResultSender? = null

  private val _state = MutableStateFlow(loadInitialState())
  val state: StateFlow<MobileWalletUiState> = _state.asStateFlow()

  init {
    walletAdapter.authToken = prefs.getString(authTokenKey)?.trim().orEmpty()
    walletAdapter.blockchain = Solana.Mainnet
  }

  fun attachActivity(activity: ComponentActivity) {
    if (attachedActivity === activity && activityResultSender != null) return
    attachedActivity = activity
    activityResultSender = ActivityResultSender(activity)
  }

  fun detachActivity(activity: ComponentActivity) {
    if (attachedActivity !== activity) return
    attachedActivity = null
    activityResultSender = null
  }

  fun currentActivity(): ComponentActivity? = attachedActivity

  suspend fun connect(activity: ComponentActivity) {
    setBusy("Opening your installed Solana wallet…")
    authorizeForResult(activity).fold(
      onSuccess = { payload ->
        _state.value =
          _state.value.copy(
            statusText = "Wallet authorized and ready for Solana Mobile signing.",
            authorizedAddress = payload.addressBase58,
            hasStoredAuthorization = walletAdapter.authToken.orEmpty().isNotBlank(),
            isBusy = false,
            errorText = null,
            infoText = "Authorized ${payload.addressBase58?.let(::shortAddress) ?: "wallet"}",
          )
      },
      onFailure = { err ->
        setFailure(err.message ?: "Wallet connection failed.")
      },
    )
  }

  suspend fun authorizeForResult(activity: ComponentActivity): Result<MobileWalletAuthorizationPayload> {
    val sender = senderFor(activity) ?: return Result.failure(senderUnavailableError())
    return when (val result = walletAdapter.connect(sender)) {
      is TransactionResult.Success -> {
        val address = result.authResult.accounts.firstOrNull()?.publicKey?.let(::toBase58)
        persistAuthorization(authToken = result.authResult.authToken.orEmpty(), address = address)
        _state.value =
          _state.value.copy(
            statusText = "Wallet authorized and ready for Solana Mobile signing.",
            authorizedAddress = address,
            hasStoredAuthorization = walletAdapter.authToken.orEmpty().isNotBlank(),
            isBusy = false,
            errorText = null,
            infoText = "Authorized ${address?.let(::shortAddress) ?: "wallet"}",
          )
        Result.success(MobileWalletAuthorizationPayload(addressBase58 = address))
      }
      is TransactionResult.NoWalletFound -> {
        Result.failure(
          IllegalStateException(
            "No Mobile Wallet Adapter wallet found. Install Seed Vault, Solflare, or Jupiter Mobile.",
          ),
        )
      }
      is TransactionResult.Failure -> {
        Result.failure(IllegalStateException(errorMessage("Wallet connection failed.", result.e), result.e))
      }
    }
  }

  suspend fun disconnect(activity: ComponentActivity) {
    val tokenPresent = walletAdapter.authToken.orEmpty().isNotBlank()
    if (!tokenPresent && !_state.value.hasStoredAuthorization) {
      clearAuthorization()
      _state.value =
        _state.value.copy(
          statusText = "No wallet authorization to clear.",
          isBusy = false,
          errorText = null,
          infoText = null,
        )
      return
    }

    setBusy("Revoking wallet authorization…")
    val sender = senderFor(activity)
    if (sender == null) {
      setFailure(senderUnavailableError().message ?: "Wallet launcher unavailable.")
      return
    }
    when (val result = walletAdapter.disconnect(sender)) {
      is TransactionResult.Success -> {
        clearAuthorization()
        _state.value =
          _state.value.copy(
            statusText = "Wallet authorization removed from this device.",
            authorizedAddress = null,
            hasStoredAuthorization = false,
            isBusy = false,
            errorText = null,
            infoText = "Disconnected wallet authorization.",
          )
      }
      is TransactionResult.NoWalletFound -> {
        clearAuthorization()
        _state.value =
          _state.value.copy(
            statusText = "Wallet authorization cleared locally.",
            authorizedAddress = null,
            hasStoredAuthorization = false,
            isBusy = false,
            errorText = null,
            infoText = "No installed wallet was available, so local authorization was cleared.",
          )
      }
      is TransactionResult.Failure -> {
        setFailure(errorMessage("Wallet disconnect failed.", result.e))
      }
    }
  }

  suspend fun signIn(activity: ComponentActivity) {
    setBusy("Requesting Sign in with Solana…")
    signInForResult(activity).fold(
      onSuccess = { payload ->
        _state.value =
          _state.value.copy(
            statusText = "Sign in with Solana completed.",
            authorizedAddress = payload.addressBase58,
            hasStoredAuthorization = walletAdapter.authToken.orEmpty().isNotBlank(),
            isBusy = false,
            errorText = null,
            infoText = "Signed in as ${payload.addressBase58?.let(::shortAddress) ?: "wallet"}.",
          )
      },
      onFailure = { err ->
        setFailure(err.message ?: "Sign in with Solana failed.")
      },
    )
  }

  suspend fun signInForResult(activity: ComponentActivity): Result<MobileWalletAuthorizationPayload> {
    val signInPayload = SignInWithSolana.Payload(identityDomain, "Sign in to $nanoSolanaAppName on Seeker.")

    return when (
      val result =
        walletAdapter.transact(
          senderFor(activity) ?: return Result.failure(senderUnavailableError()),
          signInPayload,
        ) { authResult: MobileWalletAdapterClient.AuthorizationResult ->
          if (authResult.signInResult == null) {
            throw IllegalStateException("Wallet authorized but did not return a Sign In with Solana result.")
          }
          val address = authResult.accounts.firstOrNull()?.publicKey?.let(::toBase58)
          MobileWalletAuthorizationPayload(addressBase58 = address)
        }
    ) {
      is TransactionResult.Success -> {
        val payload = result.payload
        persistAuthorization(
          authToken = result.authResult.authToken.orEmpty(),
          address = payload.addressBase58,
        )
        Result.success(payload)
      }
      is TransactionResult.NoWalletFound -> {
        Result.failure(
          IllegalStateException("No Mobile Wallet Adapter wallet found. Install a compatible wallet first."),
        )
      }
      is TransactionResult.Failure -> {
        Result.failure(IllegalStateException(errorMessage("Sign in with Solana failed.", result.e), result.e))
      }
    }
  }

  suspend fun signMessage(activity: ComponentActivity, message: String) {
    setBusy("Requesting detached message signature…")
    signMessageForResult(activity, message).fold(
      onSuccess = { payload ->
        _state.value =
          _state.value.copy(
            statusText = "Detached message signature complete.",
            authorizedAddress = payload.addressBase58,
            hasStoredAuthorization = walletAdapter.authToken.orEmpty().isNotBlank(),
            isBusy = false,
            errorText = null,
            infoText =
              payload.signatureBase58?.let {
                "Signature ${shortSignature(it)}"
              } ?: "Wallet returned no detached signature payload.",
          )
      },
      onFailure = { err ->
        setFailure(err.message ?: "Message signing failed.")
      },
    )
  }

  suspend fun signMessageForResult(
    activity: ComponentActivity,
    message: String,
  ): Result<MobileWalletDetachedMessagePayload> {
    val trimmed = message.trim()
    if (trimmed.isBlank()) {
      return Result.failure(IllegalStateException("Enter a message before requesting a signature."))
    }

    return when (
      val result =
        walletAdapter.transact(senderFor(activity) ?: return Result.failure(senderUnavailableError())) { authResult: MobileWalletAdapterClient.AuthorizationResult ->
          val publicKey = authResult.accounts.first().publicKey
          val signedMessages =
            signMessagesDetached(
              arrayOf(trimmed.encodeToByteArray()),
              arrayOf(publicKey),
            )

          MobileWalletDetachedMessagePayload(
            addressBase58 = toBase58(publicKey),
            signatureBase58 =
              signedMessages.messages
                .firstOrNull()
                ?.signatures
                ?.firstOrNull()
                ?.let(::toBase58),
          )
        }
    ) {
      is TransactionResult.Success -> {
        val payload = result.payload
        persistAuthorization(
          authToken = result.authResult.authToken.orEmpty(),
          address = payload.addressBase58,
        )
        Result.success(payload)
      }
      is TransactionResult.NoWalletFound -> {
        Result.failure(IllegalStateException("No Mobile Wallet Adapter wallet found. Install a compatible wallet first."))
      }
      is TransactionResult.Failure -> {
        Result.failure(IllegalStateException(errorMessage("Message signing failed.", result.e), result.e))
      }
    }
  }

  suspend fun signTransactionForResult(
    activity: ComponentActivity,
    unsignedTransaction: ByteArray,
  ): Result<MobileWalletSignedTransactionPayload> {
    if (unsignedTransaction.isEmpty()) {
      return Result.failure(IllegalStateException("Unsigned transaction payload is empty."))
    }

    return when (
      val result =
        walletAdapter.transact(senderFor(activity) ?: return Result.failure(senderUnavailableError())) { authResult: MobileWalletAdapterClient.AuthorizationResult ->
          val publicKey = authResult.accounts.first().publicKey
          val signedTransactions = signTransactions(arrayOf(unsignedTransaction))
          MobileWalletSignedTransactionPayload(
            addressBase58 = toBase58(publicKey),
            signedTransactionBytes = signedTransactions.signedPayloads.firstOrNull(),
          )
        }
    ) {
      is TransactionResult.Success -> {
        val payload = result.payload
        persistAuthorization(
          authToken = result.authResult.authToken.orEmpty(),
          address = payload.addressBase58,
        )
        if (payload.signedTransactionBytes == null) {
          Result.failure(IllegalStateException("Wallet returned no signed transaction payload."))
        } else {
          Result.success(payload)
        }
      }
      is TransactionResult.NoWalletFound -> {
        Result.failure(IllegalStateException("No Mobile Wallet Adapter wallet found. Install a compatible wallet first."))
      }
      is TransactionResult.Failure -> {
        Result.failure(IllegalStateException(errorMessage("Transaction signing failed.", result.e), result.e))
      }
    }
  }

  suspend fun signTransaction(activity: ComponentActivity, encodedUnsignedTransaction: String) {
    setBusy("Requesting transaction signature…")
    decodeUnsignedTransaction(encodedUnsignedTransaction).fold(
      onSuccess = { unsignedTransaction ->
        signTransactionForResult(activity, unsignedTransaction).fold(
          onSuccess = { payload ->
            _state.value =
              _state.value.copy(
                statusText = "Unsigned transaction signed by wallet.",
                authorizedAddress = payload.addressBase58,
                hasStoredAuthorization = walletAdapter.authToken.orEmpty().isNotBlank(),
                isBusy = false,
                errorText = null,
                infoText =
                  payload.signedTransactionBytes?.size?.let { signedSize ->
                    "Signed payload ready ($signedSize bytes) for ${shortAddress(payload.addressBase58)}."
                  } ?: "Wallet returned no signed transaction payload.",
              )
          },
          onFailure = { err ->
            setFailure(err.message ?: "Transaction signing failed.")
          },
        )
      },
      onFailure = { err ->
        setFailure(err.message ?: "Transaction signing failed.")
      },
    )
  }

  suspend fun signAndSendTransactionForResult(
    activity: ComponentActivity,
    unsignedTransaction: ByteArray,
  ): Result<MobileWalletSentTransactionPayload> {
    if (unsignedTransaction.isEmpty()) {
      return Result.failure(IllegalStateException("Unsigned transaction payload is empty."))
    }

    return when (
      val result =
        walletAdapter.transact(senderFor(activity) ?: return Result.failure(senderUnavailableError())) { authResult: MobileWalletAdapterClient.AuthorizationResult ->
          val publicKey = authResult.accounts.first().publicKey
          val signatures = signAndSendTransactions(arrayOf(unsignedTransaction))
          MobileWalletSentTransactionPayload(
            addressBase58 = toBase58(publicKey),
            signatureBytes = signatures.signatures.firstOrNull(),
          )
        }
    ) {
      is TransactionResult.Success -> {
        val payload = result.payload
        persistAuthorization(
          authToken = result.authResult.authToken.orEmpty(),
          address = payload.addressBase58,
        )
        if (payload.signatureBytes == null) {
          Result.failure(IllegalStateException("Wallet returned no transaction signature."))
        } else {
          Result.success(payload)
        }
      }
      is TransactionResult.NoWalletFound -> {
        Result.failure(IllegalStateException("No Mobile Wallet Adapter wallet found. Install a compatible wallet first."))
      }
      is TransactionResult.Failure -> {
        Result.failure(IllegalStateException(errorMessage("Transaction send failed.", result.e), result.e))
      }
    }
  }

  suspend fun signAndSendTransaction(activity: ComponentActivity, encodedUnsignedTransaction: String) {
    setBusy("Requesting transaction send…")
    decodeUnsignedTransaction(encodedUnsignedTransaction).fold(
      onSuccess = { unsignedTransaction ->
        signAndSendTransactionForResult(activity, unsignedTransaction).fold(
          onSuccess = { payload ->
            val signatureBase58 = payload.signatureBytes?.let(::toBase58)
            _state.value =
              _state.value.copy(
                statusText = "Transaction signed and submitted by wallet.",
                authorizedAddress = payload.addressBase58,
                hasStoredAuthorization = walletAdapter.authToken.orEmpty().isNotBlank(),
                isBusy = false,
                errorText = null,
                infoText =
                  signatureBase58?.let {
                    "Submitted transaction ${shortSignature(it)}."
                  } ?: "Wallet returned no transaction signature.",
              )
          },
          onFailure = { err ->
            setFailure(err.message ?: "Transaction send failed.")
          },
        )
      },
      onFailure = { err ->
        setFailure(err.message ?: "Transaction send failed.")
      },
    )
  }

  fun clearTransientMessages() {
    _state.value = _state.value.copy(errorText = null, infoText = null)
  }

  private fun setBusy(statusText: String) {
    _state.value =
      _state.value.copy(
        statusText = statusText,
        isBusy = true,
        errorText = null,
        infoText = null,
      )
  }

  private fun setFailure(message: String) {
    _state.value =
      _state.value.copy(
        statusText = message,
        isBusy = false,
        errorText = message,
        infoText = null,
      )
  }

  private fun persistAuthorization(authToken: String, address: String?) {
    val resolvedToken = authToken.trim()
    walletAdapter.authToken = resolvedToken
    if (resolvedToken.isNotEmpty()) {
      prefs.putString(authTokenKey, resolvedToken)
    } else {
      prefs.remove(authTokenKey)
    }

    val resolvedAddress = address?.trim().orEmpty()
    if (resolvedAddress.isNotEmpty()) {
      prefs.putString(authorizedAddressKey, resolvedAddress)
    } else {
      prefs.remove(authorizedAddressKey)
    }
  }

  private fun clearAuthorization() {
    walletAdapter.authToken = ""
    prefs.remove(authTokenKey)
    prefs.remove(authorizedAddressKey)
  }

  private fun loadInitialState(): MobileWalletUiState {
    val storedToken = prefs.getString(authTokenKey)?.trim().orEmpty()
    val storedAddress = prefs.getString(authorizedAddressKey)?.trim().orEmpty()
    val hasStoredAuthorization = storedToken.isNotEmpty()
    return MobileWalletUiState(
      statusText =
        if (hasStoredAuthorization) {
          "Stored wallet authorization ready for Solana Mobile."
        } else {
          "No wallet authorization yet."
        },
      authorizedAddress = storedAddress.ifEmpty { null },
      hasStoredAuthorization = hasStoredAuthorization,
    )
  }

  private fun errorMessage(prefix: String, throwable: Throwable?): String {
    val detail = throwable?.message?.trim().orEmpty()
    return if (detail.isNotEmpty()) "$prefix $detail" else prefix
  }

  private fun decodeUnsignedTransaction(encodedUnsignedTransaction: String): Result<ByteArray> {
    val trimmed = encodedUnsignedTransaction.trim()
    if (trimmed.isBlank()) {
      return Result.failure(
        IllegalStateException("Paste an unsigned transaction in base64 before testing wallet signing."),
      )
    }

    return try {
      Result.success(Base64.getDecoder().decode(trimmed))
    } catch (_: IllegalArgumentException) {
      Result.failure(
        IllegalStateException("Unsigned transaction must be valid base64."),
      )
    }
  }

  private fun shortAddress(address: String): String {
    if (address.length <= 12) return address
    return "${address.take(4)}…${address.takeLast(4)}"
  }

  private fun shortSignature(signature: String): String {
    if (signature.length <= 18) return signature
    return "${signature.take(8)}…${signature.takeLast(8)}"
  }

  private fun senderFor(activity: ComponentActivity): ActivityResultSender? {
    if (attachedActivity === activity) {
      return activityResultSender
    }
    if (activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
      return null
    }
    attachActivity(activity)
    return activityResultSender
  }

  private fun senderUnavailableError(): IllegalStateException =
    IllegalStateException(
      "Wallet launcher is not attached to the active activity yet. Reopen the screen and try again.",
    )

  private fun toBase58(raw: ByteArray): String = Base58.encodeToString(raw)
}
