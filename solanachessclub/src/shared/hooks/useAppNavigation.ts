import {
  createNavigationContainerRef,
  useNavigation,
} from '@react-navigation/native';
import {
  CompositeNavigationProp,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';

/**
 * Main tab param list
 */
export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Feed: undefined;
  Notifications: undefined;
  Profile: undefined;
};

/**
 * Root stack param list
 */

/**
 * Combine stack & tab props for a single type
 */
export type RootNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

/**
 * A navigation ref you can use for navigating without the hook
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Our single reusable hook for navigating
 */
export function useAppNavigation() {
  return useNavigation<RootNavigationProp>();
}
