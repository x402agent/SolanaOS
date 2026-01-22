import { Router, Request, Response } from "express";
import { deployCollection } from "../../service/metaplex/deployCollection";
import { mintCollectionNFT } from "../../service/metaplex/mintCollectionNFT";
import { PublicKey } from "@solana/web3.js";
import { CollectionOptions, MintCollectionNFTMetadata } from "../../service/metaplex/types";

interface DeployCollectionBody {
  userWalletAddress: string;
  options: CollectionOptions;
}

interface MintNFTBody {
  userWalletAddress: string;
  collectionMint: string;
  metadata: MintCollectionNFTMetadata;
  recipient?: string;
}

const router = Router();

/**
 * Deploy a new NFT collection
 * @param userWalletAddress Address of the user's wallet
 * @param options Collection options including name, URI, royalties, and creators
 */
router.post(
  "/deploy-collection",
  async (
    req: Request<{}, {}, DeployCollectionBody>,
    res: Response
  ) => {
    try {
      const { userWalletAddress, options } = req.body;
      const collectionData = await deployCollection(
        new PublicKey(userWalletAddress),
        options
      );
      res.json(collectionData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Mint a new NFT
 * @param userWalletAddress Address of the user's wallet
 * @param collectionMint Address of the collection's master NFT
 * @param metadata NFT metadata object
 * @param recipient Optional recipient address (defaults to wallet address)
 */
router.post(
  "/mint-nft",
  async (
    req: Request<{}, {}, MintNFTBody>,
    res: Response
  ) => {
    try {
      const { userWalletAddress, collectionMint, metadata, recipient } =
        req.body;
      const nftData = await mintCollectionNFT(
        new PublicKey(userWalletAddress),
        new PublicKey(collectionMint),
        metadata,
        recipient ? new PublicKey(recipient) : undefined
      );
      res.json(nftData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
