import {StyleSheet} from 'react-native';

export const defaultPeopleSectionStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    padding: 16,
    width: '100%',
  },
  holdersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  holdersTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    marginRight: 16,
  },
  cardList: {
    paddingHorizontal: 16,
  },
  userList: {
    marginTop: 16,
  },
});
