import { BIRDEYE_API_KEY } from '@env';
import { 
    BirdEyeHistoryResponse,
    PriceHistoryItem,
    TimeframeParams,
    Timeframe,
    TokenMarketData,
    TokenMetadata,
    TokenOverview,
    TokenSecurity,
    TokenTradeData
} from '../types/tokenDetails.types';

const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';
const BIRDEYE_HEADERS = {
    'accept': 'application/json',
    'x-chain': 'solana',
    'X-API-KEY': BIRDEYE_API_KEY
};

export function getBirdeyeTimeParams(timeframe: Timeframe): TimeframeParams {
    const now = Math.floor(Date.now() / 1000);
    let type = '15m';
    let time_from = now - 60 * 60; // Default to 1H

    switch (timeframe) {
        case '1H':
            type = '1m';
            time_from = now - 60 * 60;
            break;
        case '1D':
            type = '15m';
            time_from = now - 24 * 60 * 60;
            break;
        case '1W':
            type = '1D';
            time_from = now - 7 * 24 * 60 * 60;
            break;
        case '1M':
            type = '1D';
            time_from = now - 30 * 24 * 60 * 60;
            break;
        case 'YTD':
            type = '1D';
            const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
            time_from = startOfYear;
            break;
        case 'ALL':
            type = '1D';
            time_from = now - 365 * 24 * 60 * 60; // 1 year of data
            break;
    }
    return { type, time_from, time_to: now };
}

export async function fetchPriceHistory(
    tokenAddress: string, 
    timeframe: Timeframe
): Promise<PriceHistoryItem[]> {
    try {
        const birdeyeParams = getBirdeyeTimeParams(timeframe);
        const birdeyeUrl = `${BIRDEYE_BASE_URL}/defi/history_price?address=${tokenAddress}&address_type=token&type=${birdeyeParams.type}&time_from=${birdeyeParams.time_from}&time_to=${birdeyeParams.time_to}`;
        
        const birdeyeResponse = await fetch(birdeyeUrl, {
            method: 'GET',
            headers: BIRDEYE_HEADERS
        });

        if (birdeyeResponse.ok) {
            const birdeyeData: BirdEyeHistoryResponse = await birdeyeResponse.json();
            if (birdeyeData.success && birdeyeData.data?.items && birdeyeData.data.items.length > 0) {
                return birdeyeData.data.items.map(item => ({
                    unixTime: item.unixTime,
                    value: item.value
                }));
            }
        }
        return [];
    } catch (error) {
        console.error('Error fetching price history:', error);
        return [];
    }
}

export async function fetchTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    try {
        const response = await fetch(
            `${BIRDEYE_BASE_URL}/defi/v3/token/meta-data/single?address=${tokenAddress}`,
            {
                method: 'GET',
                headers: BIRDEYE_HEADERS
            }
        );
        const data = await response.json();
        if (data.success && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching token metadata:', error);
        return null;
    }
}

export async function fetchTokenOverview(tokenAddress: string): Promise<TokenOverview | null> {
    try {
        const response = await fetch(
            `${BIRDEYE_BASE_URL}/defi/token_overview?address=${tokenAddress}`,
            {
                method: 'GET',
                headers: BIRDEYE_HEADERS
            }
        );
        const data = await response.json();
        if (data.success && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching token overview:', error);
        return null;
    }
}

export async function fetchTokenSecurity(tokenAddress: string): Promise<TokenSecurity | null> {
    try {
        const response = await fetch(
            `${BIRDEYE_BASE_URL}/defi/token_security?address=${tokenAddress}`,
            {
                method: 'GET',
                headers: BIRDEYE_HEADERS
            }
        );
        const data = await response.json();
        if (data.success && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching token security:', error);
        return null;
    }
}

export async function fetchMarketData(tokenAddress: string): Promise<TokenMarketData | null> {
    try {
        const response = await fetch(
            `${BIRDEYE_BASE_URL}/defi/v3/token/market-data?address=${tokenAddress}`,
            {
                method: 'GET',
                headers: BIRDEYE_HEADERS
            }
        );
        const data = await response.json();
        if (data.success && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching market data:', error);
        return null;
    }
}

export async function fetchTradeData(tokenAddress: string): Promise<TokenTradeData | null> {
    try {
        const response = await fetch(
            `${BIRDEYE_BASE_URL}/defi/v3/token/trade-data/single?address=${tokenAddress}`,
            {
                method: 'GET',
                headers: BIRDEYE_HEADERS
            }
        );
        const data = await response.json();
        if (data.success && data.data) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching trade data:', error);
        return null;
    }
} 