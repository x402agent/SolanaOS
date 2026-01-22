import { createCollection, ruleSet } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";
import {
  toWeb3JsInstruction,
  toWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { Transaction, PublicKey } from "@solana/web3.js";
import { initUmi } from "./initUmi";
import type { CollectionOptions } from "./types";
import { getConnection } from "../../utils/connection";

/**
 * Deploy a new NFT collection
 * @param userWalletAddress Address of the user's wallet
 * @param options Collection options including name, URI, royalties, and creators
 * @returns Object containing collection address and the base64 encoded transaction to sign and send.
 */
export async function deployCollection(
  userWalletAddress: PublicKey,
  options: CollectionOptions,
) {
  try {
    // Initialize Umi
    const umi = initUmi(userWalletAddress);
    const connection = getConnection();
    // Generate collection signer
    const collectionSigner = generateSigner(umi);

    // Format creators if provided
    const formattedCreators = options.creators?.map((creator) => ({
      address: publicKey(creator.address),
      percentage: creator.percentage,
    })) || [
      {
        address: publicKey(userWalletAddress.toString()),
        percentage: 100,    
      },
    ];

    // Create collection
    const ixs = createCollection(umi, {
      collection: collectionSigner,
      name: options.name,
      uri: options.uri,
      plugins: [
        {
          type: "Royalties",
          basisPoints: options.royaltyBasisPoints || 500, 
          creators: formattedCreators,
          ruleSet: ruleSet("None"),
        },
      ],
    })
      .getInstructions()
      .map((i) => toWeb3JsInstruction(i));
    const tx = new Transaction().add(...ixs);

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userWalletAddress;
    tx.partialSign(toWeb3JsKeypair(collectionSigner));

    const serializedTx = tx.serialize();
    const base64Tx = Buffer.from(serializedTx).toString('base64');

    return {
      collectionAddress: toWeb3JsPublicKey(collectionSigner.publicKey),
      transaction: base64Tx,
    };
  } catch (error: any) {
    throw new Error(`Collection deployment failed: ${error.message}`);
  }
}
