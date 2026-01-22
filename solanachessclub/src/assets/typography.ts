const TYPOGRAPHY = {
  // Font families
  fontFamily: 'Inter Soft',

  // Font weights
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,

  // Font sizes
  size: {
    xs: 12,
    sm: 14,
    md: 15.32, // Specific size from provided spec
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    heading: 38,
  },

  // Line heights (based on 150% line height)
  lineHeight: {
    xs: 18,
    sm: 21,
    md: 23, // 150% of 15.32
    lg: 24,
    xl: 27,
    xxl: 36,
    xxxl: 48,
    heading: 63,
  },

  // Letter spacing (-1.1%)
  letterSpacing: -0.011,

  // Type for React Native fontWeight
  fontWeightType: 'normal' as FontWeight,
  
  // Helper function to convert typography weight to string format for React Native
  fontWeightToString: (weight: number): FontWeight => {
    return String(weight) as FontWeight;
  },
  
  // Pre-converted font weights to use directly in styles
  get weights() {
    return {
      regular: this.fontWeightToString(this.regular),
      medium: this.fontWeightToString(this.medium),
      semiBold: this.fontWeightToString(this.semiBold),
      bold: this.fontWeightToString(this.bold)
    };
  }
};

// Define the type for React Native fontWeight property to satisfy TypeScript
type FontWeight = 
  | 'normal' | 'bold' 
  | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export default TYPOGRAPHY;