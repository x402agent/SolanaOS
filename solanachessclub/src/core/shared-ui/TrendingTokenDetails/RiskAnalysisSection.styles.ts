import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
    },
    loadingContainer: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.md,
    },
    errorContainer: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.md,
        textAlign: 'center',
    },
    scoreSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scoreBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreValue: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '700',
    },
    riskLabel: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '600',
        marginLeft: 12,
    },
    ruggedBadge: {
        backgroundColor: COLORS.errorRed,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    ruggedText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: '700',
    },
    explanationContainer: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 10,
        padding: 14,
        marginBottom: 20,
    },
    explanationTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '600',
        color: COLORS.white,
        marginBottom: 12,
    },
    explanationText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        lineHeight: 20,
    },
    riskFactorsContainer: {
        marginBottom: 20,
    },
    factorsTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '600',
        color: COLORS.white,
        marginBottom: 12,
    },
    riskItem: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },
    riskItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    riskName: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: '600',
        color: COLORS.white,
        flex: 1,
    },
    riskLevelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    riskLevelText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: '700',
    },
    riskDescription: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        lineHeight: 18,
    },
    holdersContainer: {
        marginTop: 4,
    },
    holdersTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '600',
        color: COLORS.white,
        marginBottom: 4,
    },
    holdersSubtitle: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 12,
    },
    holderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    holderAddress: {
        width: 120,
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.white,
    },
    holderBarContainer: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 3,
        marginHorizontal: 8,
    },
    holderBar: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: COLORS.brandPrimary,
    },
    insiderBar: {
        backgroundColor: COLORS.brandPurple,
    },
    holderPercentage: {
        width: 60,
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.white,
        textAlign: 'right',
        flexShrink: 0,
    },
    insiderBadge: {
        backgroundColor: COLORS.brandPurple,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    insiderText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: '700',
    },
});

export default styles; 