import { Connection } from '@solana/web3.js';
import { MeteoraDBCService } from './meteoraDBCService';
import { getConnection } from '../../utils/connection';

// Create a singleton instance of the MeteoraDBCService
const connection = getConnection();
export const meteoraDBCService = new MeteoraDBCService(connection);

// Also export the class for direct usage
export { MeteoraDBCService };
export * from './types'; 