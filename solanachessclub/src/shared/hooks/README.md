# Custom Hooks

This directory contains reusable React hooks that encapsulate common logic and stateful operations across the application.

## Directory Structure

```
hooks/
├── useAuth.ts           # Authentication hook
├── useAppNavigation.ts # Navigation utilities
├── useDynamicWalletLogic.ts # Wallet-specific logic
└── index.ts           # Barrel file for exports
```

## Best Practices

1. **Hook Naming**:
   - Prefix with `use` (React hooks convention)
   - Use descriptive, action-oriented names
   - Keep names concise but clear

2. **Implementation**:
   - Follow React hooks rules
   - Handle cleanup in useEffect
   - Memoize callbacks and values
   - Handle loading and error states

3. **Type Safety**:
   - Define proper TypeScript types
   - Use generics when appropriate
   - Document type parameters

4. **Documentation**:
   - Document parameters and return values
   - Include usage examples
   - Document side effects
   - Note any dependencies

## Example Hook Structure

```typescript
/**
 * Hook for managing user authentication state
 * @param options - Configuration options for the hook
 * @returns Authentication state and methods
 * 
 * @example
 * ```tsx
 * const { user, login, logout } = useAuth({
 *   redirectOnSuccess: true
 * });
 * ```
 */
export function useAuth(options?: AuthOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const login = useCallback(async (credentials: Credentials) => {
    try {
      setIsLoading(true);
      // Implementation
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup logic
    };
  }, []);

  return {
    isLoading,
    error,
    login,
  };
}
```

## Current Hooks

- `useAuth`: Manages authentication state and methods
- `useAppNavigation`: Navigation utilities and type-safe navigation
- `useDynamicWalletLogic`: Wallet connection and management
- And more...

## Testing Hooks

1. **Setup**:
```typescript
import { renderHook, act } from '@testing-library/react-hooks';

describe('useAuth', () => {
  it('should handle login', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.login(mockCredentials);
    });
    
    expect(result.current.user).toBeDefined();
  });
});
```

2. **Best Practices**:
   - Test all state transitions
   - Mock external dependencies
   - Test error cases
   - Verify cleanup
   - Test with different parameters

## Adding New Hooks

1. Create a new file with the hook name
2. Define TypeScript interfaces
3. Implement the hook following React rules
4. Add comprehensive documentation
5. Write tests
6. Update the barrel file (index.ts)

## Common Patterns

1. **State Management**:
```typescript
const useCounter = (initialValue = 0) => {
  const [count, setCount] = useState(initialValue);
  
  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);
  
  return { count, increment };
};
```

2. **API Integration**:
```typescript
const useData = (id: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await api.getData(id);
        setData(result);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  return { data, loading };
};
```

3. **Event Handling**:
```typescript
const useEventListener = (eventName: string, handler: (event: Event) => void) => {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event: Event) => savedHandler.current(event);
    window.addEventListener(eventName, eventListener);
    return () => {
      window.removeEventListener(eventName, eventListener);
    };
  }, [eventName]);
};
``` 