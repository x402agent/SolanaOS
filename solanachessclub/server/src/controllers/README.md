# Controllers Directory

This directory contains the controller functions that handle the business logic between API routes and services. Controllers are responsible for processing incoming requests, interacting with services, and returning appropriate responses.

## Purpose

Controllers serve as an intermediary layer that:
- Separates route definitions from business logic
- Processes and validates incoming request data
- Calls appropriate service functions
- Handles error scenarios
- Formats and returns consistent responses

## Existing Controllers

### `jupiterSwapController.ts`
Manages token swapping operations via Jupiter DEX:
- Quote retrieval
- Swap execution
- Transaction preparation and submission

### `threadController.ts`
Handles social thread-related operations:
- Thread creation
- Thread retrieval and listings
- Thread updates and interactions
- Comment management

### `uploadMetadataController.ts`
Manages the process of uploading and storing metadata:
- Metadata validation
- IPFS storage via Pinata
- Metadata retrieval and linking

## Controller Pattern

Our controllers follow a consistent pattern:

```typescript
export async function controllerFunction(req: Request, res: Response) {
  try {
    // 1. Extract and validate input from request
    const { param1, param2 } = req.body;
    
    // 2. Call service function(s)
    const result = await serviceFunction(param1, param2);
    
    // 3. Return successful response
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // 4. Handle and return error response
    console.error(`Error in controllerFunction:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

## Creating New Controllers

When adding a new controller:

1. Create a file named `[feature]Controller.ts` in this directory
2. Import necessary types and services
3. Implement controller functions following the pattern above
4. Export the functions for use in route files
5. Add appropriate error handling and logging
6. Include proper JSDoc comments for documentation

## Best Practices

- Keep controllers focused on a single responsibility
- Move complex business logic to service functions
- Use meaningful variable names and function signatures
- Implement consistent error handling and response formatting
- Document function parameters and return values
- Validate all incoming request data before processing
- Return appropriate HTTP status codes for different scenarios
- Include comprehensive error messages for debugging
