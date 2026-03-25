package ai.openclaw.app.solana

import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test

class SolanaRpcBalanceClientTest {
  @Test
  fun fetchBalance_parsesLamportsFromRpcResponse() {
    val server = MockWebServer()
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """
        {
          "jsonrpc": "2.0",
          "result": {
            "context": { "slot": 123 },
            "value": 750000000
          },
          "id": 1
        }
        """.trimIndent(),
      ),
    )
    server.start()

    try {
      val client =
        SolanaRpcBalanceClient(
          rpcUrl = server.url("/").toString(),
          httpClient = OkHttpClient(),
        )

      val snapshot =
        runBlocking {
          client.fetchBalance("Wallet111111111111111111111111111111111111")
        }

      assertEquals(750_000_000L, snapshot.lamports)
      assertEquals(0.75, snapshot.sol, 0.00001)
    } finally {
      server.shutdown()
    }
  }
}
