import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { PumpSwapScreen } from '../screens';

export type PumpSwapParamList = {
    PumpSwap: undefined;
};

const Stack = createStackNavigator<PumpSwapParamList>();

/**
 * Stack navigator for the PumpSwap module
 * @component
 */
const PumpSwapNavigator: React.FC = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#F8FAFC' }
            }}
        >
            <Stack.Screen name="PumpSwap" component={PumpSwapScreen} />
        </Stack.Navigator>
    );
};

export default PumpSwapNavigator; 