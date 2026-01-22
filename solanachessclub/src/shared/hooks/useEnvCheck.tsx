import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useEnvError } from '../context/EnvErrorContext';
import { useDevMode } from '../context/DevModeContext';

/**
 * Hook to check if required environment variables are present for a specific screen/feature
 * 
 * @param requiredVars Array of environment variable names required for the feature
 * @param featureName Name of the feature or screen requiring these variables
 * @returns Object with error state and helper methods
 */
export function useEnvCheck(requiredVars: string[], featureName: string) {
    const [missingVars, setMissingVars] = useState<string[]>([]);
    const { missingEnvVars, toggleErrorModal } = useEnvError();
    const { isDevMode } = useDevMode();
    const [hasShownAlert, setHasShownAlert] = useState(false);

    useEffect(() => {
        if (isDevMode && missingEnvVars.length > 0) {
            // Find which required vars are missing for this specific feature
            const missing = requiredVars.filter(varName =>
                missingEnvVars.includes(varName)
            );

            setMissingVars(missing);

            // Show an alert when the component mounts, but only once
            if (missing.length > 0 && !hasShownAlert) {
                setTimeout(() => {
                    Alert.alert(
                        "Missing Environment Variables",
                        `The ${featureName} feature requires some environment variables that are missing. Some functionality may not work correctly.`,
                        [
                            {
                                text: "Show Details",
                                onPress: toggleErrorModal,
                                style: "default"
                            },
                            {
                                text: "OK",
                                style: "cancel"
                            }
                        ]
                    );
                }, 500); // Delay to avoid UI blockage

                setHasShownAlert(true);
            }
        }
    }, [missingEnvVars, requiredVars, featureName, isDevMode, hasShownAlert, toggleErrorModal]);

    return {
        hasMissingVars: missingVars.length > 0,
        missingVars,
        showErrorDetails: toggleErrorModal
    };
} 