import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Platform, StyleSheet, ImageStyle } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { styles } from './FollowersFollowingListScreen.style';
import Icons from '@/assets/svgs';
import COLORS from '@/assets/colors';

type FollowersFollowingRouteProp = RouteProp<RootStackParamList, 'FollowersFollowingList'>;
type FollowersFollowingNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SimpleUserItem {
  id: string;
  username: string;
  handle?: string;
  profile_picture_url?: string;
}

export default function FollowersFollowingListScreen() {
  const route = useRoute<FollowersFollowingRouteProp>();
  const navigation = useNavigation<FollowersFollowingNavigationProp>();
  const { mode, userId, userList }: any = route.params;

  const navigateToUserProfile = useCallback((user: SimpleUserItem) => {
    if (!user.id) return;

    // Navigate to the OtherProfile screen with the user ID
    navigation.navigate('OtherProfile', { userId: user.id });
  }, [navigation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const listData = useMemo(() => {
    return userList || [];
  }, [userList]);

  const renderEmptyList = useCallback(() => (
    <View style={styles.emptyListContainer}>
      <Text style={styles.emptyListText}>
        {mode === 'followers'
          ? 'No followers yet'
          : 'Not following anyone yet'}
      </Text>
    </View>
  ), [mode]);

  // Define avatar style separately to fix TypeScript errors
  const avatarStyle: ImageStyle = {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  };

  const renderUserItem = useCallback(({ item }: { item: SimpleUserItem }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => navigateToUserProfile(item)}
    >
      <View style={styles.avatarContainer}>
        {item.profile_picture_url ? (
          <Image
            source={{ uri: item.profile_picture_url }}
            style={avatarStyle}
          />
        ) : (
          <Image
            source={require('../../../../assets/images/User.png')}
            style={avatarStyle}
          />
        )}
      </View>

      <View style={styles.userInfoContainer}>
        <Text style={styles.username}>
          {item.username ?? 'Unnamed'}
        </Text>
        <Text style={styles.handle}>
          {item.handle ?? `@${item.id.slice(0, 6)}`}
        </Text>
      </View>
    </TouchableOpacity>
  ), [navigateToUserProfile]);

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        Platform.OS === 'android' && styles.androidSafeArea
      ]} 
      edges={['top']}
    >
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Icons.ArrowLeft width={24} height={24} color={COLORS.white} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {mode === 'followers' ? 'Followers' : 'Following'}
        </Text>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingVertical: 8,
          flexGrow: 1, // This allows the empty list to center properly
        }}
        renderItem={renderUserItem}
        ListEmptyComponent={renderEmptyList}
      />
    </SafeAreaView>
  );
}
