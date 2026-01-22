# Routes Directory

This directory contains all the Express.js route definitions for the Solana App Kit server. Routes define the API endpoints that clients can interact with and connect them to the appropriate controller functions.

## Directory Structure

The routes are organized by feature in subdirectories and individual files:

```
routes/
├── aura/          # Aura-related endpoints
├── auth/          # Authentication and authorization endpoints
├── feed/          # Social feed endpoints
├── pumpfun/       # PumpFun launch endpoints
├── swap/          # Swap-related endpoints (Jupiter, PumpSwap)
├── tokenmill/     # TokenMill functionality endpoints
└── user/          # User profile endpoints
```

## Route Categories

### TokenMill Routes (`tokenmill/`)

TokenMill-related endpoints for token creation and management:

- Token creation and badge minting
- Market creation and configuration
- Token swapping
- Staking and vesting
- Market graduation and asset retrieval

### Authentication Routes (`auth/`)

Endpoints handling user authentication and authorization:

- User signup and login
- Token validation
- Session management
- Wallet authentication

### User Routes (`user/`)

Endpoints for user profile management:

- Profile creation and retrieval
- Profile updates
- User settings
- Wallet connection

### Feed Routes (`feed/`)

Social feed related endpoints:

- Thread creation and retrieval
- Thread interactions
- Thread listing and filtering
- Thread image operations

### Swap Routes (`swap/`)

Endpoints for token swap operations:

- Jupiter DEX integration
- PumpSwap integration
- Quote retrieval
- Swap execution

### PumpFun Routes (`pumpfun/`)

PumpFun token launch endpoints:

- Launch configuration
- Participation
- Status retrieval
- Launch statistics

### Aura Routes (`aura/`)

Aura-specific endpoints:

- Aura data retrieval
- Aura interactions
- Configuration endpoints

## Route Implementation Pattern

Routes follow a consistent implementation pattern:

```typescript
import express, { Request, Response } from 'express';
import { controllerFunction } from '../controllers/featureController';

const router = express.Router();

/**
 * @route   POST /feature/endpoint
 * @desc    Description of what this endpoint does
 * @access  Public/Private
 */
router.post('/endpoint', async (req: Request, res: Response) => {
  try {
    // Call controller function
    const result = await controllerFunction(req.body);
    
    // Return successful response
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle error
    console.error('Error in endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## Route Registration

All routes are registered in the main application in `index.ts`:

```typescript
// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import tokenmillRoutes from './routes/tokenmill';
// ... other imports

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tokenmill', tokenmillRoutes);
// ... other route registrations
```

## Adding New Routes

To add new routes:

1. Determine if the route belongs in an existing subdirectory or needs a new one
2. Create a new file following the naming convention `featureRoutes.ts`
3. Import necessary controllers and middleware
4. Create an Express Router instance
5. Define your route handlers with proper error handling
6. Document each endpoint with comments explaining its purpose
7. Export the router
8. Import and mount the router in `index.ts`

## Best Practices

- Group related endpoints in the same router file or subdirectory
- Use descriptive route paths that follow RESTful conventions
- Implement consistent error handling
- Validate request data before processing
- Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- Document all endpoints with comments
- Add appropriate middleware for authentication where needed
- Return consistent response formats
- Use proper HTTP status codes
