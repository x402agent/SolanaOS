// FILE: src/components/thread/thread.types.ts
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
  message?: string; // Optional message to display with the trade
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
  userReaction?: string | null; // Current user's reaction to this post
}

export interface ThreadCTAButton {
  label: string;
  onPress: (post: ThreadPost) => void;
  buttonStyle?: StyleProp<ViewStyle>;
  buttonLabelStyle?: StyleProp<TextStyle>;
}
