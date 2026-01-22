import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  Image,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { findMentioned } from '@/shared/utils/common/findMentioned';
import TransferBalanceButton from '../transfer-balance-button/transferBalanceButton';
import BuyCard from '../buy-card/buyCard';
import ProfileIcons from '../../../../assets/svgs/index';
import { styles } from './UserProfileInfo.style';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import {
  attachCoinToProfile,
  removeAttachedCoin,
} from '@/shared/state/auth/reducer';
import { tokenModalStyles } from './profileInfoTokenModal.style';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import { AutoAvatar } from '@/shared/components/AutoAvatar';
import { UserProfileInfoProps } from '../../types/index';
// Using require as a fallback strategy for component import issues
const ProfileEditDrawerComponent = require('../profile-edit-drawer/ProfileEditDrawer').default;
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';

/**
 * Generate initials from the username
 */
function getInitials(username: string): string {
  if (!username) return '?';

  // If username already appears to be wallet-derived (6 chars), use first 2 chars
  if (username.length === 6 && /^[a-zA-Z0-9]+$/.test(username)) {
    return username.substring(0, 2).toUpperCase();
  }

  // Otherwise get initials from words
  const words = username.split(' ');
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * InitialsProfilePic - Component for displaying initials as a profile picture
 */
const InitialsProfilePic = memo(({ initials, size = 80 }: { initials: string, size?: number }) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.brandBlue,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: COLORS.white,
          fontSize: size / 3,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {initials}
      </Text>
    </View>
  );
});

/**
 * TokenAttachModal - Component for the token attachment modal
 */
const TokenAttachModal = memo(({
  visible,
  onClose,
  onConfirm,
  tokenDescription,
  onChangeDescription,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tokenDescription: string;
  onChangeDescription: (text: string) => void;
}) => {
  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View style={tokenModalStyles.overlay}>
        <View style={tokenModalStyles.container}>
          <View style={tokenModalStyles.headerRow}>
            <Text style={tokenModalStyles.headerTitle}>Token Details</Text>
            <TouchableOpacity
              style={tokenModalStyles.closeButton}
              onPress={onClose}>
              <Text style={tokenModalStyles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginVertical: 8 }}>
            <Text style={tokenModalStyles.descriptionLabel}>
              Description:
            </Text>
            <TextInput
              style={tokenModalStyles.descriptionInput}
              placeholder="Write a short token description"
              placeholderTextColor={COLORS.greyMid}
              value={tokenDescription}
              onChangeText={onChangeDescription}
              multiline
            />
          </View>

          <View style={tokenModalStyles.actionButtonContainer}>
            <TouchableOpacity
              style={[tokenModalStyles.actionButton, tokenModalStyles.cancelButton]}
              onPress={onClose}>
              <Text style={tokenModalStyles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[tokenModalStyles.actionButton, tokenModalStyles.saveButton]}
              onPress={onConfirm}>
              <Text style={tokenModalStyles.actionButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

/**
 * Bio section with memoized content
 */
const BioSection = memo(({ bioText }: { bioText: string }) => (
  <View style={{ marginTop: 8 }}>
    <Text style={styles.bioSection}>{findMentioned(bioText)}</Text>
  </View>
));

/**
 * Stats section with memoized content
 */
const StatsSection = memo(({
  followersCount,
  followingCount,
  onPressFollowers,
  onPressFollowing,
}: {
  followersCount: number;
  followingCount: number;
  onPressFollowers?: () => void;
  onPressFollowing?: () => void;
}) => (
  <View style={styles.statsContainer}>
    <TouchableOpacity
      style={styles.statItem}
      onPress={onPressFollowers}>
      <Text style={styles.statCount}>
        {followersCount}
      </Text>
      <Text style={styles.statLabel}>
        Followers
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.statItem}
      onPress={onPressFollowing}>
      <Text style={styles.statCount}>
        {followingCount}
      </Text>
      <Text style={styles.statLabel}>
        Following
      </Text>
    </TouchableOpacity>
  </View>
));

/**
 * Edit Profile Button with memoized content
 */
const EditButton = memo(({ onPress, onTransferBalance, onLogout }: { onPress?: () => void; onTransferBalance?: () => void; onLogout?: () => void }) => (
  <View style={{ marginTop: 8, width: '100%', flexDirection: 'column', gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <TouchableOpacity
        style={[styles.editProfileBtn, { flex: 1 }]}
        onPress={onPress}>
        <Text style={styles.editProfileBtnText}>Edit Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.editProfileBtn, { flex: 1 }]}
        onPress={onTransferBalance}>
        <Text style={styles.editProfileBtnText}>Transfer Balance</Text>
      </TouchableOpacity>
    </View>

    {/* {onLogout && (
      <TouchableOpacity
        style={[styles.editProfileBtn, { backgroundColor: COLORS.errorRed }]}
        onPress={onLogout}>
        <Text style={[styles.editProfileBtnText, { color: COLORS.white }]}>Logout</Text>
      </TouchableOpacity>
    )} */}
  </View>
));

/**
 * TokenCard section with memoized content
 */
const TokenCard = memo(({
  attachmentData,
  userWallet,
  isOwnProfile,
  onSelectToken,
  onRemoveCoin
}: {
  attachmentData: UserProfileInfoProps['attachmentData'];
  userWallet: string;
  isOwnProfile: boolean;
  onSelectToken: (token: any) => void;
  onRemoveCoin: () => void;
}) => (
  <View style={{ marginTop: 12 }}>
    <BuyCard
      tokenName={attachmentData?.coin?.symbol || 'Pin your coin'}
      description={
        attachmentData?.coin?.name || 'Attach a token to your profile'
      }
      tokenImage={attachmentData?.coin?.image || null}
      tokenDesc={attachmentData?.coin?.description || ''}
      onBuyPress={() => { }}
      tokenMint={attachmentData?.coin?.mint}
      showDownArrow={isOwnProfile}
      onArrowPress={undefined}
      walletAddress={userWallet}
      onSelectAsset={onSelectToken}
      showRemoveButton={isOwnProfile && !!attachmentData?.coin}
      onRemoveToken={onRemoveCoin}
    />
  </View>
));

/**
 * Follow button section with memoized content
 */
const FollowButton = memo(({
  amIFollowing,
  areTheyFollowingMe,
  onPressFollow,
  onPressUnfollow,
  recipientAddress
}: {
  amIFollowing?: boolean;
  areTheyFollowingMe?: boolean;
  onPressFollow?: () => void;
  onPressUnfollow?: () => void;
  recipientAddress: string;
}) => (
  <View style={{ marginTop: 12 }}>
    <TransferBalanceButton
      amIFollowing={!!amIFollowing}
      areTheyFollowingMe={!!areTheyFollowingMe}
      onPressFollow={onPressFollow || (() => { })}
      onPressUnfollow={onPressUnfollow || (() => { })}
      recipientAddress={recipientAddress}
    />
  </View>
));

/**
 * ProfileHeader - Component for the profile header with avatar, name, and badges
 */
const ProfileHeader = memo(({
  profilePicUrl,
  username,
  handleString,
  showFollowsYou,
  isOwnProfile,
  onAvatarPress,
  userWallet,
}: {
  profilePicUrl: string;
  username: string;
  handleString: string;
  showFollowsYou: boolean;
  isOwnProfile: boolean;
  onAvatarPress?: () => void;
  userWallet?: string;
}) => {
  console.log('[ProfileHeader] profilePicUrl:', profilePicUrl);

  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <TouchableOpacity
        style={[styles.profImgContainer, { backgroundColor: COLORS.background }]}
        onPress={onAvatarPress}
        disabled={!isOwnProfile}>
        <AutoAvatar
          userId={userWallet}
          profilePicUrl={profilePicUrl}
          username={username}
          size={72}
          style={styles.profImg}
          showInitials={true}
        />
      </TouchableOpacity>

      <View>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Text style={styles.username}>
            {username}
          </Text>
          <ProfileIcons.SubscriptionTick />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          <Text style={styles.handleText}>
            {handleString}
          </Text>
          {showFollowsYou && (
            <Text style={styles.followsBadge}>
              Follows you
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});

/**
 * UserProfileInfo - The main profile info component showing:
 * - Avatar, name, handle, bio
 * - Follower/following stats
 * - Edit/Follow button row
 * - If a coin is attached (attachmentData.coin), shows a BuyCard.
 * - If isOwnProfile, user can attach a token via the down arrow on BuyCard.
 */
function UserProfileInfo({
  profilePicUrl,
  username,
  userWallet,
  isOwnProfile,
  onAvatarPress,
  onEditProfile,
  onShareProfile,
  bioText,
  amIFollowing = false,
  areTheyFollowingMe = false,
  onFollowPress,
  onUnfollowPress,
  followersCount = 0,
  followingCount = 0,
  onPressFollowers,
  onPressFollowing,
  attachmentData = {},
}: UserProfileInfoProps) {
  const dispatch = useAppDispatch();
  const { logout } = useAuth();

  // Local state to handle updates
  const [localProfilePic, setLocalProfilePic] = useState(profilePicUrl);
  const [localUsername, setLocalUsername] = useState(username);
  const [localBioText, setLocalBioText] = useState(bioText);

  // Transfer balance state
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setLocalProfilePic(profilePicUrl);
    setLocalUsername(username);
    setLocalBioText(bioText);
  }, [profilePicUrl, username, bioText]);

  // Format wallet address as a handle
  const handleString = useMemo(() =>
    userWallet
      ? '@' + userWallet.slice(0, 6) + '...' + userWallet.slice(-4)
      : '@no_wallet',
    [userWallet]
  );

  // Default bio with username if none provided
  const sampleBio = useMemo(() =>
    localBioText ||
    `Hey folks! I'm ${localUsername} building on Solana. Mention @someone to highlight.`,
    [localBioText, localUsername]
  );

  // Conditionals for UI elements - memoized to prevent recalculations
  const canShowFollowsYou = useMemo(() =>
    !isOwnProfile && areTheyFollowingMe,
    [isOwnProfile, areTheyFollowingMe]
  );

  const canShowAddButton = useMemo(() =>
    !isOwnProfile,
    [isOwnProfile]
  );

  const showBuyCard = useMemo(() =>
    isOwnProfile || (attachmentData.coin && attachmentData.coin.mint),
    [isOwnProfile, attachmentData.coin]
  );

  // Token attachment state
  const [tokenDescription, setTokenDescription] = useState('');
  const [showAttachDetailsModal, setShowAttachDetailsModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<{
    mintPubkey: string;
    name?: string;
    imageUrl?: string;
    symbol?: string;
    description?: string;
    assetType?: 'token' | 'nft' | 'cnft' | 'collection';
  } | null>(null);

  // Profile edit drawer state
  const [showEditProfileDrawer, setShowEditProfileDrawer] = useState(false);

  // Memoize profile data to prevent unnecessary re-renders of child components
  const memoizedProfileData = useMemo(() => ({
    userId: userWallet,
    profilePicUrl: localProfilePic,
    username: localUsername,
    description: localBioText || sampleBio,
  }), [userWallet, localProfilePic, localUsername, localBioText, sampleBio]);

  /**
   * Combined handler for avatar press and edit profile
   */
  const handleEditProfilePress = useCallback(() => {
    console.log('[UserProfileInfo] handleEditProfilePress called, isOwnProfile:', isOwnProfile);
    if (!isOwnProfile) return;
    console.log('[UserProfileInfo] Setting showEditProfileDrawer to true');
    setShowEditProfileDrawer(true);
  }, [isOwnProfile]);

  /**
   * Handle profile updated event
   */
  const handleProfileUpdated = useCallback((field: 'image' | 'username' | 'description') => {
    console.log('[UserProfileInfo] handleProfileUpdated called for field:', field);
    // Refresh the local state based on the field that was updated
    if (field === 'image' && onAvatarPress) {
      console.log('[UserProfileInfo] Calling onAvatarPress callback');
      onAvatarPress();
    } else if ((field === 'username' || field === 'description') && onEditProfile) {
      console.log('[UserProfileInfo] Calling onEditProfile callback');
      onEditProfile();
    }
  }, [onAvatarPress, onEditProfile]);

  /**
   * Handle token selection from the portfolio modal
   */
  const handleSelectToken = useCallback((token: any) => {
    setSelectedToken({
      mintPubkey: token.id || token.mint,
      name: token.name || 'Unknown',
      imageUrl: token.image || '',
      symbol: token.symbol || token.token_info?.symbol,
      description: token.assetType === 'collection' ? token.metadata?.description : '',
      assetType: token.assetType,
    });
    setTokenDescription(token.assetType === 'collection' ? (token.metadata?.description || '') : '');
    console.log('LOG Setting selected token data:', token);
  }, []); // No external dependencies needed

  /**
   * Use effect to show the modal *after* the selectedToken state is updated
   * and the previous modal (portfolio modal) has presumably closed.
   */
  useEffect(() => {
    if (selectedToken && !showAttachDetailsModal) {
      // Check if assetType is token or collection (attach modal is relevant for these)
      if (selectedToken.assetType === 'token' || selectedToken.assetType === 'collection') {
        console.log('Selected token updated, scheduling attach details modal.');
        // Add a small delay to allow the previous modal to fully dismiss
        const timer = setTimeout(() => {
          setShowAttachDetailsModal(true);
        }, 100); // 100ms delay
        return () => clearTimeout(timer); // Clear timeout if component unmounts or effect re-runs
      } else {
        // If it's an individual NFT, we might not need the description modal.
        // For now, just attach it directly without asking for description.
        console.log('Individual NFT selected, attempting direct attach.');
        handleAttachCoinConfirm(true); // Pass a flag to indicate direct attach
      }
    }
  }, [selectedToken, showAttachDetailsModal]); // Re-run when selectedToken changes

  /**
   * Confirm token attachment and dispatch to Redux
   * Added skipModal parameter for direct NFT attachment
   */
  const handleAttachCoinConfirm = useCallback(async (skipModal = false) => {
    if (!selectedToken || !isOwnProfile) {
      if (!skipModal) setShowAttachDetailsModal(false);
      setSelectedToken(null); // Reset selected token if confirmation fails or is skipped
      return;
    }
    const { mintPubkey, name, imageUrl, symbol, assetType } = selectedToken;

    // Use the state description if the modal was shown, otherwise use the one from selectedToken (for collections)
    const finalDescription = skipModal ? (selectedToken.description || '') : tokenDescription.trim();

    const coinData = {
      mint: mintPubkey,
      symbol: symbol || name || 'Unknown Asset',
      name: name || 'Unknown Asset',
      image: imageUrl || '',
      description: finalDescription,
      assetType: assetType || 'token', // Default to token if not set
    };

    try {
      await dispatch(
        attachCoinToProfile({
          userId: userWallet,
          attachmentData: { coin: coinData },
        }),
      ).unwrap();
      Alert.alert(
        'Success',
        `${assetType === 'collection' ? 'Collection' : assetType === 'nft' ? 'NFT' : 'Token'} attached successfully!`,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to attach ${assetType}`);
    } finally {
      if (!skipModal) setShowAttachDetailsModal(false);
      setSelectedToken(null); // Reset selected token after attempt
      setTokenDescription(''); // Reset description field
    }
  }, [selectedToken, isOwnProfile, tokenDescription, userWallet, dispatch]); // dispatch is stable

  /**
   * Handle removing an attached coin
   */
  const handleRemoveCoin = useCallback(() => {
    if (!isOwnProfile) return;

    Alert.alert(
      'Remove Coin',
      'Are you sure you want to remove the attached coin?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(
                removeAttachedCoin({
                  userId: userWallet,
                }),
              ).unwrap();
              Alert.alert('Success', 'Coin removed from your profile');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove coin');
            }
          },
        },
      ],
    );
  }, [isOwnProfile, userWallet]); // dispatch is stable

  // Modal handlers with no dependencies
  const handleCloseModal = useCallback(() => {
    setShowAttachDetailsModal(false);
    setSelectedToken(null); // Reset selected token when modal is closed
    setTokenDescription(''); // Reset description field
  }, []);
  const handleDescriptionChange = useCallback((text: string) => setTokenDescription(text), []);

  /**
   * Handle logout
   */
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  }, [logout]);

  /**
   * Handle transfer balance button click
   */
  const handleTransferBalance = useCallback(() => {
    setShowTransferModal(true);
  }, []);

  /**
   * Handle ProfileEditDrawer close
   */
  const handleEditDrawerClose = useCallback(() => {
    console.log('[UserProfileInfo] ProfileEditDrawer onClose called');
    setShowEditProfileDrawer(false);
  }, []);

  return (
    <View style={styles.profileInfo}>
      {/* Profile Header with Avatar and Name */}
      <ProfileHeader
        profilePicUrl={localProfilePic}
        username={localUsername}
        handleString={handleString}
        showFollowsYou={canShowFollowsYou}
        isOwnProfile={isOwnProfile}
        onAvatarPress={handleEditProfilePress}
        userWallet={userWallet}
      />

      {/* Short bio */}
      <BioSection bioText={sampleBio} />

      {/* Follower/following stats */}
      <StatsSection
        followersCount={followersCount}
        followingCount={followingCount}
        onPressFollowers={onPressFollowers}
        onPressFollowing={onPressFollowing}
      />


      {showBuyCard && (
        <TokenCard
          attachmentData={attachmentData}
          userWallet={userWallet}
          isOwnProfile={isOwnProfile}
          onSelectToken={handleSelectToken}
          onRemoveCoin={handleRemoveCoin}
        />
      )}

      {/* Edit profile button (for own profile) */}
      {isOwnProfile && <EditButton
        onPress={handleEditProfilePress}
        onTransferBalance={handleTransferBalance}
        onLogout={handleLogout}
      />}

      {/* Transfer Balance Button */}
      {isOwnProfile && (
        <View style={{ height: 0, overflow: 'hidden' }}>
          <TransferBalanceButton
            showOnlyTransferButton
            showCustomWalletInput
            buttonLabel="Transfer Balance"
            recipientAddress=""
            onSendToWallet={() => { }}
            externalModalVisible={showTransferModal}
            externalSetModalVisible={setShowTransferModal}
          />
        </View>
      )}

      {/* Follow/unfollow button (for other profiles) */}
      {canShowAddButton && (
        <FollowButton
          amIFollowing={amIFollowing}
          areTheyFollowingMe={areTheyFollowingMe}
          onPressFollow={onFollowPress}
          onPressUnfollow={onUnfollowPress}
          recipientAddress={userWallet}
        />
      )}

      {/* Token attachment modal */}
      <TokenAttachModal
        visible={showAttachDetailsModal}
        onClose={handleCloseModal}
        onConfirm={() => handleAttachCoinConfirm(false)}
        tokenDescription={tokenDescription}
        onChangeDescription={handleDescriptionChange}
      />

      {/* Profile Edit Drawer - new unified profile editor */}
      {isOwnProfile && (
        <ProfileEditDrawerComponent
          visible={showEditProfileDrawer}
          onClose={handleEditDrawerClose}
          profileData={memoizedProfileData}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </View>
  );
}

// Optimize re-renders with detailed prop comparison
function arePropsEqual(
  prevProps: UserProfileInfoProps,
  nextProps: UserProfileInfoProps,
) {
  // Fast-path for reference equality
  if (prevProps === nextProps) return true;

  // Profile data
  if (prevProps.profilePicUrl !== nextProps.profilePicUrl) return false;
  if (prevProps.username !== nextProps.username) return false;
  if (prevProps.userWallet !== nextProps.userWallet) return false;
  if (prevProps.isOwnProfile !== nextProps.isOwnProfile) return false;
  if (prevProps.bioText !== nextProps.bioText) return false;

  // Social status
  if (prevProps.amIFollowing !== nextProps.amIFollowing) return false;
  if (prevProps.areTheyFollowingMe !== nextProps.areTheyFollowingMe) return false;
  if (prevProps.followersCount !== nextProps.followersCount) return false;
  if (prevProps.followingCount !== nextProps.followingCount) return false;

  // Check attachmentData only if needed
  if (prevProps.attachmentData !== nextProps.attachmentData) {
    // If one has coin and the other doesn't
    const prevHasCoin = !!prevProps.attachmentData?.coin;
    const nextHasCoin = !!nextProps.attachmentData?.coin;
    if (prevHasCoin !== nextHasCoin) return false;

    // If both have coins, compare important properties
    if (prevHasCoin && nextHasCoin) {
      const prevCoin = prevProps.attachmentData?.coin;
      const nextCoin = nextProps.attachmentData?.coin;

      if (prevCoin?.mint !== nextCoin?.mint) return false;
      if (prevCoin?.symbol !== nextCoin?.symbol) return false;
      if (prevCoin?.name !== nextCoin?.name) return false;
      if (prevCoin?.image !== nextCoin?.image) return false;
      if (prevCoin?.description !== nextCoin?.description) return false;
    }
  }

  // Check callbacks by reference
  if (prevProps.onAvatarPress !== nextProps.onAvatarPress) return false;
  if (prevProps.onEditProfile !== nextProps.onEditProfile) return false;
  if (prevProps.onFollowPress !== nextProps.onFollowPress) return false;
  if (prevProps.onUnfollowPress !== nextProps.onUnfollowPress) return false;
  if (prevProps.onPressFollowers !== nextProps.onPressFollowers) return false;
  if (prevProps.onPressFollowing !== nextProps.onPressFollowing) return false;

  return true;
}

export default React.memo(UserProfileInfo, arePropsEqual); 