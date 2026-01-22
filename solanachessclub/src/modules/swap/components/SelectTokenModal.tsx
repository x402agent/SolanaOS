import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StyleSheet,
  Alert,
  Animated,
  Easing
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { TokenInfo, useTokenSearch } from '@/modules/data-module';

const { height } = Dimensions.get('window');

// Enhanced Shimmer effect component for loading states
const Shimmer = ({ 
  width: componentWidth, 
  height, 
  style, 
  borderRadius = 4 
}: { 
  width: number | string, 
  height: number | string, 
  style?: any,
  borderRadius?: number 
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const actualWidth = typeof componentWidth === 'number' ? componentWidth : 100;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false
      })
    );
    
    shimmerAnimation.start();
    
    return () => {
      shimmerAnimation.stop();
      animatedValue.setValue(0);
    };
  }, []);

  // Create a more smooth gradient effect
  const shimmerOpacity = animatedValue.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [0.2, 0.4, 0.2, 0.2]
  });
  
  // Create a smoother horizontal movement
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-actualWidth, actualWidth]
  });

  return (
    <View 
      style={[
        { 
          width: componentWidth, 
          height, 
          backgroundColor: COLORS.darkerBackground,
          overflow: 'hidden',
          borderRadius: borderRadius
        },
        style
      ]}
    >
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          transform: [{ translateX }],
          opacity: shimmerOpacity,
          backgroundColor: COLORS.white,
          position: 'absolute',
          left: 0,
          top: 0
        }}
      />
    </View>
  );
};

// Styles specific to this modal
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.lightBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    maxHeight: height * 0.8,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: String(TYPOGRAPHY.bold) as any,
    color: COLORS.white,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: String(TYPOGRAPHY.medium) as any,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    padding: 0,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  tokenItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.darkerBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  tokenSymbol: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: String(TYPOGRAPHY.bold) as any,
    color: COLORS.white,
  },
  tokenName: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginTop: 2,
  },
  tokenStats: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenPrice: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyLight,
  },
  tokenChange: {
    fontSize: TYPOGRAPHY.size.xs,
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyMid,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyMid,
    textAlign: 'center',
  },
  closeButton: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.darkerBackground,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  closeButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: String(TYPOGRAPHY.medium) as any,
    color: COLORS.white,
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  selectionOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  selectionTextContainer: {
    backgroundColor: COLORS.lightBackground,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    width: '80%',
  },
  selectionText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
    marginBottom: 8,
  },
  favoriteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.darkerBackground + '80',
  },
  favoriteHeaderText: {
    color: COLORS.greyLight,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: String(TYPOGRAPHY.bold) as any,
    marginLeft: 8,
  }
});

// Token item skeleton for loading states
const TokenItemSkeleton = () => (
  <View style={styles.tokenSkeleton}>
    <Shimmer width={40} height={40} borderRadius={20} />
    <View style={{ marginLeft: 16, flex: 1 }}>
      <Shimmer width={100} height={18} borderRadius={4} style={{ marginBottom: 6 }} />
      <Shimmer width={150} height={14} borderRadius={3} />
    </View>
  </View>
);

interface SelectTokenModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback fired when the modal is closed */
  onClose: () => void;
  /** Callback fired when a token is selected */
  onTokenSelected: (token: TokenInfo) => void;
}

export default function SelectTokenModal({
  visible,
  onClose,
  onTokenSelected,
}: SelectTokenModalProps) {
  // Use the enhanced token search hook with debounce
  const {
    tokens: rawTokens,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
    isRefreshing
  } = useTokenSearch('', 300);

  // State for deduplicated tokens
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  
  // State to track token selection in progress
  const [selecting, setSelecting] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);

  // Keep track of component mounting state
  const isMounted = useRef(true);
  const hasUserSearched = useRef(false);
  
  // Token selection timeout
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  // Deduplicate tokens when rawTokens change
  useEffect(() => {
    // Use a Map to keep only the first occurrence of each token address
    const uniqueTokensMap = new Map<string, TokenInfo>();

    rawTokens.forEach(token => {
      if (!uniqueTokensMap.has(token.address)) {
        uniqueTokensMap.set(token.address, token);
      }
    });

    // Convert Map values back to array
    setTokens(Array.from(uniqueTokensMap.values()));
  }, [rawTokens]);

  // Reset search ONLY when modal initially becomes visible
  useEffect(() => {
    if (visible && !hasUserSearched.current) {
      setSearchQuery('');
      refresh();
    }

    // When modal becomes invisible, reset the states
    if (!visible) {
      hasUserSearched.current = false;
      setSelecting(false);
      setSelectedToken(null);
      
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = null;
      }
    }
  }, [visible, refresh, setSearchQuery]);

  /**
   * Handles search input changes
   */
  const handleSearchChange = (text: string) => {
    hasUserSearched.current = true; // Mark that user has started searching
    setSearchQuery(text);
  };

  /**
   * Handles end of list reached to load more tokens
   */
  const handleEndReached = () => {
    if (!loading && rawTokens.length > 0) {
      loadMore();
    }
  };
  
  /**
   * Enhanced token selection handler with safeguards
   */
  const handleTokenSelection = useCallback((token: TokenInfo) => {
    if (selecting) return; // Prevent duplicate selections
    
    setSelecting(true);
    setSelectedToken(token);
    
    // Clear any existing timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    // Set a timeout to prevent infinite loading
    selectionTimeoutRef.current = setTimeout(() => {
      if (isMounted.current && selecting) {
        setSelecting(false);
        setSelectedToken(null);
        Alert.alert(
          "Selection Timed Out",
          "Please try selecting the token again.",
          [{ text: "OK" }]
        );
      }
    }, 10000); // 10 second timeout
    
    // Call the parent callback
    onTokenSelected(token);
    
    // Automatically close modal after selection (will be cancelled if modal remains open)
    const closeTimeout = setTimeout(() => {
      if (isMounted.current && selecting) {
        // If we're still selecting after 3.5 seconds, close the modal to prevent UI hangs
        setSelecting(false);
        onClose();
      }
    }, 3500);
    
    return () => {
      clearTimeout(closeTimeout);
    };
  }, [selecting, onTokenSelected, onClose]);

  /**
   * Renders a single token item in the list
   */
  const renderItem = ({ item }: { item: TokenInfo }) => (
    <TouchableOpacity
      style={styles.tokenItem}
      onPress={() => handleTokenSelection(item)}
      activeOpacity={0.7}
      disabled={selecting}
    >
      <View style={styles.tokenItemContent}>
        {item.logoURI ? (
          <Image
            source={{ uri: item.logoURI }}
            style={styles.tokenLogo}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.tokenLogo}>
            <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 12 }}>
              {item.symbol && typeof item.symbol === 'string' ? item.symbol.charAt(0) : '?'}
            </Text>
          </View>
        )}
        <View style={styles.tokenTextContainer}>
          <Text style={styles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
            {item.symbol || 'Unknown'}
          </Text>
          <Text style={styles.tokenName} numberOfLines={1} ellipsizeMode="tail">
            {item.name || 'Unknown Token'}
          </Text>
          <View style={styles.tokenStats}>
            {item.price !== undefined && item.price !== null && (
              <Text style={styles.tokenPrice}>
                ${item.price.toFixed(item.price < 0.01 ? 6 : 2)}
              </Text>
            )}
            {item.priceChange24h !== undefined && item.priceChange24h !== null && (
              <Text
                style={[
                  styles.tokenChange,
                  {
                    backgroundColor: item.priceChange24h >= 0 ? 'rgba(0, 200, 83, 0.2)' : 'rgba(255, 45, 85, 0.2)',
                    color: item.priceChange24h >= 0 ? '#00C853' : '#FF2D55'
                  }
                ]}
              >
                {item.priceChange24h >= 0 ? '+' : ''}{item.priceChange24h.toFixed(2)}%
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  /**
   * Renders a loading indicator at the bottom when loading more tokens
   */
  const renderFooter = () => {
    if (!loading && !isRefreshing) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={COLORS.brandPrimary} />
      </View>
    );
  };

  /**
   * Render popular tokens section
   */
  const renderPopularTokensHeader = () => {
    if (searchQuery.trim() !== '' || tokens.length === 0) return null;
    
    return (
      <View style={styles.favoriteHeader}>
        <FontAwesome5 name="star" size={12} color={COLORS.greyLight} />
        <Text style={styles.favoriteHeaderText}>Popular Tokens</Text>
      </View>
    );
  };
  
  /**
   * Render skeleton loaders when initially loading
   */
  const renderSkeletonLoaders = () => (
    <View>
      {Array.from({ length: 8 }).map((_, index) => (
        <TokenItemSkeleton key={`skeleton-${index}`} />
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Token</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={onClose}
              disabled={selecting}
            >
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <FontAwesome5 name="search" size={16} color={COLORS.greyMid} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, symbol, or address"
              placeholderTextColor={COLORS.greyMid}
              value={searchQuery}
              onChangeText={handleSearchChange}
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!selecting}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} disabled={selecting}>
                <Ionicons name="close-circle" size={18} color={COLORS.greyMid} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>

          {loading && tokens.length === 0 ? (
            renderSkeletonLoaders()
          ) : (
            <>
              <FlatList
                data={tokens}
                keyExtractor={(item) => item.address}
                renderItem={renderItem}
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={renderPopularTokensHeader}
                ListFooterComponent={renderFooter}
                refreshing={isRefreshing}
                onRefresh={refresh}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {error ? `Error: ${error}` :
                        searchQuery ? `No tokens found matching "${searchQuery}"` :
                          'No tokens available'}
                    </Text>
                    {error && (
                      <TouchableOpacity
                        style={{ marginTop: 12, padding: 8 }}
                        onPress={refresh}
                      >
                        <Text style={{ color: COLORS.brandPrimary }}>Try Again</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                }
              />

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={selecting}
              >
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Selection in progress overlay */}
          {selecting && (
            <View style={styles.selectionOverlay}>
              <View style={styles.selectionTextContainer}>
                <Text style={styles.selectionText}>
                  {selectedToken ? `Loading ${selectedToken.symbol}...` : 'Loading selected token...'}
                </Text>
                <ActivityIndicator size="large" color={COLORS.brandPrimary} />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
} 