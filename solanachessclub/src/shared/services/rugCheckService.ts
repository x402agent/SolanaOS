import { Platform } from 'react-native';

const RUGCHECK_BASE_URL = 'https://api.rugcheck.xyz/v1';

// Define a specific type for risk levels
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface TokenRiskReport {
  score: number;
  score_normalised: number;
  risks: {
    name: string;
    description: string;
    level: string;
    score: number;
    value: string;
  }[];
  rugged: boolean;
  mint: string;
  tokenMeta?: {
    name: string;
    symbol: string;
  };
  topHolders?: {
    address: string;
    amount: number;
    decimals: number;
    insider: boolean;
    owner: string;
    pct: number;
    uiAmount: number;
    uiAmountString: string;
  }[];
  totalHolders?: number;
  totalMarketLiquidity?: number;
}

// Cache mechanism to store token risk reports and reduce API calls
interface Cache {
  [key: string]: {
    data: TokenRiskReport;
    timestamp: number;
  };
}

// In-memory cache with a 1-hour expiration
const cache: Cache = {};
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// Queue for throttling API requests
let requestQueue: Array<{
  mint: string;
  resolve: (value: TokenRiskReport | null) => void;
  reject: (reason?: any) => void;
}> = [];
let isProcessingQueue = false;
const THROTTLE_DELAY = 500; // milliseconds between API requests

/**
 * Process the queue of API requests to prevent rate limiting
 */
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    const request = requestQueue.shift();
    if (!request) {
      isProcessingQueue = false;
      return;
    }
    
    console.log(`[RugCheck] Processing queued request for ${request.mint}`);
    
    try {
      const result = await fetchTokenRiskReportFromAPI(request.mint);
      request.resolve(result);
    } catch (error) {
      console.error(`[RugCheck] Error in queued request for ${request.mint}:`, error);
      request.reject(error);
    }
    
    // Wait before processing the next request
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, THROTTLE_DELAY);
  } catch (error) {
    console.error('[RugCheck] Error processing queue:', error);
    isProcessingQueue = false;
  }
}

/**
 * Raw API call function for RugCheck API
 * @param tokenMint The mint address of the token
 * @returns The token risk report or null on error
 */
async function fetchTokenRiskReportFromAPI(tokenMint: string): Promise<TokenRiskReport | null> {
  try {
    console.log(`[RugCheck] Fetching risk report from API for token: ${tokenMint}`);
    
    const endpoint = `${RUGCHECK_BASE_URL}/tokens/${tokenMint}/report`;
    console.log(`[RugCheck] API endpoint: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'User-Agent': `SolanaSocialApp/${Platform.OS}`
      },
    });

    console.log(`[RugCheck] Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[RugCheck] API error: ${response.status}`);
      
      // Log more details about the error
      try {
        const errorText = await response.text();
        console.error(`[RugCheck] Error details: ${errorText}`);
      } catch (e) {
        console.error('[RugCheck] Could not parse error details');
      }
      
      return null;
    }

    const data = await response.json();
    console.log(`[RugCheck] Successfully retrieved data for ${tokenMint}`);

    // Save to cache
    cache[tokenMint] = {
      data,
      timestamp: Date.now()
    };
    
    return data;
  } catch (error) {
    console.error('[RugCheck] Error fetching token risk report:', error);
    return null;
  }
}

// Interface for token verification
export interface VerifyTokenParams {
  mint: string; // Token mint address
  payer: string; // The wallet address that is paying for verification
  signature: string; // Signature from the wallet
  data: {
    description: string; // Token description
    dataIntegrityAccepted: boolean; // User accepted data integrity
    termsAccepted: boolean; // User accepted terms
    solDomain?: string; // Optional .sol domain
    links?: { 
      [key: string]: string; // Social links, websites, etc.
    };
  };
}

/**
 * Submit a token for verification on RugCheck
 * @param params Token verification parameters
 * @returns Success status
 */
export async function verifyToken(params: VerifyTokenParams): Promise<{ok: boolean} | null> {
  try {
    console.log(`[RugCheck] Submitting token for verification: ${params.mint}`);
    
    const endpoint = `${RUGCHECK_BASE_URL}/tokens/verify`;
    console.log(`[RugCheck] Verification API endpoint: ${endpoint}`);
    
    // Ensure required fields are present
    if (!params.mint || !params.payer || !params.signature || !params.data) {
      console.error('[RugCheck] Missing required verification parameters');
      return null;
    }
    
    // Ensure terms are accepted
    if (!params.data.dataIntegrityAccepted || !params.data.termsAccepted) {
      console.error('[RugCheck] Terms not accepted for verification');
      return null;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `SolanaSocialApp/${Platform.OS}`
      },
      body: JSON.stringify(params)
    });

    console.log(`[RugCheck] Verification response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[RugCheck] Verification API error: ${response.status}`);
      
      // Log more details about the error
      try {
        const errorText = await response.text();
        console.error(`[RugCheck] Verification error details: ${errorText}`);
      } catch (e) {
        console.error('[RugCheck] Could not parse verification error details');
      }
      
      return null;
    }

    const data = await response.json();
    console.log(`[RugCheck] Successfully submitted verification for ${params.mint}`, data);
    return data;
  } catch (error) {
    console.error('[RugCheck] Error verifying token:', error);
    return null;
  }
}

/**
 * Fetches the token risk report using caching and request throttling
 * to prevent rate limiting issues.
 * 
 * @param tokenMint The mint address of the token.
 * @param priority Whether this request should be processed with priority
 * @returns A promise that resolves with the TokenRiskReport or null if an error occurs.
 */
export async function getTokenRiskReport(
  tokenMint: string, 
  priority: boolean = false
): Promise<TokenRiskReport | null> {
  // Check cache first
  if (cache[tokenMint] && (Date.now() - cache[tokenMint].timestamp) < CACHE_EXPIRY) {
    console.log(`[RugCheck] Using cached data for ${tokenMint}`);
    return cache[tokenMint].data;
  }
  
  // Return a new promise that will be resolved when the request is processed
  return new Promise<TokenRiskReport | null>((resolve, reject) => {
    // Add the request to the queue
    if (priority) {
      // Add to front of queue for priority requests (e.g., from token details view)
      requestQueue.unshift({ mint: tokenMint, resolve, reject });
    } else {
      // Add to end of queue for normal requests
      requestQueue.push({ mint: tokenMint, resolve, reject });
    }
    
    // Start processing the queue if it's not already being processed
    processQueue();
  });
}

/**
 * Determines the risk level category based on the normalized score.
 * @param score The normalized risk score (0-100).
 * @returns The risk level category.
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'low';
  if (score < 60) return 'medium';
  if (score < 80) return 'high';
  return 'critical';
}

/**
 * Gets the display color associated with a risk score.
 * @param score The normalized risk score (0-100).
 * @returns A hex color code string.
 */
export function getRiskScoreColor(score: number): string {
  if (score < 30) return '#4CAF50'; // Low risk - green
  if (score < 60) return '#FFC107'; // Medium risk - yellow
  if (score < 80) return '#FF9800'; // High risk - orange
  return '#F44336'; // Critical risk - red
}

/**
 * Gets the display color associated with a risk level category.
 * @param level The risk level category.
 * @returns A hex color code string.
 */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return '#4CAF50';
    case 'medium':
      return '#FFC107';
    case 'high':
      return '#FF9800';
    case 'critical':
      return '#F44336';
    default:
      return '#999999';
  }
} 