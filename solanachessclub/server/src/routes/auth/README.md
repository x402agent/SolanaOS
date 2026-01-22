# Authentication Routes

This directory contains Express.js routes related to user authentication and authorization for the Solana App Kit server. These endpoints handle wallet authentication, session management, and user authorization.

## API Endpoints

### Wallet Authentication

- **POST `/api/auth/wallet/connect`**: Connect a wallet to an account
  - Verifies wallet ownership via signed message
  - Creates or updates user account with wallet address
  - Returns authentication token

- **POST `/api/auth/wallet/verify`**: Verify wallet signature
  - Validates that a message was signed by the specified wallet
  - Used for authentication and transaction approval

### Session Management

- **POST `/api/auth/session/create`**: Create a new session
  - Establishes authenticated session for a user
  - Returns session token with expiration

- **GET `/api/auth/session/validate`**: Validate an existing session
  - Checks if session token is valid and not expired
  - Returns user information if session is valid

- **POST `/api/auth/session/refresh`**: Refresh a session token
  - Extends session validity
  - Returns new session token

- **POST `/api/auth/session/revoke`**: Revoke a session
  - Invalidates current session token
  - Logs user out of the system

### User Registration

- **POST `/api/auth/register`**: Register a new user
  - Creates a new user account
  - Supports multiple registration methods
  - Returns authentication token upon successful registration

### Authorization

- **GET `/api/auth/permissions`**: Get user permissions
  - Returns permissions associated with the authenticated user
  - Used for authorization checks in protected routes

- **POST `/api/auth/verify-ownership`**: Verify asset ownership
  - Verifies that a user owns a specific asset
  - Used for access control to asset-specific operations

## Middleware

This directory also includes authentication middleware used throughout the application:

- **`requireAuth.ts`**: Middleware to ensure a route is only accessible by authenticated users
- **`requireWallet.ts`**: Middleware to ensure a route is only accessible by users with connected wallets
- **`requirePermission.ts`**: Middleware to check specific permissions

## Implementation Pattern

Routes follow a consistent implementation pattern:

```typescript
import express, { Request, Response } from 'express';
import { authController } from '../../controllers/authController';

const router = express.Router();

router.post('/endpoint', async (req: Request, res: Response) => {
  try {
    const result = await authController.functionName(req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in auth endpoint:', error);
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
});

export default router;
```

## Security Considerations

The authentication routes implement several security measures:

- Secure handling of wallet signatures
- Token-based authentication
- Session expiration and renewal
- HTTPS-only cookies
- CSRF protection
- Rate limiting for sensitive operations

## Turnkey Integration

The authentication system integrates with Turnkey API for enhanced wallet security:

- Secure key management
- Multi-device support
- Hardware security module (HSM) integration

## Best Practices

When working with authentication routes:

1. Always use HTTPS in production
2. Implement proper validation for all input
3. Use appropriate HTTP status codes for different error conditions
4. Follow the principle of least privilege for permissions
5. Implement rate limiting to prevent brute force attacks
6. Log authentication events for audit purposes
7. Use secure, HTTP-only cookies for session tokens 