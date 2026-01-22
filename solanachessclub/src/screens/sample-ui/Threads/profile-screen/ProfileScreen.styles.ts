
import {StyleSheet} from 'react-native';
import COLORS from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  // Banner
  bannerContainer: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.greyLight,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  // Profile Header
  profileHeaderContainer: {
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  profileAvatarWrapper: {
    marginTop: -36,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.white,
    width: 80,
    height: 80,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileTextInfo: {
    marginTop: 12,
  },
  profileUsername: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  profileHandle: {
    fontSize: 14,
    color: COLORS.greyDark,
    marginRight: 4,
  },
  verifiedIcon: {
    marginTop: 2,
  },
  profileBio: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  actionButtonsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  editProfileBtn: {
    borderWidth: 1,
    borderColor: COLORS.greyBorderdark,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginLeft: 8,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
  },
  statItem: {
    marginRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.greyDark,
  },
  // Posts
  flatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  noPostContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  noPostText: {
    fontSize: 14,
    color: '#999',
  },
  postItemContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.greyBorder,
  },
  postItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postItemContent: {
    flex: 1,
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  postUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  postHandle: {
    fontSize: 13,
    color: COLORS.greyDark,
  },
  postText: {
    fontSize: 14,
    color: COLORS.black,
    marginTop: 2,
  },
  replyNote: {
    fontSize: 12,
    color: COLORS.greyMid,
  },
});


export const inlineConfirmStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});


export const modalUI = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  optionContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 14,
    color: '#333',
  },
  optionButton: {
    width: '100%',
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1d9bf0',
    alignItems: 'center',
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nftOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  nftContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  nftTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  nftError: {
    color: '#c00',
    textAlign: 'center',
    marginTop: 16,
  },
  nftItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  nftImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#eee',
    overflow: 'hidden',
    marginRight: 6,
  },
  nftImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  nftPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nftName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  nftCollection: {
    fontSize: 12,
    color: '#777',
    marginBottom: 2,
  },
  nftMint: {
    fontSize: 10,
    color: '#999',
  },
  closeButton: {
    backgroundColor: '#aaa',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});


export const confirmModalUI = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
