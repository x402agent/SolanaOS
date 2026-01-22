import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../../modules/wallet-providers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../../assets/svgs';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { AppHeader } from '@/core/shared-ui';

// Commented sections to be re-enabled later if needed
const modules = [
  {
    key: 'pumpfun',
    title: 'Pumpfun',
    subtitle: 'The OG Solana Launchpad',
    navigateTo: 'Pumpfun',
    iconImage: require('@/assets/images/Pumpfun_logo.png'),
    backgroundImage: require('@/assets/images/Pumpfun_bg.png'),
    usePngIcon: true,
  },
  // {
  //   key: 'pumpswap',
  //   title: 'Pump Swap',
  //   description:
  //     'Swap tokens, add/remove liquidity, and create pools on the Solana blockchain.',
  //   backgroundColor: '#BBDEFB',
  //   navigateTo: 'PumpSwap',
  // },
  {
    key: 'launchlab',
    title: 'Launch Lab',
    subtitle: 'Launch Tokens via Raydium',
    navigateTo: 'LaunchlabsScreen',
    iconComponent: Icons.RadyuimIcom,
    backgroundImage: require('@/assets/images/Rayduim_bg.png'),
  },

  {
    key: 'meteora',
    title: 'Meteora',
    subtitle: 'Powerful DEX with concentrated liquidity',
    navigateTo: 'MeteoraScreen',
    iconImage: require('@/assets/images/meteora.jpg'),
    backgroundImage: require('@/assets/images/new_meteora_cover.png'),
    usePngIcon: true,
  },
  {
    key: 'tokenmill',
    title: 'Token Mill',
    subtitle: 'Launch tokens with customizable bonding curve',
    navigateTo: 'TokenMill',
    iconComponent: Icons.TokenMillIcon,
    backgroundImage: require('@/assets/images/TokenMill_bg.png'),
  },
  // {
  //   key: 'nft',
  //   title: 'NFT Screen',
  //   description:
  //     'Browse, buy, and sell NFTs with integrated wallet support and listing functionality.',
  //   backgroundColor: '#E1BEE7',
  //   navigateTo: 'NftScreen',
  // },
];

// Define styles for the LaunchPads screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 16,
    marginLeft: 4,
    textAlign: 'center',
  },
  launchCard: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardBackground: {
    width: '100%',
    height: '100%',
  },
  cardFooter: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '75%',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.greyLight,
    marginTop: 2,
  },
  launchButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginLeft: 8,
  },
  launchButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  }
});

// Android specific styles
const androidStyles = StyleSheet.create({
  safeArea: {
    paddingTop: 45,
  },
  headerContainer: {
    paddingTop: 12,
  },
});

export default function ModuleScreen() {
  const navigation = useNavigation();

  const handlePress = useCallback((module: any) => {
    if (module.navigateTo) {
      navigation.navigate(module.navigateTo as never);
    }
  }, [navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);


  // Render a launch card
  const renderLaunchCard = (module: any) => {
    const IconComponent = module.iconComponent;

    return (
      <View key={module.key} style={styles.launchCard}>
        <ImageBackground
          source={module.backgroundImage}
          style={styles.cardBackground}
          resizeMode="cover"
        >
          <BlurView
            intensity={45}
            tint="dark"
            style={styles.cardFooter}
          >
            <View style={styles.cardInfo}>
              <View style={styles.iconContainer}>
                {module.usePngIcon ? (
                  <Image
                    source={module.iconImage}
                    style={{ width: 32, height: 32 }}
                    resizeMode="contain"
                  />
                ) : module.key === 'launchlab' ? (
                  <IconComponent width={32} height={32} color="#F5C05E" />
                ) : (
                  <IconComponent width={32} height={32} color={COLORS.white} />
                )}
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>{module.title}</Text>
                <Text style={styles.cardSubtitle}>{module.subtitle}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.launchButton}
              onPress={() => handlePress(module)}
            >
              <Text style={styles.launchButtonText}>Launch</Text>
            </TouchableOpacity>
          </BlurView>
        </ImageBackground>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' && androidStyles.safeArea,
      ]}>
      {/* {renderLoggingOutOverlay()} */}

      {/* Replace custom header with reusable AppHeader */}
      <AppHeader
        title="Launchpads"
        showBackButton={true}
        onBackPress={handleBack}
        style={Platform.OS === 'android' ? androidStyles.headerContainer : undefined}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Launch via</Text>

        {/* Only render active modules */}
        {modules.map(module => renderLaunchCard(module))}
      </ScrollView>
    </SafeAreaView>
  );
}
