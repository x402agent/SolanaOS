/**
 * Profile module type definitions
 */

// Import needed types
import { AssetItem, PortfolioData } from '@/modules/data-module';
import { StyleProp, ViewStyle } from 'react-native';
import { ThreadPost } from '../../thread/types';
import { NftItem } from '@/modules/nft';

// User profile data structure
export interface UserProfileData {
  address: string;
  profilePicUrl: string | null;
  username: string | null;
  description: string | null;
  // Attachment data with coin properties
  attachmentData?: { 
    [key: string]: any;
    coin?: {
      mint: string;
      symbol?: string;
      name?: string;
      image?: string;
      description?: string;
    }
  };
}

// Profile data for management
export interface ProfileData {
  profilePicUrl: string;
  username: string;
  description: string;
  attachmentData?: {
    coin?: {
      mint: string;
      symbol?: string;
      name?: string;
      image?: string;
      description?: string;
    }
  };
}

// Profile component props
export interface ProfileProps {
  isOwnProfile?: boolean;
  user?: UserProfileData;
  posts?: ThreadPost[];
  nfts?: NftItem[];
  loadingNfts?: boolean;
  fetchNftsError?: string | null;
  containerStyle?: object;
  onGoBack?: () => void;
  isScreenLoading?: boolean;
  onDeleteAccountPress?: () => void;
}

// Profile view component props
export interface ProfileViewProps {
  isOwnProfile: boolean;
  user: UserProfileData;
  myPosts: ThreadPost[];
  myNFTs: NftItem[];
  loadingNfts?: boolean;
  fetchNftsError?: string | null;
  onAvatarPress?: () => void;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
  onLogout?: () => void;
  amIFollowing?: boolean;
  areTheyFollowingMe?: boolean;
  onFollowPress?: () => void;
  onUnfollowPress?: () => void;
  followersCount?: number;
  followingCount?: number;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
  onPressPost?: (post: ThreadPost) => void;
  containerStyle?: StyleProp<ViewStyle> | object;
  myActions?: any[];
  loadingActions?: boolean;
  fetchActionsError?: string | null;
  // Portfolio related props
  portfolioData?: PortfolioData;
  onRefreshPortfolio?: () => void;
  refreshingPortfolio?: boolean;
  onAssetPress?: (asset: AssetItem) => void;
  // New loading state prop to prevent flickering
  isLoading?: boolean;
  onEditPost?: (post: ThreadPost) => void;
}

// Extended ProfileViewProps with optional share/logout callbacks
export interface ExtendedProfileViewProps extends ProfileViewProps {
  onEditPost?: (post: ThreadPost) => void;
  onShareProfile?: () => void;
  onLogout?: () => void;
}

// User profile info component props
export interface UserProfileInfoProps {
  /** The user's profile picture URL */
  profilePicUrl: string;
  /** The user's current display name */
  username: string;
  /** The user's Solana wallet address */
  userWallet: string;
  /** Whether this profile belongs to the current user (is own profile) */
  isOwnProfile: boolean;
  /** Callback when user taps the avatar image (e.g. pick a new avatar) */
  onAvatarPress?: () => void;
  /** Callback when user taps "Edit Profile" (open an edit name modal) */
  onEditProfile?: () => void;
  /** Callback when user taps "Share Profile" */
  onShareProfile?: () => void;
  /** Callback when user taps "Logout" */
  onLogout?: () => void;
  /** Optional short text describing the user's bio. We'll show mention highlighting. */
  bioText?: string;
  /** If the current user is following this user */
  amIFollowing?: boolean;
  /** If this user is following the current user */
  areTheyFollowingMe?: boolean;
  /** Called when we tap "Follow" or "Follow Back" */
  onFollowPress?: () => void;
  /** Called when we tap "Unfollow" */
  onUnfollowPress?: () => void;
  /** Follower count for display */
  followersCount?: number;
  /** Following count for display */
  followingCount?: number;
  /** If provided, pressing follower count triggers onPressFollowers */
  onPressFollowers?: () => void;
  /** If provided, pressing following count triggers onPressFollowing */
  onPressFollowing?: () => void;
  /**
   * Attachment data from the DB. We specifically care about:
   *  { coin?: {
   *       mint: string;
   *       symbol?: string;
   *       name?: string;
   *       image?: string;       // stored from Helius or user-provided
   *       description?: string; // user-provided description
   *  } }
   */
  attachmentData?: {
    coin?: {
      mint: string;
      symbol?: string;
      name?: string;
      image?: string;
      description?: string;
    };
  };
}

// Profile tabs component props
export interface ProfileTabsProps {
  myPosts: ThreadPost[];
  myNFTs: NftItem[];
  loadingNfts?: boolean;
  fetchNftsError?: string | null;
  myActions: any[];
  loadingActions?: boolean;
  fetchActionsError?: string | null;
  onPressPost?: (post: ThreadPost) => void;
  portfolioData?: PortfolioData;
  onRefreshPortfolio?: () => void;
  refreshingPortfolio?: boolean;
  onAssetPress?: (asset: AssetItem) => void;
  onEditPost?: (post: ThreadPost) => void;
}

// Actions page component props
export interface ActionsPageProps {
  myActions: Action[];
  loadingActions?: boolean;
  fetchActionsError?: string | null;
  walletAddress?: string;
}

// Wallet action interface for ProfileView component
export interface WalletAction {
  type: string;
  timestamp: string;
  // Add other expected fields based on usage in ActionsPage
  data?: any;
  metadata?: any;
}

// Actions related types
export interface RawTokenAmount {
  tokenAmount: string;
  decimals: number;
}

export interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenName?: string;
  symbol?: string;
  decimals?: number;
}

export interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

export interface TokenDetail {
  userAccount: string;
  tokenAccount: string;
  mint: string;
  rawTokenAmount: RawTokenAmount;
}

export interface SwapEvent {
  tokenInputs?: TokenDetail[];
  tokenOutputs?: TokenDetail[];
  tokenFees?: TokenDetail[];
  nativeInput?: {account: string; amount: string | number};
  nativeOutput?: {account: string; amount: string | number};
  nativeFees?: Array<{account: string; amount: string | number}>;
  innerSwaps?: any[];
}

export interface TransactionEvents {
  nft?: any;
  swap?: SwapEvent;
  compressed?: any;
  distributeCompressionRewards?: {amount: number};
  setAuthority?: any;
}

/**
 * Action data model representing a wallet transaction/activity
 * Combined from both profileActionsUtils.ts and profileActions.ts
 */
export interface Action {
  id?: string;
  signature?: string;
  slot?: number | string;
  type?: string;
  timestamp: number;
  description?: string;
  amount?: number;
  symbol?: string;
  transactionType?: string;
  status?: 'success' | 'failed';
  events?: TransactionEvents;
  source?: string;
  fee?: number;
  feePayer?: string;
  instructions?: any[];
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
    tokenName?: string;
    symbol?: string;
  }>;
  accountData?: Array<{
    account: string;
    name?: string;
    nativeBalanceChange?: number;
    // other account properties
  }>;
  // Enriched data properties for displaying transaction info
  enrichedData?: {
    direction: 'IN' | 'OUT' | 'NEUTRAL';
    counterparty?: string;
    swapType?: string;
    inputSymbol?: string;
    outputSymbol?: string;
    inputAmount?: number;
    outputAmount?: number;
    transferType?: string;
    amount?: number;
    tokenSymbol?: string;
    decimals?: number;
  };
  enrichedType?: string;
}
