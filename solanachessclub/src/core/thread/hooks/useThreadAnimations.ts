import { useRef, useState, useCallback } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

/**
 * Custom hook providing thread-related animations
 */
export const useThreadAnimations = () => {
  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(0.9)).current;
  const slideAnimation = useRef(new Animated.Value(-20)).current;
  
  // State to track if an element is currently animating
  const [isAnimating, setIsAnimating] = useState(false);
  
  /**
   * Configures layout animation for smooth adding/removing items
   */
  const configureLayoutAnimation = useCallback((duration = 300) => {
    LayoutAnimation.configureNext({
      duration,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, []);
  
  /**
   * Animates a new post appearing
   */
  const animatePostAppear = useCallback(() => {
    setIsAnimating(true);
    
    // Reset animation values
    fadeAnimation.setValue(0);
    scaleAnimation.setValue(0.9);
    slideAnimation.setValue(-20);
    
    // Run parallel animations
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5)),
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(() => {
      setIsAnimating(false);
    });
  }, [fadeAnimation, scaleAnimation, slideAnimation]);
  
  /**
   * Animates a post being removed
   * @param callback Function to call after animation completes
   */
  const animatePostRemove = useCallback((callback?: () => void) => {
    setIsAnimating(true);
    
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(scaleAnimation, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
      Animated.timing(slideAnimation, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]).start(() => {
      setIsAnimating(false);
      if (callback) callback();
    });
  }, [fadeAnimation, scaleAnimation, slideAnimation]);
  
  /**
   * Animates a like/reaction action
   * @param targetRef Reference to the element to animate
   */
  const animateReaction = useCallback((targetRef: any) => {
    if (!targetRef.current) return;
    
    const scaleUp = Animated.timing(targetRef.current, {
      toValue: 1.2,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    });
    
    const scaleDown = Animated.timing(targetRef.current, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.in(Easing.quad),
    });
    
    Animated.sequence([scaleUp, scaleDown]).start();
  }, []);
  
  /**
   * Animate thread loading
   */
  const animateThreadLoad = useCallback(() => {
    fadeAnimation.setValue(0);
    
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [fadeAnimation]);
  
  return {
    fadeAnimation,
    scaleAnimation,
    slideAnimation,
    isAnimating,
    configureLayoutAnimation,
    animatePostAppear,
    animatePostRemove,
    animateReaction,
    animateThreadLoad,
    // Combined animation style for new posts
    postAnimationStyle: {
      opacity: fadeAnimation,
      transform: [
        { scale: scaleAnimation },
        { translateY: slideAnimation },
      ],
    },
  };
}; 