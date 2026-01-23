import { TrendingUp, TrendingDown, Wallet, PieChart, Activity } from 'lucide-react';

interface Holding {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  value: number;
  change24h: number;
  allocation: number;
  icon: string;
  color: string;
}

const holdings: Holding[] = [
  { symbol: 'SOL', name: 'Solana', balance: 10.5, price: 178.50, value: 1874.25, change24h: 2.3, allocation: 65, icon: '◎', color: '#9945FF' },
  { symbol: 'JUP', name: 'Jupiter', balance: 1250, price: 0.85, value: 1062.50, change24h: -1.2, allocation: 20, icon: '🪐', color: '#14F195' },
  { symbol: 'BONK', name: 'Bonk', balance: 15000000, price: 0.000018, value: 270, change24h: 5.7, allocation: 10, icon: '🐕', color: '#FFB800' },
  { symbol: 'RAY', name: 'Raydium', balance: 125, price: 2.45, value: 306.25, change24h: 3.1, allocation: 5, icon: '💫', color: '#5773FF' },
];

const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
const totalChange = 4.2; // Mock total change

export function Portfolio() {
  return (
    <div className="h-full overflow-y-auto bg-solana-dark p-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black/40 border border-solana-purple/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-xs">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-white">${totalValue.toLocaleString()}</div>
          <div className={`flex items-center gap-1 text-sm ${totalChange >= 0 ? 'text-solana-green' : 'text-red-400'}`}>
            {totalChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {totalChange >= 0 ? '+' : ''}{totalChange}% (24h)
          </div>
        </div>

        <div className="bg-black/40 border border-solana-purple/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <PieChart className="w-4 h-4" />
            <span className="text-xs">Assets</span>
          </div>
          <div className="text-2xl font-bold text-white">{holdings.length}</div>
          <div className="text-sm text-gray-400">tokens held</div>
        </div>

        <div className="bg-black/40 border border-solana-purple/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs">Best Performer</span>
          </div>
          <div className="text-2xl font-bold text-white">BONK</div>
          <div className="text-sm text-solana-green">+5.7%</div>
        </div>
      </div>

      {/* Allocation Chart */}
      <div className="bg-black/40 border border-solana-purple/30 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-bold text-gray-400 mb-4">ALLOCATION</h3>
        <div className="flex items-center gap-4">
          {/* Pie Chart Visualization */}
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              {holdings.reduce((acc, holding, index) => {
                const startAngle = acc.angle;
                const angle = (holding.allocation / 100) * 360;
                const endAngle = startAngle + angle;

                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);

                const x1 = 18 + 16 * Math.cos(startRad);
                const y1 = 18 + 16 * Math.sin(startRad);
                const x2 = 18 + 16 * Math.cos(endRad);
                const y2 = 18 + 16 * Math.sin(endRad);

                const largeArc = angle > 180 ? 1 : 0;

                acc.paths.push(
                  <path
                    key={holding.symbol}
                    d={`M 18 18 L ${x1} ${y1} A 16 16 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={holding.color}
                    opacity={0.8}
                  />
                );

                acc.angle = endAngle;
                return acc;
              }, { paths: [] as JSX.Element[], angle: 0 }).paths}
              <circle cx="18" cy="18" r="8" fill="#0a0a12" />
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {holdings.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                  <span className="text-sm">{h.symbol}</span>
                </div>
                <span className="text-sm text-gray-400">{h.allocation}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings List */}
      <div className="bg-black/40 border border-solana-purple/30 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-solana-purple/30">
          <h3 className="text-sm font-bold text-gray-400">HOLDINGS</h3>
        </div>
        <div className="divide-y divide-solana-purple/20">
          {holdings.map((holding) => (
            <div key={holding.symbol} className="p-4 hover:bg-solana-purple/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{holding.icon}</span>
                  <div>
                    <div className="font-bold text-white">{holding.symbol}</div>
                    <div className="text-xs text-gray-500">{holding.name}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-white">${holding.value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">
                    {holding.balance.toLocaleString()} {holding.symbol}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-400">
                    ${holding.price < 0.01 ? holding.price.toFixed(6) : holding.price.toFixed(2)}
                  </div>
                  <div className={`flex items-center justify-end gap-1 text-xs ${
                    holding.change24h >= 0 ? 'text-solana-green' : 'text-red-400'
                  }`}>
                    {holding.change24h >= 0 ? '+' : ''}{holding.change24h}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
