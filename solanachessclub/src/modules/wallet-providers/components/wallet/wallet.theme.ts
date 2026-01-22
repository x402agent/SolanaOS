// components/wallet/wallet.theme.ts

/**
 * Default theme configuration for the wallet component
 * 
 * @description
 * WALLET_DEFAULT_THEME defines the default visual styling for the wallet component.
 * It uses CSS custom properties (variables) to define various aspects of the UI,
 * making it easy to customize the appearance while maintaining consistency.
 * 
 * The theme includes:
 * - Background colors for different UI elements
 * - Text colors for various content types
 * - Border and input field styling
 * - Button appearance
 * - Spacing and sizing measurements
 * 
 * @example
 * ```typescript
 * // Override specific theme values
 * const customTheme = {
 *   ...WALLET_DEFAULT_THEME,
 *   '--wallet-bg-primary': '#000000',
 *   '--wallet-text-primary': '#ffffff'
 * };
 * ```
 */
export const WALLET_DEFAULT_THEME = {
  /** Primary background color for the wallet container */
  '--wallet-bg-primary': '#FFFFFF',
  /** Secondary background color for UI elements like buttons */
  '--wallet-bg-secondary': '#F2F3F5',

  /** Primary text color for main content */
  '--wallet-text-primary': '#232324',
  /** Secondary text color for supporting content */
  '--wallet-text-secondary': '#434445',

  /** Border color for UI elements */
  '--wallet-border-color': '#EDEFF3',
  /** Border color for input fields */
  '--wallet-input-border-color': '#E0E0E0',
  /** Text color for input fields */
  '--wallet-input-text-color': '#232324',

  /** Background color for primary action buttons */
  '--wallet-button-bg': '#2B8EF0',
  /** Text color for primary action buttons */
  '--wallet-button-text-color': '#FFFFFF',

  /** Padding for the main container */
  '--wallet-container-padding': 16,
  /** Vertical padding for buttons */
  '--wallet-button-padding': 12,
  /** Base font size for text elements */
  '--wallet-font-size': 14,
};
