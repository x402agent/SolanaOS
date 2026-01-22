import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 66,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  imgBox: {
    width: 32,
    height: 32,
    borderRadius: 64,
    overflow: 'hidden',
    marginRight: 7,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'row',
    width: '60%',
  },
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1E1E',
  },
  usernameText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999999',
  },
  button: {
    width: 96,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    backgroundColor: 'black',
  },
  followingButton: {
    backgroundColor: '#F6F7F9',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  followButtonText: {
    color: 'white',
  },
  followingButtonText: {
    color: '#ADADAD',
  },
  flatListContainer: {
    paddingBottom: 10,
  },
});
