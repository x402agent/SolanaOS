import { PublicKey, Transaction, VersionedTransaction, TransactionMessage, SystemProgram, MessageV0, MessageCompiledInstruction } from '@solana/web3.js';

/**
 * Fee configuration for transactions
 */
export interface FeeConfig {
  /** Fee percentage (e.g., 0.5 for 0.5%) */
  feePercentage: number;
  /** Recipient wallet address for fees */
  feeRecipient: string;
}

/**
 * Default fee configuration
 */
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  feePercentage: 0.5,
  feeRecipient: '4iFgpVYSqxjyFekFP2XydJkxgXsK7NABJcR7T6zNa1Ty'
};

/**
 * Response from adding transaction fees
 */
export interface FeeAddResult {
  /** The modified or original transaction */
  transaction: Transaction | VersionedTransaction;
  /** Whether fee was added to original transaction */
  feeAdded: boolean;
  /** Optional separate fee transaction if fee couldn't be added directly */
  feeTx?: Transaction;
  /** The calculated fee amount */
  feeAmount: number;
  /** Error message if any */
  error?: string;
}

/**
 * Adds fee transfer instructions to a transaction
 * 
 * @param transaction Transaction or VersionedTransaction to add fees to
 * @param outputAmount The output amount of the swap in lamports/base units
 * @param payer The public key of the fee payer
 * @param recentBlockhash Recent blockhash for creating separate fee transaction
 * @param feeConfig Optional custom fee configuration
 * @returns Result with modified transaction and/or separate fee transaction
 */
export function addTransactionFees(
  transaction: Transaction | VersionedTransaction,
  outputAmount: number,
  payer: PublicKey,
  recentBlockhash?: string,
  feeConfig: FeeConfig = DEFAULT_FEE_CONFIG
): FeeAddResult {
  // Calculate fee amount (0.5% of output)
  const feeAmount = Math.floor(outputAmount * (feeConfig.feePercentage / 100));
  console.log(`Adding ${feeConfig.feePercentage}% fee: ${feeAmount} lamports to ${feeConfig.feeRecipient}`);

  if (feeAmount <= 0) {
    return {
      transaction,
      feeAdded: false,
      feeAmount: 0,
      error: 'Fee amount too small'
    };
  }
  
  // Create fee transfer instruction
  const feeRecipientPubkey = new PublicKey(feeConfig.feeRecipient);
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: feeRecipientPubkey,
    lamports: feeAmount
  });

  // Add to transaction based on type
  try {
    if (transaction instanceof VersionedTransaction) {
      // Try to add fee to versioned transaction
      const result = addFeeToVersionedTransaction(
        transaction, 
        transferInstruction, 
        payer, 
        feeRecipientPubkey, 
        feeAmount
      );

      // Return the result
      return result;
    } else {
      // For legacy transactions, simply add the instruction
      const modifiedTx = addFeeToLegacyTransaction(transaction, transferInstruction);
      return {
        transaction: modifiedTx,
        feeAdded: true,
        feeAmount
      };
    }
  } catch (error: any) {
    console.log(`Error adding fee directly to transaction: ${error.message}`);
    
    // If we have a blockhash, create a separate fee transaction
    if (recentBlockhash) {
      console.log('Creating separate fee transaction');
      
      // Create a new transaction for the fee
      const feeTx = new Transaction();
      feeTx.add(transferInstruction);
      feeTx.recentBlockhash = recentBlockhash;
      feeTx.feePayer = payer;
      
      return {
        transaction, // Return original transaction unchanged
        feeAdded: false,
        feeTx,
        feeAmount,
        error: error.message
      };
    }
    
    // If we don't have a blockhash, just return the original transaction
    return {
      transaction,
      feeAdded: false,
      feeAmount,
      error: error.message
    };
  }
}

/**
 * Adds fee to a legacy Transaction
 */
function addFeeToLegacyTransaction(
  transaction: Transaction,
  feeInstruction: any
): Transaction {
  // Add fee instruction to the end of the transaction
  transaction.add(feeInstruction);
  return transaction;
}

/**
 * Adds fee to a VersionedTransaction
 * This version handles transactions with address lookup tables
 */
function addFeeToVersionedTransaction(
  transaction: VersionedTransaction,
  feeInstruction: any,
  payer: PublicKey,
  feeRecipient: PublicKey,
  feeAmount: number
): FeeAddResult {
  try {
    // Get the original message
    const originalMessage = transaction.message;
    
    // For a v0 message with lookup tables, we need a different approach
    if (originalMessage instanceof MessageV0) {
      console.log('Processing versioned transaction with lookup tables');
      
      // Get the account keys that would be used by the instruction
      const staticAccountKeys = originalMessage.staticAccountKeys;
      
      // Find payer index in static accounts (should be 0)
      const payerIndex = 0; // In normal transactions, payer is first
      
      // See if fee recipient is already in the static accounts
      let recipientIndex = staticAccountKeys.findIndex(
        key => key.toBase58() === feeRecipient.toBase58()
      );
      
      // If not found, we need to create a separate transaction
      if (recipientIndex === -1) {
        console.log('Fee recipient not found in static accounts, need separate transaction');
        throw new Error('Fee recipient not in static accounts');
      }
      
      // Find system program index
      const systemProgramIndex = staticAccountKeys.findIndex(
        key => key.toBase58() === SystemProgram.programId.toBase58()
      );
      
      // If SystemProgram is not in static accounts, we can't proceed
      if (systemProgramIndex === -1) {
        console.log('System program not found in static accounts, need separate transaction');
        throw new Error('System program not in static accounts');
      }
      
      // Create a compiled instruction for the transfer
      // We need to use the correct structure expected by MessageV0
      const transferIx: MessageCompiledInstruction = {
        programIdIndex: systemProgramIndex,
        accountKeyIndexes: [payerIndex, recipientIndex],
        data: Buffer.from([2, ...new Uint8Array(new Uint32Array([feeAmount]).buffer)])
      };
      
      // Clone the message to avoid modifying the original
      const clonedMessage = MessageV0.deserialize(originalMessage.serialize());

      // Add our fee instruction to the compiled instructions
      const instructions = [
        ...clonedMessage.compiledInstructions,
        transferIx
      ];
      
      // Create a new message with our fee instruction added
      const newMessage = new MessageV0({
        header: clonedMessage.header,
        staticAccountKeys: clonedMessage.staticAccountKeys,
        recentBlockhash: clonedMessage.recentBlockhash,
        compiledInstructions: instructions,
        addressTableLookups: clonedMessage.addressTableLookups
      });
      
      // Create a new versioned transaction with the modified message
      return {
        transaction: new VersionedTransaction(newMessage),
        feeAdded: true,
        feeAmount
      };
    } else {
      // For simpler messages without lookup tables, use the original approach
      try {
        // Deserialize the message
        const message = TransactionMessage.decompile(originalMessage);
        
        // Add our fee instruction
        const instructions = [...message.instructions, feeInstruction];
        
        // Recompile with the new instruction
        const newMessage = new TransactionMessage({
          payerKey: payer,
          recentBlockhash: message.recentBlockhash,
          instructions
        }).compileToV0Message();
        
        // Create new versioned transaction
        return {
          transaction: new VersionedTransaction(newMessage),
          feeAdded: true,
          feeAmount
        };
      } catch (error) {
        console.error('Error recompiling message:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error processing versioned transaction:', error);
    throw error;
  }
} 