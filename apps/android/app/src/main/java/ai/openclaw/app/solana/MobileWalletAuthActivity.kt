package ai.openclaw.app.solana

import ai.openclaw.app.NodeApp
import android.os.Bundle
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

class MobileWalletAuthActivity : ComponentActivity() {
  companion object {
    const val EXTRA_ACTION = "mobile_wallet_action"
    const val EXTRA_REQUEST_ID = "mobile_wallet_request_id"
    const val EXTRA_MESSAGE = "mobile_wallet_message"
    const val EXTRA_TRANSACTION = "mobile_wallet_transaction"

    const val ACTION_AUTHORIZE = "authorize"
    const val ACTION_SIGN_IN = "sign_in"
    const val ACTION_SIGN_MESSAGE = "sign_message"
    const val ACTION_SIGN_TRANSACTION = "sign_transaction"
    const val ACTION_SIGN_AND_SEND_TRANSACTION = "sign_and_send_transaction"

    const val RESULTS_DIR = "mobile_wallet_results"
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val action = intent.getStringExtra(EXTRA_ACTION).orEmpty()
    val requestId = intent.getStringExtra(EXTRA_REQUEST_ID).orEmpty()
    if (action.isBlank() || requestId.isBlank()) {
      finish()
      return
    }

    val manager = (application as NodeApp).mobileWalletManager
    lifecycleScope.launch {
      val result =
        when (action) {
          ACTION_AUTHORIZE -> {
            manager.authorizeForResult(this@MobileWalletAuthActivity).fold(
              onSuccess = { payload ->
                JSONObject()
                  .put("address", payload.addressBase58.orEmpty())
                  .put("error", "")
              },
              onFailure = { err ->
                JSONObject()
                  .put("address", "")
                  .put("error", err.message.orEmpty())
              },
            )
          }
          ACTION_SIGN_IN -> {
            manager.signInForResult(this@MobileWalletAuthActivity).fold(
              onSuccess = { payload ->
                JSONObject()
                  .put("address", payload.addressBase58.orEmpty())
                  .put("error", "")
              },
              onFailure = { err ->
                JSONObject()
                  .put("address", "")
                  .put("error", err.message.orEmpty())
              },
            )
          }
          ACTION_SIGN_MESSAGE -> {
            val message = intent.getStringExtra(EXTRA_MESSAGE).orEmpty()
            manager.signMessageForResult(this@MobileWalletAuthActivity, message).fold(
              onSuccess = { payload ->
                JSONObject()
                  .put("address", payload.addressBase58)
                  .put("signature", payload.signatureBase58.orEmpty())
                  .put("error", "")
              },
              onFailure = { err ->
                JSONObject()
                  .put("address", "")
                  .put("signature", "")
                  .put("error", err.message.orEmpty())
              },
            )
          }
          ACTION_SIGN_TRANSACTION -> {
            val transaction = intent.getByteArrayExtra(EXTRA_TRANSACTION) ?: ByteArray(0)
            manager.signTransactionForResult(this@MobileWalletAuthActivity, transaction).fold(
              onSuccess = { payload ->
                JSONObject()
                  .put("address", payload.addressBase58)
                  .put(
                    "signedTransaction",
                    payload.signedTransactionBytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) }.orEmpty(),
                  )
                  .put("error", "")
              },
              onFailure = { err ->
                JSONObject()
                  .put("address", "")
                  .put("signedTransaction", "")
                  .put("error", err.message.orEmpty())
              },
            )
          }
          ACTION_SIGN_AND_SEND_TRANSACTION -> {
            val transaction = intent.getByteArrayExtra(EXTRA_TRANSACTION) ?: ByteArray(0)
            manager.signAndSendTransactionForResult(this@MobileWalletAuthActivity, transaction).fold(
              onSuccess = { payload ->
                JSONObject()
                  .put("address", payload.addressBase58)
                  .put(
                    "signature",
                    payload.signatureBytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) }.orEmpty(),
                  )
                  .put("error", "")
              },
              onFailure = { err ->
                JSONObject()
                  .put("address", "")
                  .put("signature", "")
                  .put("error", err.message.orEmpty())
              },
            )
          }
          else -> {
            JSONObject()
              .put("error", "Unsupported wallet action: $action")
          }
        }

      writeResultFile(requestId, result)
      finish()
    }
  }

  private fun writeResultFile(requestId: String, result: JSONObject) {
    val resultDir = File(filesDir, RESULTS_DIR).apply { mkdirs() }
    val tmpFile = File(resultDir, "$requestId.tmp")
    val jsonFile = File(resultDir, "$requestId.json")
    tmpFile.writeText(result.toString())
    tmpFile.renameTo(jsonFile)
  }
}
