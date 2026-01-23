import { useState } from 'react';
import { Download, Check, Package, Search } from 'lucide-react';
import { useDesktopStore } from '../../store/useDesktopStore';
import type { Skill } from '../../types';

const availableSkills: Skill[] = [
  { id: 'nft-sniper', name: 'NFT Sniper', category: 'nft', installed: false, description: 'Snipe NFT mints on Solana' },
  { id: 'arbitrage', name: 'Cross-DEX Arbitrage', category: 'trading', installed: false, description: 'Find and execute arbitrage opportunities' },
  { id: 'whale-tracker', name: 'Whale Tracker', category: 'analytics', installed: false, description: 'Track whale wallet movements' },
  { id: 'sentiment', name: 'Social Sentiment', category: 'analytics', installed: false, description: 'AI-powered social sentiment analysis' },
  { id: 'grid-trading', name: 'Grid Trading Bot', category: 'trading', installed: false, description: 'Automated grid trading strategy' },
  { id: 'dca-engine', name: 'DCA Engine', category: 'trading', installed: false, description: 'Dollar cost averaging automation' },
  { id: 'portfolio-rebalance', name: 'Portfolio Rebalancer', category: 'trading', installed: false, description: 'Auto-rebalance portfolio allocations' },
  { id: 'tax-calculator', name: 'Tax Calculator', category: 'tools', installed: false, description: 'Calculate crypto taxes' },
];

export function SkillsMarket() {
  const { skills, installSkill } = useDesktopStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  const isInstalled = (id: string) => skills.some((s) => s.id === id);

  const handleInstall = async (skill: Skill) => {
    setInstalling(skill.id);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    installSkill(skill);
    setInstalling(null);
  };

  const filteredSkills = availableSkills.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-solana-dark">
      {/* Header */}
      <div className="p-4 border-b border-solana-purple/30">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-solana-purple" />
          <h3 className="text-lg font-bold text-white">Skills Market</h3>
        </div>

        {/* NPX Command */}
        <div className="bg-black/50 border border-solana-green/30 rounded-lg p-3 font-mono text-sm mb-4">
          <span className="text-solana-green">$</span>
          <span className="text-white ml-2">npx skills install @solana/&lt;skill-name&gt;</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="w-full bg-black/50 border border-solana-purple/30 rounded-lg pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-solana-green"
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Installed */}
        <div className="w-1/2 border-r border-solana-purple/30 p-4 overflow-y-auto">
          <h4 className="text-sm font-bold text-gray-400 mb-3">INSTALLED ({skills.length})</h4>
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="p-3 bg-solana-green/10 border border-solana-green/30 rounded-lg flex items-center gap-3"
              >
                <Check className="w-4 h-4 text-solana-green flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{skill.name}</p>
                  <p className="text-xs text-gray-500">/mnt/skills/user/{skill.id}</p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-solana-purple/20 text-solana-purple rounded flex-shrink-0">
                  {skill.category}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Available */}
        <div className="w-1/2 p-4 overflow-y-auto">
          <h4 className="text-sm font-bold text-gray-400 mb-3">AVAILABLE</h4>
          <div className="space-y-2">
            {filteredSkills.filter((s) => !isInstalled(s.id)).map((skill) => (
              <div
                key={skill.id}
                className="p-3 bg-black/30 border border-solana-purple/20 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-white">{skill.name}</p>
                    <p className="text-xs text-gray-500">{skill.description}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-solana-purple/20 text-solana-purple rounded">
                    {skill.category}
                  </span>
                </div>
                <button
                  onClick={() => handleInstall(skill)}
                  disabled={installing === skill.id}
                  className="w-full py-2 bg-solana-green/20 border border-solana-green rounded text-solana-green text-sm hover:bg-solana-green/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {installing === skill.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-solana-green border-t-transparent rounded-full animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Install
                    </>
                  )}
                </button>
              </div>
            ))}

            {filteredSkills.filter((s) => !isInstalled(s.id)).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No skills match your search' : 'All skills installed!'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
