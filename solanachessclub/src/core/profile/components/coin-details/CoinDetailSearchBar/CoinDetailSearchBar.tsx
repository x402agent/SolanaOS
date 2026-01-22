// FILE: src/components/CoinDetails/CoinDetailSearchBar/CoinDetailSearchBar.tsx

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleProp,
  ViewStyle,
  Image,
  ImageStyle,
} from 'react-native';
import {COINGECKO_API_KEY} from '@env'; // <--  to supply the API key for images
import {useCoingecko} from '@/modules/data-module/hooks/useCoingecko';
import {searchBarStyles} from './CoinDetailSearchBar.style';
import Icons from '@/assets/svgs/index';

export type CoinListItem = {
  id: string;
  symbol: string;
  name: string;
};

export interface CoinDetailSearchBarCustomStyles {
  container?: StyleProp<ViewStyle>;
  input?: StyleProp<ViewStyle>;
  dropdown?: StyleProp<ViewStyle>;
  dropdownItem?: StyleProp<ViewStyle>;
  dropdownItemText?: StyleProp<ViewStyle>;
  coinImage?: StyleProp<ImageStyle>;
}

interface CoinDetailSearchBarProps {
  /** Callback to notify parent of the selected coin ID */
  onSelectCoinId: (coinId: string) => void;
  /** Optional custom styles to override defaults */
  customStyles?: CoinDetailSearchBarCustomStyles;
}

/**
 * A search bar that displays autocomplete suggestions for coins, along with coin icons.
 */
export const CoinDetailSearchBar: React.FC<CoinDetailSearchBarProps> = ({
  onSelectCoinId,
  customStyles = {},
}) => {
  // Use unified Coingecko hook
  const {searchCoins, loadingCoinList, searchResults} = useCoingecko();

  const [query, setQuery] = useState('');
  const [filteredCoins, setFilteredCoins] = useState<CoinListItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Local cache of fetched coin images keyed by ID
  const [coinImages, setCoinImages] = useState<Record<string, string>>({});

  // Handle text changes => triggers search
  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (text.trim().length === 0) {
        setFilteredCoins([]);
        setShowDropdown(false);
        return;
      }
      // Kick off search in useCoingecko
      searchCoins(text);
      setShowDropdown(true);
    },
    [searchCoins],
  );

  // Whenever global `searchResults` changes => local top-7
  useEffect(() => {
    if (searchResults.length > 0) {
      setFilteredCoins(searchResults.slice(0, 7));
    } else {
      setFilteredCoins([]);
    }
  }, [searchResults]);

  // Clear everything on user "select coin" or "X" button
  const handleSelectCoin = (coinId: string) => {
    setQuery('');
    setFilteredCoins([]);
    setShowDropdown(false);
    onSelectCoinId(coinId);
  };

  const handleClear = () => {
    setQuery('');
    setFilteredCoins([]);
    setShowDropdown(false);
  };

  // Hide dropdown if blank
  useEffect(() => {
    if (!query.trim()) {
      setShowDropdown(false);
    }
  }, [query]);

  /**
   * Fetch icons for the currently displayed `filteredCoins`.
   * This replicates the logic from the old code, including an API key header.
   */
  useEffect(() => {
    if (filteredCoins.length === 0) {
      setCoinImages({});
      return;
    }
    (async () => {
      try {
        const idsParam = filteredCoins.map(c => c.id).join(',');
        const url = `https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}`;
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            'x-cg-pro-api-key': COINGECKO_API_KEY || '',
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch coin images: ${response.status}`);
        }
        const data = await response.json();
        const newImages: Record<string, string> = {};
        data.forEach((item: any) => {
          if (item.id && item.image) {
            newImages[item.id] = item.image;
          }
        });
        setCoinImages(newImages);
      } catch (error) {
        console.warn(
          '[CoinDetailSearchBar] Could not fetch coin images:',
          error,
        );
      }
    })();
  }, [filteredCoins]);

  const styles = searchBarStyles;

  return (
    <View style={[styles.container, customStyles.container]}>
      {/* Input Container */}
      <View
        style={[styles.inputContainer, isFocused && {borderColor: '#318EF8'}]}>
        <Icons.MagnifyingGlass style={styles.searchIcon} />

        <TextInput
          placeholder="Search coins by name or symbol..."
          placeholderTextColor="#999"
          style={[styles.input, customStyles.input]}
          value={query}
          onChangeText={handleChangeText}
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {loadingCoinList && (
        <Text style={styles.loadingText}>Loading coins...</Text>
      )}

      {/* Dropdown with filtered coins */}
      {showDropdown && filteredCoins.length > 0 && (
        <View style={[styles.dropdown, customStyles.dropdown]}>
          {filteredCoins.map((coin, index) => {
            const isLast = index === filteredCoins.length - 1;
            const coinImgSrc = coinImages[coin.id];

            return (
              <TouchableOpacity
                key={coin.id}
                style={[
                  styles.dropdownItem,
                  customStyles.dropdownItem,
                  isLast && styles.dropdownItemLast,
                ]}
                onPress={() => handleSelectCoin(coin.id)}>
                <Image
                  source={
                    coinImgSrc
                      ? {uri: coinImgSrc}
                      : require('@/assets/images/SENDlogo.png')
                  }
                  style={[styles.coinImage, customStyles.coinImage]}
                />
                <View style={styles.dropdownItemTextContainer}>
                  <Text
                    style={[
                      styles.dropdownItemName,
                      customStyles.dropdownItemText,
                    ]}
                    numberOfLines={2}>
                    {coin.name}
                  </Text>
                  <Text
                    style={[
                      styles.dropdownItemSymbol,
                      customStyles.dropdownItemText,
                    ]}>
                    {coin.symbol.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};
