// File: src/utils/lamports.ts
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return sol * LAMPORTS_PER_SOL;
}
