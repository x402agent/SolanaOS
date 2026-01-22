# Thread Module

The The Thread module provides a comprehensive set of components, hooks, services, and utilities for implementing a social media-style thread or feed functionality within your application. It is designed to be modular, customizable, and easy to integrate.

## Module Structure

The module is organized into the following main directories:

```
src/core/thread/
├── components/            # Reusable UI components for threads and posts
│   ├── post/              # Components specific to individual post rendering (Header, Body, Footer, CTA)
│   ├── sections/          # Components for different content types within a post (Text, Image, Video, Poll, Trade, NFT)
│   ├── retweet/           # Components related to retweeting functionality (Preview, Modal, Drawer)
│   ├── trade/             # Components for sharing and displaying trades (Share Modal, Past Swaps)
│   ├── thread-ancestors/  # Component for displaying parent posts in a reply chain
│   ├── thread-composer/   # Component for creating new posts or replies
│   ├── thread-container/  # Main container component for rendering a thread
│   └── thread-item/       # Component for rendering a single item in a thread
├── hooks/                 # Custom React hooks for thread-related logic (e.g., `useThread`, `useThreadAnimations`)
├── services/              # Functions for interacting with backend APIs or data sources (e.g., `createPost`, `fetchPosts`)
├── types/                 # TypeScript type definitions for all data structures used within the module
├── utils/                 # Utility functions for common tasks (e.g., `gatherAncestorChain`, `mergeStyles`)
└── index.ts               # Main barrel file for exporting all public APIs of the module
```

## Core Components

- **`Thread`**: The main container component that renders a list of posts. It handles fetching and displaying root posts and integrates the `ThreadComposer`.
- **`ThreadItem`**: Renders a single post within a thread, including its header, body, footer, and any CTAs. It also handles the display of retweets and replies.
- **`ThreadComposer`**: A rich text editor for creating new posts or replies. Supports text, image attachments, NFT listings, and trade sharing.
- **`ThreadAncestors`**: Displays the chain of parent posts when viewing a reply, providing context.
- **`EditPostModal`**: A modal for editing the content of an existing post.
- **`ThreadEditModal`**: (Potentially an older or alternative edit modal, review usage).
- **`FeedSkeleton`**: A skeleton loader component to display while feed content is loading.

### Post Sub-Components

- **`PostHeader`**: Renders the top part of a post, including user avatar, username, handle, timestamp, and action menu (edit/delete).
- **`PostBody`**: Renders the main content of a post by iterating through its sections and using the appropriate section-specific component.
- **`PostFooter`**: Renders the bottom part of a post, including action icons (comment, retweet, react, bookmark) and their counts.
- **`PostCTA`**: Renders call-to-action buttons for posts containing trades or NFT listings (e.g., "Copy Trade", "Buy NFT").

### Section Components

These components render specific types of content within a `PostBody`:

- `SectionTextOnly`
- `SectionTextImage`
- `SectionTextVideo`
- `SectionPoll`
- `SectionTrade` (integrates `TradeCard` from shared-ui)
- `SectionNftListing` (integrates `NftDetailsSection` from the NFT module)

### Retweet Components

- **`RetweetPreview`**: Displays a preview of a retweeted post.
- **`RetweetModal`**: A modal for creating a quote retweet (adding a comment).
- **`RetweetDrawer`**: A bottom drawer offering options to repost directly or quote.

### Trade Components

- **`ShareTradeModal`**: A modal allowing users to select and share past trades from their transaction history.
- **`PastSwapsTab` / `PastSwapItem`**: Components used within `ShareTradeModal` to display a list of historical swaps.

## Hooks

- **`useThread`**: (Example) A custom hook to manage thread data, including fetching, adding, and removing posts. (Actual implementation might vary, check `src/core/thread/hooks/`)
- **`useThreadAnimations`**: (Example) A hook for managing animations related to thread interactions.

## Services

The `services` directory contains functions for backend interactions, such as:

- `createPost(postData)`
- `updatePost(postId, updates)`
- `deletePost(postId)`
- `fetchPosts(filters)`
- `addReaction(postId, reactionType)`
- `createRetweet(originalPostId, quoteText)`
- `threadImageService.ts`: Service for uploading images related to threads.

## Types

All TypeScript interfaces and type definitions for the Thread module are centralized in `src/core/thread/types/index.ts`. Key types include:

- `ThreadPost`: Defines the structure of a single post.
- `ThreadUser`: Defines the structure of a user associated with a post.
- `ThreadSection`: Defines the structure for different content sections within a post (text, image, video, trade, NFT, poll).
- Props interfaces for all components (e.g., `ThreadProps`, `ThreadItemProps`).

## Utilities

The `utils` directory provides helper functions for various tasks:

- `gatherAncestorChain(postId, allPosts)`: Builds the parent chain for a reply.
- `mergeStyles(baseStyles, ...overrides)`: Merges multiple StyleSheet objects.
- Other common utility functions for post manipulation or data transformation.

## Usage Example

To integrate the Thread module into a screen:

```tsx
import { Thread, useThread, ThreadUser, ThreadPost } from '@/core/thread'; // Assuming @ is an alias for src
import React, { useState, useEffect } from 'react';

// Placeholder for current user data
const currentUser: ThreadUser = {
  id: 'user123',
  username: 'Current User',
  handle: '@currentUser',
  avatar: require('@/assets/images/default-avatar.png'), // Replace with actual path or URI
  verified: true,
};

// Placeholder for fetching initial posts
async function getInitialPosts(): Promise<ThreadPost[]> {
  // Replace with actual API call or data source
  return []; 
}

function ThreadScreen() {
  const [rootPosts, setRootPosts] = useState<ThreadPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Example of using a custom hook (if useThread is structured this way)
  // const { posts, addPost, removePost } = useThread(initialPostsFromApi);

  useEffect(() => {
    getInitialPosts().then(posts => {
      setRootPosts(posts);
      setLoading(false);
    });
  }, []);

  const handlePostCreated = () => {
    // Logic to refetch posts or update the list
    console.log('New post created, refresh feed!');
    getInitialPosts().then(posts => setRootPosts(posts));
  };

  const handlePostPress = (post: ThreadPost) => {
    console.log('Post pressed:', post.id);
    // Navigate to post details screen, etc.
  };

  const handleUserPress = (user: ThreadUser) => {
    console.log('User pressed:', user.id);
    // Navigate to user profile screen, etc.
  };

  if (loading) {
    // return <FeedSkeleton count={5} />; // Or use FeedSkeleton if available and suitable
    return <Text>Loading posts...</Text>;
  }

  return (
    <Thread
      rootPosts={rootPosts}
      currentUser={currentUser}
      onPostCreated={handlePostCreated}
      onPressPost={handlePostPress}
      onPressUser={handleUserPress}
      // You can also pass styleOverrides, themeOverrides, etc.
    />
  );
}

export default ThreadScreen;
```

## Contributing

When contributing to the Thread module, please adhere to the following guidelines:

- Maintain a clear separation of concerns between components, hooks, services, types, and utilities.
- Place new UI components within the appropriate subdirectory in `components/`.
- Add new custom hooks to the `hooks/` directory.
- Implement API interaction logic within the `services/` directory.
- Define all new types in `types/index.ts`.
- Add reusable helper functions to `utils/index.ts`.
- Ensure components are modular and primarily focused on UI rendering, delegating complex logic to hooks or services.
- Follow established naming conventions and coding styles.
- Write unit tests for new functionalities and components.
