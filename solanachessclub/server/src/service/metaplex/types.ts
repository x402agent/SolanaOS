export interface MintCollectionNFTMetadata {
    name: string;
    uri: string;
    sellerFeeBasisPoints?: number;
    creators?: Array<{
        address: string;
        share: number;
    }>;
}

export interface Creator {
    address: string;
    percentage: number;
  }
  
  export interface CollectionOptions {
    name: string;
    uri: string;
    royaltyBasisPoints?: number;
    creators?: Creator[];
  }