// FILE: src/components/thread/post/PostHeader.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  ImageSourcePropType,
  StyleSheet,
  Platform,
} from 'react-native';
import Icons from '../../../../assets/svgs';
import { createPostHeaderStyles } from './PostHeader.styles';
import { ThreadPost, ThreadUser } from '../thread.types';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { useWallet } from '../../../../modules/wallet-providers/hooks/useWallet';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import { AutoAvatar } from '@/shared/components/AutoAvatar';
import COLORS from '@/assets/colors';

// Always available direct reference to an image in the bundle
const DEFAULT_AVATAR = require('../../../../assets/images/User.png');

// Generate random background colors for placeholders
function getAvatarColor(username: string): string {
  // Simple hash function to generate consistent colors for the same username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Get a pastel hue
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 80%)`;
}

// The ProfileAvatarView component - displays existing profile pictures with initials fallback
export function ProfileAvatarView({
  user,
  style,
  size = 40
}: {
  user: ThreadUser,
  style?: any,
  size?: number
}) {
  // Extract avatar URL from user object
  const avatarUrl = typeof user?.avatar === 'string'
    ? user.avatar
    : typeof user?.avatar === 'object' && user?.avatar && 'uri' in user.avatar
      ? user.avatar.uri
      : null;

  return (
    <AutoAvatar
      userId={user?.id}
      profilePicUrl={avatarUrl}
      username={user?.username || user?.handle}
      size={size}
      style={style}
      showInitials={true}
    />
  );
}

interface PostHeaderProps {
  /** The post data to display in the header */
  post: ThreadPost;
  /** Callback fired when the user taps the menu and chooses "delete" */
  onDeletePost?: (post: ThreadPost) => void;
  /** Callback fired when the user taps "edit" */
  onEditPost?: (post: ThreadPost) => void;
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific components */
  styleOverrides?: { [key: string]: object };

  /**
   * NEW: callback if user taps on the user's avatar/username
   */
  onPressUser?: (user: ThreadUser) => void;
}

// Wrap the component in React.memo to prevent unnecessary re-renders
export default React.memo(function PostHeader({
  post,
  onDeletePost,
  onEditPost,
  themeOverrides,
  styleOverrides,

  onPressUser,
}: PostHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, createdAt } = post;
  const styles = useMemo(() => createPostHeaderStyles(styleOverrides), [
    styleOverrides,
  ]);

  // Get current user's wallet address to check post ownership
  const { address: currentUserAddress } = useWallet();

  // Check if post belongs to current user
  const isMyPost = currentUserAddress &&
    user.id &&
    currentUserAddress.toLowerCase() === user.id.toLowerCase();

  // Convert date to a short HH:mm string for display
  const timeString = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleToggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handlePressOutside = () => {
    setMenuOpen(false);
  };

  const handleEdit = () => {
    setMenuOpen(false);
    onEditPost?.(post);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (!onDeletePost) return;
    // For safety, confirm before deleting
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeletePost(post) },
      ],
      { cancelable: true },
    );
  };

  const handleUserPress = () => {
    if (onPressUser) {
      onPressUser(user);
    }
  };

  // Add a function to format relative time
  const getRelativeTimeString = (date: string) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y`;
    if (months > 0) return `${months}m`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  return (
    <View style={[styles.threadItemHeaderRow, { zIndex: 1 }]}>
      {/* If the menu is open, a transparent overlay to detect outside clicks */}
      {menuOpen && (
        <TouchableWithoutFeedback onPress={handlePressOutside}>
          <View style={localHeaderStyles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.threadItemHeaderLeft}>
        <View style={{ marginLeft: 0 }}>
          {/* Also wrap the username in a Touchable */}
          <TouchableOpacity
            onPress={handleUserPress}
            style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.threadItemUsername}>{user.username}</Text>
            {user.verified && (
              <Icons.BlueCheck
                width={14}
                height={14}
                style={styles.verifiedIcon}
              />
            )}
          </TouchableOpacity>
          <Text style={styles.threadItemHandleTime}>
            {user.handle} • {timeString}
          </Text>
        </View>
      </View>

      {/* Time indicator and menu controls on the right */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={localHeaderStyles.relativeTime}>{getRelativeTimeString(createdAt)}</Text>

        {/* Only show 3-dot menu if this is the current user's post */}
        {isMyPost && (
          <TouchableOpacity onPress={handleToggleMenu}>
            <Icons.DotsThree width={20} height={20} color={COLORS.greyMid} />
          </TouchableOpacity>
        )}
      </View>

      {/* The small drop-down menu if menuOpen */}
      {menuOpen && isMyPost && (
        <View style={localHeaderStyles.menuContainer}>
          {/* Edit Option - No suitable icon found */}
          <TouchableOpacity
            style={localHeaderStyles.menuItem} // Use base style
            onPress={handleEdit}
          >
            {/* No icon here */}
            <Text style={localHeaderStyles.menuItemText}>Edit</Text>
          </TouchableOpacity>

          {/* Separator */}
          <View style={localHeaderStyles.separator} />

          {/* Delete Option - Using 'cross' icon */}
          <TouchableOpacity
            style={localHeaderStyles.menuItem} // Use base style
            onPress={handleDelete}
          >
            <Text style={[localHeaderStyles.menuItemText, localHeaderStyles.deleteText]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const localHeaderStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    right: -9999, // Extend further to cover more area
    bottom: -9999,
    width: '500%', // Larger area to ensure it covers screen taps
    height: '500%',
    zIndex: 30,
    // backgroundColor: 'rgba(0,0,0,0.1)', // Optional: slight dimming
  },
  menuContainer: {
    position: 'absolute',
    top: 30, // Adjusted position slightly lower
    right: 10, // Adjusted position slightly more inboard
    backgroundColor: COLORS.lighterBackground,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor, // Darker border for dark theme
    borderRadius: 8, // Slightly more rounded corners
    zIndex: 10000, // Increased zIndex slightly, ensure it's above parent row's potential context
    paddingVertical: 6, // Adjusted vertical padding
    minWidth: 120, // Ensure minimum width
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, // Slightly larger shadow
    shadowOpacity: 0.1, // Softer shadow
    shadowRadius: 5,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row', // Align icon and text horizontally
    alignItems: 'center', // Center items vertically
    paddingVertical: 10, // Increased vertical padding
    paddingHorizontal: 15, // Increased horizontal padding
  },
  menuIcon: {
    marginRight: 10, // Space between icon and text
    color: COLORS.errorRed, // Match delete text color
  },
  menuItemText: {
    fontSize: 14,
    color: COLORS.greyMid,
    flexShrink: 1, // Prevent text from pushing icon out if long
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.borderDarkColor, // Darker separator for dark theme
    marginHorizontal: 10, // Indent separator slightly
  },
  deleteText: {
    color: COLORS.errorRed, // Red from colors.ts
    fontWeight: '500', // Slightly bolder delete text
  },
  relativeTime: {
    fontSize: 12,
    color: COLORS.greyMid,
    marginRight: 8,
  },
});
