import { Alert } from 'react-native';

// Global flag to track if we've shown warnings already
let hasShownEnvWarning: Record<string, boolean> = {};

/**
 * Validates if required environment variables are present
 * In dev mode, missing variables will show a warning but continue
 * In production mode, missing variables will throw an error
 * 
 * @param key The environment variable key to check
 * @param value The environment variable value
 * @param featureName A descriptive name of the feature that requires this env variable
 * @returns The original value
 */
export function validateEnv(key: string, value: string | undefined, featureName: string): string | undefined {
  if (!value || value.trim() === '') {
    // Check if we're in dev mode using the global flag
    if (global.__DEV_MODE__) {
      // Only show the warning once per key
      if (!hasShownEnvWarning[key]) {
        console.warn(`[ENV Warning] Missing ${key} environment variable for ${featureName}`);
        
        // Schedule an alert for next tick to avoid UI blockage
        setTimeout(() => {
          Alert.alert(
            "Missing Environment Variable",
            `The ${featureName} feature requires ${key} to be set in your environment. This feature won't work correctly without it.`,
            [{ text: "OK", style: "default" }]
          );
        }, 0);
        
        // Mark that we've shown this warning
        hasShownEnvWarning[key] = true;
      }
      
      // Return undefined but don't throw - let the app continue in dev mode
      return undefined;
    } else {
      // In production, throw an error for missing env variables
      throw new Error(`${key} is not set in environment variables. Required for ${featureName}.`);
    }
  }
  
  return value;
}

/**
 * Provides a mock value for missing environment variables in dev mode
 * 
 * @param key The environment variable key to check
 * @param value The actual environment variable value
 * @param featureName A descriptive name of the feature requiring this variable
 * @param mockValue A mock value to return in dev mode if the env var is missing
 * @returns The actual value or mock value in dev mode if missing
 */
export function getEnvWithFallback<T>(
  key: string, 
  value: T | undefined, 
  featureName: string, 
  mockValue: T
): T {
  if (!value && global.__DEV_MODE__) {
    // Only show the warning once per key
    if (!hasShownEnvWarning[key]) {
      console.warn(`[ENV Warning] Missing ${key} environment variable for ${featureName}, using mock value`);
      
      // Schedule an alert for next tick to avoid UI blockage  
      setTimeout(() => {
        Alert.alert(
          "Missing Environment Variable",
          `The ${featureName} feature requires ${key} to be set in your environment. A mock value will be used in dev mode.`,
          [{ text: "OK", style: "default" }]
        );
      }, 0);
      
      // Mark that we've shown this warning
      hasShownEnvWarning[key] = true;
    }
    
    return mockValue;
  }
  
  if (!value && !global.__DEV_MODE__) {
    throw new Error(`${key} is not set in environment variables. Required for ${featureName}.`);
  }
  
  return value as T;
}

/**
 * Clears the warning history - useful for testing
 */
export function clearEnvWarningHistory(): void {
  hasShownEnvWarning = {};
} 