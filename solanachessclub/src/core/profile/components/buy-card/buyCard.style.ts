import { StyleSheet, Dimensions, Platform, ImageStyle } from "react-native";
import COLORS from "../../../../assets/colors";
import TYPOGRAPHY from "../../../../assets/typography";

// Get screen dimensions for grid items
const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width * 0.9 - 48) / 3; // 3 items per row with padding

export const styles = StyleSheet.create({
    // Main container styles
    container: {
        width: "100%",
        height: "auto",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderColor: COLORS.greyBorderdark,
        borderRadius: 12,
        // borderWidth: 1
        backgroundColor: COLORS.lighterBackground
    },
    contentContainer: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    buyButtonContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },

    // Image styles
    imgContainer: {
        width: 38,
        height: 38,
        borderRadius: 8,
        overflow: "hidden", 
    },
    img: {
        width: "100%",
        height: "100%",
    },
    imgWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    imgBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.2,
    },

    // Button styles
    buyButton: {
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 12,
        backgroundColor: COLORS.lightBackground, 
        alignItems: "center",
        justifyContent: "center",
    },
    buyButtonText: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: '600',
        letterSpacing: TYPOGRAPHY.letterSpacing,
        color: COLORS.greyMid,
    },
    arrowButton: {
        padding: 8,
        marginLeft: 8,
        color: COLORS.greyMid,
    },
    pinArrowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.brandBlue,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    pinButtonText: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: '600',
        letterSpacing: TYPOGRAPHY.letterSpacing,
        color: COLORS.white,
        marginLeft: 6,
    },

    // Pin your coin styles
    pinYourCoinContainer: {
        borderStyle: "dashed",
        borderColor: COLORS.brandBlue,
        borderWidth: 1.5,
        backgroundColor: "rgba(29, 155, 240, 0.05)",
    },

    // Token name styles
    tokenNameText: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: '500',
        letterSpacing: TYPOGRAPHY.letterSpacing,
        color: COLORS.white,
    },
    pinYourCoinText: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: '500',
        letterSpacing: TYPOGRAPHY.letterSpacing,
        color: COLORS.brandBlue,
    },

    // Token description styles
    tokenDescText: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: '400',
        letterSpacing: TYPOGRAPHY.letterSpacing,
        color: COLORS.greyDark,
    },
    tokenDescriptionText: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: '400',
        letterSpacing: TYPOGRAPHY.letterSpacing,
        color: '#666',
        marginTop: 4,
    },

    // Portfolio Modal Styles (from modalStyles)
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%',
        minHeight: '70%',
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
        elevation: 6,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    modalTitle: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.semiBold as any,
        color: COLORS.white,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.lighterBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: TYPOGRAPHY.size.lg,
        color: COLORS.white,
    },
    actionsContainer: {
        padding: 16,
        backgroundColor: COLORS.lightBackground,
        borderRadius: 8,
        marginTop: 16,
    },
    actionsText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        marginBottom: 12,
    },
    removeButton: {
        backgroundColor: COLORS.lighterBackground,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    removeButtonText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.medium as any,
    },
    loadingContainer: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.textLight,
        marginTop: 16,
    },
    errorContainer: {
        padding: 24,
        alignItems: 'center',
    },
    errorText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.errorRed,
        marginBottom: 16,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: COLORS.darkerBackground,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    retryText: {
        color: COLORS.brandPrimary,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.medium as any,
    },
    emptyContainer: {
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.textLight,
        textAlign: 'center',
    },
    assetsContainer: {
        flex: 1,
    },
    solBalanceContainer: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    solBalanceLabel: {
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.semiBold as any,
    },
    solBalanceValue: {
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.accessoryDarkColor,
    },
    instructionsContainer: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 6,
        marginVertical: 8,
    },
    instructionsText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.accessoryDarkColor,
        textAlign: 'center',
    },
    sectionContainer: {
        marginVertical: 12,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.semiBold as any,
        color: COLORS.white,
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    tokenListContainer: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        overflow: 'hidden',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.borderDarkColor,
        marginVertical: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        marginRight: 8,
    },
    searchButton: {
        backgroundColor: COLORS.brandPrimary,
        borderRadius: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchButtonText: {
        color: COLORS.black,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.semiBold as any,
    },
    collectionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    collectionItem: {
        width: '48%',
        backgroundColor: COLORS.lightBackground,
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
    },
    collectionImage: {
        width: '100%',
        height: 120,
        backgroundColor: COLORS.lighterBackground,
        overflow: 'hidden',
    } as ImageStyle,
    collectionName: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.medium as any,
        padding: 8,
    },

    // Asset Item Styles (from assetStyles)
    tokenItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: COLORS.lighterBackground,
    },
    tokenLogoContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: COLORS.darkerBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    tokenLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    } as ImageStyle,
    tokenLogoPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.darkerBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tokenLogoPlaceholderText: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.bold as any,
        color: COLORS.white,
    },
    tokenDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    tokenName: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.medium as any,
        color: COLORS.white,
        marginBottom: 2,
    },
    tokenSymbol: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.textLight,
    },
    tokenBalanceContainer: {
        alignItems: 'flex-end',
    },
    tokenBalance: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.semiBold as any,
        color: COLORS.white,
        marginBottom: 2,
    },
    tokenValue: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.textLight,
    },

    assetItem: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
    },
    assetImageContainer: {
        position: 'relative',
        width: '100%',
        aspectRatio: 1,
        backgroundColor: COLORS.darkerBackground,
    },
    assetImageWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    assetImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        overflow: 'hidden',
    } as ImageStyle,
    fallbackImage: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    } as ImageStyle,
    assetPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.darkerBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    assetPlaceholderText: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.bold as any,
        color: COLORS.white,
    },
    compressedBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: COLORS.brandPrimary,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    compressedText: {
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: TYPOGRAPHY.bold as any,
        color: COLORS.black,
    },
    priceBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    priceText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.white,
    },
    assetDetails: {
        padding: 10,
    },
    assetName: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.medium as any,
        color: COLORS.white,
        marginBottom: 2,
    },
    assetCollection: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.textLight,
    },
    emptySectionInfo: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 8,
        marginHorizontal: 8,
    },
    emptySectionText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.accessoryDarkColor,
        textAlign: 'center',
    },
});