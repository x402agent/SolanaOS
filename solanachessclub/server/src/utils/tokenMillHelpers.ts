import {
  Connection,
  Transaction,
  clusterApiUrl,
  PublicKey,
} from '@solana/web3.js';

/**
 * Parses swap amounts from return data.
 */
export function parseSwapAmounts(returnData: any): {
  baseAmount: number;
  quoteAmount: number;
} {
  if (!returnData || !returnData.data) {
    console.log('Invalid or missing return data:', returnData);
    return {baseAmount: 0, quoteAmount: 0};
  }

  try {
    const buffer = Buffer.from(returnData.data[0], 'base64');
    console.log('Decoded buffer:', buffer.toString('hex'));
    console.log('Decoded buffer length:', buffer.length);

    if (buffer.length < 16) {
      console.log('Buffer too short, returning default values');
      return {baseAmount: 0, quoteAmount: 0};
    }

    let baseAmount: bigint;
    let quoteAmount: bigint;

    try {
      baseAmount = buffer.readBigUInt64LE(0);
      quoteAmount = buffer.readBigUInt64LE(8);
    } catch (error) {
      console.log('Error reading buffer:', error);
      return {baseAmount: 0, quoteAmount: 0};
    }

    return {
      baseAmount: Number(baseAmount),
      quoteAmount: Number(quoteAmount),
    };
  } catch (error) {
    console.log('Error parsing return data:', error);
    return {baseAmount: 0, quoteAmount: 0};
  }
}

/**
 * Serializes a Solana Transaction into a base64 string.
 */
export function serializeTransaction(tx: Transaction): string {
  const serializedTx = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return serializedTx.toString('base64');
}

/**
 * Retrieves the latest blockhash from the provided connection.
 * If the primary connection fails, falls back to devnet.
 */
export async function getBlockhashWithFallback(
  connection: Connection,
): Promise<string> {
  try {
    const {blockhash} = await connection.getLatestBlockhash();
    return blockhash;
  } catch (err) {
    console.error('Error getting blockhash from primary RPC:', err);
    console.log("Falling back to clusterApiUrl('devnet')...");
    const fallbackConnection = new Connection(clusterApiUrl('devnet'));
    const {blockhash} = await fallbackConnection.getLatestBlockhash();
    return blockhash;
  }
}

/**
 * Simple sleep function.
 * @param ms Number of milliseconds to pause.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Derives a Program Derived Address (PDA) from given seeds and program ID.
 * @param seeds Array of seeds (Buffer or Uint8Array)
 * @param programId The program's public key.
 * @returns The derived PDA.
 */
export function derivePDA(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}
