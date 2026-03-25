import { Client } from "@solana-tracker/data-api";

let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    const apiKey = process.env.SOLANA_TRACKER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing SOLANA_TRACKER_API_KEY environment variable. " +
          "Get one at https://data.solanatracker.io"
      );
    }
    client = new Client({ apiKey });
  }
  return client;
}
