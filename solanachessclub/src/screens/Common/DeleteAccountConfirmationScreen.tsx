import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import AppHeader from '@/core/shared-ui/AppHeader';
import { deleteAccountAction } from '@/shared/state/auth/reducer';

function DeleteAccountConfirmationScreen() {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { logout } = useAuth();
    const currentUserId = useAppSelector((state) => state.auth.address);
    const [isLoading, setIsLoading] = React.useState(false);

    const handleDeleteConfirm = async () => {
        Alert.alert(
            'Confirm Deletion',
            'This action is permanent and cannot be undone. Are you absolutely sure?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete My Account',
                    style: 'destructive',
                    onPress: async () => {
                        if (!currentUserId) {
                            Alert.alert('Error', 'Could not identify user. Please try logging in again.');
                            setIsLoading(false);
                            return;
                        }
                        setIsLoading(true);
                        try {
                            console.log(`[DeleteAccountScreen] Initiating account deletion for user: ${currentUserId}`);
                            const result = await dispatch(deleteAccountAction(currentUserId)).unwrap();
                            console.log('[DeleteAccountScreen] Account deletion API success:', result);

                            await logout();
                        } catch (error: any) {
                            console.error('[DeleteAccountScreen] Account deletion failed:', error);
                            Alert.alert(
                                'Deletion Failed',
                                typeof error === 'string' ? error : error.message || 'Could not delete your account. Please try again later.'
                            );
                            setIsLoading(false);
                        }
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <AppHeader title="Delete Account" showBackButton={false} />
            <View style={styles.container}>
                <Text style={styles.warningTitle}>Important Notice</Text>
                <Text style={styles.warningText}>
                    You are about to permanently delete your account. This action is irreversible and will erase all your data, including posts, chats, and profile information.
                </Text>
                <Text style={[styles.warningText, styles.fundTransferWarning]}>
                    Please ensure you have transferred all funds out of your associated wallets before proceeding.
                </Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.brandPrimary} style={styles.loader} />
                ) : (
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.backButton]}
                            onPress={() => navigation.goBack()}
                            disabled={isLoading}
                        >
                            <Text style={styles.buttonText}>Go Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton]}
                            onPress={handleDeleteConfirm}
                            disabled={isLoading}
                        >
                            <Text style={[styles.buttonText, styles.confirmButtonText]}>Confirm Deletion</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    warningTitle: {
        fontSize: TYPOGRAPHY.size.xxl, // Changed from h3 to xxl (assuming 24 or similar)
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.white,
        textAlign: 'center',
        marginBottom: 16,
    },
    warningText: {
        fontSize: TYPOGRAPHY.size.md, // 16
        color: COLORS.greyMid,
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
    },
    fundTransferWarning: {
        color: COLORS.errorRed, // Or a warning yellow
        fontWeight: TYPOGRAPHY.weights.semiBold,
        marginTop: 8,
        marginBottom: 24,
    },
    buttonContainer: {
        marginTop: 30,
    },
    button: {
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
    },
    backButton: {
        backgroundColor: 'transparent',
        borderColor: COLORS.greyDark,
    },
    confirmButton: {
        backgroundColor: COLORS.errorRed,
        borderColor: COLORS.errorRed,
    },
    buttonText: {
        fontSize: TYPOGRAPHY.size.lg, // 18
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
    },
    confirmButtonText: {
        color: COLORS.white,
    },
    loader: {
        marginTop: 30,
    },
});

export default DeleteAccountConfirmationScreen; 