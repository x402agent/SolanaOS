import * as React from 'react';
import Svg, { SvgProps, Path, Rect } from 'react-native-svg';

const GalleryIcon = (props: SvgProps) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
        <Rect
            x={3}
            y={3}
            width={18}
            height={18}
            rx={2}
            stroke="currentColor"
            strokeWidth={1.5}
        />
        <Path
            d="M3 16l5-5 5 5"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M12 13l4-4 5 5v3c0 1.105-.895 2-2 2H5c-1.105 0-2-.895-2-2v-1"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M16 8a1 1 0 100-2 1 1 0 000 2z"
            fill="currentColor"
        />
    </Svg>
);

export default GalleryIcon; 