import { ImageSourcePropType, TextStyle, ViewStyle } from 'react-native';
import { ThreadPost, ThreadUser } from '@/core/thread/components/thread.types';
import { TradeData } from '@/core/shared-ui/TradeCard/TradeCard';
import { NftListingData as ModuleNftListingData } from '@/modules/nft/types';

export type NftListingData = ModuleNftListingData;

// Define more detailed interfaces based on TokenDetailsDrawer expectations
export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export interface NFTListing {
  price?: string | number; // Lamports or SOL - needs conversion in drawer?
  // other listing details...
}

export interface NFTLastSale {
  price?: string | number; // Lamports or SOL - needs conversion in drawer?
  // other sale details...
}

export interface CollectionStats {
  floorPrice?: number; // Assumed SOL
  numListed?: number;
  pctListed?: number;
  volume24h?: string | number; // Assumed lamports
  volume7d?: string | number; // Assumed lamports
  volumeAll?: string | number; // Assumed lamports
  salesAll?: number;
  // other stats...
}

// Extend NFTData with detailed fields
export interface NFTData {
  id: string; // Could be mintAddress or collection ID
  name: string;
  description?: string;
  image: string;
  collectionName?: string;
  mintAddress?: string; // For individual NFTs
  isCollection?: boolean;
  collId?: string; // For collections

  // NFT specific details (optional)
  owner?: string;
  rarityRankTN?: number;
  numMints?: number; // Total items in collection (for rarity context)
  attributes?: NFTAttribute[];
  listing?: NFTListing;
  lastSale?: NFTLastSale;

  // Collection specific details (optional)
  slugDisplay?: string; // Tensor slug
  slugMe?: string; // ME slug
  stats?: CollectionStats;
  tokenCount?: number; // Alternative to numMints
  tensorVerified?: boolean;
  discord?: string;
  twitter?: string;
  website?: string;
}

export interface MessageUser {
  id: string;
  username: string;
  handle?: string;
  avatar?: ImageSourcePropType;
  verified?: boolean;
}

export interface MessageData {
  id: string;
  text?: string;
  user: MessageUser;
  createdAt: string;
  media?: string[];
  isCurrentUser?: boolean;
  status?: 'sent' | 'delivered' | 'read';
  image_url?: string | null;
  additional_data?: {
    tradeData?: TradeData;
    nftData?: NftListingData;
  } | null;
  
  // Message content types
  contentType?: 'text' | 'media' | 'trade' | 'nft' | 'mixed';
  tradeData?: TradeData;
  nftData?: NFTData;
}

export interface MessageBubbleProps {
  message: MessageData | ThreadPost;
  isCurrentUser?: boolean;
  themeOverrides?: Record<string, string>;
  styleOverrides?: Record<string, ViewStyle | TextStyle>;
}

export interface MessageHeaderProps {
  message: MessageData | ThreadPost;
  showAvatar?: boolean;
  onPressUser?: (user: MessageUser | ThreadUser) => void;
}

export interface MessageFooterProps {
  message: MessageData | ThreadPost;
  isCurrentUser?: boolean;
}

export interface ChatMessageProps {
  message: MessageData | ThreadPost;
  currentUser: MessageUser | ThreadUser;
  onPressMessage?: (message: MessageData | ThreadPost) => void;
  themeOverrides?: Record<string, string>;
  styleOverrides?: Record<string, ViewStyle | TextStyle>;
  showHeader?: boolean;
  showFooter?: boolean;
} 