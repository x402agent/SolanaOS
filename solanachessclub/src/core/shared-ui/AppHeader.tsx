import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Icons from '@/assets/svgs';

interface AppHeaderProps {
  /**
   * Title to display in the center of the header
   */
  title?: string;
  
  /**
   * Whether to show a back button on the left
   * @default true
   */
  showBackButton?: boolean;
  
  /**
   * Whether to show a bottom border gradient
   * @default true
   */
  showBottomGradient?: boolean;
  
  /**
   * Whether to show default right icons (wallet)
   * @default true
   */
  showDefaultRightIcons?: boolean;
  
  /**
   * Custom component to render on the left side
   * (replaces back button if provided)
   */
  leftComponent?: React.ReactNode;
  
  /**
   * Custom component to render on the right side
   * (replaces default icons if provided)
   */
  rightComponent?: React.ReactNode;
  
  /**
   * Custom function to handle back button press
   * (if not provided, will use navigation.goBack)
   */
  onBackPress?: () => void;
  
  /**
   * Custom function to handle wallet icon press
   */
  onWalletPress?: () => void;
  
  /**
   * Additional styles for the header container
   */
  style?: object;
  
  /**
   * Custom gradient colors for the bottom border
   * @default ['transparent', COLORS.lightBackground]
   */
  gradientColors?: readonly [string, string, ...string[]];
}

/**
 * A reusable header component for app screens with consistent styling
 */
const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBackButton = true,
  showBottomGradient = true,
  showDefaultRightIcons = true,
  leftComponent,
  rightComponent,
  onBackPress,
  onWalletPress,
  style,
  gradientColors = ['transparent', COLORS.lightBackground] as readonly [string, string],
}) => {
  const navigation = useNavigation();
  
  // Default back button handler
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Handle wallet icon press
  const handleWalletPress = () => {
    if (onWalletPress) {
      onWalletPress();
    } else {
      // @ts-ignore - Navigation type is generic
      navigation.navigate('WalletScreen');
    }
  };
  
  return (
    <View style={[styles.container, style]}>
      {/* Left: Back button or custom component */}
      {leftComponent || (showBackButton && (
        <TouchableOpacity onPress={handleBackPress} style={styles.leftButton}>
          <Icons.ArrowLeft width={24} height={24} color={COLORS.white} />
        </TouchableOpacity>
      )) || <View style={styles.leftPlaceholder} />}
      
      {/* Center: Title */}
      {title && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      
      {/* Right: Default icons or custom component */}
      {rightComponent || (showDefaultRightIcons && (
        <View style={styles.rightContainer}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleWalletPress}
          >
            <Icons.walletIcon width={35} height={35} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )) || <View style={styles.rightPlaceholder} />}
      
      {/* Bottom gradient border */}
      {showBottomGradient && (
        <LinearGradient
          colors={gradientColors}
          style={styles.bottomGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}
    </View>
  );
};

// Styles for the header component
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? 12 : 12,
    position: 'relative',
  },
  leftPlaceholder: {
    width: 40,
  },
  rightPlaceholder: {
    width: 40,
  },
  leftButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 16,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50, // Taller gradient like in Thread.tsx
    zIndex: -2, // Lower z-index to ensure it stays behind content
  },
});

export default AppHeader; 