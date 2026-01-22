// File: src/screens/TokenMillScreen/components/ExistingAddressesCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';

// Updated props interface
export interface ExistingAddressesCardProps {
  marketAddress: string;
  setMarketAddress: (addr: string) => void;
  baseTokenMint: string;
  setBaseTokenMint: (mint: string) => void;
}

export default function ExistingAddressesCard({
  marketAddress,
  setMarketAddress,
  baseTokenMint,
  setBaseTokenMint
}: ExistingAddressesCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Market Address</Text>
        <TextInput
          style={styles.input}
          placeholder="..."
          placeholderTextColor={COLORS.greyMid}
          value={marketAddress}
          onChangeText={setMarketAddress}
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Base Token Mint</Text>
        <TextInput
          style={styles.input}
          placeholder="..."
          placeholderTextColor={COLORS.greyMid}
          value={baseTokenMint}
          onChangeText={setBaseTokenMint}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.greyMid,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
    color: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  }
});
