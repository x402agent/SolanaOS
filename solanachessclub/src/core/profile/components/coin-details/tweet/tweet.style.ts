import {StyleSheet} from 'react-native';
import COLORS from '../../../../../assets/colors';

export const createTweetStyles = (isSmallScreen: boolean) => {
  const avatarSize = 19.43;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      paddingVertical: 20,
      width: '100%',
      paddingHorizontal: isSmallScreen ? 2 : 2,
    },
    avatarContainer: {
      width: '15%',
      alignItems: 'center',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      resizeMode: 'cover',
    },
    infoContainer: {
      flex: 1,
      flexDirection: 'column',
      gap: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      position: 'relative',
      flexWrap: 'wrap',
      marginBottom: 2,
    },
    username: {
      fontWeight: '600',
      fontSize: isSmallScreen ? 14 : 15,
    },
    handle: {
      fontWeight: '400',
      color: COLORS.greyMid,
      fontSize: isSmallScreen ? 12 : 14,
    },
    menuIcon: {
      position: 'absolute',
      right: 8,
    },
    tweetText: {
      fontWeight: '400',
      lineHeight: 18,
      letterSpacing: 0.3,
      fontSize: isSmallScreen ? 14 : 15,
    },
    sendText: {
      color: COLORS.brandPrimary,
    },
    reactionContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    reactionIcons: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
      paddingRight: 8,
    },
    buyButton: {
      backgroundColor: COLORS.brandPurpleBg,
      width: 40,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: COLORS.brandPurple,
    },
    metricsContainer: {
      flexDirection: 'row',
      alignContent: 'center',
      marginTop: 2,
    },
    threadAvatars: {
      flexDirection: 'row',
      position: 'relative',
    },
    threadAvatar1: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      position: 'absolute',
      zIndex: 3,
      left: -10,
    },
    threadAvatar2: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      position: 'absolute',
      zIndex: 2,
      left: -17,
    },
    threadAvatar3: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      position: 'absolute',
      zIndex: 1,
      left: -24,
    },
    metricsInfo: {
      flexDirection: 'row',
      paddingLeft: 12,
    },
    reactionsText: {
      fontSize: 12,
      fontWeight: '500',
      marginRight: 4,
      color: COLORS.black,
    },
    metricsText: {
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'left',
      color: COLORS.greyMid,
      marginLeft: 4,
    },
    metricsCount: {
      color: COLORS.black,
    },
  });
};
