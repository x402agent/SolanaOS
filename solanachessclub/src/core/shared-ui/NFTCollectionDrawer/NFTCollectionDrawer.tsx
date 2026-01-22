import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Image,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Dimensions,
    Alert,
} from 'react-native';
import Icons from '@/assets/svgs';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { buyCollectionFloor } from '@/modules/nft';
import styles from './NFTCollectionDrawer.styles';
import COLORS from '@/assets/colors';

interface NFTCollectionDrawerProps {
    visible: boolean;
    onClose: () => void;
    collection: {
        collId: string;
        name: string;
        image?: any;
        description?: string;
    };
}

const NFTCollectionDrawer: React.FC<NFTCollectionDrawerProps> = ({
    visible,
    onClose,
    collection,
}) => {
    console.log('NFTCollectionDrawer render, visible:', visible);

    const isMounted = useRef(true);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const { address, sendTransaction } = useWallet();
    const windowHeight = Dimensions.get('window').height;

    // Debug collection data without causing circular references
    console.log('NFTCollectionDrawer collection data:', {
        collId: collection?.collId,
        name: collection?.name,
        hasImage: !!collection?.image,
        imageType: collection?.image ? typeof collection.image : 'none',
        description: collection?.description,
    });

    // Safety check - if no collection is provided, don't render
    if (!collection) {
        console.error('NFTCollectionDrawer: No collection provided');
        return null;
    }

    // Ensure we have a minimum valid collection to show
    if (!collection.name) {
        console.warn('NFTCollectionDrawer: Collection missing name');
    }

    useEffect(() => {
        console.log('NFTCollectionDrawer mounted with collection:', collection.name);

        return () => {
            console.log('NFTCollectionDrawer unmounted');
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        console.log('NFTCollectionDrawer visibility changed to:', visible);
    }, [visible]);

    const handleBuyCollectionFloor = async () => {
        if (!collection.collId) {
            Alert.alert('Error', 'Collection ID not found');
            return;
        }

        if (!address) {
            Alert.alert('Error', 'Wallet not connected');
            return;
        }

        try {
            setLoading(true);
            setStatusMsg('Fetching collection floor...');

            const signature = await buyCollectionFloor(
                address,
                collection.collId,
                sendTransaction,
                status => {
                    if (isMounted.current) {
                        setStatusMsg(status);
                    }
                }
            );

            // Show success notification only if component is still mounted
            if (isMounted.current) {
                TransactionService.showSuccess(signature, 'nft');
                onClose();
            }
        } catch (err: any) {
            console.error('Error during buy transaction:', err);
            if (isMounted.current) {
                TransactionService.showError(err);
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setStatusMsg('');
            }
        }
    };

    // Log when drawer is closed
    const handleClose = () => {
        console.log('NFTCollectionDrawer explicitly closed by user');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.drawerContainer, { maxHeight: windowHeight * 0.7 }]}>
                    {/* Drag handle for better UX */}
                    <View style={styles.dragHandle} />

                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {collection.name && collection.name.length > 20 ?
                                `${collection.name.substring(0, 17)}...` :
                                collection.name}
                        </Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Icons.cross width={24} height={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <View style={styles.collectionInfo}>
                            {collection.image && (
                                <View style={styles.imageContainer}>
                                    <Image
                                        source={typeof collection.image === 'string'
                                            ? { uri: collection.image }
                                            : collection.image}
                                        style={styles.collectionImage}
                                        resizeMode="cover"
                                    />
                                </View>
                            )}

                            <View style={styles.infoContainer}>
                                <Text style={styles.collectionName}>{collection.name}</Text>
                                {collection.description && (
                                    <Text style={styles.description} numberOfLines={3}>{collection.description}</Text>
                                )}
                            </View>
                        </View>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.buyButton}
                                onPress={handleBuyCollectionFloor}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                ) : (
                                    <Text style={styles.buyButtonText}>Buy Collection Floor</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    {/* Loading Overlay */}
                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={COLORS.brandPrimary} />
                                <Text style={styles.loadingText}>{statusMsg}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default NFTCollectionDrawer; 