import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  FlatList,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Cluster, clusterApiUrl, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { buyStyles as styles } from './buySection.styles';
import { CLUSTER, TENSOR_API_KEY } from '@env';
import { ENDPOINTS } from '@/shared/config/constants';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';

const SOL_TO_LAMPORTS = 1_000_000_000;

interface CollectionResult {
  collId: string;
  name: string;
  description?: string;
  imageUri?: string;
}

interface FloorNFT {
  mint: string;
  owner: string;
  maxPrice: number;
}

/** Helper to fix IPFS/Arweave URLs */
const fixImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('ipfs://'))
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  if (url.startsWith('ar://'))
    return url.replace('ar://', 'https://arweave.net/');
  if (url.startsWith('/')) return `https://arweave.net${url}`;
  if (!url.startsWith('http') && !url.startsWith('data:'))
    return `https://${url}`;
  return url;
};

interface BuySectionProps {
  userPublicKey: string;
  userWallet: any;
}

const BuySection: React.FC<BuySectionProps> = ({ userPublicKey, userWallet }) => {
  const [collectionName, setCollectionName] = useState('madlads');
  const [searchResults, setSearchResults] = useState<CollectionResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Selected collection for modal display.
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionResult | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // State for the floor NFT details.
  const [floorNFT, setFloorNFT] = useState<FloorNFT | null>(null);
  const [loadingFloorNFT, setLoadingFloorNFT] = useState(false);

  // Add status state for transaction progress
  const [status, setStatus] = useState<string | null>(null);
  const [isProcessingTx, setIsProcessingTx] = useState(false);

  // ------------------------------------------------------------------------
  // 1) Search collections by name
  // ------------------------------------------------------------------------
  const handleSearchCollections = async () => {
    if (!collectionName.trim()) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const url = `https://api.mainnet.tensordev.io/api/v1/collections/search_collections?query=${encodeURIComponent(
        collectionName.trim(),
      )}`;
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-tensor-api-key': TENSOR_API_KEY,
        },
      };
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Failed to fetch collections: ${response.status}`);
      }
      const data = await response.json();
      if (data.collections && data.collections.length > 0) {
        const mapped: CollectionResult[] = data.collections.map((c: any) => ({
          collId: c.collId,
          name: c.name,
          description: c.description || '',
          imageUri: c.imageUri || '',
        }));
        console.log('Search results:', mapped);
        setSearchResults(mapped);
      } else {
        Alert.alert('Info', 'No collections found.');
      }
    } catch (err: any) {
      console.error('Error searching collections:', err);
      Alert.alert('Error', err.message || 'Failed to search collections');
    } finally {
      setLoadingSearch(false);
    }
  };

  // ------------------------------------------------------------------------
  // 2) Fetch floor NFT details using:
  // GET https://api.mainnet.tensordev.io/api/v1/mint/collection?collId=...&sortBy=ListingPriceAsc&limit=1
  // We take the first mint from the "mints" array.
  // ------------------------------------------------------------------------
  const fetchFloorNFTForCollection = async (
    collId: string,
  ): Promise<FloorNFT | null> => {
    try {
      console.log(`Fetching floor NFT details for collection ${collId}...`);
      setLoadingFloorNFT(true);
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-tensor-api-key': TENSOR_API_KEY,
        },
      };
      const url = `https://api.mainnet.tensordev.io/api/v1/mint/collection?collId=${encodeURIComponent(
        collId,
      )}&sortBy=ListingPriceAsc&limit=1`;
      const resp = await fetch(url, options);
      console.log('Response from floor NFT API:', resp);
      if (!resp.ok) {
        throw new Error(`Failed to fetch collection mints: ${resp.status}`);
      }
      const data = await resp.json();
      console.log('Floor NFT data:', data);
      if (data.mints && data.mints.length > 0) {
        const floor = data.mints[0];
        if (floor && floor.mint && floor.listing) {
          const owner = floor.listing.seller;
          const maxPrice = parseFloat(floor.listing.price) / SOL_TO_LAMPORTS;
          console.log(
            `Floor NFT: mint=${floor.mint}, owner=${owner}, maxPrice=${maxPrice}`,
          );
          setFloorNFT({ mint: floor.mint, owner, maxPrice });
          return { mint: floor.mint, owner, maxPrice };
        }
      }
      Alert.alert('Info', 'No tokens found for the collection floor.');
      return null;
    } catch (err: any) {
      console.error('Error fetching floor NFT:', err);
      Alert.alert('Error', err.message || 'Failed to fetch floor NFT');
      return null;
    } finally {
      setLoadingFloorNFT(false);
    }
  };

  // ------------------------------------------------------------------------
  // 3) Initiate buy floor transaction
  // ------------------------------------------------------------------------
  const handleBuyFloor = async (coll: CollectionResult) => {
    console.log('Confirm Buy clicked for collection:', coll);
    if (!coll) return;
    const collId = coll.collId;

    setStatus('Fetching floor NFT details...');
    setIsProcessingTx(true);

    // Use the floorNFT from state if available.
    const floorDetails = floorNFT
      ? floorNFT
      : await fetchFloorNFTForCollection(collId);
    if (!floorDetails) {
      console.log('No floor NFT to buy. Aborting.');
      setStatus(null);
      setIsProcessingTx(false);
      return;
    }
    console.log('Proceeding to buy with floor NFT:', floorDetails);
    if (!userPublicKey || !userWallet) {
      Alert.alert('Error', 'Wallet not connected.');
      setStatus(null);
      setIsProcessingTx(false);
      return;
    }
    try {
      const rpcUrl = ENDPOINTS.helius || clusterApiUrl(CLUSTER as Cluster);
      const connection = new Connection(rpcUrl, 'confirmed');

      setStatus('Getting recent blockhash...');
      const { blockhash } = await connection.getRecentBlockhash();
      const maxPriceInLamports = floorDetails.maxPrice * SOL_TO_LAMPORTS;
      console.log('Obtained blockhash:', blockhash);

      setStatus('Building buy transaction...');
      const buyUrl = `https://api.mainnet.tensordev.io/api/v1/tx/buy?buyer=${userPublicKey}&mint=${floorDetails.mint}&owner=${floorDetails.owner}&maxPrice=${maxPriceInLamports}&blockhash=${blockhash}`;
      console.log('Buy URL:', buyUrl);
      const resp = await fetch(buyUrl, {
        headers: { 'x-tensor-api-key': TENSOR_API_KEY },
      });
      const rawText = await resp.text();
      console.log('Raw response from buy endpoint:', rawText);
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(
          'Tensor returned non-JSON response. Check console for details.',
        );
      }
      if (!data.txs || data.txs.length === 0) {
        throw new Error('No transactions returned from Tensor API for buying.');
      }
      console.log('Transactions received:', data.txs);

      setStatus('Preparing to sign transactions...');
      for (let i = 0; i < data.txs.length; i++) {
        const txObj = data.txs[i];
        let transaction: Transaction | VersionedTransaction;
        if (txObj.txV0) {
          const txBuffer = Buffer.from(txObj.txV0.data, 'base64');
          transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
          console.log(`Deserialized versioned transaction #${i + 1}`);
        } else if (txObj.tx) {
          const txBuffer = Buffer.from(txObj.tx.data, 'base64');
          transaction = Transaction.from(txBuffer);
          console.log(`Deserialized legacy transaction #${i + 1}`);
        } else {
          throw new Error(`Transaction #${i + 1} is in an unknown format.`);
        }

        setStatus(`Signing transaction ${i + 1} of ${data.txs.length}...`);
        const provider = await userWallet.getProvider();
        const { signature } = await provider.request({
          method: 'signAndSendTransaction',
          params: { transaction, connection },
        });
        console.log(`Transaction #${i + 1} signature: ${signature}`);

        // Show success notification for the last transaction
        if (i === data.txs.length - 1) {
          TransactionService.showSuccess(signature, 'nft');
        }
      }

      setStatus('NFT purchased successfully!');
    } catch (err: any) {
      console.error('Error during buy transaction:', err);
      // Use TransactionService to show error notification
      TransactionService.showError(err);
      setStatus('Transaction failed');
    } finally {
      // Reset modal after a delay
      setTimeout(() => {
        setIsProcessingTx(false);
        setStatus(null);
        setShowBuyModal(false);
        setSelectedCollection(null);
        setFloorNFT(null);
      }, 2000);
    }
  };

  // ------------------------------------------------------------------------
  // 4) Render each collection card
  // ------------------------------------------------------------------------
  const renderCollectionCard = ({ item }: { item: CollectionResult }) => {
    return (
      <View style={styles.collectionCard}>
        <View style={styles.imageContainer}>
          {item.imageUri ? (
            <Image
              source={{ uri: fixImageUrl(item.imageUri) }}
              style={styles.collectionImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.collectionName} numberOfLines={1}>
            {item.name}
          </Text>
          {!!item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <TouchableOpacity
            style={styles.buyButton}
            onPress={async () => {
              console.log('Buy Floor button clicked for collection:', item);
              setSelectedCollection(item);
              // Immediately fetch floor NFT details and store in state
              await fetchFloorNFTForCollection(item.collId);
              setShowBuyModal(true);
            }}>
            <Text style={styles.buyButtonText}>Buy Floor</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ------------------------------------------------------------------------
  // Buy Confirmation Modal
  // ------------------------------------------------------------------------
  const renderBuyModal = () => {
    if (!selectedCollection) return null;
    return (
      <Modal
        visible={showBuyModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowBuyModal(false);
          setSelectedCollection(null);
          setFloorNFT(null);
        }}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isProcessingTx) {
              setShowBuyModal(false);
              setSelectedCollection(null);
              setFloorNFT(null);
            }
          }}>
          <Pressable
            style={styles.modalContent}
            onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Confirm Purchase</Text>
            <Text style={styles.modalText}>
              Collection: {selectedCollection.name}
            </Text>
            {loadingFloorNFT ? (
              <ActivityIndicator size="small" color="#32D4DE" />
            ) : floorNFT ? (
              <Text style={styles.modalText}>
                Price: {floorNFT.maxPrice.toFixed(5)} SOL
              </Text>
            ) : (
              <Text style={styles.modalText}>Price: Loading...</Text>
            )}

            {/* Add status display */}
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

            {/* Show activity indicator or button based on processing state */}
            {isProcessingTx ? (
              <View style={styles.confirmButton}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  console.log('Confirm Buy clicked');
                  handleBuyFloor(selectedCollection);
                }}
                disabled={!floorNFT || loadingFloorNFT}>
                <Text style={styles.confirmButtonText}>Confirm Buy</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ------------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------------
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>Collection Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Mad Lads"
        value={collectionName}
        onChangeText={setCollectionName}
      />
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleSearchCollections}>
        <Text style={styles.actionButtonText}>Search Collection</Text>
      </TouchableOpacity>
      {loadingSearch && (
        <ActivityIndicator
          size="large"
          color="#32D4DE"
          style={{ marginVertical: 16 }}
        />
      )}
      <FlatList
        data={searchResults}
        keyExtractor={item => item.collId}
        renderItem={renderCollectionCard}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          !loadingSearch ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results to display.</Text>
            </View>
          ) : null
        }
      />
      {renderBuyModal()}
    </View>
  );
};

export default BuySection;
