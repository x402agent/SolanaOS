// File: src/routes/auth/turnkeyAuthRoutes.ts
import express, { Request, Response, Router } from 'express';
import dotenv from 'dotenv';
import { DEFAULT_ETHEREUM_ACCOUNTS, Turnkey } from '@turnkey/sdk-server';
import { decode, JwtPayload } from 'jsonwebtoken';

dotenv.config();

const router: Router = express.Router();

// Turnkey configuration from environment variables
const turnkeyConfig = {
  // Use TURNKEY_API_URL instead of TURNKEY_BASE_URL to match .env file
  apiBaseUrl: process.env.TURNKEY_API_URL && !process.env.TURNKEY_API_URL.startsWith('http') 
    ? `https://${process.env.TURNKEY_API_URL}` 
    : process.env.TURNKEY_API_URL || 'https://api.turnkey.com',
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID || '',
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY || '',
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY || '',
};

console.log("Turnkey API Base URL:", turnkeyConfig.apiBaseUrl);
console.log("Turnkey Organization ID:", turnkeyConfig.defaultOrganizationId);

// Create Turnkey client
const turnkey = new Turnkey(turnkeyConfig).apiClient();

// JWT decoding utility
const decodeJwt = (credential: string): JwtPayload | null => {
  const decoded = decode(credential);

  if (decoded && typeof decoded === 'object' && 'email' in decoded) {
    return decoded as JwtPayload;
  }

  return null;
};

/**
 * Route to get a sub-organization ID based on a filter
 */
router.post('/getSubOrgId', async (req: any, res: any) => {
  try {
    const { filterType, filterValue } = req.body;
    
    if (!filterType || !filterValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    const { organizationIds } = await turnkey.getSubOrgIds({
      filterType,
      filterValue,
    });

    return res.json({
      success: true,
      organizationId: organizationIds[0] || turnkeyConfig.defaultOrganizationId,
    });
  } catch (error: any) {
    console.error('Error in getSubOrgId:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get Sub Org ID' 
    });
  }
});

/**
 * Route to initialize OTP authentication
 */
router.post('/initOtpAuth', async (req: any, res: any) => {
  try {
    const { otpType, contact } = req.body;
    
    if (!otpType || !contact) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    let organizationId = turnkeyConfig.defaultOrganizationId;
    console.log("organizationId", organizationId);
    console.log("otpType", otpType);
    console.log("contact", contact);
    // Check if user already exists
    const { organizationIds } = await turnkey.getSubOrgIds({
      filterType: otpType === "OTP_TYPE_EMAIL" ? "EMAIL" : "PHONE_NUMBER",
      filterValue: contact,
    });
    console.log("organizationIds", organizationIds);
    if (organizationIds.length > 0) {
      organizationId = organizationIds[0];
    } else {
      // Create a new sub-organization if user doesn't exist
      const subOrgResult = await createSubOrg(
        otpType === "OTP_TYPE_EMAIL" ? { email: contact } : { phone: contact }
      );
      organizationId = subOrgResult.subOrganizationId;
    }

    // Initialize OTP authentication
    const result = await turnkey.initOtpAuth({
      organizationId,
      otpType,
      contact,
    });

    return res.json({
      success: true,
      otpId: result.otpId,
      organizationId,
    });
  } catch (error: any) {
    console.error('Error in initOtpAuth:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to initialize OTP authentication' 
    });
  }
});

/**
 * Route to complete OTP authentication
 */
router.post('/otpAuth', async (req: any, res: any) => {
  try {
    const {
      otpId,
      otpCode,
      organizationId,
      targetPublicKey,
      expirationSeconds = '3600',
      invalidateExisting = false,
    } = req.body;
    
    if (!otpId || !otpCode || !organizationId || !targetPublicKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    console.log(`Processing OTP verification: otpId=${otpId}, code format=${typeof otpCode}, code length=${otpCode.length}`);
    
    // Ensure the OTP code format is correct (string)
    const normalizedOtpCode = String(otpCode).trim();
    
    // Log the sanitized input for debugging
    console.log(`Normalized OTP code: ${normalizedOtpCode}`);

    try {
      const result = await turnkey.otpAuth({
        otpId,
        otpCode: normalizedOtpCode,
        organizationId,
        targetPublicKey,
        expirationSeconds,
        invalidateExisting,
      });

      console.log('OTP verification successful');
      
      return res.json({
        success: true,
        credentialBundle: result.credentialBundle,
      });
    } catch (otpError: any) {
      console.error('Turnkey OTP API error:', otpError);
      
      // Provide more specific error message based on the error
      let errorMessage = 'Failed to authenticate with verification code';
      
      if (otpError.message && otpError.message.includes('invalid otp')) {
        errorMessage = 'Invalid verification code, please check and try again';
      } else if (otpError.message && otpError.message.includes('expired')) {
        errorMessage = 'Verification code has expired, please request a new one';
      }
      
      return res.status(400).json({ 
        success: false, 
        error: errorMessage
      });
    }
  } catch (error: any) {
    console.error('Error in otpAuth:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to authenticate with verification code' 
    });
  }
});

/**
 * Route for OAuth login (Google, Apple)
 */
router.post('/oAuthLogin', async (req: any, res: any) => {
  try {
    const { oidcToken, providerName, targetPublicKey, expirationSeconds = '3600' } = req.body;
    
    if (!oidcToken || !providerName || !targetPublicKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    let organizationId = turnkeyConfig.defaultOrganizationId;

    // Check if user exists
    const { organizationIds } = await turnkey.getSubOrgIds({
      filterType: "OIDC_TOKEN",
      filterValue: oidcToken,
    });

    if (organizationIds.length > 0) {
      organizationId = organizationIds[0];
    } else {
      // Create a new sub-organization if user doesn't exist
      const subOrgResult = await createSubOrg({
        oauth: { oidcToken, providerName }
      });
      organizationId = subOrgResult.subOrganizationId;
    }

    // Authenticate with OAuth
    const oauthResponse = await turnkey.oauth({
      organizationId,
      oidcToken,
      targetPublicKey,
      expirationSeconds,
    });

    return res.json({
      success: true,
      credentialBundle: oauthResponse.credentialBundle,
    });
  } catch (error: any) {
    console.error('Error in oAuthLogin:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to authenticate with OAuth' 
    });
  }
});

/**
 * Helper function to create a sub-organization
 */
async function createSubOrg(params: {
  email?: string;
  phone?: string;
  passkey?: {
    challenge: string;
    attestation: any;
  };
  oauth?: {
    providerName: string;
    oidcToken: string;
  };
}) {
  const { email, phone, passkey, oauth } = params;

  // Configure authenticators if passkey is provided
  const authenticators = passkey
    ? [
        {
          authenticatorName: "Passkey",
          challenge: passkey.challenge,
          attestation: passkey.attestation,
        },
      ]
    : [];

  // Configure OAuth providers if OAuth is provided
  const oauthProviders = oauth
    ? [
        {
          providerName: oauth.providerName,
          oidcToken: oauth.oidcToken,
        },
      ]
    : [];

  // Extract user email from OAuth token if available
  let userEmail = email;
  if (oauth) {
    const decoded = decodeJwt(oauth.oidcToken);
    if (decoded?.email) {
      userEmail = decoded.email;
    }
  }

  // Create a name for the sub-organization
  const userPhoneNumber = phone;
  const subOrganizationName = `Sub Org - ${email || phone || 'OAuth User'}`;
  const userName = userEmail ? userEmail.split("@")[0] || userEmail : "User";

  // Create the sub-organization
  const result = await turnkey.createSubOrganization({
    organizationId: turnkeyConfig.defaultOrganizationId,
    subOrganizationName,
    rootUsers: [
      {
        userName,
        userEmail,
        userPhoneNumber,
        oauthProviders,
        authenticators,
        apiKeys: [],
      },
    ],
    rootQuorumThreshold: 1,
    wallet: {
      walletName: "Default Wallet",
      accounts: DEFAULT_ETHEREUM_ACCOUNTS,
    },
  });

  return { subOrganizationId: result.subOrganizationId };
}

export default router; 