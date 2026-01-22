export interface TokenDetailsSheetProps {
    visible: boolean;
    onClose: () => void;
    token: {
        address: string;
        name: string;
        symbol: string;
        logoURI?: string;
        price: number;
        priceChange24h?: number;
    };
}

export interface PriceHistoryItem {
    unixTime: number;
    value: number;
    marketCap?: number;
    volume?: number;
}

export interface BirdEyeHistoryItem {
    unixTime: number;
    value: number;
}

export interface BirdEyeHistoryResponse {
    success: boolean;
    data?: {
        items: BirdEyeHistoryItem[];
    };
}

export interface TokenMetadata {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    extensions: {
        coingecko_id?: string;
        website?: string;
        twitter?: string;
        discord?: string;
    };
    logo_uri: string;
}

export interface TokenOverview {
    name: string;
    symbol: string;
    price: number;
    price_change_24h: number;
    market_cap: number;
    marketCap?: number;
    market_cap_diluted: number;
    volume_24h: number;
    volume24h?: number;
    liquidity: number;
    supply: {
        total: number;
        circulating: number;
    };
    circulatingSupply?: number;
    holder_count: number;
    holderCount?: number;
    token_authority: string;
    mint_info: {
        is_mint_able: boolean;
    };
    metadata_info: {
        is_mutable: boolean;
    };
    isMintable?: boolean;
    isMutable?: boolean;
    created_at?: number;
    created_on?: string;
    top_holders?: {
        address: string;
        ownership: number;
    }[];
}

export interface TokenSecurity {
    top_holders?: {
        address: string;
        ownership: number;
    }[];
    mint_authority?: string;
    update_authority?: string;
    updateAuthority?: string;
    is_mint_able?: boolean;
    is_mutable?: boolean;
    is_authority_renounced?: boolean;
}

export interface TokenMarketData {
    price: number;
    liquidity: number;
    supply: number;
    marketcap: number;
    circulating_supply: number;
    circulating_marketcap: number;
}

export interface TokenTradeData {
    liquidity: number;
    last_trade_unix_time: number;
    last_trade_human_time: string;
    price: number;
    price_change_24h_percent: number;
    volume_24h: number;
    volume_24h_usd: number;
    unique_wallet_24h: number;
    unique_wallet_24h_change_percent: number;
    trade_24h: number;
    trade_24h_change_percent: number;
    buy_24h: number;
    sell_24h: number;
    volume_buy_24h: number;
    volume_sell_24h: number;
    volume_buy_24h_usd: number;
    volume_sell_24h_usd: number;
}

export interface TimeframeParams {
    type: string;
    time_from: number;
    time_to: number;
}

export type Timeframe = '1H' | '1D' | '1W' | '1M' | 'YTD' | 'ALL';

export interface TokenDetailData {
    priceHistory: PriceHistoryItem[];
    metadata: TokenMetadata | null;
    tokenOverview: TokenOverview | null;
    tokenSecurity: TokenSecurity | null;
    marketData: TokenMarketData | null;
    tradeData: TokenTradeData | null;
    loading: boolean;
    selectedTimeframe: Timeframe;
} 