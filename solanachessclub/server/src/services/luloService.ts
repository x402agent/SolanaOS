import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { connection } from '../utils/solana';

const LULO_API_KEY = process.env.LULO_API_KEY;
if (!LULO_API_KEY) {
  throw new Error("LULO_API_KEY environment variable is not set");
}

const REFERRAL_WALLET = new PublicKey("FPfGD3kA8ZXWWMTZHLcFDMhVzyWhqstbgTpg1KoR7Vk4");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export interface LuloTimePeriodRates {
  CURRENT: number;
  "1HR": number;
  "1YR": number;
  "24HR": number;
  "30DAY": number;
  "7DAY": number;
}

export interface LuloApyRates {
  regular: LuloTimePeriodRates;
  protected: LuloTimePeriodRates;
}

export interface LuloPendingWithdrawal {
  owner: string;
  withdrawalId: number;
  nativeAmount: string;
  createdTimestamp: number;
  cooldownSeconds: string;
  mintAddress: string;
}

export class LuloService {
  private static getHeaders() {
    return {
      "Content-Type": "application/json",
      "x-api-key": LULO_API_KEY as string,
    };
  }

  static async fetchApy(): Promise<LuloApyRates> {
    const response = await fetch("https://api.lulo.fi/v1/rates.getRates", {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  static async lend(userPublicKey: string, amount: number): Promise<{ transaction: string }> {
    const response = await fetch("https://api.lulo.fi/v1/generate.transactions.deposit", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        owner: userPublicKey,
        mintAddress: USDC_MINT.toBase58(),
        regularAmount: amount,
        referrer: REFERRAL_WALLET.toBase58(),
      }),
    });
    const { transaction } = await response.json();
    // The transaction is already base64 encoded by the API
    return { transaction };
  }

  static async getBalance(userPublicKey: string) {
    const response = await fetch(
      `https://api.lulo.fi/v1/account.getAccount?owner=${userPublicKey}`,
      {
        headers: this.getHeaders(),
      }
    );
    return response.json();
  }

  static async initiateWithdraw(userPublicKey: string, amount: number): Promise<{ transaction: string }> {
    console.log('Initiating withdraw with params:', { userPublicKey, amount });
    try {
      const response = await fetch("https://api.lulo.fi/v1/generate.transactions.initiateRegularWithdraw", {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          owner: userPublicKey,
          feePayer: userPublicKey,
          mintAddress: USDC_MINT.toBase58(),
          amount: Number(amount), // Ensure amount is sent as a number
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lulo API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Lulo API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Raw Lulo API response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse Lulo API response:', e);
        throw new Error('Invalid response from Lulo API');
      }

      console.log('Parsed Lulo API response:', data);

      if (!data.transaction) {
        console.error('No transaction in Lulo API response:', data);
        throw new Error('No transaction received from Lulo API');
      }

      return { transaction: data.transaction };
    } catch (error) {
      console.error('Error in initiateWithdraw:', error);
      throw error;
    }
  }

  static async fetchPendingWithdrawals(userPublicKey: string): Promise<LuloPendingWithdrawal[]> {
    const response = await fetch(
      `https://api.lulo.fi/v1/account.withdrawals.listPendingWithdrawals?owner=${userPublicKey}`,
      {
        headers: this.getHeaders(),
      }
    );
    const data = await response.json();
    return data.pendingWithdrawals || [];
  }

  static async fetchAvailableWithdrawals(userPublicKey: string): Promise<LuloPendingWithdrawal[]> {
    const pendingWithdrawals = await this.fetchPendingWithdrawals(userPublicKey);
    const now = Math.floor(Date.now() / 1000);
    return pendingWithdrawals.filter(withdrawal => {
      const cooldownEnds = withdrawal.createdTimestamp + parseInt(withdrawal.cooldownSeconds, 10);
      return now >= cooldownEnds;
    });
  }

  static async completeWithdraw(userPublicKey: string): Promise<{ transaction: string } | null> {
    const pendingWithdrawals = await this.fetchAvailableWithdrawals(userPublicKey);
    if (!pendingWithdrawals.length) {
      return null;
    }
    const { withdrawalId } = pendingWithdrawals[0];
    const response = await fetch("https://api.lulo.fi/v1/generate.transactions.completeRegularWithdrawal", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ 
        owner: userPublicKey, 
        pendingWithdrawalId: withdrawalId, 
        feePayer: userPublicKey 
      }),
    });
    const { transaction } = await response.json();
    return { transaction };
  }
} 