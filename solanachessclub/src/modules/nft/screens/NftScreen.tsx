import React, { useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import BuySection from './BuySection';
import SellSection from './SellSection';
import { styles } from './styles';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';



/**
 * Main NFT screen that shows two tabs: "Buy" and "Sell".
 * When "Buy" is active, it renders <BuySection/>; 
 * When "Sell" is active, it renders <SellSection/>.
 */
const NftScreen: React.FC = () => {
  const { solanaWallet } = useAuth();
  const myWallet = useAppSelector(state => state.auth.address);


  // For simplicity, using the first connected wallet
  const userPublicKey = solanaWallet?.wallets?.[0]?.publicKey || myWallet || null;
  const userWallet = solanaWallet?.wallets?.[0] || null;

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // Get the status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

  if (!userPublicKey) {
    return (
      <>
        {Platform.OS === 'android' && <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: styles.container.backgroundColor }} />}
        <SafeAreaView style={[styles.container, Platform.OS === 'android' && androidStyles.container]}>
          <Text style={styles.warnText}>Please connect your wallet first!</Text>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      {Platform.OS === 'android' && <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: styles.container.backgroundColor }} />}
      <SafeAreaView style={[styles.container, Platform.OS === 'android' && androidStyles.container]}>
        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'buy' && styles.tabButtonActive]}
            onPress={() => setActiveTab('buy')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'buy' && styles.tabButtonTextActive]}>
              Buy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'sell' && styles.tabButtonActive]}
            onPress={() => setActiveTab('sell')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'sell' && styles.tabButtonTextActive]}>
              Sell
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conditional rendering of Buy or Sell sections */}
        {activeTab === 'buy' && (
          <BuySection userPublicKey={userPublicKey} userWallet={userWallet} />
        )}
        {activeTab === 'sell' && (
          <SellSection userPublicKey={userPublicKey} userWallet={userWallet} />
        )}
      </SafeAreaView>
    </>
  );
};

// Add Android-specific styles
const androidStyles = StyleSheet.create({
  container: {
    paddingTop: 0, // We're handling this with the extra View
  }
});

export default NftScreen;


