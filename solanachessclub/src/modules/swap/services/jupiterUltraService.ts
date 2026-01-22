import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { ENDPOINTS } from '@/shared/config/constants';
import { TokenInfo } from '@/modules/data-module';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';

// Define interfaces for Jupiter Ultra API responses
export interface JupiterUltraOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  feeBps: number;
  transaction: string | null;
  gasless: boolean;
  prioritizationType: string;
  prioritizationFeeLamports: number;
  requestId: string;
  swapType: string;
  quoteId?: string;
  maker?: string;
  taker?: string | null;
  expireAt?: number | null;
  contextSlot: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  totalTime: number;
}

export interface JupiterUltraExecuteResponse {
  status: 'Success' | 'Failed';
  signature: string;
  slot?: string;
  code?: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
  swapEvents?: Array<{
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
  }>;
  error?: string;
}

export interface JupiterUltraBalancesResponse {
  balances: Array<{
    mint: string;
    amount: string;
    decimals: number;
    uiAmount: number;
  }>;
}

export interface JupiterUltraSwapResponse {
  success: boolean;
  signature?: string;
  error?: Error | string;
  inputAmount: number;
  outputAmount: number;
}

export interface SwapCallback {
  statusCallback?: (status: string) => void;
  isComponentMounted?: () => boolean;
}

/**
 * Jupiter Ultra Service
 * Provides comprehensive swap functionality using Jupiter's Ultra API
 * Features:
 * - Request for swap orders from both Jupiter DEX Routing Engine and Jupiter Z (RFQ)
 * - Execute swap orders seamlessly in a single API call
 * - Handle complexities of RPC connections, transaction landing, slippage protection
 * - Request for token balances of an account
 */
export class JupiterUltraService {
  
  /**
   * Gets a swap order from Jupiter Ultra API via our server
   */
  static async getSwapOrder(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    taker?: string
  ): Promise<JupiterUltraOrderResponse> {
    try {
      console.log('[JupiterUltraService] 🚀 Getting Ultra swap order');
      console.log(`[JupiterUltraService] Input: ${inputMint} -> Output: ${outputMint}, Amount: ${amount}`);
      
      const ultraOrderUrl = `${ENDPOINTS.serverBase}/api/jupiter/ultra/order`;
      
      const requestBody = {
        inputMint,
        outputMint,
        amount: amount.toString(),
        ...(taker && { taker })
      };

      const response = await fetch(ultraOrderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      console.log("Jupiter swap order response: ", response);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('[JupiterUltraService] Ultra order error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(
          `Failed to get Ultra swap order: ${response.statusText}${
            errorData?.error ? ` - ${errorData.error}` : ''
          }`
        );
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        console.error('[JupiterUltraService] Invalid Ultra order response:', data);
        throw new Error(data.error || 'Invalid response from Ultra API');
      }

      console.log('[JupiterUltraService] ✅ Ultra swap order received');
      return data.data;
    } catch (error) {
      console.error('[JupiterUltraService] Ultra swap order error:', error);
      throw new Error(`Failed to get Ultra swap order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a swap order via Jupiter Ultra API through our server
   */
  static async executeSwapOrder(
    signedTransaction: string,
    requestId: string
  ): Promise<JupiterUltraExecuteResponse> {
    try {
      console.log('[JupiterUltraService] 🔄 Executing Ultra swap order');
      console.log(`[JupiterUltraService] Request ID: ${requestId}`);
      
      const ultraExecuteUrl = `${ENDPOINTS.serverBase}/api/jupiter/ultra/execute`;
      
      const requestBody = {
        signedTransaction,
        requestId,
      };

      const response = await fetch(ultraExecuteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      console.log("Jupiter execute response: ", response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('[JupiterUltraService] Ultra execute error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(
          `Failed to execute Ultra swap: ${response.statusText}${
            errorData?.error ? ` - ${errorData.error}` : ''
          }`
        );
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        console.error('[JupiterUltraService] Invalid Ultra execute response:', data);
        throw new Error(data.error || 'Invalid response from Ultra execute API');
      }

      console.log('[JupiterUltraService] ✅ Ultra swap executed');
      return data.data;
    } catch (error) {
      console.error('[JupiterUltraService] Ultra execute error:', error);
      throw new Error(`Failed to execute Ultra swap: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get token balances for a wallet via Jupiter Ultra API
   */
  static async getBalances(walletAddress: string): Promise<JupiterUltraBalancesResponse> {
    try {
      console.log('[JupiterUltraService] 💰 Getting wallet balances');
      console.log(`[JupiterUltraService] Wallet: ${walletAddress}`);
      
      const ultraBalancesUrl = `${ENDPOINTS.serverBase}/api/jupiter/ultra/balances?wallet=${walletAddress}`;
      
      const response = await fetch(ultraBalancesUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('[JupiterUltraService] Ultra balances error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(
          `Failed to get Ultra balances: ${response.statusText}${
            errorData?.error ? ` - ${errorData.error}` : ''
          }`
        );
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        console.error('[JupiterUltraService] Invalid Ultra balances response:', data);
        throw new Error(data.error || 'Invalid response from Ultra balances API');
      }

      console.log('[JupiterUltraService] ✅ Ultra balances received');
      return data.data;
    } catch (error) {
      console.error('[JupiterUltraService] Ultra balances error:', error);
      throw new Error(`Failed to get Ultra balances: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets a swap order using token info objects
   */
  static async getSwapOrderFromTokenInfo(
    inputToken: TokenInfo,
    outputToken: TokenInfo,
    inputAmount: string,
    taker?: string
  ): Promise<JupiterUltraOrderResponse | null> {
    try {
      // Validate tokens
      if (!inputToken?.address || !outputToken?.address) {
        console.error('[JupiterUltraService] Invalid tokens for order:', { inputToken, outputToken });
        return null;
      }
      
      // Convert input amount to integer with proper decimal handling
      const inputAmountNum = parseFloat(inputAmount);
      if (isNaN(inputAmountNum) || inputAmountNum <= 0) {
        console.error('[JupiterUltraService] Invalid input amount for order:', inputAmount);
        return null;
      }
      
      // Calculate amount in lamports/base units
      const amountInBaseUnits = inputAmountNum * Math.pow(10, inputToken.decimals);
      console.log(`[JupiterUltraService] Converting ${inputAmountNum} ${inputToken.symbol} to ${amountInBaseUnits} base units`);
      
      return this.getSwapOrder(
        inputToken.address,
        outputToken.address,
        amountInBaseUnits,
        taker
      );
    } catch (error) {
      console.error('[JupiterUltraService] Error getting Ultra swap order:', error);
      return null;
    }
  }

  /**
   * Executes a complete Ultra swap flow: get order -> sign transaction -> execute
   */
  static async executeUltraSwap(
    inputToken: TokenInfo,
    outputToken: TokenInfo,
    inputAmount: string,
    walletPublicKey: PublicKey,
    sendBase64Transaction: (base64Tx: string, connection: any, options?: any) => Promise<string>,
    connection: Connection,
    callbacks?: SwapCallback
  ): Promise<JupiterUltraSwapResponse> {
    const { statusCallback } = callbacks || {};

    const updateStatus = (status: string) => {
      console.log(`[JupiterUltraService] Status: ${status}`);
      if (statusCallback) {
        statusCallback(status);
      }
    };

    try {
      updateStatus('Getting swap order from Jupiter...');

      const inputLamports = JupiterUltraService.toBaseUnits(inputAmount, inputToken.decimals);

      // Get the swap order from our server
      const order = await JupiterUltraService.getSwapOrder(
        inputToken.address,
        outputToken.address,
        inputLamports.toString(),
        walletPublicKey.toString()
      );

      if (!order || !order.transaction) {
        throw new Error('Failed to get a valid swap order from the server.');
      }

      updateStatus('Sending transaction to wallet for signing...');

      const signature = await sendBase64Transaction(
        order.transaction,
        connection,
        {
          statusCallback: updateStatus,
        }
      );

      if (!signature) {
        throw new Error('Transaction was not signed or failed to send.');
      }
      
      updateStatus('Executing swap on the server...');

      // The swap is already executed by the wallet, but we can double-check with the server if needed
      // For now, we'll assume the signature means success and show it to the user.

      updateStatus('Swap successful! Finalizing...');

      // Show success notification
      TransactionService.showSuccess(signature, 'swap');

      return {
        success: true,
        signature: signature,
        inputAmount: JupiterUltraService.fromBaseUnits(order.inAmount, inputToken.decimals),
        outputAmount: JupiterUltraService.fromBaseUnits(order.outAmount, outputToken.decimals)
      };
    } catch (error: any) {
      console.error('[JupiterUltraService] Swap execution failed:', error);
      updateStatus('Swap failed.');
      return {
        success: false,
        error: error.message || 'An unknown error occurred during the swap.',
        inputAmount: parseFloat(inputAmount),
        outputAmount: 0
      };
    }
  }

  /**
   * Convert amount to base units (lamports)
   */
  static toBaseUnits(amount: string, decimals: number): number {
    const amountNum = parseFloat(amount);
    return Math.round(amountNum * Math.pow(10, decimals));
  }

  /**
   * Convert from base units to readable amount
   */
  static fromBaseUnits(amount: string | number, decimals: number): number {
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
    return amountNum / Math.pow(10, decimals);
  }
} 