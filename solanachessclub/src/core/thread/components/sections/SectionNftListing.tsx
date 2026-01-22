import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NftListingData as ThreadNftListingData } from '../thread.types';
import { NftDetailsSection, NftListingData } from '../../../../modules/nft';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

interface SectionNftListingProps {
  listingData?: ThreadNftListingData;
  compact?: boolean;
}

/**
 * Component for displaying NFT listings within threads
 * Enhanced for better display in chat interfaces with dark theme support
 */
export default function SectionNftListing({ listingData, compact = false }: SectionNftListingProps) {
  if (!listingData) {
    return null;
  }

  // Convert the thread NftListingData to the module's NftListingData type
  // The main difference is that owner is string | null in thread types
  // and string | undefined in module types
  const convertedListingData: NftListingData = {
    ...listingData,
    owner: listingData.owner || undefined,
  };

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <NftDetailsSection
        listingData={convertedListingData}
        containerStyle={[
          styles.nftContainer,
          compact && styles.compactNftContainer
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  compactContainer: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  nftContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 12,
  },
  compactNftContainer: {
    padding: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.darkerBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDarkColor,
  },
  priceLabel: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  priceValue: {
    color: COLORS.brandPurple,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});

