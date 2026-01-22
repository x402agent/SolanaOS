// Utility function to merge different style objects
export const mergeStyles = (
  baseStyles: Record<string, any>,
  overrides?: Record<string, object> | null,
  userStyles?: Record<string, object> | null
): Record<string, any> => {
  if (!overrides && !userStyles) {
    return baseStyles;
  }

  const result = { ...baseStyles };

  // Apply component-specific overrides
  if (overrides) {
    Object.keys(overrides).forEach((key) => {
      if (result[key]) {
        result[key] = { ...result[key], ...overrides[key] };
      }
    });
  }

  // Apply user-provided styles (takes highest precedence)
  if (userStyles) {
    Object.keys(userStyles).forEach((key) => {
      if (result[key]) {
        result[key] = { ...result[key], ...userStyles[key] };
      }
    });
  }

  return result;
}; 