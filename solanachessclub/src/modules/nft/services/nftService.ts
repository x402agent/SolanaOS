/**
 * Services for NFT operations
 */
import { Connection, Cluster, clusterApiUrl, PublicKey, Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { TENSOR_API_KEY, CLUSTER, HELIUS_STAKED_URL, COMMISSION_WALLET } from '@env';
import { TransactionService } from '../../wallet-providers/services/transaction/transactionService';
import { CollectionData, NftItem } from '../types';
import { ENDPOINTS } from '../../../config/constants';

// Constants
const SOL_TO_LAMPORTS = 1_000_000_000;

// Fee configuration
const FEE_PERCENTAGE = 0.5; // 0.5% fee for NFT purchases

/**
 * Fetches metadata for a specific NFT
 * 
 * @param mint NFT mint address
 * @returns Detailed NFT metadata
 */
export async function fetchNftMetadata(mint: string): Promise<any> {
  // Check if API key is available
  if (!TENSOR_API_KEY) {
    // In dev mode, return mock data
    if (global.__DEV_MODE__) {
      console.log('[DEV MODE] Returning mock NFT metadata');
      return {
        name: "Mock NFT",
        mint: mint,
        attributes: [],
        image: "https://placehold.co/400",
        description: "This is mock NFT data returned in dev mode due to missing API key"
      };
    }
    return null;
  }
  
  const url = `https://api.mainnet.tensordev.io/api/v1/mint?mints=${mint}`;
  const resp = await fetch(url, {
    headers: {
      'x-tensor-api-key': TENSOR_API_KEY,
    },
  });
  
  if (!resp.ok) {
    throw new Error(`Tensor API error: ${resp.status}`);
  }
  
  const data = await resp.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  } else {
    throw new Error('No data returned from Tensor');
  }
}

/**
 * Fetches collection data
 * 
 * @param collId Collection ID
 * @returns Collection metadata
 */
export async function fetchCollectionData(collId: string): Promise<CollectionData> {
  // Check if API key is available
  if (!TENSOR_API_KEY) {
    // In dev mode, return mock data
    if (global.__DEV_MODE__) {
      console.log('[DEV MODE] Returning mock collection data');
      return {
        collId: collId,
        name: "Mock Collection",
        description: "This is mock collection data returned in dev mode due to missing API key",
        floorPrice: 1.5,
        tokenCount: 100,
        imageUri: "https://placehold.co/400",
      };
    }
    return {
      collId: collId,
      name: "Unknown Collection",
      description: "Collection data not available",
      imageUri: "https://placehold.co/400",
    };
  }
  
  // Use the find_collection endpoint to get comprehensive collection data
  const url = `https://api.mainnet.tensordev.io/api/v1/collections/find_collection?filter=${collId}`;
  const resp = await fetch(url, {
    headers: {
      'x-tensor-api-key': TENSOR_API_KEY,
    },
  });

  if (!resp.ok) {
    throw new Error(`Tensor API error: ${resp.status}`);
  }

  const data = await resp.json();
  
  try {
    // Now that we have collection data, fetch the current floor price
    const floorUrl = `https://api.mainnet.tensordev.io/api/v1/mint/collection?collId=${collId}&sortBy=ListingPriceAsc&limit=1`;
    const floorResp = await fetch(floorUrl, {
      headers: {
        'x-tensor-api-key': TENSOR_API_KEY,
      },
    });

    if (floorResp.ok) {
      const floorData = await floorResp.json();
      if (floorData.mints?.length > 0 && floorData.mints[0].listing?.price) {
        // Add floor price to collection data
        const updatedData = {
          ...data,
          floorPrice: parseFloat(floorData.mints[0].listing.price) / SOL_TO_LAMPORTS
        };
        return updatedData;
      }
    }
  } catch (floorErr) {
    console.error('Error fetching floor price:', floorErr);
  }
  
  return data;
}

/**
 * Fetches the floor NFT for a collection
 * 
 * @param collId Collection ID
 * @returns Floor NFT details including price and owner
 */
export async function fetchFloorNFTForCollection(collId: string): Promise<{ mint: string, owner: string, maxPrice: number } | null> {
  try {
    // Check if API key is available
    if (!TENSOR_API_KEY) {
      // In dev mode, return mock data
      if (global.__DEV_MODE__) {
        console.log('[DEV MODE] Returning mock floor NFT data');
        return {
          mint: "mock123456789",
          owner: "mockowneraddress123456789",
          maxPrice: 1.5
        };
      }
      return null;
    }

    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-tensor-api-key': TENSOR_API_KEY,
      },
    };

    const url = `https://api.mainnet.tensordev.io/api/v1/mint/collection?collId=${encodeURIComponent(
      collId
    )}&sortBy=ListingPriceAsc&limit=1`;

    const resp = await fetch(url, options);
    if (!resp.ok) {
      throw new Error(`Failed to fetch collection floor: ${resp.status}`);
    }

    const data = await resp.json();
    if (data.mints && data.mints.length > 0) {
      const floor = data.mints[0];
      if (floor && floor.mint && floor.listing) {
        const owner = floor.listing.seller;
        const maxPrice = parseFloat(floor.listing.price) / SOL_TO_LAMPORTS;
        return { mint: floor.mint, owner, maxPrice };
      }
    }

    return null;
  } catch (err: any) {
    console.error('Error fetching floor NFT:', err);
    throw err;
  }
}

/**
 * Searches for NFT collections
 * 
 * @param query Search query
 * @returns Matching collection results
 */
export async function searchCollections(query: string): Promise<any[]> {
  if (!query.trim()) return [];
  
  // Check if API key is available
  if (!TENSOR_API_KEY) {
    // In dev mode, return mock data
    if (global.__DEV_MODE__) {
      console.log('[DEV MODE] Returning mock collection search results');
      return [
        {
          collId: "mock1",
          name: "Mock Collection 1",
          description: "This is mock collection data returned in dev mode",
          imageUri: "https://placehold.co/400",
        },
        {
          collId: "mock2",
          name: "Mock Collection 2",
          description: "Another mock collection in dev mode",
          imageUri: "https://placehold.co/400",
        }
      ];
    }
    return [];
  }
  
  const url = `https://api.mainnet.tensordev.io/api/v1/collections/search_collections?query=${encodeURIComponent(
    query.trim(),
  )}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-tensor-api-key': TENSOR_API_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.collections && data.collections.length > 0) {
    return data.collections.map((c: any) => ({
      collId: c.collId,
      name: c.name,
      description: c.description || '',
      imageUri: c.imageUri || '',
    }));
  }
  
  return [];
}

/**
 * Fetches user's active NFT listings
 * 
 * @param walletAddress User's wallet address
 * @returns Array of active NFT listings
 */
export async function fetchActiveListings(walletAddress: string): Promise<NftItem[]> {
  if (!walletAddress) {
    return [];
  }
  
  // Check if API key is available
  if (!TENSOR_API_KEY) {
    // In dev mode, return mock data
    if (global.__DEV_MODE__) {
      console.log('[DEV MODE] Returning mock active listings');
      return [{
        mint: "mock123",
        name: "Mock NFT 1",
        description: "Mock listing in dev mode",
        collection: "Mock Collection",
        priceSol: 1.5,
        image: "https://placehold.co/400",
        isCompressed: false
      }];
    }
    return [];
  }
  
  const url = `https://api.mainnet.tensordev.io/api/v1/user/active_listings?wallets=${walletAddress}&sortBy=PriceAsc&limit=50`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-tensor-api-key': TENSOR_API_KEY,
    },
  };

  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Failed to fetch active listings: ${res.status}`);
  }

  const data = await res.json();
  if (data.listings && Array.isArray(data.listings)) {
    const mappedListings = data.listings.map((item: any) => {
      const mintObj = item.mint || {};
      const mintAddress = typeof item.mint === 'object' && item.mint.onchainId
        ? item.mint.onchainId
        : item.mint;
      const nftName = mintObj?.name || 'Unnamed NFT';
      const nftImage = fixImageUrl(mintObj?.imageUri || '');
      const nftCollection = mintObj?.collName || '';
      const lamports = parseInt(item.grossAmount || '0', 10);
      const priceSol = lamports / SOL_TO_LAMPORTS;

      return {
        mint: mintAddress,
        name: nftName,
        collection: nftCollection,
        image: nftImage,
        priceSol,
        isCompressed: item.compressed || false
      } as NftItem;
    });

    return mappedListings;
  }
  
  return [];
}

/**
 * Buys an NFT using the Tensor API
 * 
 * @param publicKey Buyer's public key
 * @param mint NFT mint address
 * @param maxPriceSol Maximum price in SOL
 * @param owner Owner's public key
 * @param sendTransaction Transaction sending function
 * @param onStatus Status update callback
 * @returns Transaction signature
 */
export async function buyNft(
  publicKey: string,
  mint: string,
  maxPriceSol: number,
  owner: string,
  sendTransaction: any,
  onStatus?: (status: string) => void
): Promise<string> {
  if (!publicKey) {
    throw new Error('Wallet not connected');
  }
  
  if (!TENSOR_API_KEY) {
    throw new Error('API key not available');
  }
  
  try {
    if (onStatus) onStatus('Fetching blockhash...');

    const rpcUrl = HELIUS_STAKED_URL || clusterApiUrl(CLUSTER as Cluster);
    const connection = new Connection(rpcUrl, 'confirmed');
    const { blockhash } = await connection.getRecentBlockhash();
    
    if (onStatus) onStatus(`Preparing buy transaction...`);

    const maxPriceInLamports = maxPriceSol * SOL_TO_LAMPORTS;
    const buyUrl = `https://api.mainnet.tensordev.io/api/v1/tx/buy?buyer=${publicKey}&mint=${mint}&owner=${owner}&maxPrice=${maxPriceInLamports}&blockhash=${blockhash}`;

    const resp = await fetch(buyUrl, {
      headers: {
        'x-tensor-api-key': TENSOR_API_KEY,
      },
    });
    
    const rawText = await resp.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      throw new Error('Tensor returned non-JSON response.');
    }
    
    if (!data.txs || data.txs.length === 0) {
      throw new Error('No transactions returned from Tensor buy endpoint.');
    }

    if (onStatus) onStatus(`Signing ${data.txs.length} transaction(s)...`);
    
    let lastSignature = '';
    
    for (let i = 0; i < data.txs.length; i++) {
      const txObj = data.txs[i];
      let transaction: Transaction | VersionedTransaction;

      if (txObj.txV0) {
        const txBuffer = new Uint8Array(Buffer.from(txObj.txV0.data, 'base64'));
        transaction = VersionedTransaction.deserialize(txBuffer);
      } else if (txObj.tx) {
        const txBuffer = Buffer.from(txObj.tx.data, 'base64');
        transaction = Transaction.from(txBuffer);
      } else {
        throw new Error(`Unknown transaction format in item #${i + 1}`);
      }

      if (onStatus) onStatus(`Sending transaction #${i + 1}...`);
      
      const signature = await sendTransaction(
        transaction,
        connection,
        {
          confirmTransaction: true,
          statusCallback: (status: string) => {
            if (onStatus) onStatus(`TX #${i + 1}: ${status}`);
          }
        }
      );

      if (!signature) {
        throw new Error('Failed to sign transaction or no signature returned.');
      }

      if (onStatus) onStatus(`TX #${i + 1} signature: ${signature}`);
      
      // Keep track of the last signature
      lastSignature = signature;
    }
    
    return lastSignature;
  } catch (err: any) {
    console.error('Error during buy transaction:', err);
    throw err;
  }
}

/**
 * Buys the floor NFT from a collection
 * 
 * @param publicKey Buyer's public key
 * @param collId Collection ID
 * @param sendTransaction Transaction sending function
 * @param onStatus Status update callback
 * @returns Transaction signature
 */
export async function buyCollectionFloor(
  publicKey: string,
  collId: string,
  sendTransaction: any,
  onStatus?: (status: string) => void
): Promise<string> {
  if (!publicKey) {
    throw new Error('Wallet not connected');
  }
  
  try {
    if (onStatus) onStatus('Fetching collection floor...');

    // Get the floor NFT for this collection
    const floorDetails = await fetchFloorNFTForCollection(collId);
    if (!floorDetails) {
      throw new Error('No floor NFT found for this collection.');
    }

    if (onStatus) onStatus(`Found floor NFT at ${floorDetails.maxPrice.toFixed(5)} SOL`);
    
    // Use the buyNft function to purchase the floor NFT
    const nftSignature = await buyNft(
      publicKey,
      floorDetails.mint,
      floorDetails.maxPrice,
      floorDetails.owner,
      sendTransaction,
      onStatus
    );
    
    // After successful NFT purchase, try to collect commission fee
    // But only if the main purchase was successful
    try {
      // Wait a little to ensure balance has updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (onStatus) onStatus(`Preparing platform fee...`);
      
      // Calculate fee amount (0.5% of NFT price)
      const feeAmount = Math.floor(floorDetails.maxPrice * SOL_TO_LAMPORTS * (FEE_PERCENTAGE / 100));
      
      if (feeAmount > 0) {
        // Create connection for fee transaction
        const rpcUrl = HELIUS_STAKED_URL || clusterApiUrl(CLUSTER as Cluster);
        const connection = new Connection(rpcUrl, 'confirmed');
        
        // Check user balance before attempting fee transaction
        const walletPubkey = new PublicKey(publicKey);
        const balance = await connection.getBalance(walletPubkey);
        
        // Make sure user has enough balance for fee plus some buffer
        // Ensure at least 0.002 SOL remaining after fee (for transaction costs)
        const minimumBuffer = 0.002 * SOL_TO_LAMPORTS;
        
        if (balance < (feeAmount + minimumBuffer)) {
          console.log(`[NFT] Insufficient balance for fee. Balance: ${balance}, Fee: ${feeAmount}`);
          return nftSignature; // Return the NFT signature even if we can't collect the fee
        }
        
        // Get fresh blockhash
        const { blockhash } = await connection.getRecentBlockhash();
        
        // Create fee transaction
        if (!COMMISSION_WALLET) {
          console.log('[NFT] No commission wallet address configured');
          return nftSignature;
        }
        
        try {
          const feeRecipientPubkey = new PublicKey(COMMISSION_WALLET);
          
          const feeTx = new Transaction();
          feeTx.add(SystemProgram.transfer({
            fromPubkey: walletPubkey,
            toPubkey: feeRecipientPubkey,
            lamports: feeAmount
          }));
          feeTx.recentBlockhash = blockhash;
          feeTx.feePayer = walletPubkey;
          
          // Send fee transaction
          if (onStatus) onStatus(`Collecting ${FEE_PERCENTAGE}% platform fee...`);
          
          try {
            // First simulate the transaction to check for issues
            const simulate = await connection.simulateTransaction(feeTx);
            
            if (simulate.value.err) {
              console.error('[NFT] Fee transaction simulation failed:', simulate.value.err);
              return nftSignature; // Return NFT signature if fee simulation fails
            }
            
            const feeSignature = await sendTransaction(
              feeTx,
              connection,
              {
                statusCallback: (status: string) => {
                  if (onStatus) onStatus(`Fee: ${status}`);
                },
                confirmTransaction: true
              }
            );
            
            console.log(`[NFT] Fee transaction sent with signature: ${feeSignature}`);
            TransactionService.showSuccess(feeSignature, 'transfer');
          } catch (feeError) {
            console.error('[NFT] Error sending fee transaction:', feeError);
            // We don't throw here since the NFT purchase was successful
          }
        } catch (walletError) {
          console.error('[NFT] Error with wallet during fee transaction:', walletError);
        }
      } else {
        console.log('[NFT] Fee amount too small, skipping fee collection');
      }
    } catch (feeError) {
      console.error('[NFT] Error collecting fee, but NFT purchase was successful:', feeError);
    }
    
    // Always return the NFT purchase signature even if fee collection failed
    return nftSignature;
  } catch (err: any) {
    console.error('Error during collection floor purchase:', err);
    throw err;
  }
}

/**
 * Helper function to fix image URLs
 */
function fixImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('ipfs://'))
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  if (url.startsWith('ar://'))
    return url.replace('ar://', 'https://arweave.net/');
  if (url.startsWith('/')) return `https://arweave.net${url}`;
  if (!url.startsWith('http') && !url.startsWith('data:'))
    return `https://${url}`;
  return url;
} 