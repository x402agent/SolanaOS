import { TransactionType } from './types';

/**
 * Extract the most relevant part of a simulation error message
 * @param error The error object from a failed transaction
 * @returns A user-friendly error message
 */
export function parseTransactionError(error: any): string {
  if (!error) return 'Unknown transaction error';

  // Check if it's a simulation error
  if (typeof error === 'object') {
    // Extract simulation error message if available
    if (error.logs && Array.isArray(error.logs)) {
      // Check for insufficient funds errors
      const insufficientFundsLog = error.logs.find((log: string) => 
        log.includes('insufficient lamports') || 
        log.includes('insufficient funds')
      );
      
      if (insufficientFundsLog) {
        return 'Transaction failed: Insufficient SOL balance for this transaction';
      }
      
      // Check for other common errors
      const simulationErrorLog = error.logs.find((log: string) => 
        log.includes('Error:') || 
        log.includes('failed:') || 
        log.includes('Instruction error:')
      );

      if (simulationErrorLog) {
        // Extract the most relevant part of the simulation error
        const errorParts = simulationErrorLog.split('Error:');
        if (errorParts.length > 1) {
          return `Transaction failed: ${errorParts[1].trim()}`;
        }
        return `Transaction failed: ${simulationErrorLog}`;
      }

      // If there's a custom program error
      const customErrorLog = error.logs.find((log: string) => 
        log.includes('Program log:') && 
        (log.includes('failed') || log.includes('error'))
      );
      
      if (customErrorLog) {
        return `Transaction failed: ${customErrorLog.split('Program log:')[1].trim()}`;
      }
    }

    // Check for specific error message patterns
    if (error.message) {
      // Extract simulation result if available
      if (error.message.includes('Transaction simulation failed:')) {
        // Handle the common "Transfer: insufficient lamports" error
        if (error.message.includes('insufficient lamports')) {
          return 'Transaction failed: Insufficient SOL balance for this transaction';
        }
        
        const parts = error.message.split('Transaction simulation failed:');
        if (parts.length > 1) {
          const simulationPart = parts[1].trim();
          const endOfSimulation = simulationPart.indexOf('\n');
          
          if (endOfSimulation !== -1) {
            return `Transaction failed: ${simulationPart.substring(0, endOfSimulation)}`;
          }
          return `Transaction failed: ${simulationPart}`;
        }
      }

      // Check for blockhash errors
      if (error.message.includes('Blockhash not found')) {
        return 'Transaction failed: Network timeout. Please try again.';
      }
      
      // Check for insufficient funds
      if (error.message.includes('insufficient funds') || 
          error.message.includes('insufficient lamports')) {
        return 'Transaction failed: Insufficient SOL balance for this transaction';
      }

      // Check for user rejection
      if (error.message.includes('User rejected') || 
          error.message.includes('cancelled') || 
          error.message.includes('canceled')) {
        return 'Transaction was cancelled by the user.';
      }

      // Return the error message as is if it's reasonably short
      if (error.message.length < 100) {
        return error.message;
      }
      
      // For longer messages, try to extract the most relevant part
      return error.message.split('\n')[0];
    }
  }

  // If it's a string, return it directly
  if (typeof error === 'string') {
    // Check for common error strings
    if (error.includes('insufficient lamports') || 
        error.includes('insufficient funds')) {
      return 'Transaction failed: Insufficient SOL balance for this transaction';
    }
    
    if (error.length < 100) {
      return error;
    }
    return error.split('\n')[0];
  }

  // Fallback to a generic message
  return 'Transaction failed. Please try again.';
}

/**
 * Generate a success message for a transaction
 * @param signature The transaction signature
 * @param type Optional transaction type for more specific messaging
 * @returns A user-friendly success message
 */
export function getSuccessMessage(signature: string, type?: TransactionType): string {
  const shortSignature = signature ? `${signature.slice(0, 8)}...${signature.slice(-8)}` : '';
  
  switch (type) {
    case 'swap':
      return `Swap completed successfully! Signature: ${shortSignature}`;
    case 'transfer':
      return `Transfer completed successfully! Signature: ${shortSignature}`;
    case 'stake':
      return `Staking transaction completed! Signature: ${shortSignature}`;
    case 'nft':
      return `NFT transaction completed! Signature: ${shortSignature}`;
    case 'token':
      return `Token transaction completed! Signature: ${shortSignature}`;
    default:
      return `Transaction completed successfully! Signature: ${shortSignature}`;
  }
} 