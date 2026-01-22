import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../../wallet-providers/hooks/useAuth';
import PumpfunLaunchSection from '../components/PumpfunLaunchSection';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Icons from '@/assets/svgs';
import { AppHeader } from '@/core/shared-ui';

export default function PumpfunScreen() {
  const { solanaWallet } = useAuth();
  const myWallet = useAppSelector(state => state.auth.address);
  const navigation = useNavigation();

  const userPublicKey = solanaWallet?.wallets?.[0]?.publicKey || myWallet || null;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (!userPublicKey) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader
          title="Pump.fun"
          showBackButton={true}
          onBackPress={handleBack}
          showDefaultRightIcons={true}
        />
        <View style={styles.centeredMessageContainer}>
          <Text style={styles.warnText}>Please connect your wallet first!</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader
        title="Pump.fun"
        showBackButton={true}
        onBackPress={handleBack}
        showDefaultRightIcons={true}
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Create a new coin</Text>

        <PumpfunLaunchSection
          containerStyle={styles.cardContainer}
          inputStyle={styles.input}
          buttonStyle={styles.button}
          launchButtonLabel="Go Live!"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  warnText: {
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.white,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    alignSelf: 'center',
  },
  cardContainer: {
    backgroundColor: COLORS.background,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'transparent',
    color: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: TYPOGRAPHY.size.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderDarkColor,
    marginBottom: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  button: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
});
