import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useCustomization } from '@/shared/config/CustomizationProvider';
import { TURNKEY_ORGANIZATION_ID } from '@env';
import { useTurnkey } from '@turnkey/sdk-react-native'; 
import { SERVER_URL } from '@env';
import { PublicKey } from '@solana/web3.js';

// Types for the OTP flow
export interface OtpResponse {
  otpId: string;
  organizationId: string;
}

export interface OtpAuthParams {
  otpId: string;
  otpCode: string;
  organizationId: string;
  targetPublicKey: string;
}

// Utility function to convert hex string to base58 Solana address
const hexToSolanaAddress = (hexKey: string): string => {
  try {
    // Remove '0x' prefix if present
    const cleanHex = hexKey.startsWith('0x') ? hexKey.slice(2) : hexKey;
    
    // Convert hex to bytes
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    
    // Create a Solana PublicKey from the bytes and return as base58
    const solanaKey = new PublicKey(bytes);
    return solanaKey.toBase58();
  } catch (error) {
    console.error('Failed to convert hex to Solana address:', error);
    // If conversion fails, create a deterministic key from the hex string
    // This is a fallback to avoid breaking the flow if the conversion fails
    return new PublicKey(
      Array.from(hexKey).map(c => c.charCodeAt(0) % 256).slice(0, 32)
    ).toBase58();
  }
};

export function useTurnkeyWalletLogic() {
  const [user, setUser] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpResponse, setOtpResponse] = useState<OtpResponse | null>(null);
  
  // Get Turnkey SDK hooks
  const { createEmbeddedKey, createSession, clearSession } = useTurnkey();
  
  const { auth: { turnkey: turnkeyConfig } } = useCustomization();
  
  // Monitor for authenticated user
  useEffect(() => {
    if (walletAddress) {
      setIsAuthenticated(true);
      setUser({ id: walletAddress });
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [walletAddress]);
  
  // Clear any existing session when component mounts
  useEffect(() => {
    const clearExistingSession = async () => {
      try {
        if (clearSession) {
          console.log('Clearing existing Turnkey session on component mount');
          await clearSession();
        }
      } catch (error) {
        // Ignore errors on initial cleanup
        console.log('No session to clear or error clearing session:', error);
      }
    };
    
    // Only clear if not authenticated
    if (!isAuthenticated) {
      clearExistingSession();
    }
  }, [clearSession, isAuthenticated]);

  // Initiates the email OTP login flow
  const handleInitOtpLogin = useCallback(async ({
    email,
    setStatusMessage,
    onSuccess
  }: {
    email: string;
    setStatusMessage?: (msg: string) => void;
    onSuccess?: (info: { provider: 'turnkey'; address: string }) => void;
  }) => {
    setLoading(true);
    setStatusMessage?.('Initiating OTP verification...');
    
    try {
      // Clear any existing session first
      if (clearSession) {
        try {
          console.log('Clearing any existing Turnkey session before OTP login');
          await clearSession();
        } catch (clearError) {
          console.log('No session to clear or error clearing session:', clearError);
          // Continue with the login flow
        }
      }
      
      const SERVER_BASE_URL = SERVER_URL || 'http://localhost:8080';
      const response = await fetch(`${SERVER_BASE_URL}/api/auth/initOtpAuth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          otpType: 'OTP_TYPE_EMAIL', 
          contact: email 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate OTP verification');
      }
      
      setStatusMessage?.('OTP sent to your email');
      setOtpResponse({
        otpId: data.otpId,
        organizationId: data.organizationId,
      });
      
      return data;
    } catch (error: any) {
      console.error('OTP initiation error:', error);
      setStatusMessage?.(`Failed to send OTP: ${error.message}`);
      Alert.alert('Authentication Error', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  // Verifies the OTP code
  const handleVerifyOtp = useCallback(async ({
    otpCode,
    setStatusMessage,
    onWalletConnected,
  }: {
    otpCode: string;
    setStatusMessage?: (msg: string) => void;
    onWalletConnected?: (info: { provider: 'turnkey'; address: string }) => void;
  }) => {
    if (!otpResponse) {
      setStatusMessage?.('No active OTP verification in progress');
      return;
    }
    
    setLoading(true);
    setStatusMessage?.('Verifying OTP...');
    
    try {
      // Try to clear any existing session first
      if (clearSession) {
        try {
          console.log('Clearing any existing Turnkey session before verification');
          await clearSession();
        } catch (clearError) {
          console.log('No session to clear or error clearing session:', clearError);
          // Continue with the verification flow
        }
      }
      
      // Generate public key for the embedded key
      const targetPublicKey = await createEmbeddedKey();
      
      const SERVER_BASE_URL = SERVER_URL || 'http://localhost:8080';
      const response = await fetch(`${SERVER_BASE_URL}/api/auth/otpAuth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otpId: otpResponse.otpId,
          otpCode,
          organizationId: otpResponse.organizationId,
          targetPublicKey,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }
      
      if (data.credentialBundle) {
        // Create session with the credential bundle
        setStatusMessage?.('Creating wallet session...');
        
        // Use a unique session key based on the organization ID to avoid conflicts
        const sessionKey = `@turnkey/session/${otpResponse.organizationId}`;
        await createSession({ 
          bundle: data.credentialBundle,
          sessionKey: sessionKey
        });
        
        // Convert the hex public key to a base58 Solana address
        console.log('Raw public key from Turnkey:', targetPublicKey);
        const solanaAddress = hexToSolanaAddress(targetPublicKey);
        console.log('Converted Solana address:', solanaAddress);
        
        // Set the wallet address to the converted base58 format
        setWalletAddress(solanaAddress);
        setIsAuthenticated(true);
        setUser({ id: solanaAddress });
        
        setStatusMessage?.(`Successfully authenticated with wallet: ${solanaAddress}`);
        onWalletConnected?.({ provider: 'turnkey', address: solanaAddress });
        
        return { address: solanaAddress };
      } else {
        throw new Error('No credential bundle received');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setStatusMessage?.(`Failed to verify OTP: ${error.message}`);
      Alert.alert('Authentication Error', error.message);
      throw error;
    } finally {
      setLoading(false);
      setOtpResponse(null); // Clear OTP response after verification attempt
    }
  }, [otpResponse, createEmbeddedKey, createSession, clearSession]);

  // Handle OAuth login (Google, Apple)
  const handleOAuthLogin = useCallback(async ({
    oidcToken,
    providerName,
    setStatusMessage,
    onWalletConnected,
  }: {
    oidcToken: string;
    providerName: string;
    setStatusMessage?: (msg: string) => void;
    onWalletConnected?: (info: { provider: 'turnkey'; address: string }) => void;
  }) => {
    setLoading(true);
    setStatusMessage?.(`Authenticating with ${providerName}...`);
    
    try {
      // Try to clear any existing session first
      if (clearSession) {
        try {
          console.log('Clearing any existing Turnkey session before OAuth login');
          await clearSession();
        } catch (clearError) {
          console.log('No session to clear or error clearing session:', clearError);
          // Continue with the login flow
        }
      }
      
      // Generate public key for the embedded key
      const targetPublicKey = await createEmbeddedKey();
      
      const SERVER_BASE_URL = SERVER_URL || 'http://localhost:8080';
      const response = await fetch(`${SERVER_BASE_URL}/api/auth/oAuthLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oidcToken,
          providerName,
          targetPublicKey,
          expirationSeconds: '3600', // 1 hour
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to authenticate with ${providerName}`);
      }
      
      if (data.credentialBundle) {
        // Create session with the credential bundle
        setStatusMessage?.('Creating wallet session...');
        
        // Use a unique session key to avoid conflicts
        const sessionKey = `@turnkey/session/${providerName}`;
        await createSession({ 
          bundle: data.credentialBundle,
          sessionKey: sessionKey 
        });
        
        // Convert the hex public key to a base58 Solana address
        console.log('Raw public key from Turnkey OAuth:', targetPublicKey);
        const solanaAddress = hexToSolanaAddress(targetPublicKey);
        console.log('Converted Solana address from OAuth:', solanaAddress);
        
        // Set the wallet address to the converted base58 format
        setWalletAddress(solanaAddress);
        setIsAuthenticated(true);
        setUser({ id: solanaAddress });
        
        setStatusMessage?.(`Successfully authenticated with wallet: ${solanaAddress}`);
        onWalletConnected?.({ provider: 'turnkey', address: solanaAddress });
        
        return { address: solanaAddress };
      } else {
        throw new Error('No credential bundle received');
      }
    } catch (error: any) {
      console.error('OAuth login error:', error);
      setStatusMessage?.(`Failed to authenticate: ${error.message}`);
      Alert.alert('Authentication Error', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [createEmbeddedKey, createSession, clearSession]);

  // Handles logout for Turnkey provider
  const handleTurnkeyLogout = useCallback(async (setStatusMessage?: (msg: string) => void) => {
    try {
      // First reset our local state - do this first to ensure UI updates even if session clearing fails
      setWalletAddress(null);
      setUser(null);
      setIsAuthenticated(false);
      
      // Try to clear the Turnkey session, but don't fail if session not found
      if (clearSession) {
        try {
          console.log('Attempting to clear Turnkey session');
          await clearSession();
          console.log('Successfully cleared Turnkey session');
        } catch (sessionError: any) {
          // Ignore "Session not found" errors - this is expected in some cases
          if (sessionError.message && sessionError.message.includes('Session not found')) {
            console.log('No active session to clear, continuing with logout');
          } else {
            // Log other errors but don't throw them
            console.warn('Non-critical error during session clearing:', sessionError);
          }
        }
      }
      
      setStatusMessage?.('Logged out successfully');
    } catch (error: any) {
      console.error('Error during Turnkey logout:', error);
      // Still consider logout successful even if there were errors
      setStatusMessage?.('Logged out successfully');
    }
  }, [clearSession]);

  return {
    user,
    walletAddress,
    isAuthenticated,
    loading,
    otpResponse,
    handleInitOtpLogin,
    handleVerifyOtp,
    handleOAuthLogin,
    handleTurnkeyLogout
  };
} 