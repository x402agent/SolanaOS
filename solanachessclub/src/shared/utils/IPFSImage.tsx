import { DEFAULT_IMAGES } from '@/shared/config/constants';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image, Platform, ImageProps, View, Text } from 'react-native';
import COLORS from '@/assets/colors';

// Reliable IPFS gateways with load balancing
const IPFS_GATEWAYS = {
  primary: [
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/'
  ],
  backup: [
    'https://nftstorage.link/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://ipfs.fleek.co/ipfs/'
  ]
};

// Track problematic IPFS hashes globally to avoid retrying failed URLs
const problematicIpfsHashes = new Set<string>();

/**
 * A React component that handles IPFS images with advanced fallback gateways
 * 
 * @param props Standard Image props plus optional defaultSource
 * @returns An Image component with enhanced IPFS handling
 */
export const IPFSAwareImage = ({
    source,
    style,
    defaultSource = DEFAULT_IMAGES.user,
    onLoad,
    onError,
    ...props
}: ImageProps & { defaultSource?: any }) => {
    const [currentSource, setCurrentSource] = useState(source);
    const [loadError, setLoadError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [gatewayAttempt, setGatewayAttempt] = useState(0);
    const mountedRef = useRef(true);
    const ipfsHashRef = useRef<string | null>(null);
    const [showFallback, setShowFallback] = useState(false);

    // Extract IPFS hash when source changes
    useEffect(() => {
        const extractIpfsHash = (sourceUri: string): string | null => {
            // Case 1: ipfs://Qm...
            if (sourceUri.startsWith('ipfs://')) {
                return sourceUri.replace('ipfs://', '');
            }
            // Case 2: https://ipfs.io/ipfs/Qm...
            else if (sourceUri.includes('/ipfs/')) {
                const parts = sourceUri.split('/ipfs/');
                if (parts.length > 1) {
                    return parts[1].split('?')[0]?.split('#')[0];
                }
            }
            // Case 3: Direct Qm... hash
            else if (sourceUri.startsWith('Qm') && sourceUri.length > 30) {
                return sourceUri;
            }
            return null;
        };

        // Reset state for new source
        setLoadError(false);
        setIsLoading(true);
        setGatewayAttempt(0);
        setShowFallback(false);

        // Type checking for the source
        let sourceUri = '';
        if (typeof source === 'string') {
            sourceUri = source;
        } else if (source && typeof source === 'object' && 'uri' in source) {
            sourceUri = source.uri as string;
        }

        if (sourceUri) {
            // Extract IPFS hash if present
            const hash = extractIpfsHash(sourceUri);
            ipfsHashRef.current = hash;

            // If this is a known problematic hash, go straight to fallback
            if (hash && problematicIpfsHashes.has(hash)) {
                setShowFallback(true);
                setIsLoading(false);
                return;
            }

            // For IPFS hash on Android, use our managed gateway selection
            if (Platform.OS === 'android' && hash) {
                const gateway = IPFS_GATEWAYS.primary[0];
                setCurrentSource({ 
                    uri: `${gateway}${hash}`,
                    headers: { 'Cache-Control': 'no-cache' }
                });
            } else {
                // For other URLs or iOS, use the original source
                setCurrentSource(source);
            }
        } else {
            // Not a valid image source
            setShowFallback(true);
            setIsLoading(false);
        }

        return () => {
            mountedRef.current = false;
        };
    }, [source]);

    // Try next gateway when current one fails
    const tryNextGateway = useCallback(() => {
        if (!mountedRef.current || !ipfsHashRef.current) return;

        const hash = ipfsHashRef.current;
        const gatewayList = [...IPFS_GATEWAYS.primary, ...IPFS_GATEWAYS.backup];
        const nextAttempt = gatewayAttempt + 1;
        
        // If we've tried all gateways, show fallback
        if (nextAttempt >= gatewayList.length) {
            if (hash) {
                // Remember this problematic hash for future reference
                problematicIpfsHashes.add(hash);
            }
            setShowFallback(true);
            setIsLoading(false);
            return;
        }

        // Try next gateway
        setGatewayAttempt(nextAttempt);
        const nextGateway = gatewayList[nextAttempt];
        
        // Add a small delay to prevent rapid retries
        setTimeout(() => {
            if (mountedRef.current) {
                setCurrentSource({ 
                    uri: `${nextGateway}${hash}`,
                    headers: { 'Cache-Control': 'no-cache' }
                });
            }
        }, 50);
    }, [gatewayAttempt]);

    // Handle image load error
    const handleError = (e: any) => {
        if (!mountedRef.current) return;

        console.log(`Image load error: ${e?.nativeEvent?.error || 'Unknown error'}`);
        
        if (ipfsHashRef.current) {
            // For IPFS images, try next gateway
            tryNextGateway();
        } else {
            // For regular images, show fallback immediately
            setShowFallback(true);
            setIsLoading(false);
        }

        // Call original onError if provided
        if (onError) {
            onError(e);
        }
    };

    // Handle image load success
    const handleLoad = (e: any) => {
        if (!mountedRef.current) return;
        
        setIsLoading(false);
        
        // Call original onLoad if provided
        if (onLoad) {
            onLoad(e);
        }
    };

    return (
        <View style={[
            { overflow: 'hidden', backgroundColor: COLORS.background },
            style
        ]}>
            {isLoading && !showFallback && (
                <View style={[
                    { 
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: COLORS.background 
                    }
                ]}>
                    {/* Optional loading indicator or placeholder could go here */}
                </View>
            )}
            
            {showFallback ? (
                <Image
                    source={defaultSource}
                    style={{ width: '100%', height: '100%' }}
                    {...props}
                />
            ) : (
                <Image
                    source={currentSource}
                    style={{ width: '100%', height: '100%' }}
                    onError={handleError}
                    onLoad={handleLoad}
                    fadeDuration={Platform.OS === 'android' ? 0 : 150}
                    {...props}
                />
            )}
        </View>
    );
};

/**
 * Convert a URL or string to a valid image source object with platform-specific handling
 * 
 * @param imageUrl URL string or image source object
 * @returns A properly formatted image source object
 */
export const getValidImageSource = (imageUrl: string | any) => {
    if (!imageUrl) return DEFAULT_IMAGES.user;

    // If it's already an object (like required assets), return as is
    if (typeof imageUrl !== 'string') {
        return imageUrl;
    }

    // First, standardize the URL format
    const fixedUrl = fixAllImageUrls(imageUrl);

    // Extract IPFS hash if present
    let ipfsHash = '';
    if (fixedUrl.startsWith('ipfs://')) {
        ipfsHash = fixedUrl.replace('ipfs://', '');
    } else if (fixedUrl.includes('/ipfs/')) {
        const parts = fixedUrl.split('/ipfs/');
        if (parts.length > 1) {
            ipfsHash = parts[1];
        }
    } else if (fixedUrl.startsWith('Qm') && fixedUrl.length > 30) {
        ipfsHash = fixedUrl;
    }

    // If we identified an IPFS hash, use our primary gateway
    if (ipfsHash) {
        // Use different gateways for different platforms
        const gateway = Platform.OS === 'android' 
            ? IPFS_GATEWAYS.primary[0]  
            : 'https://ipfs.io/ipfs/';
            
        return {
            uri: `${gateway}${ipfsHash}`,
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };
    }

    // Add caching headers for Android
    if (Platform.OS === 'android') {
        return {
            uri: fixedUrl,
            headers: {
                'Cache-Control': 'no-cache'
            }
        };
    }

    // Default handling for other platforms
    return { uri: fixedUrl };
};

/**
 * A more comprehensive image URL fixing function
 * 
 * @param url Any image URL to process
 * @returns A properly formatted URL string
 */
export const fixAllImageUrls = (url: string | null | undefined): string => {
    if (!url) return '';

    // Remove extra quotes that might be present
    if (url.startsWith('"') && url.endsWith('"')) {
        url = url.slice(1, -1);
    }

    // Handle IPFS URLs - Use the specific gateway for the platform
    if (url.startsWith('ipfs://')) {
        const hash = url.replace('ipfs://', '');
        return Platform.OS === 'android'
            ? `${IPFS_GATEWAYS.primary[0]}${hash}`
            : `https://ipfs.io/ipfs/${hash}`;
    }

    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
        return url.replace('ar://', 'https://arweave.net/');
    }

    // Handle relative Arweave paths
    if (url.startsWith('/')) {
        return `https://arweave.net${url}`;
    }

    // Fix URLs without protocol
    if (!url.startsWith('http') && !url.startsWith('data:')) {
        return `https://${url}`;
    }

    // Fix encoding issues with spaces
    if (url.includes(' ')) {
        return encodeURI(url);
    }

    return url;
};

// For backward compatibility
export const fixIPFSUrl = fixAllImageUrls;

/**
 * Utility to generate a unique key for IPFS images
 */
export const getImageKey = (baseKey: string): string => {
    return Platform.OS === 'android'
        ? `img-${baseKey}-${Date.now()}`
        : `img-${baseKey}`;
}; 