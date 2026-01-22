import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
  SendTransactionError,
  clusterApiUrl,
  Cluster,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { CLUSTER, HELIUS_API_KEY, TENSOR_API_KEY } from '@env';
import { sellStyles as styles } from './sellSection.styles';
import { useDispatch } from 'react-redux';
import { ThreadSection } from '@/core/thread/components/thread.types';
// import {addRootPost} from '../../../state/thread/reducer';
import { fetchWithRetries } from '@/modules/data-module/utils/fetch';
import { ENDPOINTS } from '@/shared/config/constants';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';

const SOL_TO_LAMPORTS = 1_000_000_000;

interface NftItem {
  mint: string;
  name: string;
  uri?: string;
  symbol?: string;
  collection?: string;
  image?: string;
  priceSol?: number;
  description?: string;
  isCompressed?: boolean;
}

interface SellSectionProps {
  userPublicKey: string;
  userWallet: any;
}

/** Helper to fix various NFT image URI formats. */
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

/**
 * Ensures an associated token account (ATA) is initialized for a standard (non-compressed) NFT.
 */
async function ensureAtaIfNeeded(
  connection: Connection,
  mint: string,
  owner: string,
  userWallet: any,
) {
  const mintPubkey = new PublicKey(mint);
  const ownerPubkey = new PublicKey(owner);
  const ataAddr = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
  try {
    await getAccount(connection, ataAddr);
    return ataAddr;
  } catch (err) {
    console.log('ATA not found; creating:', ataAddr.toBase58());
  }
  const createTx = new Transaction();
  const instruction = createAssociatedTokenAccountInstruction(
    ownerPubkey,
    ataAddr,
    ownerPubkey,
    mintPubkey,
  );
  createTx.add(instruction);
  const { blockhash } = await connection.getLatestBlockhash();
  createTx.recentBlockhash = blockhash;
  createTx.feePayer = ownerPubkey;

  const provider = await userWallet.getProvider();
  console.log('[ensureAtaIfNeeded] about to sign ATA creation TX...');
  const { signature } = await provider.request({
    method: 'signAndSendTransaction',
    params: { transaction: createTx, connection },
  });
  console.log('ATA creation signature:', signature);
  return ataAddr;
}

/**
 * Fetch actual compressed NFT data using Helius's DAS API (getAssetProof).
 */
async function getRealCompressedNFTData(nft: NftItem, ownerAddress: string) {
  console.log('[getRealCompressedNFTData] Called for NFT:', nft);
  const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const body = {
    jsonrpc: '2.0',
    id: 'my-id',
    method: 'getAssetProof',
    params: {
      id: nft.mint, // assuming the mint is used as the asset ID
    },
  };
  console.log(
    '[getRealCompressedNFTData] Fetching asset proof from Helius with URL:',
    url,
  );
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch asset proof from Helius: ${resp.status}`);
  }
  const json = await resp.json();
  console.log(
    '[getRealCompressedNFTData] Helius getAssetProof response:',
    json,
  );
  const result = json.result;
  if (!result || !result.tree_id) {
    throw new Error('Helius response missing asset proof data.');
  }
  // If proof is an array of arrays, take the first array.
  const proof =
    Array.isArray(result.proof) && Array.isArray(result.proof[0])
      ? result.proof[0]
      : result.proof;
  // Use the returned leaf as the dataHash.
  const dataHash = result.leaf;
  // Use a dummy creatorsHash (adjust if you can fetch the actual value).
  const creatorsHash =
    '0000000000000000000000000000000000000000000000000000000000000000';
  // Use canopyDepth from the result if provided; otherwise, default to 14.
  const canopyDepth = result.canopyDepth || 14;
  const leafIndex = result.node_index;
  return {
    merkleTree: result.tree_id, // the Merkle tree address
    proof,
    root: result.root,
    canopyDepth,
    leafIndex,
    dataHash,
    creatorsHash,
  };
}

const SellSection: React.FC<SellSectionProps> = ({
  userPublicKey,
  userWallet,
}) => {
  const dispatch = useDispatch();

  const [loadingNfts, setLoadingNfts] = useState(false);
  const [ownedNfts, setOwnedNfts] = useState<NftItem[]>([]);
  const [selectedNft, setSelectedNft] = useState<NftItem | null>(null);
  const [salePrice, setSalePrice] = useState<string>('1.0');
  const [durationDays, setDurationDays] = useState<string>('');
  const [activeListings, setActiveListings] = useState<NftItem[]>([]);
  const [loadingActiveListings, setLoadingActiveListings] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isProcessingTx, setIsProcessingTx] = useState(false);

  useEffect(() => {
    if (userPublicKey) {
      console.log('[SellSection] userPublicKey:', userPublicKey);
      fetchOwnedNfts();
      fetchActiveListings();
    }
  }, [userPublicKey]);

  const fetchOwnedNfts = useCallback(async () => {
    if (!userPublicKey) return;
    setLoadingNfts(true);
    setOwnedNfts([]);
    setFetchError(null);
    console.log('[fetchOwnedNfts] for wallet:', userPublicKey);

    const url = `https://api.mainnet.tensordev.io/api/v1/user/portfolio?wallet=${userPublicKey}&includeUnverified=true&includeCompressed=true&includeFavouriteCount=true`;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-tensor-api-key': TENSOR_API_KEY,
      },
    };
    try {
      const response = await fetchWithRetries(url, options);
      console.log('[fetchOwnedNfts] response:', response);
      if (!response.ok) {
        throw new Error(
          `Portfolio API request failed with status ${response.status}`,
        );
      }
      const data = await response.json();
      const dataArray = Array.isArray(data) ? data : [];
      const mappedNfts: NftItem[] = dataArray
        .map((item: any) => {
          // if (!item.setterMintMe) return null;
          const mint = item.setterMintMe;
          const name = item.name || 'Unnamed NFT';
          const image = item.imageUri ? fixImageUrl(item.imageUri) : '';
          const description = item.description || '';
          const symbol = item.symbol || '';
          const collection = item.slugDisplay || '';
          const isCompressed = !!item.compressed;
          let priceSol;
          if (item.statsV2?.buyNowPrice) {
            const lamports = parseInt(item.statsV2.buyNowPrice, 10);
            priceSol = lamports / SOL_TO_LAMPORTS;
          }
          return {
            mint,
            name,
            description,
            symbol,
            collection,
            image,
            priceSol,
            isCompressed,
          };
        })
        .filter(Boolean) as NftItem[];
      console.log('[fetchOwnedNfts] Mapped NFTs:', mappedNfts);
      setOwnedNfts(mappedNfts);
    } catch (err: any) {
      console.error('[fetchOwnedNfts] error:', err);
      setFetchError(err.message);
    } finally {
      setLoadingNfts(false);
    }
  }, [userPublicKey]);

  const fetchActiveListings = useCallback(async () => {
    if (!userPublicKey) return;
    setLoadingActiveListings(true);
    console.log('[fetchActiveListings] for wallet:', userPublicKey);
    try {
      const url = `https://api.mainnet.tensordev.io/api/v1/user/active_listings?wallets=${userPublicKey}&sortBy=PriceAsc&limit=50`;
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
          const mintAddress =
            typeof item.mint === 'object' && item.mint.onchainId
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
            isCompressed: item.compressed || false,
          } as NftItem;
        });
        console.log('[fetchActiveListings] fetched:', mappedListings);
        setActiveListings(mappedListings);
      } else {
        console.log('[fetchActiveListings] no listings found');
        setActiveListings([]);
      }
    } catch (err: any) {
      console.error('[fetchActiveListings] error:', err);
      Alert.alert('Error', err.message || 'Failed to fetch active listings');
    } finally {
      setLoadingActiveListings(false);
    }
  }, [userPublicKey]);

  const handleSellNftOnTensor = async () => {
    if (!selectedNft) {
      console.log('[handleSellNftOnTensor] No NFT selected.');
      return;
    }
    if (!salePrice) {
      Alert.alert('Error', 'Please enter a valid sale price in SOL.');
      return;
    }
    if (!userPublicKey || !userWallet) {
      Alert.alert('Error', 'Wallet not connected.');
      return;
    }
    console.log(
      '[handleSellNftOnTensor] Starting listing, selected NFT:',
      selectedNft,
    );

    setIsProcessingTx(true);
    setStatus('Preparing transaction...');

    try {
      const rpcUrl = ENDPOINTS.helius || clusterApiUrl(CLUSTER as Cluster);
      const connection = new Connection(rpcUrl, 'confirmed');
      const priceLamports = Math.floor(parseFloat(salePrice) * SOL_TO_LAMPORTS);
      let expiryValue: number | undefined;
      if (durationDays && !isNaN(parseFloat(durationDays))) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const addedSeconds = parseFloat(durationDays) * 24 * 60 * 60;
        expiryValue = nowSeconds + addedSeconds;
        console.log(
          '[handleSellNftOnTensor] Listing expiry (seconds):',
          expiryValue,
        );
      }
      if (selectedNft.isCompressed) {
        // For now, alert the user that selling compressed NFTs is not supported.
        TransactionService.showError(new Error('Selling compressed NFTs is not supported as of now.'));
        setStatus(null);
        return;

        /* 
        // Uncomment this block when you are ready to enable cNFT sales:
        console.log('[handleSellNftOnTensor] This NFT is compressed. Fetching tree data...');
        const compressedData = await getRealCompressedNFTData(selectedNft, userPublicKey);
        console.log('[handleSellNftOnTensor] cNFT data:', compressedData);
        const params = {
          seller: userPublicKey,
          owner: userPublicKey,
          price: priceLamports,
          expiry: expiryValue,
          merkleTree: compressedData.merkleTree,
          proof: compressedData.proof,
          root: compressedData.root,
          canopyDepth: compressedData.canopyDepth,
          leafIndex: compressedData.leafIndex,
          dataHash: compressedData.dataHash,
          creatorsHash: compressedData.creatorsHash
        };
        console.log('[handleSellNftOnTensor] sending to server:', params);
        const resp = await fetch('http://localhost:3000/api/build-compressed-nft-listing-tx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tensor-api-key': TENSOR_API_KEY
          },
          body: JSON.stringify(params)
        });
        const result = await resp.json();
        console.log('[handleSellNftOnTensor] server response:', result);
        if (!result.success || !result.transaction) {
          throw new Error('No transaction returned for compressed NFT listing.');
        }
        const unsignedTxBase64 = result.transaction;
        const txBuffer = Buffer.from(unsignedTxBase64, 'base64');
        const unsignedTx = Transaction.from(txBuffer);
        console.log('[handleSellNftOnTensor] about to sign cNFT listing TX...');
        const provider = await userWallet.getProvider();
        const serializedMessage = unsignedTx.serializeMessage();
        const base64Message = Buffer.from(serializedMessage).toString('base64');
        const signResult = await provider.request({
          method: 'signMessage',
          params: { message: base64Message }
        });
        if (!signResult?.signature) {
          throw new Error('No signature returned from wallet.');
        }
        unsignedTx.addSignature(
          new PublicKey(userPublicKey),
          Buffer.from(signResult.signature, 'base64')
        );
        const signedTx = unsignedTx.serialize();
        console.log('[handleSellNftOnTensor] sending raw transaction...');
        let txSignature: string;
        try {
          txSignature = await connection.sendRawTransaction(signedTx, { skipPreflight: false });
          console.log('[handleSellNftOnTensor] raw TX sent. Sig:', txSignature);
          const confirmResult = await connection.confirmTransaction(txSignature, 'confirmed');
          console.log('[handleSellNftOnTensor] confirmation result:', confirmResult);
        } catch (sendErr: any) {
          console.error('[handleSellNftOnTensor] sendRawTransaction error:', sendErr);
          if (sendErr instanceof SendTransactionError) {
            console.error('SendTransactionError logs:', sendErr.logs);
          } else if (sendErr.logs) {
            console.error('Raw logs:', sendErr.logs);
          }
          throw sendErr;
        }
        Alert.alert('Success', `Compressed NFT listed at ${salePrice} SOL!`);
        */
      } else {
        console.log('[handleSellNftOnTensor] This NFT is NOT compressed.');

        setStatus('Ensuring token account...');
        await ensureAtaIfNeeded(
          connection,
          selectedNft.mint,
          userPublicKey,
          userWallet,
        );

        const { blockhash } = await connection.getLatestBlockhash();
        const mintAddress = selectedNft.mint;

        setStatus('Building listing transaction...');
        const listUrl =
          `https://api.mainnet.tensordev.io/api/v1/tx/list` +
          `?seller=${userPublicKey}&owner=${userPublicKey}` +
          `&mint=${mintAddress}&price=${priceLamports}` +
          `&blockhash=${blockhash}`;
        console.log('[handleSellNftOnTensor] calling list endpoint:', listUrl);
        const resp = await fetch(listUrl, {
          headers: { 'x-tensor-api-key': TENSOR_API_KEY },
        });
        const rawText = await resp.text();
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          console.error(
            '[handleSellNftOnTensor] failed to parse JSON from Tensor:',
            rawText,
          );
          throw new Error('Tensor returned non-JSON response. Check the logs.');
        }
        if (!data.txs?.length) {
          throw new Error('No transactions returned from Tensor for listing.');
        }

        const provider = await userWallet.getProvider();
        setStatus('Signing transaction...');

        for (let i = 0; i < data.txs.length; i++) {
          let transaction: Transaction | VersionedTransaction;
          const txObj = data.txs[i];
          if (txObj.txV0) {
            const txBuffer = Buffer.from(txObj.txV0.data, 'base64');
            transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
          } else if (txObj.tx) {
            const txBuffer = Buffer.from(txObj.tx.data, 'base64');
            transaction = Transaction.from(txBuffer);
          } else {
            throw new Error(`Transaction #${i + 1} is in an unknown format.`);
          }

          setStatus(`Signing transaction ${i + 1} of ${data.txs.length}...`);
          console.log(
            `[handleSellNftOnTensor] signing standard NFT TX #${i + 1}...`,
          );

          const { signature } = await provider.request({
            method: 'signAndSendTransaction',
            params: { transaction, connection },
          });

          setStatus(`Confirming transaction ${i + 1}...`);
          console.log(
            `[handleSellNftOnTensor] TX #${i + 1} confirmed. Sig: ${signature}`,
          );

          // Show success notification for the last transaction
          if (i === data.txs.length - 1) {
            TransactionService.showSuccess(signature, 'nft');
          }
        }

        setStatus('NFT listed successfully!');
      }
    } catch (err: any) {
      console.error('[handleSellNftOnTensor] error:', err);
      // Use TransactionService to show error notification
      TransactionService.showError(err);
      setStatus('Transaction failed');
    } finally {
      // Reset form after a delay
      setTimeout(() => {
        setIsProcessingTx(false);
        setStatus(null);
        setSelectedNft(null);
        setSalePrice('1.0');
        setDurationDays('');
      }, 2000);
    }
  };

  const handleShareToFeed = (item: NftItem) => {
    if (!userPublicKey) {
      Alert.alert('Not logged in', 'Connect your wallet first');
      return;
    }

    // We'll create a new Root Post that includes an NFT_LISTING section
    const sections: ThreadSection[] = [
      {
        id: 'section-' + Math.random().toString(36).substring(2),
        type: 'NFT_LISTING',
        text: 'I\'ve listed this NFT. Anyone interested in buying?',
        listingData: {
          mint: item.mint,
          owner: userPublicKey, // The user who listed
          priceSol: item.priceSol,
          name: item.name,
          image: item.image,
        },
      },
    ];

    // Dispatch to Redux:
    // dispatch(
    //   addRootPost({
    //     user: {
    //       id: userPublicKey,
    //       username: 'Aranav', // or from your profile data
    //       handle: '@' + userPublicKey.slice(0, 5),
    //       avatar: require('../../../assets/images/User.png'), // or your actual avatar
    //     },
    //     sections,
    //   }),
    // );

    Alert.alert('Shared to Feed', 'A new post was created in the feed!');
  };

  const renderActiveListingCard = ({ item }: { item: NftItem }) => (
    <View style={styles.listedCard}>
      <View style={styles.imageContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.nftImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        {item.isCompressed && (
          <View
            style={{
              position: 'absolute',
              top: 5,
              left: 5,
              backgroundColor: '#FF4500',
              paddingHorizontal: 4,
              paddingVertical: 2,
              borderRadius: 4,
            }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
              cNFT
            </Text>
          </View>
        )}
      </View>

      <View style={styles.nftDetails}>
        <Text style={styles.nftName} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.collection && (
          <Text style={styles.collectionName} numberOfLines={1}>
            {item.collection}
          </Text>
        )}
        <Text style={styles.mintAddress} numberOfLines={1}>
          {item.mint
            ? item.mint.slice(0, 8) + '...' + item.mint.slice(-4)
            : 'No Mint'}
        </Text>
        {item.priceSol !== undefined && (
          <Text style={styles.priceText}>
            Listed @ {item.priceSol.toFixed(2)} SOL
          </Text>
        )}
      </View>

      {/* Add a "Share to Feed" button here */}
      {/* <TouchableOpacity
          style={{
            backgroundColor: '#32D4DE',
            margin: 8,
            paddingVertical: 6,
            borderRadius: 6,
            alignItems: 'center',
          }}
          onPress={() => handleShareToFeed(item)}>
          <Text style={{color: '#fff', fontWeight: '600'}}>Share to Feed</Text>
        </TouchableOpacity> */}
    </View>
  );

  const renderNftCard = ({ item }: { item: NftItem }) => {
    const isSelected = selectedNft?.mint === item.mint;
    return (
      <TouchableOpacity
        style={[
          styles.nftCard,
          isSelected && styles.nftCardSelected,
          item.isCompressed && {
            borderColor: '#FFD700',
            backgroundColor: '#FFF8DC',
          },
        ]}
        onPress={() => setSelectedNft(item)}>
        <View style={styles.imageContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.nftImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          {item.isCompressed && (
            <View
              style={{
                position: 'absolute',
                top: 5,
                left: 5,
                backgroundColor: '#FF4500',
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
              <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                cNFT
              </Text>
            </View>
          )}
        </View>
        <View style={styles.nftDetails}>
          <Text style={styles.nftName} numberOfLines={1}>
            {item.name || 'Unnamed'}
          </Text>
          {!!item.collection && (
            <Text style={styles.collectionName} numberOfLines={1}>
              {item.collection}
            </Text>
          )}
          {item.description ? (
            <Text
              style={{ fontSize: 10, color: '#666', marginVertical: 2 }}
              numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <Text style={styles.mintAddress} numberOfLines={1}>
            {item.mint
              ? item.mint.slice(0, 8) + '...' + item.mint.slice(-4)
              : 'No Mint'}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sellHeader}>
        <Text style={styles.infoText}>
          Active Listings ({activeListings.length})
        </Text>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={fetchActiveListings}>
          <Text style={styles.reloadButtonText}>Reload Active Listings</Text>
        </TouchableOpacity>
      </View>
      {loadingActiveListings ? (
        <ActivityIndicator
          size="large"
          color="#32D4DE"
          style={{ marginVertical: 16 }}
        />
      ) : (
        <FlatList
          data={activeListings}
          keyExtractor={item => item.mint}
          renderItem={renderActiveListingCard}
          horizontal
          contentContainerStyle={{ paddingHorizontal: 4 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyListText}>
                No active listings found.
              </Text>
            </View>
          }
        />
      )}
      <View style={styles.sellHeader}>
        <Text style={styles.infoText}>Your NFTs ({ownedNfts.length})</Text>
        <TouchableOpacity style={styles.reloadButton} onPress={fetchOwnedNfts}>
          <Text style={styles.reloadButtonText}>Reload</Text>
        </TouchableOpacity>
      </View>
      {fetchError && <Text style={styles.errorText}>{fetchError}</Text>}
      {loadingNfts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#32D4DE" />
          <Text style={styles.loadingText}>Fetching your NFTs...</Text>
        </View>
      ) : (
        <FlatList
          data={ownedNfts}
          keyExtractor={item => item.mint}
          renderItem={renderNftCard}
          numColumns={2}
          columnWrapperStyle={styles.nftGrid}
          contentContainerStyle={styles.nftList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyListText}>
                No items found in this wallet.
              </Text>
            </View>
          }
        />
      )}
      <Modal
        transparent
        visible={selectedNft !== null}
        animationType="fade"
        onRequestClose={() => setSelectedNft(null)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedNft(null)}>
          <Pressable style={styles.sellForm} onPress={e => e.stopPropagation()}>
            <Text style={styles.formTitle}>List NFT for Sale</Text>
            <View style={styles.selectedNftInfo}>
              <Text style={styles.label}>Selected NFT</Text>
              <Text style={styles.selectedNftName}>{selectedNft?.name}</Text>
              <Text style={styles.selectedMint}>{selectedNft?.mint}</Text>
            </View>
            <Text style={styles.label}>Sale Price (SOL)</Text>
            <TextInput
              style={styles.input}
              placeholder="1.0"
              keyboardType="numeric"
              value={salePrice}
              onChangeText={setSalePrice}
              editable={!isProcessingTx}
            />
            <Text style={styles.label}>Duration (days, optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 7"
              keyboardType="numeric"
              value={durationDays}
              onChangeText={setDurationDays}
              editable={!isProcessingTx}
            />

            {status && (
              <Text style={{
                textAlign: 'center',
                marginVertical: 10,
                padding: 8,
                backgroundColor: '#f0f0f0',
                borderRadius: 4,
                color: '#333'
              }}>{status}</Text>
            )}

            {isProcessingTx ? (
              <View style={styles.actionButton}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSellNftOnTensor}>
                <Text style={styles.actionButtonText}>List on Tensor</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default SellSection;
