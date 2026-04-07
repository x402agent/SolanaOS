import * as web3 from "@solana/web3.js";
import getBondingCurvePDA from "./getBondingCurvePDA";
import getBondingCurveTokenAccountWithRetry from "./getBondingCurveTokenAccountWithRetry";
import tokenDataFromBondingCurveTokenAccBuffer from "./tokenDataFromBondingCurveTokenAccBuffer";
import { PUMP_FUN_PROGRAM } from "../../constants";

const MAYHEM_MODE_TOTAL_SUPPLY = 2_000_000_000n; // 2 billion tokens
const NORMAL_TOTAL_SUPPLY = 1_000_000_000n; // 1 billion tokens

/**
 * Checks if a token is in Mayhem Mode by examining its total supply
 * Mayhem Mode tokens have 2 billion total supply instead of 1 billion
 * 
 * @param mint - The mint address of the token
 * @param connection - Solana connection instance
 * @returns Promise<boolean> - true if token is in Mayhem Mode, false otherwise
 */
export default async function isMayhemMode(
  mint: web3.PublicKey,
  connection: web3.Connection
): Promise<boolean> {
  try {
    const bondingCurve = getBondingCurvePDA(mint, PUMP_FUN_PROGRAM);
    
    const bondingCurveTokenAccount = await getBondingCurveTokenAccountWithRetry(
      connection,
      bondingCurve,
      10, // Reduced retries for faster detection
      50  // 50ms delay
    );

    if (!bondingCurveTokenAccount) {
      return false;
    }

    const tokenData = tokenDataFromBondingCurveTokenAccBuffer(bondingCurveTokenAccount.data);
    
    // Mayhem Mode tokens have 2 billion total supply
    return tokenData.tokenTotalSupply === MAYHEM_MODE_TOTAL_SUPPLY;
  } catch (error) {
    console.error("Error checking Mayhem Mode:", error);
    return false;
  }
}

/**
 * Gets the token total supply from bonding curve
 * 
 * @param mint - The mint address of the token
 * @param connection - Solana connection instance
 * @returns Promise<bigint | null> - Total supply or null if error
 */
export async function getTokenTotalSupply(
  mint: web3.PublicKey,
  connection: web3.Connection
): Promise<bigint | null> {
  try {
    const bondingCurve = getBondingCurvePDA(mint, PUMP_FUN_PROGRAM);
    
    const bondingCurveTokenAccount = await getBondingCurveTokenAccountWithRetry(
      connection,
      bondingCurve,
      10,
      50
    );

    if (!bondingCurveTokenAccount) {
      return null;
    }

    const tokenData = tokenDataFromBondingCurveTokenAccBuffer(bondingCurveTokenAccount.data);
    return tokenData.tokenTotalSupply;
  } catch (error) {
    console.error("Error getting token total supply:", error);
    return null;
  }
}

