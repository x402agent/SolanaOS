import { useEffect, useState, useCallback } from 'react';
import { 
    PriceHistoryItem, 
    Timeframe,
    TokenDetailData,
    TokenMarketData, 
    TokenMetadata, 
    TokenOverview, 
    TokenSecurity, 
    TokenTradeData 
} from '../types/tokenDetails.types';
import {
    fetchMarketData,
    fetchPriceHistory,
    fetchTokenMetadata as fetchTokenDetailMetadata,
    fetchTokenOverview,
    fetchTokenSecurity,
    fetchTradeData
} from '../services/tokenDetailsService';

interface UseTokenDetailsProps {
    tokenAddress: string;
    visible: boolean;
}

interface UseTokenDetailsReturn extends TokenDetailData {
    handleTimeframeChange: (timeframe: Timeframe) => void;
    getTimestamps: () => number[];
}

export function useTokenDetails({ tokenAddress, visible }: UseTokenDetailsProps): UseTokenDetailsReturn {
    const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
    const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
    const [tokenOverview, setTokenOverview] = useState<TokenOverview | null>(null);
    const [tokenSecurity, setTokenSecurity] = useState<TokenSecurity | null>(null);
    const [marketData, setMarketData] = useState<TokenMarketData | null>(null);
    const [tradeData, setTradeData] = useState<TokenTradeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1D');

    const fetchTokenData = useCallback(async () => {
        if (!tokenAddress) return;
        
        setLoading(true);
        try {
            await Promise.all([
                fetchTokenDetailMetadata(tokenAddress).then(setMetadata),
                fetchTokenOverview(tokenAddress).then(setTokenOverview),
                fetchTokenSecurity(tokenAddress).then(setTokenSecurity),
                fetchMarketData(tokenAddress).then(setMarketData),
                fetchTradeData(tokenAddress).then(setTradeData)
            ]);
        } catch (error) {
            console.error('Error fetching token data:', error);
        } finally {
            setLoading(false);
        }
    }, [tokenAddress]);

    const fetchTokenPriceHistory = useCallback(async (timeframe: Timeframe) => {
        if (!tokenAddress) return;
        
        setLoading(true);
        setPriceHistory([]); // Clear previous data
        
        try {
            const data = await fetchPriceHistory(tokenAddress, timeframe);
            setPriceHistory(data);
        } catch (error) {
            console.error('Error fetching token price history:', error);
        } finally {
            setLoading(false);
        }
    }, [tokenAddress]);

    const handleTimeframeChange = useCallback((timeframe: Timeframe) => {
        setSelectedTimeframe(timeframe);
        fetchTokenPriceHistory(timeframe);
    }, [fetchTokenPriceHistory]);

    const getTimestamps = useCallback(() => {
        return priceHistory.map(item => item.unixTime * 1000);
    }, [priceHistory]);

    // Load data when component becomes visible
    useEffect(() => {
        if (visible && tokenAddress) {
            fetchTokenData();
            handleTimeframeChange('1D');
        }
    }, [visible, tokenAddress, fetchTokenData, handleTimeframeChange]);

    return {
        priceHistory,
        metadata,
        tokenOverview,
        tokenSecurity,
        marketData,
        tradeData,
        loading,
        selectedTimeframe,
        handleTimeframeChange,
        getTimestamps
    };
} 