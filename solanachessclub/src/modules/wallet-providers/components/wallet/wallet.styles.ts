// components/wallet/wallet.styles.ts

import {StyleSheet} from 'react-native';
import {WALLET_DEFAULT_THEME} from './wallet.theme';

/**
 * Merges a user-provided theme with the default wallet theme
 * 
 * @param {Partial<typeof WALLET_DEFAULT_THEME>} [userTheme] - Optional user-provided theme overrides
 * @returns {typeof WALLET_DEFAULT_THEME} The merged theme object
 * 
 * @example
 * ```typescript
 * const customTheme = {
 *   '--wallet-bg-primary': '#000000',
 *   '--wallet-text-primary': '#ffffff'
 * };
 * const mergedTheme = getMergedWalletTheme(customTheme);
 * ```
 */
export function getMergedWalletTheme(
  userTheme?: Partial<typeof WALLET_DEFAULT_THEME>,
) {
  return {
    ...WALLET_DEFAULT_THEME,
    ...(userTheme || {}),
  };
}

/**
 * Creates a complete set of wallet styles by merging multiple style sources
 * 
 * @param {ReturnType<typeof getMergedWalletTheme>} theme - The merged theme object
 * @param {{[key: string]: object}} [overrideStyles] - Optional explicit style overrides
 * @param {{[key: string]: object}} [userStyleSheet] - Optional user-provided style sheet
 * @returns {{[key: string]: any}} The final merged styles object
 * 
 * @description
 * This function creates a complete set of wallet styles by merging styles from
 * multiple sources in the following order:
 * 1. Default wallet theme
 * 2. Optional user-provided theme
 * 3. Base wallet styles
 * 4. Optional user style sheet
 * 5. Explicit override styles
 * 
 * The resulting styles object includes styles for:
 * - Container layout
 * - Headers and text
 * - Provider buttons
 * - Connect button
 * - Input fields
 * - Status text
 * 
 * @example
 * ```typescript
 * const theme = getMergedWalletTheme();
 * const styles = createWalletStyles(theme, {
 *   container: { backgroundColor: '#000' }
 * });
 * ```
 */
export function createWalletStyles(
  theme: ReturnType<typeof getMergedWalletTheme>,
  overrideStyles?: {[key: string]: object},
  userStyleSheet?: {[key: string]: object},
) {
  const baseStyles: {[key: string]: any} = StyleSheet.create({
    /** Main container for the wallet component */
    container: {
      flex: 1,
      backgroundColor: theme['--wallet-bg-primary'],
      padding: theme['--wallet-container-padding'],
      justifyContent: 'center',
      alignItems: 'center',
    },
    /** Primary header text style */
    header: {
      fontSize: theme['--wallet-font-size'] + 2,
      fontWeight: '600',
      color: theme['--wallet-text-primary'],
      marginBottom: 20,
    },
    /** Secondary header text style */
    subHeader: {
      fontSize: theme['--wallet-font-size'],
      color: theme['--wallet-text-secondary'],
      marginBottom: 20,
    },
    /** Container for provider selection buttons */
    providerButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginBottom: 20,
    },
    /** Base style for provider selection buttons */
    providerButton: {
      paddingVertical: theme['--wallet-button-padding'],
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme['--wallet-border-color'],
      borderRadius: 8,
      backgroundColor: theme['--wallet-bg-secondary'],
    },
    /** Style for the active provider button */
    providerButtonActive: {
      backgroundColor: theme['--wallet-button-bg'],
    },
    /** Text style for provider buttons */
    providerButtonText: {
      fontSize: theme['--wallet-font-size'],
      color: theme['--wallet-text-primary'],
    },
    /** Text style for active provider button */
    providerButtonTextActive: {
      color: theme['--wallet-button-text-color'],
    },
    /** Style for the main connect button */
    connectButton: {
      paddingVertical: theme['--wallet-button-padding'],
      paddingHorizontal: 32,
      backgroundColor: theme['--wallet-button-bg'],
      borderRadius: 8,
      marginTop: 10,
    },
    /** Text style for the connect button */
    connectButtonText: {
      fontSize: theme['--wallet-font-size'],
      color: theme['--wallet-button-text-color'],
      fontWeight: '600',
    },
    /** Style for input fields */
    input: {
      borderWidth: 1,
      borderColor: theme['--wallet-input-border-color'],
      borderRadius: 8,
      padding: 10,
      color: theme['--wallet-input-text-color'],
      fontSize: theme['--wallet-font-size'],
      marginBottom: 10,
      width: '100%',
    },
    /** Style for status messages */
    statusText: {
      marginTop: 20,
      fontSize: theme['--wallet-font-size'],
      color: theme['--wallet-text-secondary'],
      textAlign: 'center',
    },
  });

  // Merge userStyleSheet if provided
  if (userStyleSheet) {
    Object.keys(userStyleSheet).forEach(key => {
      if (baseStyles[key]) {
        baseStyles[key] = StyleSheet.flatten([
          baseStyles[key],
          userStyleSheet[key],
        ]);
      }
    });
  }

  // Merge explicit overrideStyles last
  if (overrideStyles) {
    Object.keys(overrideStyles).forEach(key => {
      if (baseStyles[key]) {
        baseStyles[key] = StyleSheet.flatten([
          baseStyles[key],
          overrideStyles[key],
        ]);
      }
    });
  }

  return baseStyles;
}
