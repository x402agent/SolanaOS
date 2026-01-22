import { MoonPayParameters } from '../types';

/**
 * MoonPay utility functions
 */

/**
 * Formats wallet address for display (shortens with ellipsis)
 */
export function formatWalletAddress(address: string | null | undefined): string {
  if (!address) return '';
  
  if (address.length <= 10) return address;
  
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Parses MoonPay error messages to user-friendly format
 */
export function parseErrorMessage(error: Error | unknown): string {
  if (!error) return 'Unknown error occurred';
  
  if (error instanceof Error) {
    // Handle specific MoonPay error patterns
    if (error.message.includes('network') || error.message.includes('connection')) {
      return 'Unable to connect to MoonPay. Please check your internet connection.';
    }
    
    if (error.message.includes('api key')) {
      return 'Invalid API configuration. Please contact support.';
    }
    
    if (error.message.includes('unsupported region')) {
      return 'MoonPay is not available in your region.';
    }
    
    if (error.message.includes('wallet address')) {
      return 'Invalid wallet address provided.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get MoonPay environment constant from environment variable
 */
export function getEnvironmentFromConfig(apiKey: string): 'sandbox' | 'production' {
  // If using a test key, force sandbox environment
  if (apiKey.startsWith('pk_test_')) {
    return 'sandbox';
  }
  
  // Production keys start with pk_live_
  if (apiKey.startsWith('pk_live_')) {
    return 'production';
  }
  
  // Default to sandbox for safety
  return 'sandbox';
}

/**
 * Validates MoonPay parameters
 */
export function validateMoonPayParameters(params: Partial<MoonPayParameters>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate API key
  if (!params.apiKey || typeof params.apiKey !== 'string') {
    errors.push('API key is required and must be a string');
  } else if (!params.apiKey.startsWith('pk_test_') && !params.apiKey.startsWith('pk_live_')) {
    errors.push('API key must start with pk_test_ or pk_live_');
  }
  
  // Validate amounts
  if (params.baseCurrencyAmount) {
    const amount = parseFloat(params.baseCurrencyAmount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('baseCurrencyAmount must be a positive number');
    }
  }
  
  if (params.quoteCurrencyAmount) {
    const amount = parseFloat(params.quoteCurrencyAmount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('quoteCurrencyAmount must be a positive number');
    }
  }
  
  // Validate color code
  if (params.colorCode && !/^#[0-9A-F]{6}$/i.test(params.colorCode)) {
    errors.push('colorCode must be a valid hexadecimal color (e.g., #FF2B8F)');
  }
  
  // Validate email
  if (params.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)) {
    errors.push('email must be a valid email address');
  }
  
  // Validate URLs
  if (params.redirectURL && !isValidUrl(params.redirectURL)) {
    errors.push('redirectURL must be a valid URL');
  }
  
  if (params.unsupportedRegionRedirectUrl && !isValidUrl(params.unsupportedRegionRedirectUrl)) {
    errors.push('unsupportedRegionRedirectUrl must be a valid URL');
  }
  
  // Validate language code (basic check)
  if (params.language && !/^[a-z]{2}$/.test(params.language)) {
    errors.push('language must be a valid ISO 639-1 language code (e.g., en, es, fr)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Helper function to validate URLs
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts MoonPay parameters to URL-safe format
 */
export function sanitizeMoonPayParameters(params: Partial<MoonPayParameters>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'boolean') {
        sanitized[key] = value.toString();
      } else if (typeof value === 'object') {
        // Handle JSON parameters like walletAddresses
        sanitized[key] = JSON.stringify(value);
      } else {
        sanitized[key] = String(value);
      }
    }
  });
  
  return sanitized;
}

/**
 * Gets default parameters for common use cases
 */
export function getDefaultParameters(useCase: 'basic' | 'solana' | 'ethereum' = 'solana'): Partial<MoonPayParameters> {
  const base: Partial<MoonPayParameters> = {
    baseCurrencyCode: 'usd',
    baseCurrencyAmount: '50',
    theme: 'dark',
    showWalletAddressForm: false,
  };
  
  switch (useCase) {
    case 'ethereum':
      return {
        ...base,
        currencyCode: 'eth',
        defaultCurrencyCode: 'eth',
      };
    case 'basic':
      return base;
    case 'solana':
    default:
      // Default to Solana as the primary chain
      return {
        ...base,
        currencyCode: 'sol',
        defaultCurrencyCode: 'sol',
      };
  }
} 