import {
  Raydium,
  TxVersion,
  parseTokenAccountResp,
} from '@raydium-io/raydium-sdk-v2';
import {Connection, Keypair, clusterApiUrl, Cluster, PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import bs58 from 'bs58';

// Use user's public key passed from the client
// SECURITY: No hardcoded wallet addresses - must be provided by caller
export const getUserWallet = (publicKey: string): PublicKey => {
  if (!publicKey) {
    throw new Error('[RaydiumConfig] Public key is required - no default wallet fallback for security');
  }
  try {
    return new PublicKey(publicKey);
  } catch (error) {
    throw new Error(`[RaydiumConfig] Invalid public key provided: ${publicKey}`);
  }
};

// Use environment variable for RPC URL or fall back to default
export const connection = new Connection(
  process.env.SOLANA_RPC_URL || 
  process.env.HELIUS_STAKED_URL || 
  clusterApiUrl('mainnet-beta')
);

export const txVersion = TxVersion.V0; // or TxVersion.LEGACY

// Convert 'mainnet' to 'mainnet-beta' for Solana compatibility
// The SDK might use 'mainnet' internally, but Solana's Cluster type expects 'mainnet-beta'
const cluster: 'mainnet' | 'devnet' = 
  process.env.SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet';

let raydium: Raydium | undefined;
export const initSdk = async (userPublicKey: string, params?: {loadToken?: boolean}) => {
  if (!userPublicKey) {
    throw new Error('[RaydiumConfig] userPublicKey is required to initialize SDK');
  }
  const owner = getUserWallet(userPublicKey);
  if (raydium) return raydium;
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn(
      'using free rpc node might cause unexpected error, strongly suggest uses paid rpc node',
    );
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`);
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
    // urlConfigs: {
    //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
    // },
  });

  /**
   * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
   * if you want to handle token account by yourself, set token account data after init sdk
   * code below shows how to do it.
   * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
   */

  /*  
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

  return raydium;
};

export const fetchTokenAccountData = async (userPublicKey: string) => {
  if (!userPublicKey) {
    throw new Error('[RaydiumConfig] userPublicKey is required to fetch token account data');
  }
  const ownerPubkey = getUserWallet(userPublicKey);
  const solAccountResp = await connection.getAccountInfo(ownerPubkey);
  const tokenAccountResp = await connection.getTokenAccountsByOwner(
    ownerPubkey,
    {programId: TOKEN_PROGRAM_ID},
  );
  const token2022Req = await connection.getTokenAccountsByOwner(
    ownerPubkey,
    {programId: TOKEN_2022_PROGRAM_ID},
  );
  const tokenAccountData = parseTokenAccountResp({
    owner: ownerPubkey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  });
  return tokenAccountData;
};