import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert, Linking } from 'react-native';
import { PublicKey } from '@solana/web3.js';

import {
  TokenInfo,
  fetchTokenBalance,
  fetchTokenPrice,
  fetchTokenMetadata,
  ensureCompleteTokenInfo,
} from '@/modules/data-module';
import { TradeService, SwapProvider } from '@/modules/swap/services/tradeService';

// Time after which to assume PumpSwap transactions have succeeded (in milliseconds)
const PUMPSWAP_SUCCESS_TIMEOUT = 10000; // 10 seconds
// Debounce time for updating price-related values (in milliseconds)
const PRICE_UPDATE_DEBOUNCE = 1000;

export interface SwapRouteParams {
  inputToken?: TokenInfo;
  outputToken?: TokenInfo;
  inputAmount?: string;
  shouldInitialize?: boolean;
}

export function useSwapLogic(
  routeParams: SwapRouteParams = {},
  userPublicKey: PublicKey | null,
  connected: boolean,
  transactionSender: { 
    sendTransaction: (transaction: any, connection: any, options?: any) => Promise<string>,
    sendBase64Transaction: (base64Tx: string, connection: any, options?: any) => Promise<string> 
  },
  navigation: any
) {
  // UI States
  const [activeProvider, setActiveProvider] = useState<SwapProvider>('JupiterUltra');
  const [inputValue, setInputValue] = useState(routeParams.inputAmount || '0');
  const [showSelectTokenModal, setShowSelectTokenModal] = useState(false);
  const [selectingWhichSide, setSelectingWhichSide] = useState<'input' | 'output'>('input');
  const [poolAddress, setPoolAddress] = useState('');
  const [slippage, setSlippage] = useState(10);

  // Token States
  const [inputToken, setInputToken] = useState<TokenInfo | null>(null);
  const [outputToken, setOutputToken] = useState<TokenInfo | null>(null);
  const [tokensInitialized, setTokensInitialized] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [currentTokenPrice, setCurrentTokenPrice] = useState<number | null>(null);
  const [estimatedOutputAmount, setEstimatedOutputAmount] = useState<string>('');
  const [outputTokenUsdValue, setOutputTokenUsdValue] = useState('$0.00');

  // Transaction States
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [solscanTxSig, setSolscanTxSig] = useState('');

  // Refs
  const isMounted = useRef(true);
  const [pendingTokenOps, setPendingTokenOps] = useState<{ input: boolean, output: boolean }>({ input: false, output: false });
  
  // Caching refs to prevent unnecessary state updates
  const currentPriceRef = useRef<number | null>(null);
  const lastCalculatedPriceRef = useRef<{
    inputAmount: string;
    inputPrice: number | null;
    outputAmount: string;
    outputPrice: number | null;
  }>({
    inputAmount: '',
    inputPrice: null,
    outputAmount: '',
    outputPrice: null
  });
  
  // Debounce timer refs
  const priceUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const estimateSwapTimer = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      console.log('[SwapScreen] Component unmounting, cleaning up');
      isMounted.current = false;
      setPendingTokenOps({ input: false, output: false });
      
      // Clear any pending timers
      if (priceUpdateTimer.current) {
        clearTimeout(priceUpdateTimer.current);
      }
      if (estimateSwapTimer.current) {
        clearTimeout(estimateSwapTimer.current);
      }
    };
  }, []);

  // Initialize tokens with details
  const initializeTokens = useCallback(async () => {
    // Don't initialize if already initializing or completed
    if (!isMounted.current || (pendingTokenOps.input && pendingTokenOps.output)) {
      return;
    }

    try {
      // Mark operations as pending
      setPendingTokenOps({ input: true, output: true });
      console.log('[SwapScreen] Initializing tokens...', routeParams);

      // Fetch initial tokens
      let initialInputToken: TokenInfo | null = null;
      let initialOutputToken: TokenInfo | null = null;

      // Use tokens from route params if available, otherwise fetch SOL and USDC
      try {
        if (routeParams.inputToken && routeParams.inputToken.address) {
          console.log('[SwapScreen] Using input token from route params:', routeParams.inputToken);
          initialInputToken = await fetchTokenMetadata(routeParams.inputToken.address);
        } else {
          // Default to SOL if not specified
          initialInputToken = await fetchTokenMetadata('So11111111111111111111111111111111111111112');
        }
      } catch (err) {
        console.error('[SwapScreen] Error fetching input token:', err);
        // If we can't fetch the input token, try with SOL as a fallback
        initialInputToken = await fetchTokenMetadata('So11111111111111111111111111111111111111112');
      }

      try {
        if (routeParams.outputToken && routeParams.outputToken.address) {
          console.log('[SwapScreen] Using output token from route params:', routeParams.outputToken);
          initialOutputToken = await fetchTokenMetadata(routeParams.outputToken.address);
        } else {
          // Default to USDC if not specified
          initialOutputToken = await fetchTokenMetadata('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        }
      } catch (err) {
        console.error('[SwapScreen] Error fetching output token:', err);
        // If we can't fetch the output token, try with USDC as a fallback
        initialOutputToken = await fetchTokenMetadata('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      }

      // Handle case where token fetching fails
      if (!initialInputToken || !initialOutputToken) {
        console.error('[SwapScreen] Failed to initialize tokens after multiple attempts');
        setErrorMsg('Failed to load token information. Please try again.');
        setPendingTokenOps({ input: false, output: false });
        return;
      }

      if (isMounted.current) {
        // Set the tokens
        setInputToken(initialInputToken);
        setOutputToken(initialOutputToken);
        setPendingTokenOps({ input: false, output: false });
        setTokensInitialized(true);

        // If route provided an amount, set it
        if (routeParams.inputAmount) {
          console.log('[SwapScreen] Setting input amount from route:', routeParams.inputAmount);
          setInputValue(routeParams.inputAmount);
        }

        // Fetch balance and price only if wallet is connected
        if (userPublicKey && initialInputToken) {
          // Load token details in sequence to avoid parallel fetch issues
          const balance = await fetchTokenBalance(userPublicKey, initialInputToken);
            if (isMounted.current && balance !== null) {
              setCurrentBalance(balance);
            
            // Fetch price after balance is loaded
            const price = await fetchTokenPrice(initialInputToken);
                  if (isMounted.current && price !== null) {
                    setCurrentTokenPrice(price);
              currentPriceRef.current = price; // Update the price ref
                  }
              }
        }
      }
    } catch (error) {
      console.error('[SwapScreen] Error initializing tokens:', error);
      setPendingTokenOps({ input: false, output: false });
    }
  }, [userPublicKey, routeParams, setPendingTokenOps]);

  // Fetch token balance
  const fetchBalance = useCallback(async (tokenToUse?: TokenInfo | null) => {
    if (!connected || !userPublicKey) {
      console.log("[SwapScreen] No wallet connected, cannot fetch balance");
      return null;
    }

    const tokenForBalance = tokenToUse || inputToken;

    // Cannot fetch balance if token is null
    if (!tokenForBalance) {
      console.log("[SwapScreen] No token provided, cannot fetch balance");
      return null;
    }

    try {
      console.log(`[SwapScreen] Fetching balance for ${tokenForBalance.symbol}...`);
      const balance = await fetchTokenBalance(userPublicKey, tokenForBalance);

      // Only update state if component is still mounted and balance is non-null
      if (isMounted.current) {
        // Only update if the balance actually changed
        if (balance !== null && balance !== currentBalance) {
        console.log(`[SwapScreen] Token balance fetched for ${tokenForBalance.symbol}: ${balance}`);
        setCurrentBalance(balance);
        }
        return balance;
      }
    } catch (err) {
      console.error('[SwapScreen] Error fetching balance:', err);
      if (isMounted.current) {
        setCurrentBalance(0);
        setErrorMsg(`Failed to fetch ${tokenForBalance.symbol} balance`);
        setTimeout(() => isMounted.current && setErrorMsg(''), 3000);
      }
    }
    return null;
  }, [connected, userPublicKey, inputToken, currentBalance]);

  // Fetch token price
  const getTokenPrice = useCallback(async (tokenToUse?: TokenInfo | null): Promise<number | null> => {
    const tokenForPrice = tokenToUse || inputToken;

    // Cannot fetch price if token is null
    if (!tokenForPrice) {
      console.log("[SwapScreen] No token provided, cannot fetch price");
      return null;
    }

    try {
      console.log(`[SwapScreen] Fetching price for ${tokenForPrice.symbol}...`);
      const price = await fetchTokenPrice(tokenForPrice);
      
      if (isMounted.current) {
        console.log(`[SwapScreen] Token price fetched for ${tokenForPrice.symbol}: ${price}`);
        
        // Only update state if it's the input token and the price actually changed
        if (tokenForPrice === inputToken && price !== null && price !== currentPriceRef.current) {
          // Clear any pending price update timer
          if (priceUpdateTimer.current) {
            clearTimeout(priceUpdateTimer.current);
          }
          
          // Update price with debounce to prevent frequent re-renders
          priceUpdateTimer.current = setTimeout(() => {
            if (isMounted.current) {
        setCurrentTokenPrice(price);
              currentPriceRef.current = price;
            }
          }, PRICE_UPDATE_DEBOUNCE);
        }
        
        return price;
      }
    } catch (err) {
      console.error('[SwapScreen] Error fetching token price:', err);
      if (isMounted.current) {
        setCurrentTokenPrice(null);
        currentPriceRef.current = null;
      }
    }
    return null;
  }, [inputToken]);

  // Calculate USD value for a given token amount
  const calculateUsdValue = useCallback((amount: string, tokenPrice: number | null) => {
    // Add better error handling for invalid inputs
    if (!tokenPrice || tokenPrice <= 0 || !amount || isNaN(parseFloat(amount))) {
      return '$0.00';
    }

    try {
      const numericAmount = parseFloat(amount);
      const usdValue = numericAmount * tokenPrice;

      // Format based on value size
      if (usdValue >= 1000000) {
        return `$${(usdValue / 1000000).toFixed(2)}M`;
      } else if (usdValue >= 1000) {
        return `$${(usdValue / 1000).toFixed(2)}K`;
      } else if (usdValue < 0.01 && usdValue > 0) {
        return `$${usdValue.toFixed(6)}`;
      } else {
        return `$${usdValue.toFixed(2)}`;
      }
    } catch (error) {
      console.error('Error calculating USD value:', error);
      return '$0.00';
    }
  }, []);

  // Estimate the output amount based on input
  const estimateSwap = useCallback(async () => {
    if (!connected || parseFloat(inputValue) <= 0 || !inputToken || !outputToken) {
      // Reset values when conditions aren't met
      if (estimatedOutputAmount !== '0') {
        setEstimatedOutputAmount('0');
      }
      if (outputTokenUsdValue !== '$0.00') {
        setOutputTokenUsdValue('$0.00');
      }
      return;
    }
    
    // Check if we need to recalculate based on cached values
    const shouldRecalculate = 
      inputValue !== lastCalculatedPriceRef.current.inputAmount ||
      currentPriceRef.current !== lastCalculatedPriceRef.current.inputPrice;
    
    if (!shouldRecalculate) {
      return; // Skip calculation if nothing has changed
    }

    try {
      // Clear any pending estimate
      if (estimateSwapTimer.current) {
        clearTimeout(estimateSwapTimer.current);
      }
      
      // Update with debounce to prevent frequent recalculations
      estimateSwapTimer.current = setTimeout(async () => {
        if (!isMounted.current) return;
        
        // Get prices for both tokens
        const inputPrice = await getTokenPrice(inputToken);
        const outputPrice = await getTokenPrice(outputToken);

        if (inputPrice && outputPrice && isMounted.current) {
          const inputValueNum = parseFloat(inputValue);

          // Calculate USD value
          const inputValueUsd = inputValueNum * inputPrice;

          // Calculate output amount based on equivalent USD value (minus simulated 0.3% fee)
          const estimatedOutput = (inputValueUsd / outputPrice) * 0.997;

          // Format the number properly based on token decimals
          const formattedOutput = estimatedOutput.toFixed(outputToken.decimals <= 6 ? outputToken.decimals : 6);
          const formattedUsdValue = calculateUsdValue(formattedOutput, outputPrice);

          // Update state only if values have changed
          if (formattedOutput !== estimatedOutputAmount) {
            setEstimatedOutputAmount(formattedOutput);
          }
          
          if (formattedUsdValue !== outputTokenUsdValue) {
            setOutputTokenUsdValue(formattedUsdValue);
          }

          // Update the cache
          lastCalculatedPriceRef.current = {
            inputAmount: inputValue,
            inputPrice,
            outputAmount: formattedOutput,
            outputPrice
          };

          console.log(`[SwapScreen] Estimate: ${inputValueNum} ${inputToken.symbol} (${inputPrice} USD) → ${estimatedOutput} ${outputToken.symbol} (${outputPrice} USD)`);
        }
      }, 300); // Short debounce for estimate calculation
    } catch (error) {
      console.error('[SwapScreen] Error estimating swap:', error);
    }
  }, [connected, inputValue, getTokenPrice, inputToken, outputToken, outputTokenUsdValue, estimatedOutputAmount, calculateUsdValue]);

  // Handle token selection
  const handleTokenSelected = useCallback(async (token: TokenInfo) => {
    if (!isMounted.current) return;

    try {
      console.log(`[SwapScreen] Token selected: ${token.symbol || 'Unknown'}`);

      // Mark token operation as pending
      if (selectingWhichSide === 'input') {
        setPendingTokenOps(prev => ({ ...prev, input: true }));
      } else {
        setPendingTokenOps(prev => ({ ...prev, output: true }));
      }

      // Cancel any pending price updates and estimate calculations
      if (priceUpdateTimer.current) {
        clearTimeout(priceUpdateTimer.current);
        priceUpdateTimer.current = null;
      }
      
      if (estimateSwapTimer.current) {
        clearTimeout(estimateSwapTimer.current);
        estimateSwapTimer.current = null;
      }

      // Ensure we have complete token info - add timeout protection
      let completeToken: TokenInfo | null = null;
      
      // Set up a timeout promise that will resolve after 8 seconds
      const timeoutPromise = new Promise<TokenInfo>(resolve => {
        setTimeout(() => {
          console.log(`[SwapScreen] Token fetch timeout for ${token.symbol}, using available data`);
          resolve(token); // Return original token on timeout
        }, 8000);
      });
      
      // Race the token fetch against the timeout
      try {
        completeToken = await Promise.race([
          ensureCompleteTokenInfo(token),
          timeoutPromise
        ]);
      } catch (error) {
        console.error('[SwapScreen] Error fetching complete token info:', error);
        completeToken = token; // Use original token as fallback
      }

      if (!isMounted.current) return;
      
      // Safely proceed with either complete token or original token
      if (!completeToken) {
        throw new Error('Failed to get token information');
      }

      if (selectingWhichSide === 'input') {
        console.log('[SwapScreen] Input token changed to', completeToken.symbol);

        // Update input token state immediately
        setInputToken(completeToken);
        setPendingTokenOps(prev => ({ ...prev, input: false }));

        // Reset input value and fetch new balance in sequence
        setInputValue('0');
        setCurrentBalance(null);
        setCurrentTokenPrice(null);
        currentPriceRef.current = null;

        // Show the modal as closed immediately
        setShowSelectTokenModal(false);

        // Fetch balance and price for new token with small delay to allow UI to update
        setTimeout(async () => {
          if (isMounted.current && userPublicKey) {
            try {
              // First fetch balance
              const newBalance = await fetchBalance(completeToken);
              
              if (!isMounted.current) return;
              
              // Then fetch price (sequentially to avoid race conditions)
              if (newBalance !== null) {
                const price = await getTokenPrice(completeToken);
                
                if (!isMounted.current) return;
                
                if (price !== null) {
                  currentPriceRef.current = price;
                  
                  // Update price state with debounce
                  priceUpdateTimer.current = setTimeout(() => {
                    if (isMounted.current) {
                      setCurrentTokenPrice(price);
                      
                      // Finally trigger output calculation
                      setTimeout(() => {
                        if (isMounted.current && parseFloat(inputValue) > 0) {
                          estimateSwap();
                        }
                      }, 300);
                    }
                  }, PRICE_UPDATE_DEBOUNCE / 2);
                }
              }
            } catch (error) {
              console.error('[SwapScreen] Error during token change updates:', error);
              
              // Clean up and set some default values to prevent UI being stuck
              if (isMounted.current) {
                setCurrentBalance(0);
                if (currentPriceRef.current === null) {
                  setCurrentTokenPrice(0);
                }
              }
            }
          }
        }, 200);
      } else {
        console.log('[SwapScreen] Output token changed to', completeToken.symbol);
        
        // Update output token state
        setOutputToken(completeToken);
        setPendingTokenOps(prev => ({ ...prev, output: false }));

        // Close the modal immediately
      setShowSelectTokenModal(false);
        
        // Reset estimated output
        setEstimatedOutputAmount('');
        setOutputTokenUsdValue('$0.00');
        
        // Trigger new output estimate after a short delay
        setTimeout(() => {
          if (isMounted.current && inputToken && parseFloat(inputValue) > 0) {
            estimateSwap();
          }
        }, 300);
      }
    } catch (error) {
      console.error('[SwapScreen] Error selecting token:', error);
      // Reset pending flags
      if (selectingWhichSide === 'input') {
        setPendingTokenOps(prev => ({ ...prev, input: false }));
      } else {
        setPendingTokenOps(prev => ({ ...prev, output: false }));
      }

      if (isMounted.current) {
        setErrorMsg('Failed to load token information');
        setTimeout(() => isMounted.current && setErrorMsg(''), 3000);
        // Always close the modal even on error
        setShowSelectTokenModal(false);
      }
    }
  }, [selectingWhichSide, fetchBalance, getTokenPrice, userPublicKey, estimateSwap, inputValue, inputToken]);

  // Handle max button click
  const handleMaxButtonClick = useCallback(async () => {
    console.log("[SwapScreen] MAX button clicked, current balance:", currentBalance);

    if (isMounted.current) {
      setErrorMsg(''); // Clear any existing error messages
    }

    // Validate wallet connection
    if (!connected || !userPublicKey || !inputToken) {
      if (isMounted.current) {
        Alert.alert(
          "Wallet Not Connected",
          "Please connect your wallet to view your balance."
        );
      }
      return;
    }

    // If we already have a balance, use it
    if (currentBalance !== null && currentBalance > 0) {
      setInputValue(String(currentBalance));
      return;
    }

    // Otherwise, fetch fresh balance
    if (isMounted.current) {
      setLoading(true);
      setResultMsg("Fetching your balance...");
    }

    try {
      const balance = await fetchBalance(inputToken);

      if (isMounted.current) {
        setLoading(false);
        setResultMsg("");
      }

      // Check if we have a balance after fetching
      if (balance !== null && balance > 0 && isMounted.current) {
        console.log("[SwapScreen] Setting max amount from fetched balance:", balance);
        setInputValue(String(balance));
      } else if (isMounted.current) {
        console.log("[SwapScreen] Balance fetch returned:", balance);
        Alert.alert(
          "Balance Unavailable",
          `Could not get your ${inputToken.symbol} balance. Please check your wallet connection.`
        );
      }
    } catch (error) {
      console.error("[SwapScreen] Error in MAX button handler:", error);
      if (isMounted.current) {
        setLoading(false);
        setResultMsg("");
        setErrorMsg(`Failed to fetch your ${inputToken?.symbol || 'token'} balance`);
        setTimeout(() => isMounted.current && setErrorMsg(''), 3000);
      }
    }
  }, [currentBalance, fetchBalance, inputToken, userPublicKey, connected]);

  // Handle percentage button clicks (25%, 50%)
  const handlePercentageButtonClick = useCallback(async (percentage: number) => {
    console.log(`[SwapScreen] ${percentage}% button clicked, current balance:`, currentBalance);

    if (isMounted.current) {
      setErrorMsg(''); // Clear any existing error messages
    }

    // Validate wallet connection
    if (!connected || !userPublicKey || !inputToken) {
      if (isMounted.current) {
        Alert.alert(
          "Wallet Not Connected",
          "Please connect your wallet to view your balance."
        );
      }
      return;
    }

    // If we already have a balance, use it
    if (currentBalance !== null && currentBalance > 0) {
      const percentageAmount = (currentBalance * percentage) / 100;
      setInputValue(String(percentageAmount));
      return;
    }

    // Otherwise, fetch fresh balance
    if (isMounted.current) {
      setLoading(true);
      setResultMsg("Fetching your balance...");
    }

    try {
      const balance = await fetchBalance(inputToken);

      if (isMounted.current) {
        setLoading(false);
        setResultMsg("");
      }

      // Check if we have a balance after fetching
      if (balance !== null && balance > 0 && isMounted.current) {
        console.log(`[SwapScreen] Setting ${percentage}% amount from fetched balance:`, balance);
        const percentageAmount = (balance * percentage) / 100;
        setInputValue(String(percentageAmount));
      } else if (isMounted.current) {
        console.log("[SwapScreen] Balance fetch returned:", balance);
        Alert.alert(
          "Balance Unavailable",
          `Could not get your ${inputToken.symbol} balance. Please check your wallet connection.`
        );
      }
    } catch (error) {
      console.error(`[SwapScreen] Error in ${percentage}% button handler:`, error);
      if (isMounted.current) {
        setLoading(false);
        setResultMsg("");
        setErrorMsg(`Failed to fetch your ${inputToken?.symbol || 'token'} balance`);
        setTimeout(() => isMounted.current && setErrorMsg(''), 3000);
      }
    }
  }, [currentBalance, fetchBalance, inputToken, userPublicKey, connected]);

  // Handle clear button click
  const handleClearButtonClick = useCallback(() => {
    console.log("[SwapScreen] Clear button clicked");
    setInputValue('0');
    if (isMounted.current) {
      setErrorMsg(''); // Clear any existing error messages
    }
  }, []);

  // Calculate conversion rate
  const getConversionRate = useCallback(() => {
    if (!inputToken || !outputToken || !estimatedOutputAmount || parseFloat(inputValue || '0') <= 0) {
      return `1 ${inputToken?.symbol || 'token'} = 0 ${outputToken?.symbol || 'token'}`;
    }

    const inputAmt = parseFloat(inputValue);
    const outputAmt = parseFloat(estimatedOutputAmount);
    const rate = outputAmt / inputAmt;

    return `1 ${inputToken.symbol} = ${rate.toFixed(6)} ${outputToken.symbol}`;
  }, [inputToken, outputToken, inputValue, estimatedOutputAmount]);

  // Memoize the conversion rate to prevent unnecessary calculations
  const conversionRate = useMemo(() => getConversionRate(), [getConversionRate]);

  // Check if a provider is available for selection
  const isProviderAvailable = useCallback((provider: SwapProvider) => {
    // Now Jupiter, Raydium, and PumpSwap are fully implemented
    return provider === 'JupiterUltra' || provider === 'Raydium' || provider === 'PumpSwap';
  }, []);

  // Check if the swap button should be enabled
  const isSwapButtonEnabled = useCallback(() => {
    if (!connected || loading) return false;

    // Check if the provider is available
    if (!isProviderAvailable(activeProvider)) return false;

    // For PumpSwap, we need a pool address
    if (activeProvider === 'PumpSwap' && !poolAddress) return false;

    // Check if input amount is valid and not greater than balance
    const inputAmount = parseFloat(inputValue || '0');
    if (inputAmount <= 0) return false;

    // If we have a current balance, check if input amount exceeds it
    if (currentBalance !== null && inputAmount > currentBalance) {
      return false;
    }

    return true;
  }, [connected, loading, activeProvider, isProviderAvailable, poolAddress, inputValue, currentBalance]);

  // Function to handle keypad input
  const handleKeyPress = (key: string) => {
    if (key === 'delete') {
      setInputValue(prev => prev.slice(0, -1) || '0');
      return;
    }

    if (key === '.') {
      if (inputValue.includes('.')) return;
    }

    if (inputValue === '0' && key !== '.') {
      setInputValue(key);
    } else {
      setInputValue(prev => prev + key);
    }
  };

  // Execute swap
  const handleSwap = useCallback(async () => {
    console.log('[SwapScreen] ⚠️⚠️⚠️ SWAP BUTTON CLICKED ⚠️⚠️⚠️');
    console.log(`[SwapScreen] Provider: ${activeProvider}, Amount: ${inputValue} ${inputToken?.symbol || 'token'}`);

    if (!connected || !userPublicKey) {
      console.log('[SwapScreen] Error: Wallet not connected');
      Alert.alert('Wallet not connected', 'Please connect your wallet first.');
      return;
    }

    if (!inputToken || !outputToken) {
      console.log('[SwapScreen] Error: Tokens not initialized');
      Alert.alert('Tokens not loaded', 'Please wait for tokens to load or select tokens first.');
      return;
    }

    if (isNaN(parseFloat(inputValue)) || parseFloat(inputValue) <= 0) {
      console.log('[SwapScreen] Error: Invalid amount input:', inputValue);
      Alert.alert('Invalid amount', 'Please enter a valid amount to swap.');
      return;
    }

    // Check if the selected provider is implemented
    if (!isProviderAvailable(activeProvider)) {
      console.log('[SwapScreen] Error: Provider not available:', activeProvider);
      Alert.alert(
        'Provider Not Available',
        `${activeProvider} integration is coming soon! Please use Jupiter, Raydium, or PumpSwap for now.`
      );
      return;
    }

    // For PumpSwap, check if pool address is provided
    if (activeProvider === 'PumpSwap' && !poolAddress) {
      console.log('[SwapScreen] Error: PumpSwap selected but no pool address provided');
      Alert.alert(
        'Pool Address Required',
        'Please enter a pool address for PumpSwap.'
      );
      return;
    }

    console.log('[SwapScreen] Starting swap with:', {
      provider: activeProvider,
      inputToken: inputToken.symbol,
      outputToken: outputToken.symbol,
      amount: inputValue,
      poolAddress: activeProvider === 'PumpSwap' ? poolAddress : 'N/A'
    });

    setLoading(true);
    setResultMsg('');
    setErrorMsg('');

    // For PumpSwap, set a timeout that will assume success
    let pumpSwapTimeoutId: NodeJS.Timeout | null = null;
    if (activeProvider === 'PumpSwap') {
      console.log(`[SwapScreen] Setting up PumpSwap success timeout for ${PUMPSWAP_SUCCESS_TIMEOUT}ms`);
      pumpSwapTimeoutId = setTimeout(() => {
        if (isMounted.current && loading) {
          console.log('[SwapScreen] PumpSwap timeout reached - assuming transaction success');
          setLoading(false);
          setResultMsg('Transaction likely successful! PumpSwap transactions often succeed despite timeout errors.');

          Alert.alert(
            'PumpSwap Transaction Likely Successful',
            'Your transaction has been sent and likely processed successfully. PumpSwap transactions often succeed despite not receiving confirmation in the app.',
            [
              {
                text: 'Check Wallet Balance',
                onPress: () => {
                  setInputValue('0');
                  fetchBalance();
                }
              },
              {
                text: 'OK',
                style: 'default'
              }
            ]
          );
        }
      }, PUMPSWAP_SUCCESS_TIMEOUT);
    }

    try {
      // Execute the swap using the trade service with the selected provider
      console.log('[SwapScreen] Calling TradeService.executeSwap');
      const response = await TradeService.executeSwap(
        inputToken,
        outputToken,
        inputValue,
        userPublicKey,
        transactionSender,
        {
          statusCallback: (status) => {
            console.log('[SwapScreen] Status update:', status);
            if (isMounted.current) {
              setResultMsg(status);

              // Check if the status message indicates completion
              if (status.toLowerCase().includes('complete') ||
                status.toLowerCase().includes('successful') ||
                status === 'Transaction complete! ✓') {
                console.log('[SwapScreen] Completion status received, resetting loading state');
                setLoading(false);
              }
            }
          },
          isComponentMounted: () => isMounted.current
        },
        activeProvider,
        // Pass pool address for PumpSwap
        activeProvider === 'PumpSwap' ? { poolAddress, slippage } : undefined
      );

      console.log('[SwapScreen] TradeService.executeSwap response:', JSON.stringify(response));
      console.log('[SwapScreen] Output amount for fee calculation:', response.outputAmount);

      if (response.success && response.signature) {
        if (isMounted.current) {
          console.log('[SwapScreen] Swap successful! Signature:', response.signature);
          setResultMsg(`Swap successful!`);
          setSolscanTxSig(response.signature);

          // Wait a moment for the fee collection alert to show
          setTimeout(() => {
            console.log('[SwapScreen] Checking if fee alert is visible...');
          }, 500);

          
        }
      } else {
        console.log('[SwapScreen] Swap response not successful:', response);
        const errorString = response.error?.toString() || '';
        if (errorString.includes('Component unmounted')) {
          console.log('[SwapScreen] Component unmounted during swap, ignoring error.');
          return; // Exit silently
        }
        // For PumpSwap, check if we might have had a transaction timeout but it could have succeeded
        if (activeProvider === 'PumpSwap' && response.error) {
          const errorMsg = response.error.toString();
          const signatureMatch = errorMsg.match(/Signature: ([a-zA-Z0-9]+)/);

          // If we have a signature, it might have succeeded despite the timeout
          if (errorMsg.includes('may have succeeded') ||
            errorMsg.includes('confirmation timed out') ||
            (signatureMatch && signatureMatch[1] !== 'Unknown')) {

            // Extract signature if available
            const signature = signatureMatch ? signatureMatch[1] : null;

            console.log('[SwapScreen] PumpSwap transaction may have succeeded despite timeout. Signature:', signature);

            if (signature && signature !== 'Unknown') {
              setResultMsg('Transaction appears successful! Check Solscan for confirmation.');
              setSolscanTxSig(signature);
              setLoading(false);

              Alert.alert(
                'PumpSwap Transaction Likely Successful',
                'Your transaction was sent and likely processed, though confirmation timed out in our app. PumpSwap transactions often succeed despite timeout errors.',
                [
                  {
                    text: 'View on Solscan',
                    onPress: () => {
                      const url = `https://solscan.io/tx/${signature}`;
                      Linking.openURL(url).catch(err => {
                        console.error('[SwapScreen] Error opening Solscan URL:', err);
                      });
                    }
                  },
                  {
                    text: 'OK',
                    onPress: () => {
                      setInputValue('0');
                      fetchBalance();
                    }
                  }
                ]
              );
              return;
            }
          }
        }

        throw new Error(response.error?.toString() || 'Transaction failed');
      }
    } catch (err: any) {
      console.error('[SwapScreen] Swap error caught:', err);
      console.error('[SwapScreen] Error details:', JSON.stringify(err, null, 2));

      if (isMounted.current) {
        // Format error message for user
        let errorMessage = 'Swap failed. ';
        let mayHaveSucceeded = false;

        if (err.message.includes('signature verification')) {
          errorMessage += 'Please try again.';
        } else if (err.message.includes('0x1771')) {
          errorMessage += 'Insufficient balance or price impact too high.';
        } else if (err.message.includes('ExceededSlippage') || err.message.includes('0x1774')) {
          errorMessage += 'Price impact too high. Try increasing your slippage tolerance.';
        } else if (err.message.includes('confirmation failed') || err.message.includes('may have succeeded')) {
          // Handle the case where transaction might have succeeded
          mayHaveSucceeded = true;

          // Extract signature if available
          const signatureMatch = err.message.match(/Signature: ([a-zA-Z0-9]+)/);
          const signature = signatureMatch ? signatureMatch[1] : null;

          if (signature && signature !== 'Unknown') {
            errorMessage = 'Transaction sent but confirmation timed out. ';
            setSolscanTxSig(signature);

            // For PumpSwap, we're more confident the transaction succeeded if we have a signature
            if (activeProvider === 'PumpSwap') {
              // Clear the success timeout since we're handling it now
              if (pumpSwapTimeoutId) {
                clearTimeout(pumpSwapTimeoutId);
                pumpSwapTimeoutId = null;
              }

              setResultMsg('PumpSwap transaction likely successful! Check Solscan for confirmation.');
              setLoading(false);

              Alert.alert(
                'PumpSwap Transaction Likely Successful',
                'Your transaction was sent and likely processed, though confirmation timed out in our app. PumpSwap transactions often succeed despite timeout errors.',
                [
                  {
                    text: 'View on Solscan',
                    onPress: () => {
                      // Open transaction on Solscan
                      const url = `https://solscan.io/tx/${signature}`;
                      Linking.openURL(url).catch(err => {
                        console.error('[SwapScreen] Error opening Solscan URL:', err);
                      });
                    }
                  },
                  {
                    text: 'OK',
                    onPress: () => {
                      setInputValue('0');
                      fetchBalance();
                    }
                  }
                ]
              );
              return;
            }

            // Show a different alert for this case (for other providers)
            Alert.alert(
              'Transaction Status Uncertain',
              'Your transaction was sent but confirmation timed out. It may have succeeded. You can check the status on Solscan.',
              [
                {
                  text: 'View on Solscan',
                  onPress: () => {
                    // Open transaction on Solscan
                    const url = `https://solscan.io/tx/${signature}`;
                    Linking.openURL(url).catch(err => {
                      console.error('[SwapScreen] Error opening Solscan URL:', err);
                    });
                  }
                },
                {
                  text: 'OK',
                  onPress: () => {
                    setInputValue('0');
                    fetchBalance();
                  }
                }
              ]
            );

            // Return early so we don't show the standard error alert
            return;
          } else {
            errorMessage += 'Your transaction may have succeeded but confirmation timed out. Check your wallet for changes.';
          }
        } else {
          errorMessage += err.message;
        }

        console.log('[SwapScreen] Setting error message:', errorMessage);
        setErrorMsg(errorMessage);

        if (!mayHaveSucceeded) {
          Alert.alert('Swap Failed', errorMessage);
        }
      }
    } finally {
      if (isMounted.current) {
        console.log('[SwapScreen] Swap process completed, resetting loading state');

        // Clean up the PumpSwap timeout if it's still active
        if (pumpSwapTimeoutId) {
          console.log('[SwapScreen] Clearing PumpSwap success timeout');
          clearTimeout(pumpSwapTimeoutId);
        }

        setLoading(false);
      }
    }
  }, [
    connected,
    userPublicKey,
    inputValue,
    inputToken,
    outputToken,
    transactionSender,
    fetchBalance,
    estimatedOutputAmount,
    activeProvider,
    poolAddress,
    slippage,
    isProviderAvailable,
    loading
  ]);

  // View transaction on Solscan
  const viewTransaction = useCallback(() => {
    if (solscanTxSig) {
      const url = `https://solscan.io/tx/${solscanTxSig}`;
      Linking.openURL(url).catch(err => {
        console.error('[SwapScreen] Error opening Solscan URL:', err);
      });
    }
  }, [solscanTxSig]);

  // Function to swap input and output tokens
  const handleSwapTokens = useCallback(async () => {
    if (!isMounted.current || pendingTokenOps.input || pendingTokenOps.output) {
      console.log('[SwapScreen] Token operations pending, cannot swap tokens now.');
      return;
    }

    console.log('[SwapScreen] Swapping input and output tokens.');

    // Store current values temporarily
    const tempInputToken = inputToken;
    const tempOutputToken = outputToken;
    const tempInputValue = inputValue;
    const tempEstimatedOutputAmount = estimatedOutputAmount;

    // Set operations as pending
    setPendingTokenOps({ input: true, output: true });

    // Swap tokens
    setInputToken(tempOutputToken);
    setOutputToken(tempInputToken);

    // Swap amounts (new input amount becomes the previous output amount)
    // Reset output amount as it will be recalculated
    setInputValue(tempEstimatedOutputAmount || '0'); // Use '0' if undefined
    setEstimatedOutputAmount(tempInputValue); // Old input becomes new 'estimated' output temporarily, will be overwritten

    // Reset and fetch new data for the new input token
    setCurrentBalance(null);
    setCurrentTokenPrice(null);
    currentPriceRef.current = null;

    if (tempOutputToken && connected && userPublicKey) {
      try {
        const balance = await fetchTokenBalance(userPublicKey, tempOutputToken);
        if (isMounted.current && balance !== null) {
          setCurrentBalance(balance);
        }
        const price = await fetchTokenPrice(tempOutputToken);
        if (isMounted.current && price !== null) {
          setCurrentTokenPrice(price);
          currentPriceRef.current = price;
        }
      } catch (error) {
        console.error('[SwapScreen] Error fetching data for new input token after swap:', error);
        if (isMounted.current) {
          setErrorMsg('Error updating token data after swap.');
          setTimeout(() => setErrorMsg(''), 3000);
        }
      }
    }
    
    // Mark operations as complete
    setPendingTokenOps({ input: false, output: false });

    // Trigger a re-estimation of the swap if the new input value is greater than 0
    if (parseFloat(tempEstimatedOutputAmount || '0') > 0) {
      // We need to call estimateSwap or a similar function here
      // For now, this will be handled by the useEffect that depends on inputValue or inputToken
      console.log('[SwapScreen] Triggering swap estimation after token swap.');
    }
  }, [
    inputToken, 
    outputToken, 
    inputValue, 
    estimatedOutputAmount, 
    connected, 
    userPublicKey,
    fetchTokenBalance, 
    fetchTokenPrice,
    setPendingTokenOps
  ]);

  // Update effects
  useEffect(() => {
    if (!tokensInitialized) {
      initializeTokens();
    } else if (routeParams.shouldInitialize) {
      // If the component needs to re-initialize with new route params
      console.log('[SwapScreen] Re-initializing from route params', routeParams);
      setTokensInitialized(false); // This will trigger initializeTokens() in the next effect

      // Clear the shouldInitialize flag to prevent re-initialization loops
      if (navigation?.setParams) {
        // Update the route params to remove shouldInitialize
        navigation.setParams({ ...routeParams, shouldInitialize: false });
      }
    }
  }, [tokensInitialized, initializeTokens, routeParams, navigation]);

  // Reset states and handle token updates on visibility changes
  useEffect(() => {
    // Reset states
    setResultMsg('');
    setErrorMsg('');
    setSolscanTxSig('');

    console.log('[SwapScreen] Component mounted/became visible. Current token price:', currentTokenPrice);

    // Initialize tokens if not already initialized
    if (!tokensInitialized) {
      initializeTokens();
    } else if (connected && userPublicKey && inputToken) {
      // If tokens are already initialized and we have a wallet connected, 
      // fetch data in a controlled, sequential manner with proper debouncing
      console.log('[SwapScreen] Initialized tokens already exist, scheduling updates...');

      // Clear any pending timers to avoid conflicts
      if (priceUpdateTimer.current) {
        clearTimeout(priceUpdateTimer.current);
      }
      
      if (estimateSwapTimer.current) {
        clearTimeout(estimateSwapTimer.current);
        }

      // Use a sequence of operations with proper timing gaps
      // First check balance, then price, then calculate estimates
      const fetchSequence = async () => {
        if (!isMounted.current) return;
        
        try {
          // 1. First fetch balance
          const balance = await fetchTokenBalance(userPublicKey, inputToken);
          if (!isMounted.current) return;
          
          if (balance !== null && balance !== currentBalance) {
            setCurrentBalance(balance);
          }
          
          // 2. Next fetch input token price (with small delay)
          setTimeout(async () => {
            if (!isMounted.current) return;
            
            const price = await fetchTokenPrice(inputToken);
            if (!isMounted.current) return;
            
            if (price !== null && price !== currentPriceRef.current) {
              currentPriceRef.current = price;
              
              // Debounce the actual state update
              priceUpdateTimer.current = setTimeout(() => {
                if (isMounted.current) {
                  setCurrentTokenPrice(price);

                  // 3. Finally, estimate the swap (with further delay)
                  setTimeout(() => {
                    if (isMounted.current && parseFloat(inputValue) > 0) {
      estimateSwap();
                    }
                  }, 300);
                }
              }, PRICE_UPDATE_DEBOUNCE / 2);
    }
          }, 100);
        } catch (error) {
          console.error('[SwapScreen] Error updating token data:', error);
        }
      };
      
      // Start the sequence with a small delay
      const timer = setTimeout(fetchSequence, 200);

      return () => {
        clearTimeout(timer);
        if (priceUpdateTimer.current) {
          clearTimeout(priceUpdateTimer.current);
        }
        if (estimateSwapTimer.current) {
          clearTimeout(estimateSwapTimer.current);
        }
      };
    }
  }, [tokensInitialized, initializeTokens, connected, userPublicKey, inputToken, currentTokenPrice, currentBalance, estimateSwap, inputValue]);
  
  // Update output estimate when input changes, but with debounce
  useEffect(() => {
    // Clear any pending estimate
    if (estimateSwapTimer.current) {
      clearTimeout(estimateSwapTimer.current);
    }
    
    // Schedule new estimate with debounce
    estimateSwapTimer.current = setTimeout(() => {
      if (isMounted.current) {
        if (parseFloat(inputValue) > 0) {
          estimateSwap();
        } else if (estimatedOutputAmount !== '0') {
          setEstimatedOutputAmount('0');
          setOutputTokenUsdValue('$0.00');
        }
      }
    }, 300);
    
    return () => {
      if (estimateSwapTimer.current) {
        clearTimeout(estimateSwapTimer.current);
            }
    };
  }, [inputValue, estimateSwap, estimatedOutputAmount]);

  return {
    // Token data
    inputToken,
    outputToken,
    currentBalance,
    currentTokenPrice,
    
    // UI state
    inputValue,
    estimatedOutputAmount,
    outputTokenUsdValue,
    activeProvider,
    showSelectTokenModal,
    selectingWhichSide,
    poolAddress,
    slippage,
    loading,
    resultMsg,
    errorMsg,
    solscanTxSig,
    pendingTokenOps,
    
    // Computed values
    conversionRate,
    
    // State updaters
    setInputValue,
    setActiveProvider,
    setShowSelectTokenModal,
    setSelectingWhichSide,
    setPoolAddress,
    setSlippage,
    
    // Action handlers
    handleTokenSelected,
    handleMaxButtonClick,
    handlePercentageButtonClick,
    handleClearButtonClick,
    handleKeyPress,
    handleSwap,
    viewTransaction,
    calculateUsdValue,
    isProviderAvailable,
    isSwapButtonEnabled,
    handleSwapTokens,
    
    // Token operations
    fetchBalance,
    getTokenPrice
  };
} 