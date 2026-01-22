import React, {useRef, useEffect} from 'react';
import {Animated, View, StyleSheet} from 'react-native';

type AnimatedTabIconProps = {
  focused: boolean;
  icon: React.ComponentType<{ width: number; height: number }>;
  iconSelected: React.ComponentType<{ width: number; height: number }>;
  size: number;
  style?: object;
};

function AnimatedTabIcon({
  focused,
  icon: IconDefault,
  iconSelected: IconSelected,
  size,
  style,
}: AnimatedTabIconProps) {
  const animation = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animation, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [focused, animation]);

  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const IconComponent = focused ? IconSelected : IconDefault;

  return (
    <Animated.View style={[focused ? style : null, {transform: [{scale}]}]}>
      <IconComponent width={size} height={size} />
    </Animated.View>
  );
}

export default AnimatedTabIcon;
