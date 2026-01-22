// Screens within the SampleUI Threads feature

// Re-export screens that don't have a conflicting 'styles' export, or if their 'styles' are self-contained.
export * from './feed-screen';
export * from './other-profile-screen';

// Re-export components and alias their 'styles' export to avoid conflicts.
export { ProfileScreen, styles as ProfileScreenStyles } from './profile-screen';
export { PostThreadScreen, styles as PostThreadScreenStyles } from './post-thread-screen';
export { CoinDetailPage, styles as CoinDetailPageStyles } from './coin-detail-page';

// Re-export other specific components like SearchScreen.
export { default as SearchScreen } from './SearchScreen';