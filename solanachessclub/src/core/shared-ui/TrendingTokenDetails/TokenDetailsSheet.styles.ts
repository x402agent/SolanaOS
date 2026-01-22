import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 20,
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        zIndex: 1,
        padding: 8,
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 20,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontSize: TYPOGRAPHY.size.xl,
        color: COLORS.white,
        lineHeight: 20,
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 20,
    },
    tokenLogo: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.lighterBackground,
    },
    tokenInfo: {
        marginLeft: 16,
        flex: 1,
    },
    tokenName: {
        fontSize: TYPOGRAPHY.size.xxl,
        fontWeight: '700',
        color: COLORS.white,
        marginBottom: 4,
    },
    tokenSymbol: {
        fontSize: TYPOGRAPHY.size.lg,
        color: COLORS.greyMid,
    },
    priceContainer: {
        marginBottom: 28,
    },
    price: {
        fontSize: TYPOGRAPHY.size.xxxl,
        fontWeight: '700',
        color: COLORS.white,
        marginBottom: 8,
    },
    priceChangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priceChangeAmount: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: '600',
        marginRight: 12,
    },
    percentageBox: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    percentageText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '600',
    },
    section: {
        marginBottom: 32,
    },
    chartContainer: {
        marginBottom: 32,
        height: 300,
        backgroundColor: COLORS.lightBackground,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    graphWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        height: 220,
    },
    graph: {
        backgroundColor: 'transparent',
    },
    noDataContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noDataText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.lg,
    },
    timeframeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        padding: 4,
    },
    timeframeButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    selectedTimeframe: {
        backgroundColor: COLORS.lighterBackground,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    timeframeText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: '600',
    },
    selectedTimeframeText: {
        color: COLORS.brandPrimary,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: '700',
        color: COLORS.white,
        marginBottom: 16,
    },
    infoSection: {
        marginBottom: 32,
        backgroundColor: COLORS.lightBackground,
        borderRadius: 16,
        padding: 20,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    infoItem: {
        width: '50%',
        paddingHorizontal: 8,
        marginBottom: 20,
    },
    infoLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 6,
    },
    infoValue: {
        fontSize: TYPOGRAPHY.size.lg,
        color: COLORS.white,
        fontWeight: '600',
    },
    performanceSection: {
        marginBottom: 32,
        backgroundColor: COLORS.lightBackground,
        borderRadius: 16,
        padding: 20,
    },
    performanceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    performanceItem: {
        width: '48%',
        marginBottom: 12,
    },
    performanceLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 6,
    },
    performanceValue: {
        fontSize: TYPOGRAPHY.size.lg,
        color: COLORS.white,
        fontWeight: '600',
    },
    securitySection: {
        marginBottom: 32,
        backgroundColor: COLORS.lightBackground,
        borderRadius: 16,
        padding: 20,
    },
    securityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    securityItem: {
        width: '50%',
        paddingHorizontal: 8,
        marginBottom: 20,
    },
    securityLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 6,
    },
    securityValue: {
        fontSize: TYPOGRAPHY.size.lg,
        color: COLORS.white,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 220,
    },
    loadingText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.md,
        marginTop: 12,
    },
    disabledButton: {
        opacity: 0.5,
    },
    disabledText: {
        opacity: 0.5,
    },
    handleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: COLORS.borderDarkColor,
    },
}); 