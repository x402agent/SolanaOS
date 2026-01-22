# Navigation

This directory contains the navigation configuration for the application using React Navigation. It defines the navigation structure, routes, and navigation-related utilities.

## Directory Structure

```
navigation/
├── RootNavigator.tsx     # Root navigation configuration
├── MainTabs.tsx         # Main tab navigation
├── types.ts            # Navigation type definitions
└── utils/             # Navigation utilities
```

## Navigation Structure

The app uses a combination of navigation patterns:

1. **Stack Navigation**:
   - Authentication flow
   - Modal screens
   - Detail views

2. **Tab Navigation**:
   - Main app sections
   - Bottom tab bar
   - Persistent views

3. **Modal Navigation**:
   - Overlay screens
   - Action sheets
   - Popups

## Type Safety

```typescript
// types.ts
export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  Profile: { userId: string };
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Wallet: undefined;
  Social: undefined;
  Profile: undefined;
};
```

## Navigation Setup

```typescript
// RootNavigator.tsx
const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return (
    <Stack.Navigator>
      {!isAuthenticated ? (
        // Auth Stack
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // Main App Stack
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
```

## Navigation Patterns

1. **Type-Safe Navigation**:
```typescript
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type ProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Profile'
>;

export const ProfileButton = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  
  const handlePress = () => {
    navigation.navigate('Profile', { userId: '123' });
  };
  
  return <Button onPress={handlePress} title="View Profile" />;
};
```

2. **Screen Options**:
```typescript
<Stack.Screen
  name="Profile"
  component={ProfileScreen}
  options={{
    headerShown: true,
    headerTitle: 'User Profile',
    headerLeft: () => <BackButton />,
    presentation: 'modal',
  }}
/>
```

3. **Navigation Events**:
```typescript
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    // Handle screen focus
  });

  return unsubscribe;
}, [navigation]);
```

## Best Practices

1. **Type Safety**:
   - Define route parameters
   - Use TypeScript for navigation props
   - Create type-safe navigation hooks

2. **Performance**:
   - Lazy load screens
   - Minimize re-renders
   - Use proper screen options

3. **User Experience**:
   - Consistent navigation patterns
   - Proper back button handling
   - Loading states during navigation

4. **Organization**:
   - Group related screens
   - Clear navigation hierarchy
   - Documented screen flows

## Common Navigation Flows

1. **Authentication Flow**:
```typescript
function AuthNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
```

2. **Tab Navigation**:
```typescript
function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <HomeIcon color={color} />
          ),
        }}
      />
      {/* Other tabs */}
    </Tab.Navigator>
  );
}
```

## Testing Navigation

1. **Mock Navigation**:
```typescript
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('Screen', () => {
  it('should navigate on button press', () => {
    render(<Screen navigation={mockNavigation} />);
    fireEvent.press(screen.getByText('Navigate'));
    expect(mockNavigation.navigate).toHaveBeenCalled();
  });
});
```

2. **Test Navigation State**:
```typescript
it('should show correct screen based on auth state', () => {
  const { getByText } = render(
    <Provider store={store}>
      <RootNavigator />
    </Provider>
  );
  
  expect(getByText('Login')).toBeTruthy();
});
``` 