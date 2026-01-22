# State Management

This directory contains the Redux state management setup using Redux Toolkit. It follows a feature-based structure with each feature having its own slice of state.

## Directory Structure

```
state/
├── store.ts              # Redux store configuration
├── auth/                 # Authentication state
│   ├── reducer.ts       # Auth slice reducer
│   └── selectors.ts    # Auth state selectors
├── thread/             # Thread feature state
└── transaction/       # Transaction state
```

## State Organization

The application state is organized into feature slices:

- **auth**: Authentication state and user information
- **thread**: Social thread data and interactions
- **transaction**: Transaction history and status

## Best Practices

1. **State Structure**:
   - Keep state normalized
   - Avoid redundant data
   - Use proper TypeScript types
   - Document state shape

2. **Actions**:
   - Use Redux Toolkit's `createSlice`
   - Define action types clearly
   - Use meaningful action names
   - Document action payloads

3. **Selectors**:
   - Use memoized selectors with `createSelector`
   - Keep selectors focused
   - Document selector usage
   - Consider performance implications

4. **Side Effects**:
   - Use Redux Thunk for async operations
   - Handle errors properly
   - Document async flows
   - Test async behavior

## Example Slice Structure

```typescript
// types.ts
export interface FeatureState {
  data: Record<string, DataItem>;
  loading: boolean;
  error: string | null;
}

// slice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState: FeatureState = {
  data: {},
  loading: false,
  error: null,
};

const featureSlice = createSlice({
  name: 'feature',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    // ... more reducers
  },
});

// selectors.ts
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../store';

export const selectFeatureData = (state: RootState) => state.feature.data;
```

## Using the Store

1. **Accessing State**:
```typescript
import { useSelector } from 'react-redux';
import { selectFeatureData } from './selectors';

const Component = () => {
  const data = useSelector(selectFeatureData);
  // ...
};
```

2. **Dispatching Actions**:
```typescript
import { useDispatch } from 'react-redux';
import { actions } from './slice';

const Component = () => {
  const dispatch = useDispatch();
  
  const handleAction = () => {
    dispatch(actions.setLoading(true));
  };
};
```

## Adding New State

1. Create a new directory for the feature
2. Define TypeScript interfaces
3. Create the slice with reducers
4. Add selectors
5. Add to root reducer
6. Document the new state

## Performance Considerations

- Use proper memoization
- Avoid unnecessary re-renders
- Keep state granular
- Use proper TypeScript types
- Consider using RTK Query for API calls

## Testing

- Test reducers
- Test selectors
- Test async operations
- Mock API calls
- Use proper test utilities 