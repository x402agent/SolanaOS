import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { DevModeProvider, useDevMode } from '@/shared/context/DevModeContext';
import DevModeStatusBar from './DevModeStatusBar';
import DevDrawer from './DevDrawer';

interface DevModeContainerProps {
    children: ReactNode;
}

// This component wraps the content and adds the dev UI elements
const DevModeContainer = ({ children }: DevModeContainerProps) => {
    // Use the dev mode context
    const { isDevMode } = useDevMode();

    return (
        <View style={styles.container}>
            {children}

            {/* The DevModeStatusBar will only render if in dev mode */}
            <DevModeStatusBar />

            {/* The DevDrawer will handle its own visibility */}
            {isDevMode && <DevDrawer />}
        </View>
    );
};

// This provider component wraps the app with the DevModeProvider
// and adds the dev UI elements
interface DevModeWrapperProps {
    children: ReactNode;
}

const DevModeWrapper = ({ children }: DevModeWrapperProps) => {
    return (
        <DevModeProvider>
            <DevModeContainer>
                {children}
            </DevModeContainer>
        </DevModeProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default DevModeWrapper; 