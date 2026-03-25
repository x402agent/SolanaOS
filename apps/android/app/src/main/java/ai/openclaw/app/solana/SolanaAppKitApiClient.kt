package ai.openclaw.app.solana

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

@Serializable
data class SolanaAppKitMintNftResponse(
  val mint: String = "",
  val metadata: String = "",
  val transaction: String = "",
)

data class SolanaNftMintResult(
  val mintAddress: String,
  val collectionMint: String,
  val metadataUri: String,
  val transactionSignature: String,
)

@Serializable
private data class SolanaAppKitMintNftRequest(
  val userWalletAddress: String,
  val collectionMint: String,
  val metadata: SolanaAppKitMintMetadata,
  val recipient: String? = null,
)

@Serializable
private data class SolanaAppKitMintMetadata(
  val name: String,
  val uri: String,
)

internal class SolanaAppKitApiClient(
  private val httpClient: OkHttpClient = OkHttpClient(),
  private val json: Json = Json { ignoreUnknownKeys = true },
) {
  suspend fun uploadNftMetadata(
    baseUrl: String,
    fileName: String,
    mimeType: String,
    imageBytes: ByteArray,
    nftName: String,
    tokenSymbol: String,
    description: String,
  ): String =
    withContext(Dispatchers.IO) {
      val tempFile =
        File.createTempFile("solanaos-nft-", fileName.substringAfterLast('.', "img")).apply {
          writeBytes(imageBytes)
        }
      try {
        val requestBody =
          MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("tokenName", nftName)
            .addFormDataPart("tokenSymbol", tokenSymbol)
            .addFormDataPart("description", description)
            .addFormDataPart(
              "image",
              fileName,
              tempFile.asRequestBody(mimeType.toMediaType()),
            )
            .build()

        val request =
          Request.Builder()
            .url(normalizeBaseUrl(baseUrl) + "/api/pumpfun/uploadMetadata")
            .post(requestBody)
            .build()

        httpClient.newCall(request).execute().use { response ->
          val body = response.body?.string().orEmpty()
          val root = parseJsonObject(body)
          if (!response.isSuccessful || root["success"]?.jsonPrimitive?.booleanOrNull == false) {
            throw IllegalStateException(root.string("error") ?: body.trim().ifEmpty { "Metadata upload failed" })
          }
          return@use root.string("metadataUri")
            ?: throw IllegalStateException("Metadata upload returned no metadata URI")
        }
      } finally {
        tempFile.delete()
      }
    }

  suspend fun mintCollectionNft(
    baseUrl: String,
    userWalletAddress: String,
    collectionMint: String,
    nftName: String,
    metadataUri: String,
    recipient: String?,
  ): SolanaAppKitMintNftResponse =
    withContext(Dispatchers.IO) {
      val request =
        Request.Builder()
          .url(normalizeBaseUrl(baseUrl) + "/api/nft/mint-nft")
          .header("Content-Type", "application/json")
          .post(
            json.encodeToString(
              SolanaAppKitMintNftRequest(
                userWalletAddress = userWalletAddress,
                collectionMint = collectionMint,
                metadata = SolanaAppKitMintMetadata(name = nftName, uri = metadataUri),
                recipient = recipient,
              ),
            ).toRequestBody(jsonMediaType),
          ).build()

      httpClient.newCall(request).execute().use { response ->
        val body = response.body?.string().orEmpty()
        val root = parseJsonObject(body)
        if (!response.isSuccessful) {
          throw IllegalStateException(root.string("error") ?: body.trim().ifEmpty { "Mint request failed" })
        }
        val payload = json.decodeFromJsonElement<SolanaAppKitMintNftResponse>(root)
        if (payload.transaction.isBlank() || payload.mint.isBlank()) {
          throw IllegalStateException("Mint response is missing the unsigned transaction or mint address")
        }
        payload
      }
    }

  private fun parseJsonObject(body: String): JsonObject =
    json.parseToJsonElement(body) as? JsonObject ?: throw IllegalStateException(body.trim().ifEmpty { "Invalid server response" })

  private fun normalizeBaseUrl(baseUrl: String): String {
    val trimmed = baseUrl.trim()
    val withScheme =
      if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
      } else {
        "http://$trimmed"
      }
    return withScheme.trimEnd('/')
  }

  companion object {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
  }
}

private fun JsonObject.string(key: String): String? =
  (this[key] as? kotlinx.serialization.json.JsonPrimitive)?.let { primitive ->
    if (primitive.isString) {
      primitive.content
    } else {
      primitive.toString().trim().trim('"')
    }
  }
