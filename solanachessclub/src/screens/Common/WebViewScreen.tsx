import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '@/core/shared-ui/AppHeader';
import COLORS from '@/assets/colors';
import { RootStackParamList } from '@/shared/navigation/RootNavigator'; // Assuming RootStackParamList is here

type WebViewScreenRouteProp = RouteProp<RootStackParamList, 'WebViewScreen'>;

function WebViewScreen() {
    const route = useRoute<WebViewScreenRouteProp>();
    const insets = useSafeAreaInsets();
    const { uri, title } = route.params;

    // Custom styling for the WebView to make it look more native
    const injectedJavaScript = `
    const meta = document.createElement('meta');
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    meta.setAttribute('name', 'viewport');
    document.getElementsByTagName('head')[0].appendChild(meta);
    true; // note: this is required, or you might sometimes get silent failures
  `;

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <AppHeader title={title || 'Details'} showBackButton={true} />
            <WebView
                source={{ uri }}
                style={styles.webview}
                injectedJavaScript={injectedJavaScript}
                onMessage={() => { }} // Required to make injectedJavaScript work on some platforms
                startInLoadingState={true}
                renderLoading={() => (
                    <ActivityIndicator
                        color={COLORS.brandBlue}
                        size="large"
                        style={styles.loadingIndicator}
                    />
                )}
                onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('[WebViewScreen] WebView error: ', nativeEvent);
                }}
                textZoom={100} // Prevents system font size from affecting webview content too much
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background, // Changed from COLORS.white to COLORS.background
    },
    webview: {
        flex: 1,
    },
    loadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background, // Changed from semi-transparent white to semi-transparent COLORS.background (assuming #0C101A)
    },
});

export default WebViewScreen; 