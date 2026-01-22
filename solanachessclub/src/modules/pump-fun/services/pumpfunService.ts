import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  MessageV0,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import {PumpFunSDK} from 'pumpdotfun-sdk';
import {getAssociatedTokenAddress} from '@solana/spl-token';
import {
  PumpSdk,
  BondingCurve,
  getBuyTokenAmountFromSolAmount,
} from '@pump-fun/pump-sdk';
import {
  CreateAndBuyTokenParams,
  BuyTokenParams,
  SellTokenParams,
} from './types';
import BN from 'bn.js';
import {
  getProvider,
  checkIfTokenIsOnRaydium,
  getSwapFee,
  getSwapQuote,
  getSwapTransaction,
  buildPumpFunBuyTransaction,
  buildPumpFunSellTransaction,
  RAYDIUM_SOL_MINT,
} from '../utils/pumpfunUtils';
import {COMMISSION_WALLET, SERVER_URL} from '@env';
import {TransactionService} from '@/modules/wallet-providers';

/**
 * Create and immediately buy tokens
 */
export async function createAndBuyTokenViaPumpfun({
  userPublicKey,
  tokenName,
  tokenSymbol,
  description,
  twitter,
  telegram,
  website,
  imageUri,
  solAmount,
  solanaWallet,
  onStatusUpdate,
}: CreateAndBuyTokenParams) {
  if (!solanaWallet) {
    throw new Error(
      'No Solana wallet found. Please connect your wallet first.',
    );
  }

  const provider = getProvider();
  const connection = provider.connection;
  const pumpSdk = new PumpSdk(connection);
  const creatorPubkey = new PublicKey(userPublicKey);
  // This is the recipient for Pump.fun's own platform fees, as used by their SDK.
  const pumpFunPlatformFeeRecipient = new PublicKey(COMMISSION_WALLET);
  // This is the recipient for our additional 0.5% platform commission.
  const ourPlatformCommissionWallet = new PublicKey(COMMISSION_WALLET);

  console.log('[createAndBuyTokenViaPumpfun] =>', {
    userPublicKey,
    tokenName,
    tokenSymbol,
    solAmount,
    imageUri,
  });

  try {
    const OUR_COMMISSION_RATE = 0.005; // 0.5%
    const totalSolLamportsUserPays = Math.floor(solAmount * LAMPORTS_PER_SOL);

    const ourCommissionLamports = Math.floor(
      totalSolLamportsUserPays * OUR_COMMISSION_RATE,
    );
    const solAmountForPumpFunBuyLamports =
      totalSolLamportsUserPays - ourCommissionLamports;

    if (solAmountForPumpFunBuyLamports < 0) {
      const errMessage =
        'SOL amount is too small to cover the 0.5% platform commission fee.';
      onStatusUpdate?.(`Error: ${errMessage}`);
      throw new Error(errMessage);
    }

    onStatusUpdate?.(`Total SOL input: ${solAmount} SOL`);
    onStatusUpdate?.(
      `Platform commission (0.5%): ${
        ourCommissionLamports / LAMPORTS_PER_SOL
      } SOL to ${ourPlatformCommissionWallet.toBase58()}`,
    );
    onStatusUpdate?.(
      `Net SOL for Pump.fun buy: ${
        solAmountForPumpFunBuyLamports / LAMPORTS_PER_SOL
      } SOL`,
    );

    onStatusUpdate?.('Uploading token metadata...');
    const uploadEndpoint = `${SERVER_URL}/api/pumpfun/uploadMetadata`;

    const mint = Keypair.generate();

    const metadata = {
      name: tokenName,
      symbol: tokenSymbol,
      description: description,
      showName: true,
      createdOn: 'https://www.solanaappkit.com',
      image: imageUri,
      twitter: twitter,
      telegram: telegram,
      website: website,
    };

    // Create FormData object
    const formData = new FormData();
    formData.append('tokenName', tokenName);
    formData.append('tokenSymbol', tokenSymbol);
    formData.append('description', description);
    formData.append('twitter', twitter || '');
    formData.append('telegram', telegram || '');
    formData.append('website', website || '');
    formData.append('createdOn', 'https://www.solanaappkit.com');

    // Instead of doing a fetch and blob conversion which may not work in all environments,
    // append the image directly as an object with uri, name, and type properties
    formData.append('image', {
      uri: imageUri,
      name: 'token.png',
      type: 'image/png',
    } as any);

    const uploadResponse = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    });
    if (!uploadResponse.ok) {
      const errMsg = await uploadResponse.text();
      throw new Error(`Metadata upload failed: ${errMsg}`);
    }
    const uploadJson = await uploadResponse.json();
    if (!uploadJson?.success || !uploadJson.metadataUri) {
      throw new Error(uploadJson?.error || 'No metadataUri returned');
    }

    const {metadataUri} = uploadJson;
    console.log('[createAndBuy] metadataUri =>', metadataUri);

    onStatusUpdate?.('Generating mint keypair...');
    // "create" instructions
    onStatusUpdate?.('Preparing token creation...');
    const createIx = await pumpSdk.createInstruction(
      mint.publicKey,
      metadata.name,
      metadata.symbol,
      metadataUri,
      pumpFunPlatformFeeRecipient,
      creatorPubkey,
    );

    const instructions: TransactionInstruction[] = [createIx];

    // Add our platform's commission transfer instruction
    if (ourCommissionLamports > 0) {
      const ourCommissionTransferIx = SystemProgram.transfer({
        fromPubkey: creatorPubkey,
        toPubkey: ourPlatformCommissionWallet,
        lamports: ourCommissionLamports,
      });
      instructions.push(ourCommissionTransferIx);
      onStatusUpdate?.(`Added 0.5% commission transfer instruction.`);
    }

    // optional "buy" instructions
    let buyIx: TransactionInstruction[] | null = null;

    // Only attempt buy if there's SOL left after our commission and user intended to buy initially
    if (solAmountForPumpFunBuyLamports > 0 && solAmount > 0) {
      onStatusUpdate?.(
        'Preparing initial buy instructions (after platform commission)...',
      );

      const global = await pumpSdk.fetchGlobal();

      const bondingCurve: BondingCurve = {
        virtualTokenReserves: global.initialVirtualTokenReserves,
        virtualSolReserves: global.initialVirtualSolReserves,
        realTokenReserves: global.initialRealTokenReserves,
        realSolReserves: new BN(0),
        tokenTotalSupply: new BN(global.tokenTotalSupply),
        complete: false,
        creator: creatorPubkey,
      };

      // Convert solAmountForPumpFunBuyLamports to BN for SDK
      const solAmountForBuyBN = new BN(solAmountForPumpFunBuyLamports);
      const buyTokenAmount = getBuyTokenAmountFromSolAmount(
        global,
        bondingCurve,
        solAmountForBuyBN,
        true,
      );

      buyIx = await pumpSdk.buyInstructions(
        global,
        null,
        bondingCurve,
        mint.publicKey,
        creatorPubkey,
        buyTokenAmount,
        solAmountForBuyBN,
        1,
        pumpFunPlatformFeeRecipient,
      );
      instructions.push(...buyIx);
    } else if (solAmount > 0 && solAmountForPumpFunBuyLamports <= 0) {
      onStatusUpdate?.(
        'Warning: SOL amount for Pump.fun buy is zero or less after 0.5% commission. Only token creation and commission transfer will occur.',
      );
    }

    const {blockhash} = await provider.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: creatorPubkey, // Ensure this is PublicKey
      recentBlockhash: blockhash,
      instructions: instructions, // Use the combined instructions array
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([mint]);

    // Use the new transaction service
    console.log('msg =>', messageV0);
    onStatusUpdate?.('Sending transaction for approval...');
    const txSignature = await TransactionService.signAndSendTransaction(
      {type: 'transaction', transaction: tx},
      solanaWallet, // Pass wallet directly - TransactionService will handle it
      {
        connection,
        statusCallback: onStatusUpdate,
      },
    );

    if (!txSignature) {
      throw new Error('Transaction failed.');
    }

    onStatusUpdate?.('Token launched successfully!');
    return {
      mint: mint.publicKey.toString(),
      txSignature,
      metadataUri,
    };
  } catch (err: any) {
    console.error('createAndBuyTokenViaPumpfun error:', err);
    throw err;
  }
}

/**
 * buyTokenViaPumpfun
 */
export async function buyTokenViaPumpfun({
  buyerPublicKey,
  tokenAddress,
  solAmount,
  solanaWallet,
  onStatusUpdate,
}: BuyTokenParams) {
  if (!solanaWallet) {
    throw new Error(
      'No Solana wallet found. Please connect your wallet first.',
    );
  }

  const provider = getProvider();
  const connection = provider.connection;
  const sdk = new PumpFunSDK(provider);

  console.log('[buyTokenViaPumpfun] =>', {
    buyerPublicKey,
    tokenAddress,
    solAmount,
  });

  try {
    // 1. Check if the token is available on Raydium
    onStatusUpdate?.('Checking token availability...');
    const isOnRaydium = await checkIfTokenIsOnRaydium(tokenAddress);
    console.log('isOnRaydium =>', isOnRaydium);

    // If on Raydium, we should use their API
    if (isOnRaydium) {
      onStatusUpdate?.('Token found on Raydium, preparing swap...');
      console.log(
        '[buyTokenViaPumpfun] Token is on Raydium, using swap API...',
      );

      // 2. Get quote first (exact output: I want X tokens, how much SOL?)
      const lamportsIn = Math.floor(solAmount * LAMPORTS_PER_SOL);
      onStatusUpdate?.('Getting swap quote...');
      const quote = await getSwapQuote(
        RAYDIUM_SOL_MINT, // input = SOL
        tokenAddress, // output = Token
        lamportsIn, // amount in (SOL lamports)
      );

      console.log('quote =>', quote);

      if (!quote || !quote.data) {
        throw new Error('Failed to get swap quote from Raydium');
      }

      onStatusUpdate?.('Calculating swap fee...');
      const swapFee = await getSwapFee();

      // 3. Get swap transaction
      onStatusUpdate?.('Building swap transaction...');
      const swapTxResp = await getSwapTransaction({
        swapResponse: quote,
        computeUnitPriceMicroLamports: swapFee,
        userPubkey: buyerPublicKey,
        unwrapSol: false,
        wrapSol: true,
      });

      console.log('swapTxResp =>', swapTxResp);

      const base64Tx = swapTxResp?.data?.[0]?.transaction;
      if (!base64Tx) {
        throw new Error('No swap transaction returned from Raydium');
      }

      // Send the transaction
      onStatusUpdate?.('Sending transaction for approval...');
      const txSignature = await TransactionService.signAndSendTransaction(
        {type: 'base64', data: base64Tx},
        solanaWallet,
        {
          connection,
          statusCallback: onStatusUpdate,
        },
      );

      onStatusUpdate?.('Token purchased successfully!');
      return txSignature;
    } else {
      // Not on Raydium, use PumpFun API
      console.log(
        '[buyTokenViaPumpfun] Token not on Raydium, using PumpFun...',
      );
      onStatusUpdate?.('Using PumpFun for token purchase...');

      const mintPubkey = new PublicKey(tokenAddress);
      const buyerPubkey = new PublicKey(buyerPublicKey);

      onStatusUpdate?.('Building transaction...');
      console.log(
        '[buyTokenViaPumpfun] Building buy transaction with params:',
        {
          payerPubkey: buyerPubkey.toString(),
          tokenMint: mintPubkey.toString(),
          solAmount,
          lamportsToBuy: BigInt(
            Math.floor(solAmount * LAMPORTS_PER_SOL),
          ).toString(),
        },
      );

      const tx = await buildPumpFunBuyTransaction({
        payerPubkey: buyerPubkey,
        tokenMint: mintPubkey,
        lamportsToBuy: BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL)),
        sdk,
        connection,
      });

      console.log('[buyTokenViaPumpfun] Transaction built successfully:', {
        recentBlockhash: tx.recentBlockhash,
        feePayer: tx.feePayer?.toString() || 'undefined',
        hasInstructions: tx.instructions.length > 0,
      });

      onStatusUpdate?.('Sending transaction for approval...');
      const txSignature = await TransactionService.signAndSendTransaction(
        {type: 'transaction', transaction: tx},
        solanaWallet,
        {
          connection,
          statusCallback: onStatusUpdate,
        },
      );

      onStatusUpdate?.('Token purchased successfully!');
      return txSignature;
    }
  } catch (err: any) {
    console.error('[buyTokenViaPumpfun] Error:', err);
    throw err;
  }
}

/**
 * sellTokenViaPumpfun
 */
export async function sellTokenViaPumpfun({
  sellerPublicKey,
  tokenAddress,
  tokenAmount,
  solanaWallet,
  onStatusUpdate,
}: SellTokenParams) {
  if (!solanaWallet) {
    throw new Error(
      'No Solana wallet found. Please connect your wallet first.',
    );
  }

  const provider = getProvider();
  const connection = provider.connection;
  const sdk = new PumpFunSDK(provider);

  console.log('[sellTokenViaPumpfun] =>', {
    sellerPublicKey,
    tokenAddress,
    tokenAmount,
  });

  try {
    // 1. Check if the token is available on Raydium
    onStatusUpdate?.('Checking token availability...');
    const isOnRaydium = await checkIfTokenIsOnRaydium(tokenAddress);
    console.log('isOnRaydium =>', isOnRaydium);

    // If on Raydium, we should use their API
    if (isOnRaydium) {
      onStatusUpdate?.('Token found on Raydium, preparing swap...');
      console.log(
        '[sellTokenViaPumpfun] Token is on Raydium, using swap API...',
      );

      // Get token ATA (Associated Token Account)
      const tokenAta = await getAssociatedTokenAddress(
        new PublicKey(tokenAddress),
        new PublicKey(sellerPublicKey),
      );
      console.log('[sellTokenViaPumpfun] Token ATA:', tokenAta.toString());

      // Check if token ATA exists
      const ataInfo = await connection.getAccountInfo(tokenAta);
      if (!ataInfo) {
        throw new Error(`Token account ${tokenAta.toString()} does not exist`);
      }

      // Get the actual token balance
      const tokenBalance = await connection.getTokenAccountBalance(tokenAta);
      console.log('[sellTokenViaPumpfun] Token balance:', tokenBalance);

      if (!tokenBalance.value) {
        throw new Error('Could not retrieve token balance');
      }

      const actualBalance = BigInt(tokenBalance.value.amount);
      const tokenDecimals = tokenBalance.value.decimals;

      // Calculate token amount in lamports using actual decimals
      const requestedAmount = BigInt(
        Math.floor(tokenAmount * 10 ** tokenDecimals),
      );

      console.log(
        '[sellTokenViaPumpfun] Actual balance:',
        actualBalance.toString(),
      );
      console.log(
        '[sellTokenViaPumpfun] Trying to sell:',
        requestedAmount.toString(),
      );
      console.log('[sellTokenViaPumpfun] Token decimals:', tokenDecimals);

      if (actualBalance < requestedAmount) {
        throw new Error(
          `Not enough tokens to sell. You have ${
            Number(actualBalance) / 10 ** tokenDecimals
          } tokens available.`,
        );
      }

      // Convert token amount to lamports using the correct decimals
      const tokenLamports = Math.floor(tokenAmount * 10 ** tokenDecimals);

      // Get a swap quote (token -> SOL)
      onStatusUpdate?.('Getting swap quote...');
      const quote = await getSwapQuote(
        tokenAddress, // input = Token
        RAYDIUM_SOL_MINT, // output = SOL
        tokenLamports, // amount in (token lamports)
      );

      console.log(
        '[sellTokenViaPumpfun] Raydium quote:',
        JSON.stringify(quote, null, 2),
      );

      if (!quote || !quote.data) {
        throw new Error('Failed to get swap quote from Raydium');
      }

      onStatusUpdate?.('Calculating swap fee...');
      const swapFee = await getSwapFee();
      console.log('[sellTokenViaPumpfun] Raydium swap fee:', swapFee);

      // Get swap transaction
      onStatusUpdate?.('Building swap transaction...');
      const swapParams = {
        swapResponse: quote,
        computeUnitPriceMicroLamports: swapFee,
        userPubkey: sellerPublicKey,
        unwrapSol: true,
        wrapSol: false,
        inputAccount: tokenAta.toString(),
      };
      console.log(
        '[sellTokenViaPumpfun] Raydium swap params:',
        JSON.stringify(swapParams, null, 2),
      );

      const swapTxResp = await getSwapTransaction(swapParams);
      console.log(
        '[sellTokenViaPumpfun] Raydium swap response:',
        JSON.stringify(swapTxResp, null, 2),
      );

      // Check if the response indicates failure
      if (!swapTxResp.success) {
        const errorMsg = swapTxResp.msg || 'Unknown Raydium API error';
        console.error(`[sellTokenViaPumpfun] Raydium API error: ${errorMsg}`);
        throw new Error(`Raydium API error: ${errorMsg}`);
      }

      const base64Tx = swapTxResp?.data?.[0]?.transaction;
      if (!base64Tx) {
        throw new Error('No swap transaction returned from Raydium');
      }

      // Send the transaction
      onStatusUpdate?.('Sending transaction for approval...');
      const txSignature = await TransactionService.signAndSendTransaction(
        {type: 'base64', data: base64Tx},
        solanaWallet,
        {
          connection,
          statusCallback: onStatusUpdate,
        },
      );

      onStatusUpdate?.('Tokens sold successfully!');
      return txSignature;
    } else {
      // Not on Raydium, use PumpFun API
      console.log(
        '[sellTokenViaPumpfun] Token not on Raydium, using PumpFun...',
      );
      onStatusUpdate?.('Using PumpFun for token sale...');

      const mintPubkey = new PublicKey(tokenAddress);
      const sellerPubkey = new PublicKey(sellerPublicKey);

      // Check if user has the token account
      onStatusUpdate?.('Checking token account...');
      const ata = await getAssociatedTokenAddress(mintPubkey, sellerPubkey);
      const tokenAccountInfo = await connection.getAccountInfo(ata);
      if (!tokenAccountInfo) {
        throw new Error(`You don't own any ${tokenAddress} tokens.`);
      }

      // Get the actual token balance
      try {
        const tokenBalance = await connection.getTokenAccountBalance(ata);
        console.log('[sellTokenViaPumpfun] Token balance:', tokenBalance);

        if (!tokenBalance.value) {
          throw new Error('Could not retrieve token balance');
        }

        const actualBalance = BigInt(tokenBalance.value.amount);
        const requestedAmount = BigInt(
          Math.floor(tokenAmount * 10 ** tokenBalance.value.decimals),
        );

        console.log(
          '[sellTokenViaPumpfun] Actual balance:',
          actualBalance.toString(),
        );
        console.log(
          '[sellTokenViaPumpfun] Trying to sell:',
          requestedAmount.toString(),
        );

        if (actualBalance < requestedAmount) {
          throw new Error(
            `Not enough tokens to sell. You have ${
              Number(actualBalance) / 10 ** tokenBalance.value.decimals
            } tokens available.`,
          );
        }

        // Build the transaction
        onStatusUpdate?.('Building transaction...');
        console.log(
          '[sellTokenViaPumpfun] Building sell transaction with params:',
          {
            sellerPubkey: sellerPubkey.toString(),
            tokenMint: mintPubkey.toString(),
            tokenAmount,
            actualBalance: actualBalance.toString(),
            lamportsToSell: requestedAmount.toString(),
          },
        );

        const tx = await buildPumpFunSellTransaction({
          sellerPubkey,
          tokenMint: mintPubkey,
          lamportsToSell: requestedAmount,
          sdk,
          connection,
        });

        console.log('[sellTokenViaPumpfun] Transaction built successfully:', {
          recentBlockhash: tx.recentBlockhash,
          feePayer: tx.feePayer?.toString() || 'undefined',
          hasInstructions: tx.instructions.length > 0,
        });

        // Send the transaction
        onStatusUpdate?.('Sending transaction for approval...');
        const txSignature = await TransactionService.signAndSendTransaction(
          {type: 'transaction', transaction: tx},
          solanaWallet,
          {
            connection,
            statusCallback: onStatusUpdate,
          },
        );

        onStatusUpdate?.('Tokens sold successfully!');
        return txSignature;
      } catch (err: any) {
        console.error('[sellTokenViaPumpfun] Error:', err);

        // Check for common error patterns
        const errorMessage = err.message || '';
        const errorLogs = err.logs || [];

        // Check for insufficient funds errors
        if (
          errorMessage.includes('insufficient funds') ||
          errorLogs.some((log: string) => log.includes('insufficient funds'))
        ) {
          onStatusUpdate?.('Failed: Insufficient token balance');
          throw new Error(
            'Insufficient token balance. Please try a smaller amount or check your balance.',
          );
        }

        // Check for not enough tokens errors
        if (
          errorMessage.includes('Not enough tokens') ||
          errorLogs.some((log: string) => log.includes('NotEnoughTokensToSell'))
        ) {
          onStatusUpdate?.('Failed: Not enough tokens to sell');
          throw new Error(
            'Not enough tokens to sell. Please try a smaller amount.',
          );
        }

        // Check for slippage errors
        if (
          errorMessage.includes('slippage') ||
          errorLogs.some((log: string) => log.includes('slippage'))
        ) {
          onStatusUpdate?.('Failed: Price slippage too high');
          throw new Error(
            'Price slippage too high. Try a smaller amount or try again later.',
          );
        }

        // Check for simulation errors that contain logs
        if (
          errorMessage.includes('Simulation failed') &&
          errorLogs.length > 0
        ) {
          console.error('Transaction simulation logs:', errorLogs);

          // Try to extract a more specific error message from the logs
          const relevantErrorLog = errorLogs.find(
            (log: string) => log.includes('Error:') || log.includes('failed:'),
          );

          if (relevantErrorLog) {
            const cleanError = relevantErrorLog.includes('Error:')
              ? relevantErrorLog.split('Error:')[1].trim()
              : relevantErrorLog;

            onStatusUpdate?.(`Failed: ${cleanError}`);
            throw new Error(`Transaction failed: ${cleanError}`);
          }
        }

        // Default error handling
        onStatusUpdate?.('Transaction failed');
        throw err;
      }
    }
  } catch (err: any) {
    console.error('[sellTokenViaPumpfun] Error:', err);

    // Check for common error patterns
    const errorMessage = err.message || '';
    const errorLogs = err.logs || [];

    // Check for insufficient funds errors
    if (
      errorMessage.includes('insufficient funds') ||
      errorLogs.some((log: string) => log.includes('insufficient funds'))
    ) {
      onStatusUpdate?.('Failed: Insufficient token balance');
      throw new Error(
        'Insufficient token balance. Please try a smaller amount or check your balance.',
      );
    }

    // Check for not enough tokens errors
    if (
      errorMessage.includes('Not enough tokens') ||
      errorLogs.some((log: string) => log.includes('NotEnoughTokensToSell'))
    ) {
      onStatusUpdate?.('Failed: Not enough tokens to sell');
      throw new Error(
        'Not enough tokens to sell. Please try a smaller amount.',
      );
    }

    // Check for slippage errors
    if (
      errorMessage.includes('slippage') ||
      errorLogs.some((log: string) => log.includes('slippage'))
    ) {
      onStatusUpdate?.('Failed: Price slippage too high');
      throw new Error(
        'Price slippage too high. Try a smaller amount or try again later.',
      );
    }

    // Check for simulation errors that contain logs
    if (errorMessage.includes('Simulation failed') && errorLogs.length > 0) {
      console.error('Transaction simulation logs:', errorLogs);

      // Try to extract a more specific error message from the logs
      const relevantErrorLog = errorLogs.find(
        (log: string) => log.includes('Error:') || log.includes('failed:'),
      );

      if (relevantErrorLog) {
        const cleanError = relevantErrorLog.includes('Error:')
          ? relevantErrorLog.split('Error:')[1].trim()
          : relevantErrorLog;

        onStatusUpdate?.(`Failed: ${cleanError}`);
        throw new Error(`Transaction failed: ${cleanError}`);
      }
    }

    // Default error handling
    onStatusUpdate?.('Transaction failed');
    throw err;
  }
}
