import React, {useState} from 'react';
import {Image, Text, TouchableOpacity, View, FlatList} from 'react-native';
import {styles} from './userListing.style';
import {dummyData, UserItem} from '@/shared/mocks/users';

/**
 * A component that displays a scrollable list of users with follow functionality
 * 
 * @component
 * @description
 * UserListing is a component that renders a list of users with their profile
 * information and follow/unfollow functionality. Features include:
 * - User profile image display
 * - User name and username display
 * - Interactive follow/unfollow button
 * - State management for follow status
 * - Smooth scrolling list implementation
 * 
 * The component uses FlatList for efficient rendering of large lists and
 * maintains follow state for each user independently.
 * 
 * @example
 * ```tsx
 * <UserListing />
 * ```
 * 
 * Note: The component currently uses dummy data from mocks/users.
 * In a production environment, this should be replaced with real user data.
 */
const UserListing = () => {
  const [userData, setUserData] = useState(dummyData);

  const handleFollow = (id: string) => {
    setUserData(prevData =>
      prevData.map(user =>
        user.id === id ? {...user, following: !user.following} : user,
      ),
    );
  };

  const renderItem = ({item}: {item: UserItem}) => (
    <View style={styles.container}>
      <View style={styles.userDetails}>
        <View style={styles.imgBox}>
          <Image source={item.image} style={styles.image} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.usernameText}>{item.username}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          item.following ? styles.followingButton : styles.followButton,
        ]}
        onPress={() => handleFollow(item.id)}>
        <Text
          style={[
            styles.buttonText,
            item.following
              ? styles.followingButtonText
              : styles.followButtonText,
          ]}>
          {item.following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={userData}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.flatListContainer}
    />
  );
};

export default UserListing;
