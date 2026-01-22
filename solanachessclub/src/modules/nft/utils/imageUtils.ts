/**
 * Utilities for NFT image handling
 */

/**
 * Fixes various image URL formats (IPFS, Arweave, etc.) to ensure they work consistently
 * 
 * @param url The original image URL from the NFT metadata
 * @returns A properly formatted URL that can be used in an Image component
 */
export function fixImageUrl(url: any): string {
  if (!url) return '';
  
  if (typeof url !== 'string') {
    return '';
  }
  
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  
  if (url.startsWith('ar://')) {
    return url.replace('ar://', 'https://arweave.net/');
  }
  
  if (url.startsWith('/')) {
    return `https://arweave.net${url}`;
  }
  
  if (!url.startsWith('http') && !url.startsWith('data:')) {
    return `https://${url}`;
  }
  
  return url;
}

/**
 * Gets an appropriate image source object for an NFT
 * 
 * @param uri The image URI for the NFT
 * @param defaultImage Default image to use if URI is invalid
 * @returns An image source object for React Native
 */
export function getNftImageSource(uri?: string, defaultImage?: any) {
  if (!uri || typeof uri !== 'string') {
    return defaultImage || require('../../../assets/images/SENDlogo.png');
  }
  
  return { uri: fixImageUrl(uri) };
}

/**
 * Formats a SOL price with appropriate precision
 * 
 * @param price Price value in SOL or lamports
 * @param inLamports Whether the price is in lamports (needs conversion)
 * @returns Formatted price string with appropriate precision
 */
export function formatSolPrice(price: number | string | undefined, inLamports: boolean = false) {
  if (!price) return null;
  
  let solPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (inLamports) {
    solPrice = solPrice / 1_000_000_000;
  }
  
  // Different formatting based on size
  if (solPrice < 0.0001) return solPrice.toExponential(2);
  if (solPrice < 0.1) return solPrice.toFixed(6);
  if (solPrice < 10) return solPrice.toFixed(4);
  return solPrice.toFixed(2);
} 