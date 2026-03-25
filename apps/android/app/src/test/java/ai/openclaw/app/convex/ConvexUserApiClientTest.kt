package ai.openclaw.app.convex

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConvexUserApiClientTest {
  @Test
  fun `fetch health falls back to configured urls`() =
    runBlocking {
      val server = MockWebServer()
      server.enqueue(
        MockResponse().setResponseCode(200).setBody("""{"status":"ok","backend":"convex"}"""),
      )
      server.start()
      try {
        val client =
          ConvexUserApiClient(
            cloudUrl = "https://knowing-crane-255.convex.cloud",
            siteUrl = server.url("/").toString().removeSuffix("/"),
          )

        val result = client.fetchHealth()
        assertEquals("ok", result.status)
        assertEquals("https://knowing-crane-255.convex.cloud", result.cloudUrl)
        assertTrue(result.siteUrl!!.contains("http://"))
      } finally {
        server.shutdown()
      }
    }

  @Test
  fun `upsert wallet user posts json payload`() =
    runBlocking {
      val server = MockWebServer()
      server.enqueue(
        MockResponse().setResponseCode(200).setBody(
          """
          {
            "status":"ok",
            "user":{
              "walletAddress":"8BitWallet11111111111111111111111111111111",
              "displayName":"8Bit",
              "appVersion":"2026.3.11",
              "firstSeenAt":1000,
              "lastSeenAt":2000
            }
          }
          """.trimIndent(),
        ),
      )
      server.start()
      try {
        val client =
          ConvexUserApiClient(
            cloudUrl = "",
            siteUrl = server.url("/").toString().removeSuffix("/"),
          )
        val response =
          client.upsertWalletUser(
            ConvexWalletUserUpsertRequest(
              walletAddress = "8BitWallet11111111111111111111111111111111",
              displayName = "8Bit",
              appVersion = "2026.3.11",
              signedAtMs = 123L,
              nonce = "abc",
              signatureBase58 = "sig",
            ),
          )

        assertEquals("ok", response.status)
        assertEquals("8Bit", response.user.displayName)
        val recorded = server.takeRequest()
        assertEquals("/nanosolana/users/upsert", recorded.path)
        assertTrue(recorded.body.readUtf8().contains("walletAddress"))
      } finally {
        server.shutdown()
      }
    }
}
