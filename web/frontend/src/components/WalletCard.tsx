import React from 'react';
import { Wallet, ExternalLink, TrendingUp } from 'lucide-react';
import { Portfolio } from '../types';

interface WalletCardProps {
  address: string;
  portfolio: Portfolio | null;
}

export const WalletCard: React.FC<WalletCardProps> = ({ address, portfolio }) => {
  if (!portfolio) return null;

  return (
    <div className="bg-cyber-gray border border-white/5 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-solana-purple/20 rounded-lg">
            <Wallet className="w-5 h-5 text-solana-purple" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Agent Wallet</h3>
            <p className="text-sm font-mono text-white/80">{address}</p>
          </div>
        </div>
        <a 
          href={`https://solscan.io/account/${address}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-white/40" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
          <span className="text-[10px] uppercase text-white/40 block mb-1">SOL Balance</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-solana-green">{portfolio.sol.balance.toFixed(4)}</span>
            <span className="text-xs text-white/40">SOL</span>
          </div>
          <span className="text-[10px] text-white/20 font-mono">${portfolio.sol.usd.toFixed(2)} USD</span>
        </div>
        <div className="bg-black/30 p-3 rounded-lg border border-white/5">
          <span className="text-[10px] uppercase text-white/40 block mb-1">Portfolio Value</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-white">
              ${(portfolio.sol.usd + portfolio.tokens.reduce((acc, t) => acc + t.usd, 0)).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-solana-green">
            <TrendingUp className="w-3 h-3" />
            <span>+12.4% (24h)</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Top Assets</h4>
        {portfolio.tokens.map((token) => (
          <div key={token.symbol} className="flex items-center justify-between p-2 bg-black/20 rounded border border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold">
                {token.symbol[0]}
              </div>
              <span className="text-xs font-bold">{token.symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono">{token.balance.toLocaleString()}</div>
              <div className="text-[10px] text-white/40 font-mono">${token.usd.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
