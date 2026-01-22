import React from 'react';
import {View, ViewStyle} from 'react-native';
import { PumpfunCardProps } from '../types';

export const PumpfunCard: React.FC<PumpfunCardProps> = ({
  containerStyle,
  children,
}) => {
  return <View style={[defaultCardStyle, containerStyle]}>{children}</View>;
};

const defaultCardStyle: ViewStyle = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginVertical: 8,
  shadowColor: '#000',
  shadowOffset: {width: 0, height: 2},
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
};

export default PumpfunCard;
