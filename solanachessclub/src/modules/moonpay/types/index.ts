/**
 * MoonPay module type definitions
 */

/**
 * Comprehensive MoonPay parameters based on official documentation
 * @see https://dev.moonpay.com/docs/ramps-sdk-buy-params
 */
export interface MoonPayParameters {
  /** Your publishable API key (required) */
  apiKey: string;
  
  /** The code of the cryptocurrency you want the customer to purchase */
  currencyCode?: string;
  
  /** The code of the cryptocurrency you would prefer the customer to purchase */
  defaultCurrencyCode?: string;
  
  /** The cryptocurrency wallet address the purchased funds will be sent to */
  walletAddress?: string;
  
  /** The secondary cryptocurrency wallet address identifier/memo */
  walletAddressTag?: string;
  
  /** JSON string representing wallet addresses for multiple cryptocurrencies */
  walletAddresses?: string;
  
  /** JSON string representing wallet address tags for various cryptocurrencies */
  walletAddressTags?: string;
  
  /** The color code for the widget main color (hexadecimal) */
  colorCode?: string;
  
  /** Enable dark mode or light mode ('dark' | 'light') */
  theme?: 'dark' | 'light';
  
  /** ID of the theme created for your application */
  themeId?: string;
  
  /** ISO 639-1 language code */
  language?: string;
  
  /** The code of the fiat currency (e.g. usd, aud, gbp) */
  baseCurrencyCode?: string;
  
  /** Positive integer representing how much fiat the customer wants to spend */
  baseCurrencyAmount?: string;
  
  /** Positive integer representing how much crypto the customer wants to buy */
  quoteCurrencyAmount?: string;
  
  /** Lock the baseCurrencyAmount and prevent customer modification */
  lockAmount?: boolean;
  
  /** The customer's email address */
  email?: string;
  
  /** Identifier to associate with the transaction */
  externalTransactionId?: string;
  
  /** Identifier to associate with the customer */
  externalCustomerId?: string;
  
  /** Pre-select payment method */
  paymentMethod?: 'credit_debit_card' | 'gbp_bank_transfer' | 'gbp_open_banking_payment' | 
                  'apple_pay' | 'google_pay' | 'sepa_bank_transfer' | 'pix_instant_payment' | 
                  'paypal' | 'venmo' | 'moonpay_balance';
  
  /** URL to redirect customer after completing the buy flow */
  redirectURL?: string;
  
  /** Show all cryptocurrencies enabled on your account */
  showAllCurrencies?: boolean;
  
  /** Comma-separated list of currency codes to show only specific currencies */
  showOnlyCurrencies?: string;
  
  /** Show wallet address form even with pre-filled address */
  showWalletAddressForm?: boolean;
  
  /** URL to redirect customer from unsupported region */
  unsupportedRegionRedirectUrl?: string;
  
  /** Skip unsupported region screen and redirect immediately */
  skipUnsupportedRegionScreen?: boolean;
}

/**
 * MoonPay widget props interface
 */
export interface MoonPayWidgetProps {
  /**
   * MoonPay API key (required)
   */
  apiKey: string;
  
  /**
   * Environment to use for MoonPay
   */
  environment?: 'sandbox' | 'production';
  
  /**
   * MoonPay parameters for customizing the widget behavior
   */
  parameters?: Partial<MoonPayParameters>;
  
  /**
   * Called when widget is opened
   */
  onOpen?: () => void;
  
  /**
   * Called when widget encounters an error
   */
  onError?: (error: Error) => void;
  
  /**
   * Container height
   */
  height?: number;
  
  /**
   * Retry callback
   */
  onRetry?: () => void;
  
  /**
   * Called when transaction is completed
   */
  onTransactionCompleted?: (transactionId: string, status: string) => void;
  
  /**
   * Called when user closes the widget
   */
  onClose?: () => void;
}

/**
 * MoonPay service configuration interface
 */
export interface MoonPayConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
  defaultParameters?: Partial<MoonPayParameters>;
}

/**
 * MoonPay transaction status types
 */
export type MoonPayTransactionStatus = 
  | 'waitingPayment'
  | 'pending'
  | 'waitingAuthorization'
  | 'failed'
  | 'completed'; 