# Screens

This directory contains all the screen components for the application. Each screen represents a full-page view that is rendered by the navigation system.

## Directory Structure

The `screens` directory is organized into two main subdirectories: `common` for shared screens and `SampleUI` for example UI implementations.

```
screens/
├── common/
│   ├── DeleteAccountConfirmationScreen.tsx
│   ├── WebViewScreen.tsx
│   ├── index.ts
│   ├── intro-screen/
│   │   ├── IntroScreen.tsx
│   │   └── IntroScreen.styles.ts
│   ├── launhc-modules-screen/  // Note: 'launhc' might be a typo for 'launch'
│   │   ├── LaunchModules.tsx
│   │   └── LaunchModules.styles.ts
│   └── login-screen/
│       ├── LoginScreen.tsx
│       └── LoginScreen.styles.ts
├── SampleUI/
│   ├── index.ts
│   ├── chat/
│   │   ├── index.ts
│   │   ├── chat-list-screen/
│   │   │   ├── ChatListScreen.tsx
│   │   │   ├── ChatListScreen.styles.ts
│   │   │   └── index.ts
│   │   ├── chat-screen/
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── ChatScreen.styles.ts
│   │   │   └── index.ts
│   │   └── user-selection-screen/
│   │       ├── UserSelectionScreen.tsx
│   │       └── index.ts
│   └── Threads/
│       ├── SearchScreen.tsx
│       ├── index.ts
│       ├── coin-detail-page/
│       │   ├── CoinDetailPage.tsx
│       │   ├── CoinDetailPage.style.ts
│       │   └── index.ts
│       ├── feed-screen/
│       │   ├── FeedScreen.tsx
│       │   └── index.ts
│       ├── other-profile-screen/
│       │   ├── OtherProfileScreen.tsx
│       │   └── index.ts
│       ├── post-thread-screen/
│       │   ├── PostthreadScreen.tsx
│       │   ├── PostThreadScreen.style.ts
│       │   └── index.ts
│       └── profile-screen/
│           ├── ProfileScreen.tsx
│           ├── ProfileScreen.styles.ts
│           └── index.ts
└── index.ts                 # Barrel file for all screens
```

## Screen Organization

Each screen or feature within a screen (like those in `SampleUI`) is typically organized into its own directory. This directory might contain:

-   `index.ts`: Barrel file re-exporting the main component and other necessary modules.
-   `[ScreenName].tsx`: The main React component for the screen.
-   `[ScreenName].styles.ts`: Styles specific to the screen, often using `StyleSheet` from React Native or a styling library.
-   Potentially other component-specific files like custom hooks or sub-components.

## Core Screens

### Common Screens (`src/screens/common`)

This directory houses screens that are fundamental to the application's core functionality or are shared across multiple features.

-   **`DeleteAccountConfirmationScreen.tsx`**: A screen to confirm user account deletion.
-   **`WebViewScreen.tsx`**: A generic screen for displaying web content within the app.
-   **`intro-screen/`**: Contains the `IntroScreen.tsx`, likely used for application onboarding or introduction.
-   **`launhc-modules-screen/`**: (Possible typo for "launch") Contains `LaunchModules.tsx`, which might be a dashboard or entry point to different app modules.
-   **`login-screen/`**: Contains `LoginScreen.tsx` for user authentication.

### Sample UI Screens (`src/screens/SampleUI`)

This directory provides examples of more complex UI implementations, serving as a reference or starting point for developers.

#### Chat (`src/screens/SampleUI/chat`)

-   **`chat-list-screen/`**: Displays a list of chat conversations (`ChatListScreen.tsx`).
-   **`chat-screen/`**: The main interface for an individual chat conversation (`ChatScreen.tsx`).
-   **`user-selection-screen/`**: Allows users to select other users, possibly for starting new chats (`UserSelectionScreen.tsx`).

#### Threads (`src/screens/SampleUI/Threads`)

This section seems to implement a social media-like "threads" feature.

-   **`SearchScreen.tsx`**: A screen for searching content within the Threads feature.
-   **`coin-detail-page/`**: Displays details for a specific coin or token (`CoinDetailPage.tsx`).
-   **`feed-screen/`**: Shows a feed of posts or threads (`FeedScreen.tsx`).
-   **`other-profile-screen/`**: Displays the profile of another user (`OtherProfileScreen.tsx`).
-   **`post-thread-screen/`**: Allows users to create new posts or threads (`PostthreadScreen.tsx`).
-   **`profile-screen/`**: Displays the current user's profile (`ProfileScreen.tsx`).

## Barrel Files (`index.ts`)

Barrel files (`index.ts`) are used extensively to simplify imports. Each major directory and subdirectory within `src/screens` typically has an `index.ts` that re-exports its public components and modules. This allows for cleaner import statements in other parts of the application.

For example, instead of:
`import { LoginScreen } from './src/screens/common/login-screen/LoginScreen';`

You can use:
`import { LoginScreen } from './src/screens';` (assuming `LoginScreen` is exported all the way up to the root `screens/index.ts`)

## Best Practices

When developing new screens, please adhere to the following:

1.  **Modularity**: Keep screens focused on a single responsibility. Extract reusable components and logic into shared directories or modules.
2.  **Directory Structure**: Follow the existing pattern of creating a new directory for each screen or distinct feature area.
3.  **Naming Conventions**:
    *   Screen component files and directories: PascalCase (e.g., `MyNewScreen`, `MyNewScreen.tsx`).
    *   Style files: `[ComponentName].styles.ts`.
4.  **TypeScript**: Use TypeScript for all new code to ensure type safety. Define props and state interfaces.
5.  **Styling**: Utilize the established styling patterns (e.g., `StyleSheet` or any project-wide styling library). Keep styles co-located with their components or in dedicated `.styles.ts` files.
6.  **Performance**:
    *   Optimize list rendering (e.g., using `FlatList` with `keyExtractor` and `getItemLayout`).
    *   Memoize components where appropriate using `React.memo`.
    *   Minimize unnecessary re-renders.
    *   Implement loading states and placeholders for a better user experience.
7.  **Navigation**: Integrate screens with the existing navigation setup (likely `react-navigation`). Ensure type safety for route parameters.
8.  **Accessibility (a11y)**: Ensure screens are accessible by providing necessary props like `accessibilityLabel`, `accessibilityHint`, etc.

## Adding New Screens

1.  **Create Directory**: Create a new directory for your screen within `src/screens/common` or `src/screens/SampleUI` (or a new top-level category if appropriate) using PascalCase (e.g., `NewFeatureScreen`).
2.  **Implement Component**: Create `NewFeatureScreen.tsx` and implement your screen component.
3.  **Add Styles**: Create `NewFeatureScreen.styles.ts` for screen-specific styles.
4.  **Create Index File**: Add an `index.ts` in your screen's directory to export the component and its styles (e.g., `export { default as NewFeatureScreen } from './NewFeatureScreen'; export * from './NewFeatureScreen.styles';`).
5.  **Export from Category**: Add your new screen to the `index.ts` of its parent directory (e.g., `src/screens/common/index.ts`).
6.  **Export from Root**: Ensure your screen is ultimately exported from the main `src/screens/index.ts`.
7.  **Navigation**: Add the new screen to your application's navigation configuration.
8.  **Testing**: Write unit and integration tests for the new screen.
9.  **Documentation**: Briefly update this `README.md` if you've added a major new section or screen category. 