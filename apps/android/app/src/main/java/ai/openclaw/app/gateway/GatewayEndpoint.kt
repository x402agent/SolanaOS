package ai.openclaw.app.gateway

data class GatewayEndpoint(
  val stableId: String,
  val name: String,
  val host: String,
  val port: Int,
  val transport: GatewayTransport = GatewayTransport.WebSocketRpc,
  val lanHost: String? = null,
  val tailnetDns: String? = null,
  val gatewayPort: Int? = null,
  val canvasPort: Int? = null,
  val tlsEnabled: Boolean = false,
  val tlsFingerprintSha256: String? = null,
) {
  companion object {
    fun manual(
      host: String,
      port: Int,
      transport: GatewayTransport = GatewayTransport.NativeJsonTcp,
    ): GatewayEndpoint =
      GatewayEndpoint(
        stableId = "manual|${transport.name.lowercase()}|${host.lowercase()}|$port",
        name = "$host:$port",
        host = host,
        port = port,
        transport = transport,
        tlsEnabled = transport == GatewayTransport.WebSocketRpc,
        tlsFingerprintSha256 = null,
      )
  }
}
