import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Constants
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const RPC_URL = process.env.HELIUS_STAKED_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Types
interface RaydiumSwapRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  userPublicKey: string;
  inputTokenAccount?: string;
  outputTokenAccount?: string;
}

interface RaydiumSwapResponse {
  success: boolean;
  transaction?: string;  // Base64 encoded transaction
  error?: string;
  inputAmount?: number;
  outputAmount?: number;
}

/**
 * RaydiumService - Server-side service for interacting with Raydium's API
 * 
 * This service handles the complete Raydium-specific swap workflow:
 * - Getting quotes from Raydium
 * - Getting priority fees from Raydium
 * - Building swap transactions from Raydium
 * - Handling all the business logic
 */
export class RaydiumService {
  /**
   * Get priority fee information from Raydium
   */
  static async getPriorityFee() {
    try {
      const response = await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get priority fee');
      }
      return response.data;
    } catch (error) {
      console.error('[RaydiumService] Error getting priority fee:', error);
      throw error;
    }
  }

  /**
   * Get a swap quote from Raydium
   */
  static async getSwapQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 100,
    txVersion: string = 'V0'
  ) {
    try {
      const url = `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=${txVersion}`;
      
      console.log(`[RaydiumService] Quote URL: ${url}`);
      const response = await axios.get(url);
      
      // Log the full response to help diagnose any issues
      console.log(`[RaydiumService] Raw quote response:`, JSON.stringify(response.data));
      
      return response.data;
    } catch (error) {
      console.error('[RaydiumService] Error getting swap quote:', error);
      throw error;
    }
  }

  /**
   * Get the Associated Token Account address for a given mint and owner
   */
  static async getTokenAccount(mintAddress: string, ownerAddress: string): Promise<string> {
    try {
      const connection = new Connection(RPC_URL);
      const mintPubkey = new PublicKey(mintAddress);
      const ownerPubkey = new PublicKey(ownerAddress);
      
      const tokenAccountAddress = await getAssociatedTokenAddress(
        mintPubkey,
        ownerPubkey,
        false // allowOwnerOffCurve
      );
      
      return tokenAccountAddress.toString();
    } catch (error) {
      console.error(`[RaydiumService] Error getting token account for mint ${mintAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get a swap transaction from Raydium
   */
  static async getSwapTransaction(params: {
    computeUnitPriceMicroLamports: string;
    swapResponse: any;
    txVersion: string;
    wallet: string;
    wrapSol: boolean;
    unwrapSol: boolean;
    inputAccount?: string;
    outputAccount?: string;
  }) {
    try {
      const url = `${API_URLS.SWAP_HOST}/transaction/swap-base-in`;
      
      // Log the full request body with redacted sensitive data
      const logParams = {...params};
      console.log(`[RaydiumService] Transaction request params:`, JSON.stringify(logParams, null, 2));
      
      const response = await axios.post(url, params);
      
      // Log detailed transaction response for debugging
      console.log(`[RaydiumService] Transaction response status: ${response.status}`);
      console.log(`[RaydiumService] Transaction response headers:`, JSON.stringify(response.headers, null, 2));
      
      if (response.data) {
        console.log(`[RaydiumService] Transaction response success: ${response.data.success}`);
        console.log(`[RaydiumService] Transaction response data exists: ${!!response.data.data}`);
        console.log(`[RaydiumService] Transaction response data length: ${response.data.data ? response.data.data.length : 0}`);
      }
      
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        // Check if there's an error message in the response
        const errorMessage = response.data && response.data.error 
          ? response.data.error 
          : 'No transaction data returned from Raydium';
        
        console.error(`[RaydiumService] Raydium API error: ${errorMessage}`);
        throw new Error(errorMessage);
      }
      
      return response.data;
    } catch (error: unknown) {
      // Log the complete error for better debugging
      console.error('[RaydiumService] Error getting swap transaction:');
      
      if (error instanceof Error) {
        console.error(`[RaydiumService] Error message: ${error.message}`);
      }
      
      if (axios.isAxiosError(error) && error.response) {
        console.error(`[RaydiumService] Error status: ${error.response.status}`);
        console.error('[RaydiumService] Error response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      throw error;
    }
  }

  /**
   * Main entry point - Handle a complete Raydium swap
   * This performs ALL the swap steps on the server:
   * 1. Get a quote from Raydium
   * 2. Get priority fee from Raydium
   * 3. Build the swap transaction
   * 4. Return the transaction for signing
   */
  static async handleSwap(request: RaydiumSwapRequest): Promise<RaydiumSwapResponse> {
    try {
      console.log('[RaydiumService] Handling swap request:', JSON.stringify(request));
      const { 
        inputMint, 
        outputMint, 
        amount, 
        slippageBps = 100, 
        userPublicKey,
        inputTokenAccount,
        outputTokenAccount
      } = request;
      
      // Check if we're dealing with SOL (requires wrapSol/unwrapSol params)
      const isInputSol = inputMint === WSOL_MINT;
      const isOutputSol = outputMint === WSOL_MINT;
      
      // For non-SOL tokens, we need to derive the token accounts if not provided
      let resolvedInputAccount = inputTokenAccount;
      let resolvedOutputAccount = outputTokenAccount;
      
      // If we're not using SOL as input and no input token account was provided, derive it
      if (!isInputSol && !resolvedInputAccount) {
        console.log(`[RaydiumService] Deriving input token account for mint ${inputMint}`);
        resolvedInputAccount = await this.getTokenAccount(inputMint, userPublicKey);
        console.log(`[RaydiumService] Derived input token account: ${resolvedInputAccount}`);
      }
      
      // If we're not using SOL as output and no output token account was provided, derive it
      if (!isOutputSol && !resolvedOutputAccount) {
        console.log(`[RaydiumService] Deriving output token account for mint ${outputMint}`);
        resolvedOutputAccount = await this.getTokenAccount(outputMint, userPublicKey);
        console.log(`[RaydiumService] Derived output token account: ${resolvedOutputAccount}`);
      }
      
      // Step 1: Get a quote from Raydium
      console.log('[RaydiumService] Getting quote...');
      const quoteResponse = await this.getSwapQuote(
        inputMint,
        outputMint,
        amount,
        slippageBps,
        'V0' // Use versioned transactions (V0)
      );
      
      if (!quoteResponse.success) {
        throw new Error(quoteResponse.error || 'Failed to get quote from Raydium');
      }
      
      // Extract output amount for response
      const outputAmount = Number(quoteResponse.data?.outputAmount || 0);
      console.log(`[RaydiumService] Quote received. Output amount: ${outputAmount}`);
      
      // If output amount is 0, something is wrong
      if (outputAmount === 0) {
        console.warn('[RaydiumService] Warning: Output amount is 0, this may indicate an issue with the swap parameters such as:');
        console.warn(' - Too small input amount');
        console.warn(' - Incorrect token mints');
        console.warn(' - Insufficient liquidity on the pair');
        
        // Validate input amount is not too small
        if (amount < 1000) {
          console.warn('[RaydiumService] Input amount appears very small, this may be below minimum swap size');
        }
      }
      
      // Step 2: Get priority fee
      console.log('[RaydiumService] Getting priority fee...');
      const priorityFeeResponse = await this.getPriorityFee();
      const priorityFee = String(priorityFeeResponse.data.default.h); // Use high priority
      console.log(`[RaydiumService] Priority fee: ${priorityFee}`);
      
      // Log the details of what we're about to send to Raydium
      console.log('[RaydiumService] Building swap transaction with params:');
      console.log(` - Input mint: ${inputMint} (is SOL: ${isInputSol})`);
      console.log(` - Output mint: ${outputMint} (is SOL: ${isOutputSol})`);
      console.log(` - Input account: ${isInputSol ? 'undefined (will wrap SOL)' : resolvedInputAccount}`);
      console.log(` - Output account: ${resolvedOutputAccount}`);
      console.log(` - User wallet: ${userPublicKey}`);
      
      // Step 3: Get swap transaction
      console.log('[RaydiumService] Calling Raydium for swap transaction...');
      const transactionResponse = await this.getSwapTransaction({
        computeUnitPriceMicroLamports: priorityFee,
        swapResponse: quoteResponse,
        txVersion: 'V0',
        wallet: userPublicKey,
        wrapSol: isInputSol,
        unwrapSol: isOutputSol,
        inputAccount: isInputSol ? undefined : resolvedInputAccount,
        outputAccount: resolvedOutputAccount
      });
      
      if (!transactionResponse.success) {
        throw new Error(transactionResponse.error || 'Failed to build swap transaction');
      }
      
      // Get the first transaction (most cases will only have one)
      const transaction = transactionResponse.data[0].transaction;
      console.log('[RaydiumService] Swap transaction built successfully');
      
      // Return the transaction for signing by the client
      return {
        success: true,
        transaction: transaction,
        inputAmount: amount,
        outputAmount: outputAmount
      };
    } catch (error: unknown) {
      console.error('[RaydiumService] Error handling swap:');
      
      if (error instanceof Error) {
        console.error(`[RaydiumService] Error message: ${error.message}`);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing Raydium swap'
      };
    }
  }
} 