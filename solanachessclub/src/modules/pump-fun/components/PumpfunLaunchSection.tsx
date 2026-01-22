import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  View,
  Switch,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { usePumpFun } from '../hooks/usePumpFun';
// import { PumpfunLaunchStyles } from './Pumpfun.styles'; // Removed old styles
import PumpfunCard from './PumpfunCard';
import { PumpfunLaunchSectionProps } from '../types';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { TransactionService } from '@/modules/wallet-providers';

export const PumpfunLaunchSection: React.FC<PumpfunLaunchSectionProps> = ({
  containerStyle,
  inputStyle,
  buttonStyle,
  launchButtonLabel = 'Launch Token',
}) => {
  const { launchToken } = usePumpFun();

  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [website, setWebsite] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [solAmount, setSolAmount] = useState('0.001');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Add a new state variable to track whether social fields are visible
  const [showSocials, setShowSocials] = useState(false);

  // Add a function to toggle social fields visibility
  const toggleSocials = () => {
    setShowSocials(!showSocials);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const handleLaunch = async () => {
    if (!tokenName || !tokenSymbol || !description || !imageUri) {
      Alert.alert(
        'Error',
        'Please fill in name, symbol, description, and select an image.',
      );
      return;
    }

    setLoading(true);
    setStatus('Preparing token launch...');

    try {
      await launchToken({
        tokenName,
        tokenSymbol,
        description,
        twitter,
        telegram,
        website,
        imageUri,
        solAmount: Number(solAmount),
        onStatusUpdate: newStatus => {
          console.log('Launch token status:', newStatus);
          // Use TransactionService to filter raw error messages
          TransactionService.filterStatusUpdate(newStatus, setStatus);
        },
      });
      setStatus('Token launched successfully!');
      // Success message will be handled by TransactionService
    } catch (error: any) {
      console.error('Launch error:', error);
      // Don't show raw error in UI
      setStatus('Transaction failed');
      // Error notification will be handled by TransactionService
    } finally {
      setTimeout(() => {
        setLoading(false);
        setStatus(null);
      }, 2000);
    }
  };

  return (
    <PumpfunCard containerStyle={containerStyle}>
      {/* <Text style={styles.header}>Pumpfun Token Launch</Text> */}

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Token Name</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="..."
          placeholderTextColor={COLORS.greyMid}
          value={tokenName}
          onChangeText={setTokenName}
          editable={!loading}
          keyboardAppearance="dark"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Token Symbol</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="..."
          placeholderTextColor={COLORS.greyMid}
          value={tokenSymbol}
          onChangeText={setTokenSymbol}
          editable={!loading}
          keyboardAppearance="dark"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.input, inputStyle, { height: 80 }]}
          placeholder="..."
          placeholderTextColor={COLORS.greyMid}
          multiline
          value={description}
          onChangeText={setDescription}
          editable={!loading}
          keyboardAppearance="dark"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Initial SOL to Buy</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="0.001"
          placeholderTextColor={COLORS.greyMid}
          keyboardType="decimal-pad"
          value={solAmount}
          onChangeText={setSolAmount}
          editable={!loading}
          keyboardAppearance="dark"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Token Image</Text>
        <View style={styles.imageUploadContainer}>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <View style={styles.imageControlsContainer}>
                <TouchableOpacity
                  style={styles.imageControlButton}
                  onPress={pickImage}
                  disabled={loading}>
                  <Text style={styles.imageControlText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageControlButton, styles.removeButton]}
                  onPress={removeImage}
                  disabled={loading}>
                  <Text style={styles.imageControlText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.uploadContent}>
              <View style={styles.uploadIconContainer}>
                <View style={styles.uploadIcon}>
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 3L12 17M12 3L7 8M12 3L17 8"
                      stroke={COLORS.white}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M3 21H21M3 21V19M21 21V19"
                      stroke={COLORS.white}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
              </View>
              <Text style={styles.uploadText}>
                drag and drop an image or video
              </Text>
              <TouchableOpacity
                onPress={pickImage}
                style={styles.selectFileButton}
                disabled={loading}>
                <Text style={styles.selectFileText}>select file</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Add socials section moved to after image upload */}
      <View style={styles.formField}>
        <TouchableOpacity
          style={styles.socialsToggleButton}
          onPress={toggleSocials}
          disabled={loading}>
          <Text style={styles.socialsToggleText}>
            add socials (optional) {showSocials ? '↑' : '↓'}
          </Text>
        </TouchableOpacity>

        {showSocials && (
          <View style={styles.socialsContainer}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Twitter (optional)</Text>
              <TextInput
                style={[styles.input, inputStyle]}
                placeholder="..."
                placeholderTextColor={COLORS.greyMid}
                value={twitter}
                onChangeText={setTwitter}
                editable={!loading}
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Telegram (optional)</Text>
              <TextInput
                style={[styles.input, inputStyle]}
                placeholder="..."
                placeholderTextColor={COLORS.greyMid}
                value={telegram}
                onChangeText={setTelegram}
                editable={!loading}
                keyboardAppearance="dark"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Website (optional)</Text>
              <TextInput
                style={[styles.input, inputStyle]}
                placeholder="..."
                placeholderTextColor={COLORS.greyMid}
                value={website}
                onChangeText={setWebsite}
                editable={!loading}
                keyboardAppearance="dark"
              />
            </View>
          </View>
        )}
      </View>

      {status && (
        <View style={styles.statusContainer}>
          <ActivityIndicator
            size="small"
            color={COLORS.brandBlue}
            style={styles.loader}
          />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleLaunch}
          style={[styles.button, buttonStyle, loading && styles.disabledButton]}
          disabled={loading}>
          <Text style={styles.buttonText}>{launchButtonLabel}</Text>
        </TouchableOpacity>
      </View>
    </PumpfunCard>
  );
};

const styles = StyleSheet.create({
  header: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
    marginBottom: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginBottom: 8,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  input: {
    backgroundColor: 'transparent',
    color: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: TYPOGRAPHY.size.md,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  imageUploadContainer: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderStyle: 'dashed',
    height: 200,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    padding: 20,
  },
  uploadIconContainer: {
    marginBottom: 16,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  uploadText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  selectFileButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  selectFileText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageControlsContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
  },
  imageControlButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  removeButton: {
    backgroundColor: 'rgba(220,53,69,0.8)', // Red color with transparency
  },
  imageControlText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  verificationSection: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  verificationTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginBottom: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  switchDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  switchControl: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  verificationOptionsContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDarkColor,
  },
  verificationNote: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.brandBlue,
    marginTop: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  loader: {
    marginRight: 10,
  },
  statusText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  buttonContainer: {
    marginTop: 20,
    width: '100%',
  },
  button: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  socialsToggleButton: {
    paddingVertical: 12,
    marginBottom: 0,
  },
  socialsToggleText: {
    color: COLORS.brandBlue,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  socialsContainer: {
    marginTop: 8,
  },
});

export default PumpfunLaunchSection;
