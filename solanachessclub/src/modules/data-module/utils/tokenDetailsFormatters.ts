import { TokenSecurity } from '../types/tokenDetails.types';

export function formatPrice(price: number): string {
    return price < 0.01 ? price.toFixed(8) : price.toFixed(2);
}

export function formatPriceChange(change?: number): string {
    if (!change) return 'N/A';
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

export function formatDollarChange(price: number, change?: number): string {
    if (!change) return 'N/A';
    const dollarChange = (price * change) / 100;
    return `${dollarChange >= 0 ? '+' : ''}$${Math.abs(dollarChange).toFixed(8)}`;
}

export function formatNumber(num?: number): string {
    if (num === undefined || num === null) return 'N/A';
    
    if (num < 1000) return num.toFixed(2);
    
    const prefixes = ['', 'K', 'M', 'B', 'T'];
    const exponent = Math.min(Math.floor(Math.log10(num) / 3), prefixes.length - 1);
    
    return (num / Math.pow(1000, exponent)).toFixed(2) + prefixes[exponent];
}

export function formatTopHolders(tokenSecurity: TokenSecurity | null): string {
    if (!tokenSecurity?.top_holders || tokenSecurity.top_holders.length === 0) return 'N/A';

    const total = tokenSecurity.top_holders.reduce((sum, holder) => sum + (holder?.ownership || 0), 0);
    return `${total.toFixed(2)}%`;
}

export function getGraphData(values: number[]): number[] {
    if (!values.length) return [];

    // If all values are the same, create slight variations for visualization
    const allSame = values.every(v => v === values[0]);
    if (allSame) {
        return values.map((v, i) => v * (1 + (Math.sin(i * 0.1) * 0.001)));
    }

    // Return actual values if they're different
    return values;
} 