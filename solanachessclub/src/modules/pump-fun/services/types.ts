export type CreateAndBuyTokenParams = {
  userPublicKey: string;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  imageUri: string;
  solAmount: number;
  slippageBasisPoints?: bigint;
  solanaWallet: any;
  onStatusUpdate?: (status: string) => void;
};

export type BuyTokenParams = {
  buyerPublicKey: string;
  tokenAddress: string;
  solAmount: number;
  solanaWallet: any;
  onStatusUpdate?: (status: string) => void;
};

export type SellTokenParams = {
  sellerPublicKey: string;
  tokenAddress: string;
  tokenAmount: number;
  solanaWallet: any;
  onStatusUpdate?: (status: string) => void;
};
