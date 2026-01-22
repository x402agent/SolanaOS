/**
 * Types related to NFT functionality
 */

/**
 * Interface representing an NFT item
 */
export interface NftItem {
  /** Mint address of the NFT */
  mint: string;
  /** Name of the NFT */
  name: string;
  /** URL to the NFT image */
  image: string;
  /** Collection the NFT belongs to (optional) */
  collection?: string;
  /** Whether the NFT is compressed */
  isCompressed?: boolean;
  /** Price in SOL if listed */
  priceSol?: number;
  /** Additional attributes */
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  /** Description of the NFT */
  description?: string;
  /** Collection ID if this is a collection */
  collId?: string;
  /** If this is a collection listing rather than specific NFT */
  isCollection?: boolean;
  /** Collection description */
  collectionDescription?: string;
}

/**
 * Interface for NFT collection data
 */
export interface CollectionData {
  /** Collection ID */
  collId: string;
  /** Name of the collection */
  name: string;
  /** Description of the collection */
  description?: string;
  /** URL to the collection image */
  imageUri?: string;
  /** Floor price in SOL */
  floorPrice?: number;
  /** Number of items in the collection */
  tokenCount?: number;
  /** Collection statistics */
  stats?: {
    /** Number of items listed for sale */
    numListed?: number;
    /** Percentage of collection listed for sale */
    pctListed?: number;
    /** 24-hour volume in lamports */
    volume24h?: string;
    /** 7-day volume in lamports */
    volume7d?: string;
    /** Total volume in lamports */
    volumeAll?: string;
    /** Total number of sales */
    salesAll?: number;
  };
  /** Verification status on Tensor */
  tensorVerified?: boolean;
  /** Discord URL */
  discord?: string;
  /** Twitter URL */
  twitter?: string;
  /** Website URL */
  website?: string;
  /** ME slug */
  slugMe?: string;
  /** Display slug */
  slugDisplay?: string;
}

/**
 * Interface for NFT listing data in threads
 */
export interface NftListingData {
  /** Mint address of the NFT */
  mint?: string;
  /** Owner wallet address */
  owner?: string;
  /** Price in SOL */
  priceSol?: number;
  /** NFT name */
  name?: string;
  /** NFT image URL */
  image?: string;
  /** If this is a collection listing rather than specific NFT */
  isCollection?: boolean;
  /** Collection ID if this is a collection */
  collId?: string;
  /** Collection name */
  collectionName?: string;
  /** Collection image */
  collectionImage?: string;
  /** Collection description */
  collectionDescription?: string;
  /** Whether the NFT is compressed */
  isCompressed?: boolean;
}

/**
 * Options for fetching NFTs
 */
export interface FetchNFTsOptions {
  /** Provider type */
  providerType?: 'privy' | 'dynamic' | 'turnkey' | 'mwa' | null;
  /** Max number of NFTs to fetch */
  limit?: number;
}

/**
 * Props for NFT listing modal component
 */
export interface NftListingModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Function called when a listing is selected */
  onSelectListing: (item: NftItem) => void;
  /** Items to display in the listing */
  listingItems: NftItem[];
  /** Whether listings are loading */
  loadingListings: boolean;
  /** Error message if fetching failed */
  fetchNftsError: string | null;
  /** Styles from parent component */
  styles?: any;
}

/**
 * Result from NFT collection search
 */
export interface CollectionResult {
  /** Collection ID */
  collId: string;
  /** Name of the collection */
  name: string;
  /** Description of the collection */
  description?: string;
  /** URL to the collection image */
  imageUri?: string;
} 