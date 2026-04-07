#!/usr/bin/env node
/**
 * SolanaOS MCP Server — STDIO entrypoint (for Claude Desktop, local Cursor, etc.)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, validateGateway } from "./server.js";

async function main(): Promise<void> {
  await validateGateway();
  const server = createServer(process.env.SOLANAOS_GATEWAY_API_KEY);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
