# Utility Functions

## IPFS Image Handling

The `IPFSImage.tsx` utility provides robust IPFS image handling across both iOS and Android platforms. This was created to solve specific issues with IPFS image loading on Android.

### Problem

IPFS images that load properly on iOS sometimes fail to load or flicker on Android due to:

1. Different security policies on Android for loading remote content
2. Gateway compatibility issues
3. Cache handling differences
4. Different handling of non-standard URL formats

### Solution Components

The utility provides these key tools:

1. **IPFSAwareImage Component**

   - A drop-in replacement for React Native's Image component
   - Automatically handles IPFS URLs with appropriate fallbacks
   - Uses Pinata IPFS gateway for Android (most reliable option)
   - Provides smooth error handling and fallback to default images
   - Prevents memory leaks with proper cleanup
   - Reduces flickering with optimized image loading strategy

2. **getValidImageSource Function**

   - Formats image sources correctly for both platforms
   - Uses platform-specific IPFS gateways:
     - `gateway.pinata.cloud` for Android (direct use of most reliable gateway)
     - `ipfs.io` for iOS
   - Adds proper cache headers for Android
   - Types checked for TypeScript safety

3. **fixIPFSUrl Function**

   - Converts various IPFS URL formats to standard HTTPS URLs
   - Handles ipfs://, ar://, and other special URL formats
   - Platform-aware conversions

4. **fixAllImageUrls Function**
   - A comprehensive solution that combines best practices from across the app
   - Handles all edge cases: quotes, encoding issues, protocol prefixes
   - Converts ipfs.io URLs to Pinata on Android for consistency
   - Performs platform-specific optimizations

### Usage Examples

#### Using the IPFSAwareImage Component

```tsx
import { IPFSAwareImage } from '../utils/IPFSImage';

// Simple usage
<IPFSAwareImage
  source={{ uri: "https://ipfs.io/ipfs/QmSomeHash" }}
  style={styles.image}
/>

// With fallback and key for forced refresh on Android
<IPFSAwareImage
  source={imageUrl}
  style={styles.avatar}
  defaultSource={DEFAULT_IMAGES.user}
  key={Platform.OS === 'android' ? `image-${Date.now()}` : 'image'}
/>
```

#### Using the getValidImageSource Function

```tsx
import {getValidImageSource} from '../utils/IPFSImage';

// In a component that needs to process image sources
function getUserAvatar(user) {
  if (user.avatar) {
    return getValidImageSource(user.avatar);
  }
  return DEFAULT_IMAGES.user;
}
```

#### Using the fixAllImageUrls Function

```tsx
import {fixAllImageUrls} from '../utils/IPFSImage';

// For comprehensive URL fixing that handles all edge cases
const imageUrl = fixAllImageUrls(rawImageUrl);

// Can handle quoted strings, missing protocols, and multiple formats
const imageUrl = fixAllImageUrls('"ipfs://QmSomeHash"'); // Will remove quotes and fix IPFS URL
```

### Implementation Notes

- For maximum reliability on Android:
  - We directly use Pinata IPFS gateway (gateway.pinata.cloud) for all IPFS content
  - We automatically convert ipfs.io URLs to Pinata URLs on Android for consistency
  - On image load failure, we directly use default image instead of trying multiple gateways
- Cache headers are set properly for Android to help with image caching
- The unique key prop on Android forces image refresh when needed
- Careful memory management prevents leaks with mountedRef tracking
- Type safety ensures proper TypeScript compatibility
- Anti-flickering measures with controlled timing and state management
