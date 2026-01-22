import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    drawerContainer: {
        backgroundColor: COLORS.lightBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: COLORS.borderDarkColor,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    title: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
        color: COLORS.white,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.lighterBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: 16,
    },
    collectionInfo: {
        alignItems: 'center',
        marginVertical: 16,
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    collectionImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
    },
    infoContainer: {
        alignItems: 'center',
    },
    collectionName: {
        fontSize: TYPOGRAPHY.size.xxl,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
        marginBottom: 8,
        textAlign: 'center',
        color: COLORS.white,
    },
    description: {
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.accessoryDarkColor,
        marginBottom: 16,
        lineHeight: TYPOGRAPHY.lineHeight.md,
        textAlign: 'center',
    },
    buttonContainer: {
        alignItems: 'center',
        marginTop: 24,
    },
    buyButton: {
        backgroundColor: COLORS.brandPrimary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        alignItems: 'center',
        minWidth: 180,
    },
    buyButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(12, 16, 26, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    loadingContainer: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        minWidth: 200,
    },
    loadingText: {
        color: COLORS.white,
        marginTop: 12,
        textAlign: 'center',
        fontSize: TYPOGRAPHY.size.md,
    },
});

export default styles; 