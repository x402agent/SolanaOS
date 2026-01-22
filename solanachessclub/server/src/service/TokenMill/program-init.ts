import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Loads the TokenMill IDL from JSON file
 * @returns The parsed IDL object
 * @throws Error if IDL file cannot be loaded
 */
const loadIDLFromJson = () => {
  try {
    const idlPath = path.resolve(__dirname, './idl/token_mill.json');
    return JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  } catch (error) {
    console.error('Error loading IDL:', error);
    throw error;
  }
};

/**
 * Client class for interacting with the TokenMill program
 */
class TokenMillClient {
  /** Anchor program instance */
  public program: anchor.Program;
  /** Solana connection */
  public connection: Connection;
  /** Wallet for signing transactions */
  public wallet: anchor.Wallet;

  /**
   * Creates a new TokenMillClient instance
   * @throws Error if initialization fails
   */
  constructor() {
    try {
      this.connection = new Connection(
        process.env.RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
      );

      const keypairPath = path.resolve(__dirname, '../keypair.json');
      const keypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
      );
      this.wallet = new anchor.Wallet(keypair);

      const provider = new anchor.AnchorProvider(
        this.connection,
        this.wallet,
        anchor.AnchorProvider.defaultOptions()
      );
      anchor.setProvider(provider);

      const idl = loadIDLFromJson();
      const programId = new PublicKey(process.env.PROGRAM_ID || 'JoeaRXgtME3jAoz5WuFXGEndfv4NPH9nBxsLq44hk9J');
      
      this.program = new anchor.Program(idl, provider);
      
      console.log('TokenMill program initialized successfully');
    } catch (error) {
      console.error('Error initializing TokenMill client:', error);
      throw error;
    }
  }

  /**
   * Verifies connection to Solana cluster
   * @returns Promise resolving to true if connected, false otherwise
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      console.log('Connected to Solana cluster:', version);
      return true;
    } catch (error) {
      console.error('Connection verification failed:', error);
      return false;
    }
  }
}

const tokenMill = new TokenMillClient();

export { tokenMill, TokenMillClient };
