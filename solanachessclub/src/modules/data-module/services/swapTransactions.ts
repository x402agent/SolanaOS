/**
 * File: src/services/swapTransactions.ts
 *
 * Service for fetching and processing swap transactions for a user
 */

import {CLUSTER, HELIUS_STAKED_URL} from '@env';
import {PublicKey, Connection, clusterApiUrl, Cluster} from '@solana/web3.js';
import { ENDPOINTS } from '@/shared/config/constants';

export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  amount: number;
  image?: string;
  logoURI?: string;
  price_info?: {
    price_per_token?: number;
    total_price?: number;
  };
}

export interface SwapTransaction {
  signature: string;
  timestamp: number;
  inputToken: TokenMetadata;
  outputToken: TokenMetadata;
  success: boolean;
  fee?: number;
}

/**
 * Fetches recent swap transactions for a wallet
 */
export const fetchRecentSwaps = async (
  walletAddress: string,
): Promise<SwapTransaction[]> => {
  try {
    if (!walletAddress) {
      return [];
    }

    // Use Helius API or fallback to cluster API URL
    const rpcUrl = HELIUS_STAKED_URL || ENDPOINTS.helius || clusterApiUrl(CLUSTER as Cluster);

    // Use a more specific method to target swap transactions
    const swapsResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getSignaturesForAddress',
        params: [
          walletAddress,
          {
            limit: 30,
          },
        ],
      }),
    });

    const swapsData = await swapsResponse.json();

    if (!swapsData.result || !Array.isArray(swapsData.result)) {
      console.log('No transaction signatures found');
      return [];
    }

    // Filter for likely swap signatures and get transaction details
    const swapSignatures = swapsData.result
      .filter((tx: any) => !tx.err) // Filter out errors
      .map((tx: any) => ({
        signature: tx.signature,
        // Convert blockTime to milliseconds for consistency
        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
      }));

    if (swapSignatures.length === 0) {
      console.log('No successful transactions found');
      return [];
    }

    // Retrieve transaction details for all signatures
    // and filter for transactions that look like swaps (pre/post token balances changed)
    const swapTransactions: SwapTransaction[] = [];

    // Process in chunks to avoid overwhelming the API
    const chunkSize = 5;
    for (let i = 0; i < swapSignatures.length; i += chunkSize) {
      const signatureChunk = swapSignatures.slice(i, i + chunkSize);

      const transactionPromises = signatureChunk.map(async (sig: any) => {
        try {
          const txResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: '1',
              method: 'getTransaction',
              params: [
                sig.signature,
                {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0},
              ],
            }),
          });

          const txData = await txResponse.json();

          // Check if this is a swap transaction by looking for token balance changes
          if (
            txData.result &&
            txData.result.meta &&
            txData.result.meta.preTokenBalances &&
            txData.result.meta.postTokenBalances
          ) {
            // Only consider transactions where at least 2 different tokens are involved
            const uniqueMints = new Set();

            // Add all mints from preTokenBalances
            txData.result.meta.preTokenBalances.forEach((balance: any) => {
              if (balance.mint) uniqueMints.add(balance.mint);
            });

            // Add all mints from postTokenBalances
            txData.result.meta.postTokenBalances.forEach((balance: any) => {
              if (balance.mint) uniqueMints.add(balance.mint);
            });

            // If we have at least 2 different tokens involved, this is likely a swap
            if (uniqueMints.size >= 2) {
              // Create a basic swap transaction structure
              const swapTx: SwapTransaction = {
                signature: sig.signature,
                timestamp: sig.timestamp,
                inputToken: {
                  mint: '', // Will be filled by parseSwapFromTransaction
                  symbol: 'Unknown',
                  name: 'Unknown Token',
                  decimals: 9,
                  amount: 0,
                },
                outputToken: {
                  mint: '', // Will be filled by parseSwapFromTransaction
                  symbol: 'Unknown',
                  name: 'Unknown Token',
                  decimals: 9,
                  amount: 0,
                },
                success: true,
              };

              // Use our parser to extract token details
              const parsedSwap = parseSwapFromTransaction(
                txData.result,
                swapTx,
              );

              // Only include transactions where both input and output tokens were identified
              if (
                parsedSwap.inputToken.mint &&
                parsedSwap.outputToken.mint &&
                parsedSwap.inputToken.mint !== 'Unknown' &&
                parsedSwap.outputToken.mint !== 'Unknown' &&
                parsedSwap.inputToken.amount > 0 &&
                parsedSwap.outputToken.amount > 0
              ) {
                swapTransactions.push(parsedSwap);
              }
            }
          }
        } catch (err) {
          console.error(`Error processing transaction ${sig.signature}:`, err);
        }
      });

      await Promise.all(transactionPromises);
    }

    // Sort by timestamp, newest first
    return swapTransactions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching recent swaps:', error);
    return [];
  }
};

/**
 * Enriches swap transactions with token metadata
 */
export const enrichSwapTransactions = async (
  swaps: SwapTransaction[],
): Promise<SwapTransaction[]> => {
  try {
    if (swaps.length === 0) {
      return [];
    }

    // Collect all unique token mints
    const tokenMints = new Set<string>();
    swaps.forEach(swap => {
      if (swap.inputToken.mint && swap.inputToken.mint !== 'Unknown')
        tokenMints.add(swap.inputToken.mint);
      if (swap.outputToken.mint && swap.outputToken.mint !== 'Unknown')
        tokenMints.add(swap.outputToken.mint);
    });

    console.log(`Enriching metadata for ${tokenMints.size} unique tokens`);

    // Fetch metadata for all tokens at once
    const tokenMetadataMap = new Map<string, any>();
    await Promise.all(
      Array.from(tokenMints).map(async mint => {
        if (!mint) return;
        try {
          const metadata = await fetchTokenMetadata(mint);
          if (metadata) {
            tokenMetadataMap.set(mint, metadata);
          }
        } catch (error) {
          console.error(`Error fetching metadata for ${mint}:`, error);
        }
      }),
    );

    console.log(
      `Successfully fetched metadata for ${tokenMetadataMap.size} tokens`,
    );

    // Enrich each swap with the fetched metadata
    const enrichedSwaps = swaps.map(swap => {
      try {
        const enrichedSwap = {...swap};

        // Enrich input token
        if (
          enrichedSwap.inputToken.mint &&
          tokenMetadataMap.has(enrichedSwap.inputToken.mint)
        ) {
          const metadata = tokenMetadataMap.get(enrichedSwap.inputToken.mint);
          enrichedSwap.inputToken = {
            ...enrichedSwap.inputToken,
            symbol: metadata.symbol || enrichedSwap.inputToken.symbol,
            name: metadata.name || enrichedSwap.inputToken.name,
            decimals: metadata.decimals || enrichedSwap.inputToken.decimals,
            logoURI: metadata.logoURI || enrichedSwap.inputToken.logoURI,
            image:
              metadata.logoURI ||
              metadata.image ||
              enrichedSwap.inputToken.image,
          };
        }

        // Enrich output token
        if (
          enrichedSwap.outputToken.mint &&
          tokenMetadataMap.has(enrichedSwap.outputToken.mint)
        ) {
          const metadata = tokenMetadataMap.get(enrichedSwap.outputToken.mint);
          enrichedSwap.outputToken = {
            ...enrichedSwap.outputToken,
            symbol: metadata.symbol || enrichedSwap.outputToken.symbol,
            name: metadata.name || enrichedSwap.outputToken.name,
            decimals: metadata.decimals || enrichedSwap.outputToken.decimals,
            logoURI: metadata.logoURI || enrichedSwap.outputToken.logoURI,
            image:
              metadata.logoURI ||
              metadata.image ||
              enrichedSwap.outputToken.image,
          };
        }

        return enrichedSwap;
      } catch (error) {
        console.error(`Error enriching swap ${swap.signature}:`, error);
        return swap;
      }
    });

    return enrichedSwaps;
  } catch (error) {
    console.error('Error enriching swap transactions:', error);
    return swaps;
  }
};

/**
 * Parse swap details from a transaction object
 * This is a simplified implementation that would need to be expanded
 */
function parseSwapFromTransaction(
  txData: any,
  swap: SwapTransaction,
): SwapTransaction {
  // The updated implementation will use preTokenBalances and postTokenBalances
  // to reliably identify the tokens involved in the swap

  // Set fallback values if parsing fails
  const defaultInput = {
    mint: swap.inputToken.mint || 'Unknown',
    symbol: swap.inputToken.symbol || 'Unknown',
    name: swap.inputToken.name || 'Unknown Token',
    decimals: swap.inputToken.decimals || 9,
    amount: 0,
  };

  const defaultOutput = {
    mint: swap.outputToken.mint || 'Unknown',
    symbol: swap.outputToken.symbol || 'Unknown',
    name: swap.outputToken.name || 'Unknown Token',
    decimals: swap.outputToken.decimals || 9,
    amount: 0,
  };

  try {
    // Extract token balances from the transaction metadata
    if (
      !txData.meta ||
      !txData.meta.preTokenBalances ||
      !txData.meta.postTokenBalances
    ) {
      console.log('Transaction metadata missing token balances');
      throw new Error('Transaction metadata missing token balances');
    }

    const preBalances = txData.meta.preTokenBalances || [];
    const postBalances = txData.meta.postTokenBalances || [];

    // First, identify the relevant accounts - tokens owned by the user
    // In Jupiter swaps, many temporary accounts are created and the actual swap
    // can involve multiple steps between intermediate tokens

    // Extract the owner key from the transaction (usually the first signer)
    let userOwner = null;
    if (
      txData.transaction &&
      txData.transaction.message &&
      txData.transaction.message.accountKeys
    ) {
      for (const account of txData.transaction.message.accountKeys) {
        if (account.signer) {
          userOwner = account.pubkey;
          break;
        }
      }
    }

    if (!userOwner) {
      console.log('Could not identify user wallet in transaction');
      throw new Error('Could not identify user wallet in transaction');
    }

    // Group token balances by owner to identify user-owned accounts
    const userPreBalances: any[] = [];
    const userPostBalances: any[] = [];

    // Find user's token accounts in pre-balances
    preBalances.forEach((balance: any) => {
      if (balance.owner === userOwner) {
        userPreBalances.push({
          mint: balance.mint,
          amount: parseFloat(balance.uiTokenAmount.amount),
          decimals: balance.uiTokenAmount.decimals,
          accountIndex: balance.accountIndex,
        });
      }
    });

    // Find user's token accounts in post-balances
    postBalances.forEach((balance: any) => {
      if (balance.owner === userOwner) {
        userPostBalances.push({
          mint: balance.mint,
          amount: parseFloat(balance.uiTokenAmount.amount),
          decimals: balance.uiTokenAmount.decimals,
          accountIndex: balance.accountIndex,
        });
      }
    });

    // Find newly created token accounts by checking which mints appear only in post-balances
    const preBalanceMints = new Set(
      userPreBalances.map(balance => balance.mint),
    );
    const newMints = userPostBalances
      .filter(
        balance => !preBalanceMints.has(balance.mint) && balance.amount > 0,
      )
      .map(balance => balance.mint);

    // Find tokens with decreased balances (spent tokens)
    const decreasedTokens: any[] = [];
    const userPreBalanceMap = new Map(userPreBalances.map(b => [b.mint, b]));

    // Check for tokens that existed before and have decreased amounts
    userPostBalances.forEach(postBalance => {
      const preBalance = userPreBalanceMap.get(postBalance.mint);
      if (preBalance && preBalance.amount > postBalance.amount) {
        decreasedTokens.push({
          mint: postBalance.mint,
          decimals: postBalance.decimals,
          preLamports: preBalance.amount,
          postLamports: postBalance.amount,
          difference: preBalance.amount - postBalance.amount,
        });
      }
    });

    // Find tokens with increased balances (received tokens)
    const increasedTokens: any[] = [];
    const userPostBalanceMap = new Map(userPostBalances.map(b => [b.mint, b]));

    // Check for tokens that existed before and have increased amounts
    userPreBalances.forEach(preBalance => {
      const postBalance = userPostBalanceMap.get(preBalance.mint);
      if (postBalance && postBalance.amount > preBalance.amount) {
        increasedTokens.push({
          mint: postBalance.mint,
          decimals: postBalance.decimals,
          preLamports: preBalance.amount,
          postLamports: postBalance.amount,
          difference: postBalance.amount - preBalance.amount,
        });
      }
    });

    // Also add newly created token accounts to the increased tokens list
    newMints.forEach(mint => {
      const newBalance = userPostBalances.find(
        balance => balance.mint === mint,
      );
      if (newBalance) {
        increasedTokens.push({
          mint: newBalance.mint,
          decimals: newBalance.decimals,
          preLamports: 0,
          postLamports: newBalance.amount,
          difference: newBalance.amount,
        });
      }
    });

    // Sort to find the token with the largest relative value change
    // This helps prioritize the main token in complex swaps with multiple token movements
    decreasedTokens.sort((a, b) => b.difference - a.difference);
    increasedTokens.sort((a, b) => b.difference - a.difference);

    // Identify the primary input token (most decreased)
    let inputToken = decreasedTokens.length > 0 ? decreasedTokens[0] : null;

    // Identify the primary output token (most increased)
    let outputToken = increasedTokens.length > 0 ? increasedTokens[0] : null;

    // Handle the special cases for wrapped SOL (native SOL)
    const solMint = 'So11111111111111111111111111111111111111112';

    // Look for SOL balances in the transaction, since some swaps unwrap SOL at the end
    const preAccountSOLBalance =
      txData.meta.preBalances && txData.meta.preBalances[0];
    const postAccountSOLBalance =
      txData.meta.postBalances && txData.meta.postBalances[0];

    // This check helps with swaps that end by unwrapping SOL
    if (
      preAccountSOLBalance !== undefined &&
      postAccountSOLBalance !== undefined
    ) {
      const preSolAmount = preAccountSOLBalance;
      const postSolAmount = postAccountSOLBalance;
      const solDifference =
        postSolAmount - preSolAmount - (txData.meta.fee || 0); // Adjust for tx fee

      if (solDifference > 1000000) {
        // A significant SOL increase (>0.001 SOL)
        // Native SOL was likely received
        if (!outputToken || solDifference > outputToken.difference) {
          outputToken = {
            mint: solMint,
            decimals: 9,
            preLamports: preSolAmount,
            postLamports: postSolAmount,
            difference: solDifference,
          };
        }
      } else if (solDifference < -1000000) {
        // A significant SOL decrease (> 0.001 SOL)
        // Native SOL was likely spent (beyond just fees)
        const adjustedDifference =
          Math.abs(solDifference) + (txData.meta.fee || 0);
        if (!inputToken || adjustedDifference > inputToken.difference) {
          inputToken = {
            mint: solMint,
            decimals: 9,
            preLamports: preSolAmount,
            postLamports: postSolAmount,
            difference: adjustedDifference,
          };
        }
      }
    }

    // Construct final token information
    const finalInput = inputToken
      ? {
          mint: inputToken.mint,
          symbol: defaultInput.symbol, // Will be enriched later via metadata
          name: defaultInput.name,
          decimals: inputToken.decimals,
          amount: inputToken.difference,
        }
      : defaultInput;

    const finalOutput = outputToken
      ? {
          mint: outputToken.mint,
          symbol: defaultOutput.symbol, // Will be enriched later via metadata
          name: defaultOutput.name,
          decimals: outputToken.decimals,
          amount: outputToken.difference,
        }
      : defaultOutput;

    // Use the transaction's blockTime if available, converting to milliseconds for consistency
    const finalTimestamp = txData.blockTime
      ? txData.blockTime * 1000 // Convert seconds to milliseconds
      : swap.timestamp;

    // Debug log
    console.log(
      `Swap identified: ${finalInput.mint.substring(0, 6)}... (${
        finalInput.amount
      }) → ${finalOutput.mint.substring(0, 6)}... (${finalOutput.amount})`,
    );

    // Return the updated swap transaction with the parsed data
    return {
      ...swap,
      timestamp: finalTimestamp,
      inputToken: finalInput,
      outputToken: finalOutput,
      success: true,
    };
  } catch (error) {
    console.error('Error parsing swap transaction:', error);
    // Fall back to original data if parsing fails
    return {
      ...swap,
      timestamp: txData.blockTime ? txData.blockTime * 1000 : swap.timestamp,
      inputToken: defaultInput,
      outputToken: defaultOutput,
      success: true,
    };
  }
}

/**
 * Fetch token metadata from Jupiter API
 */
export const fetchTokenMetadata = async (mint: string): Promise<any> => {
  try {
    if (!mint) return null;

    // wSOL is a special case
    if (mint === 'So11111111111111111111111111111111111111112') {
      return {
        mint,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI:
          'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
      };
    }

    const response = await fetch(`https://api.jup.ag/tokens/v1/token/${mint}`);
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error(`Error fetching token metadata for ${mint}:`, err);
    return null;
  }
};
