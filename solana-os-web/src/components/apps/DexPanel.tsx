import { useState } from 'react';
import { ArrowDownUp, Settings, TrendingUp, TrendingDown } from 'lucide-react';

interface Token {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  balance: number;
  icon: string;
}

const tokens: Token[] = [
  { symbol: 'SOL', name: 'Solana', price: 178.50, change24h: 2.3, balance: 10.5, icon: '◎' },
  { symbol: 'JUP', name: 'Jupiter', price: 0.85, change24h: -1.2, balance: 1250, icon: '🪐' },
  { symbol: 'BONK', name: 'Bonk', price: 0.000018, change24h: 5.7, balance: 15000000, icon: '🐕' },
  { symbol: 'RAY', name: 'Raydium', price: 2.45, change24h: 3.1, balance: 125, icon: '💫' },
];

export function DexPanel() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');

  const estimatedOutput = amount ? (parseFloat(amount) * fromToken.price / toToken.price).toFixed(4) : '0';

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  return (
    <div className="h-full flex bg-solana-dark">
      {/* Swap Panel */}
      <div className="flex-1 p-4 border-r border-solana-purple/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Swap</h3>
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* From Token */}
        <div className="bg-black/50 border border-solana-purple/30 rounded-lg p-4 mb-2">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-400">From</span>
            <span className="text-xs text-gray-400">Balance: {fromToken.balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={fromToken.symbol}
              onChange={(e) => setFromToken(tokens.find(t => t.symbol === e.target.value) || tokens[0])}
              className="bg-solana-purple/20 border border-solana-purple/30 rounded-lg px-3 py-2 text-white outline-none"
            >
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-right text-2xl text-white outline-none"
            />
          </div>
          <div className="text-right text-xs text-gray-500 mt-1">
            ≈ ${amount ? (parseFloat(amount) * fromToken.price).toFixed(2) : '0.00'}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={swapTokens}
            className="p-2 bg-solana-purple/20 border border-solana-purple rounded-lg hover:bg-solana-purple/30 transition-colors"
          >
            <ArrowDownUp className="w-4 h-4 text-solana-purple" />
          </button>
        </div>

        {/* To Token */}
        <div className="bg-black/50 border border-solana-purple/30 rounded-lg p-4 mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-400">To</span>
            <span className="text-xs text-gray-400">Balance: {toToken.balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={toToken.symbol}
              onChange={(e) => setToToken(tokens.find(t => t.symbol === e.target.value) || tokens[1])}
              className="bg-solana-green/20 border border-solana-green/30 rounded-lg px-3 py-2 text-white outline-none"
            >
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
              ))}
            </select>
            <div className="flex-1 text-right text-2xl text-white">
              {estimatedOutput}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500 mt-1">
            ≈ ${(parseFloat(estimatedOutput) * toToken.price).toFixed(2)}
          </div>
        </div>

        {/* Slippage */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-gray-400">Slippage Tolerance</span>
          <div className="flex gap-1">
            {['0.1', '0.5', '1.0'].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  slippage === s
                    ? 'bg-solana-purple/30 text-solana-purple'
                    : 'bg-black/30 text-gray-400 hover:bg-solana-purple/20'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Swap Button */}
        <button className="w-full py-3 bg-gradient-to-r from-solana-purple to-solana-green rounded-lg font-bold text-white hover:opacity-90 transition-opacity">
          Swap via Jupiter
        </button>
      </div>

      {/* Market Info */}
      <div className="w-72 p-4 bg-black/30">
        <h3 className="text-sm font-bold text-gray-400 mb-4">MARKET</h3>
        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.symbol} className="p-3 bg-black/30 rounded-lg border border-solana-purple/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{token.icon}</span>
                  <span className="font-bold">{token.symbol}</span>
                </div>
                <span className={`flex items-center gap-1 text-xs ${
                  token.change24h >= 0 ? 'text-solana-green' : 'text-red-400'
                }`}>
                  {token.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                </span>
              </div>
              <div className="text-lg font-bold text-white">
                ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
