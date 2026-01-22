import { mplCore } from "@metaplex-foundation/mpl-core";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { signerIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fromWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { Connection, PublicKey } from "@solana/web3.js";
import { getConnection } from "../../utils/connection";

export function initUmi(walletAddress: PublicKey) {
  const connection = getConnection();
  const umi = createUmi(connection.rpcEndpoint)
    .use(mplCore())
    .use(mplToolbox())
    .use(signerIdentity({
        publicKey: fromWeb3JsPublicKey(walletAddress),
        signTransaction: async (tx) => tx,
        signMessage: async (data) => data,
        signAllTransactions: async (txs) => txs,
    }))

  return umi;
}
