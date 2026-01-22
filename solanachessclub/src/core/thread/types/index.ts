import {
  ImageSourcePropType,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';

export type ThreadSectionType =
  | 'TEXT_ONLY'
  | 'TEXT_IMAGE'
  | 'TEXT_VIDEO'
  | 'TEXT_TRADE'
  | 'POLL'
  | 'NFT_LISTING';

export interface NftListingData {
  mint?: string;  // Now optional since we might only have collection data
  owner: string | null;
  name?: string;
  image?: string;
  priceSol?: number;
  collId?: string;  // Collection ID for floor buying
  isCollection?: boolean; // Flag to indicate if this is a collection listing
  collectionName?: string;
  collectionImage?: string;
  collectionDescription?: string;
}

export interface TradeData {
  inputMint: string;
  outputMint: string;
  aggregator?: string;
  inputSymbol: string;
  inputQuantity: string;
  inputUsdValue?: string;
  outputSymbol: string;
  outputQuantity: string;
  outputUsdValue?: string;
  inputAmountLamports?: string;
  outputAmountLamports?: string;
  executionTimestamp?: number; // Add timestamp for when the trade was executed
}


export interface PollData {
  question: string;
  options: string[];
  votes: number[];
}

export interface ThreadSection {
  id: string | null;
  type: ThreadSectionType;
  text?: string;
  imageUrl?: ImageSourcePropType;
  videoUrl?: string;
  tradeData?: TradeData;
  pollData?: PollData;
  listingData?: NftListingData;
}

export interface ThreadUser {
  id: string;
  username: string;
  handle: string;
  avatar: ImageSourcePropType;
  verified?: boolean;
}

export interface ThreadPost {
  id: string;
  parentId?: string | null;
  user: ThreadUser;
  sections: ThreadSection[];
  createdAt: string;
  replies: ThreadPost[];
  reactionCount: number;
  retweetCount: number;
  quoteCount: number;
  reactions?: { [key: string]: number };
  retweetOf?: ThreadPost | null;
}

export interface ThreadCTAButton {
  label: string;
  onPress: (post: ThreadPost) => void;
  buttonStyle?: StyleProp<ViewStyle>;
  buttonLabelStyle?: StyleProp<TextStyle>;
}

// Component props types
export interface ThreadProps {
  /** Array of root-level posts to display in the thread */
  rootPosts: ThreadPost[];
  /** Current user information */
  currentUser: ThreadUser;
  /** Whether to show the thread header */
  showHeader?: boolean;
  /** Callback fired when a new post is created */
  onPostCreated?: () => void;
  /** Whether to hide the post composer */
  hideComposer?: boolean;
  /** Callback fired when a post is pressed */
  onPressPost?: (post: ThreadPost) => void;
  /** Array of call-to-action buttons to display */
  ctaButtons?: ThreadCTAButton[];
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  styleOverrides?: { [key: string]: object };
  userStyleSheet?: { [key: string]: object };
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Callback fired when the user's avatar/username is pressed
   */
  onPressUser?: (user: ThreadUser) => void;
  /**
   * If true, do NOT show sub replies or reply composers within each post
   * (used for feed, or anywhere we only want a preview).
   */
  disableReplies?: boolean;
  /**
   * Scroll UI context for hiding/showing tab bar based on scroll direction
   */
  scrollUI?: {
    hideTabBar: () => void;
    showTabBar: () => void;
  };
}

export interface ThreadItemProps {
  /** The post to display. */
  post: ThreadPost;
  /** The current logged-in user. */
  currentUser: ThreadUser;
  /** An array of root-level posts; used to gather ancestor info. */
  rootPosts: ThreadPost[];
  /** Depth in the reply hierarchy (for optional styling). */
  depth?: number;
  /** Invoked if a post is pressed, e.g. to navigate to PostThreadScreen. */
  onPressPost?: (post: ThreadPost) => void;
  /** Array of custom CTA buttons to render below the post body. */
  ctaButtons?: ThreadCTAButton[];
  /** Theming overrides. */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific keys in the default style. */
  styleOverrides?: { [key: string]: object };
  /** A user-provided stylesheet that merges with internal styles. */
  userStyleSheet?: { [key: string]: object };
  /**
   * Invoked if the user's avatar/username is pressed (e.g., to open a profile).
   */
  onPressUser?: (user: ThreadUser) => void;
  /**
   * If true, replies inside this post are hidden.
   */
  disableReplies?: boolean;
} 