import { create, mplCore } from "@metaplex-foundation/mpl-core";
import { fetchCollection } from "@metaplex-foundation/mpl-core";
import { generateSigner } from "@metaplex-foundation/umi";
import {
    fromWeb3JsPublicKey,
    toWeb3JsInstruction,
    toWeb3JsKeypair,
    toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { initUmi } from "./initUmi";
import { getConnection } from "../../utils/connection";
import { MintCollectionNFTMetadata } from "./types";

/**
 * Mint a new NFT as part of an existing collection
 * @param userWalletAddress Address of the user's wallet
 * @param collectionMint Address of the collection's master NFT
 * @param metadata NFT metadata object
 * @param recipient Optional recipient address (defaults to wallet address)
 * @returns Object containing the new NFT's mint address, metadata address, and the base64 encoded transaction to sign and send.
 */
export async function mintCollectionNFT(
    userWalletAddress: PublicKey,
    collectionMint: PublicKey,
    metadata: MintCollectionNFTMetadata,
    recipient?: PublicKey,
) {
    try {
        // Create UMI instance from agent
        const umi = initUmi(userWalletAddress);
        const umiCollectionMint = fromWeb3JsPublicKey(collectionMint);
        const collection = await fetchCollection(umi, umiCollectionMint);
        const assetSigner = generateSigner(umi);
        const connection = getConnection();

        const ixs = create(umi, {
            asset: assetSigner,
            collection: collection,
            name: metadata.name,
            uri: metadata.uri,
            owner: fromWeb3JsPublicKey(recipient ?? userWalletAddress),
        })
            .getInstructions()
            .map((i) => toWeb3JsInstruction(i));
        const tx = new Transaction().add(...ixs);
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = userWalletAddress;
        tx.partialSign(toWeb3JsKeypair(assetSigner));

        const serializedTx = tx.serialize();
        const base64Tx = Buffer.from(serializedTx).toString('base64');

        return {
            mint: toWeb3JsPublicKey(assetSigner.publicKey),
            metadata: toWeb3JsPublicKey(assetSigner.publicKey),
            transaction: base64Tx,
        };
    } catch (error: any) {
        throw new Error(`Collection NFT minting failed: ${error.message}`);
    }
}