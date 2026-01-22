import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SwapTransaction, fetchRecentSwaps, enrichSwapTransactions } from '../../../../modules/data-module/services/swapTransactions';
import PastSwapItem from './PastSwapItem';

const { height } = Dimensions.get('window');

interface PastSwapsTabProps {
  walletAddress: string;
  onSwapSelected: (swap: SwapTransaction) => void;
}

/**
 * Component for displaying and selecting past swap transactions
 * with Jupiter-inspired UI
 */
const PastSwapsTab: React.FC<PastSwapsTabProps> = ({ walletAddress, onSwapSelected }) => {
  const [swaps, setSwaps] = useState<SwapTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSwap, setSelectedSwap] = useState<SwapTransaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Function to fetch and process past swaps
  const fetchPastSwaps = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Fetch raw swap transactions
      const rawSwaps = await fetchRecentSwaps(walletAddress);

      if (rawSwaps.length === 0) {
        setSwaps([]);
        return;
      }

      // Enrich with token metadata
      const enrichedSwaps = await enrichSwapTransactions(rawSwaps);
      setSwaps(enrichedSwaps);

      // If no swap is selected yet and we have swaps, select the first one
      if (!selectedSwap && enrichedSwaps.length > 0) {
        setSelectedSwap(enrichedSwaps[0]);
        onSwapSelected(enrichedSwaps[0]);
      }
    } catch (err: any) {
      console.error('Error fetching past swaps:', err);
      setError(err.message || 'Failed to load past swaps');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchPastSwaps();
  }, [walletAddress]);

  // Handle swap selection
  const handleSelectSwap = (swap: SwapTransaction) => {
    setSelectedSwap(swap);
    onSwapSelected(swap);
  };

  // Refresh handler
  const handleRefresh = () => {
    fetchPastSwaps(true);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3871DD" />
        <Text style={styles.loadingText}>Loading your past swaps...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorIconContainer}>
          <FontAwesome5 name="exclamation-circle" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.errorTitle}>Failed to Load Swaps</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchPastSwaps()}>
          <FontAwesome5 name="sync" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (swaps.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyStateIcon}>
          <FontAwesome5 name="exchange-alt" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.emptyText}>No Swap History Found</Text>
        <Text style={styles.emptySubText}>Complete a token swap to see it here</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchPastSwaps()}>
          <FontAwesome5 name="sync" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Select a swap to share</Text>
        <TouchableOpacity
          style={styles.refreshIconButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <FontAwesome5
            name="sync"
            size={14}
            color="#4B5563"
            style={refreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={swaps}
        renderItem={({ item }) => (
          <PastSwapItem
            swap={item}
            onSelect={handleSelectSwap}
            selected={selectedSwap?.signature === item.signature}
          />
        )}
        keyExtractor={item => item.signature}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        bounces={true}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  refreshIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3871DD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#3871DD',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#3871DD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3871DD',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default PastSwapsTab; 