import { MoonPayConfig, MoonPayParameters } from '../types';
import { getDefaultParameters } from '../utils/moonpayUtils';

/**
 * MoonPay service for handling API interactions
 */
function createMoonPayService(config: MoonPayConfig) {
  // Set Solana defaults if no default parameters are provided
  const defaultParams = config.defaultParameters || getDefaultParameters('solana');

  /**
   * Get MoonPay widget URL with configured parameters
   */
  function getWidgetUrl(customParams?: Partial<MoonPayParameters>) {
    const baseUrl = config.environment === 'sandbox' 
      ? 'https://buy-sandbox.moonpay.com' 
      : 'https://buy.moonpay.com';
    
    // Merge default config parameters with custom parameters
    const allParams = {
      ...defaultParams,
      ...customParams,
      // Ensure apiKey is always present
      apiKey: config.apiKey,
    };
    
    // Remove undefined values and convert booleans to strings
    const params = new URLSearchParams();
    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'boolean') {
          params.append(key, value.toString());
        } else {
          params.append(key, String(value));
        }
      }
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Validate if the configuration is correct
   */
  function validateConfig(): boolean {
    return Boolean(config.apiKey) && 
           ['sandbox', 'production'].includes(config.environment);
  }

  /**
   * Get supported currencies (this would typically call MoonPay API)
   * Solana is listed first as the primary supported currency
   */
  function getSupportedCurrencies() {
    return [
      { code: 'sol', name: 'Solana' },
      { code: 'usdc', name: 'USD Coin' },
      { code: 'usdt', name: 'Tether' },
      { code: 'btc', name: 'Bitcoin' },
      { code: 'eth', name: 'Ethereum' },
    ];
  }

  /**
   * Validate a wallet address format (basic validation)
   */
  function validateWalletAddress(address: string, currencyCode: string): boolean {
    if (!address || !currencyCode) return false;
    
    // Basic validation - could be enhanced with proper address validation
    switch (currencyCode.toLowerCase()) {
      case 'sol':
        return address.length >= 32 && address.length <= 44;
      case 'btc':
        return address.length >= 26 && address.length <= 35;
      case 'eth':
      case 'usdc':
      case 'usdt':
        return address.startsWith('0x') && address.length === 42;
      default:
        return address.length > 20; // Generic validation
    }
  }
  
  return {
    getWidgetUrl,
    validateConfig,
    getSupportedCurrencies,
    validateWalletAddress,
  };
}

export default createMoonPayService; 