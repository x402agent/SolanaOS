/**
 * Custom hook for fetching and managing profile actions/transactions
 */
import { useState, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { fetchWalletActionsWithCache, pruneOldActionData } from '@/shared/state/profile/reducer';

/**
 * Hook that manages profile actions/transactions
 * @param walletAddress The wallet address to fetch actions for
 * @returns Object with actions data and loading state
 */
export function useProfileActions(walletAddress: string | undefined) {
  const dispatch = useAppDispatch();
  const [hasFetchedInitial, setHasFetchedInitial] = useState<Record<string, boolean>>({});
  
  // Get actions data from Redux state
  const profileActions = useAppSelector(state => state.profile.actions);

  // Extract values with error handling
  const myActions = walletAddress 
    ? (profileActions.data[walletAddress] || [])
    : [];
    
  const loadingActions = !!walletAddress && !!profileActions.loading[walletAddress];
  const fetchActionsError = walletAddress 
    ? profileActions.error[walletAddress] 
    : null;

  // Fetch actions with caching
  const fetchActions = useCallback(async (forceRefresh = false) => {
    if (!walletAddress) return;
    
    try {
      await dispatch(fetchWalletActionsWithCache({ 
        walletAddress,
        forceRefresh 
      }));
      
      // Prune old action data after fetching new data
      // This helps keep the store optimized
      dispatch(pruneOldActionData());
      
      // Mark this wallet as having fetched initial data
      setHasFetchedInitial(prev => ({
        ...prev,
        [walletAddress]: true
      }));
    } catch (error) {
      console.error('Error fetching wallet actions:', error);
      // Still mark as fetched even on error to prevent continuous retries
      setHasFetchedInitial(prev => ({
        ...prev,
        [walletAddress]: true
      }));
    }
  }, [walletAddress, dispatch]);

  // Load actions when the wallet address changes, but only if we haven't fetched for this wallet before
  useEffect(() => {
    if (walletAddress && !hasFetchedInitial[walletAddress]) {
      fetchActions();
    }
  }, [walletAddress, fetchActions, hasFetchedInitial]);

  return {
    actions: myActions,
    loadingActions,
    fetchActionsError,
    refreshActions: () => fetchActions(true), // Force refresh when manually refreshing
  };
} 