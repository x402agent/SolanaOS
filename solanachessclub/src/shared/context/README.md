# Context

This directory contains React Context providers that manage global state outside of Redux. These contexts provide a way to share data across components without prop drilling.

## Directory Structure

```
context/
├── DevModeContext.tsx     # Development mode settings context
└── EnvErrorContext.tsx    # Environment error handling context
```

## Context Providers

### DevModeContext

A context provider for managing development mode features and settings. This allows developers to access debug tools and development-specific features across the application.

### EnvErrorContext

Provides error handling related to environment configuration. This context captures and manages environment-related errors, ensuring that the application can gracefully handle configuration issues.

## Best Practices

1. **Context Creation**:
   - Keep contexts focused on a single responsibility
   - Define clear TypeScript interfaces for context values
   - Provide default values that make sense
   - Document context usage and purpose

2. **Context Usage**:
   - Use custom hooks to access context values
   - Handle cases where context might be undefined
   - Memoize complex values to prevent unnecessary re-renders
   - Keep provider components as high in the tree as necessary, but no higher

3. **Performance Considerations**:
   - Split contexts by update frequency to minimize re-renders
   - Use context selectors when possible
   - Consider using `useReducer` for complex state
   - Memoize callbacks and values with `useCallback` and `useMemo`

## Example Context Pattern

```typescript
// 1. Create the context
export interface MyContextType {
  value: string;
  setValue: (value: string) => void;
}

export const MyContext = createContext<MyContextType | undefined>(undefined);

// 2. Create a provider component
export const MyProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [value, setValue] = useState('');
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    value,
    setValue,
  }), [value]);
  
  return (
    <MyContext.Provider value={contextValue}>
      {children}
    </MyContext.Provider>
  );
};

// 3. Create a custom hook for consuming the context
export const useMyContext = () => {
  const context = useContext(MyContext);
  if (context === undefined) {
    throw new Error('useMyContext must be used within a MyProvider');
  }
  return context;
};
```

## Adding New Contexts

1. Create a new file with the name of your context
2. Define the context type with TypeScript
3. Create the context with a meaningful default value or undefined
4. Implement the provider component
5. Create a custom hook for accessing the context
6. Document the purpose and usage of the context
7. Consider adding tests for the context and provider 