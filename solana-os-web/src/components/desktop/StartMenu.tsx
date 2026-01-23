import { motion, AnimatePresence } from 'framer-motion';
import { useDesktopStore } from '../../store/useDesktopStore';
import type { AppConfig } from '../../types';

const apps: AppConfig[] = [
  { id: 'comet', name: 'COMET Chat', icon: '☄️', component: 'CometChat', category: 'tools', description: 'AI-powered assistant' },
  { id: 'dex', name: 'DEX Panel', icon: '📊', component: 'DexPanel', category: 'trading', description: 'Token swapping' },
  { id: 'portfolio', name: 'Portfolio', icon: '💰', component: 'Portfolio', category: 'trading', description: 'Track holdings' },
  { id: 'agents', name: 'Agent Studio', icon: '🤖', component: 'AgentStudio', category: 'tools', description: 'Create trading agents' },
  { id: 'loops', name: 'Loop Creator', icon: '🔄', component: 'LoopCreator', category: 'tools', description: 'SPARK infinite loops' },
  { id: 'terminal', name: 'Terminal', icon: '💻', component: 'Terminal', category: 'system', description: 'Command interface' },
  { id: 'skills', name: 'Skills Market', icon: '📦', component: 'SkillsMarket', category: 'system', description: 'Install capabilities' },
  { id: 'explorer', name: 'Chain Explorer', icon: '🔍', component: 'ChainExplorer', category: 'tools', description: 'Transaction viewer' },
  { id: 'burner', name: 'SPL Burner', icon: '🔥', component: 'SplBurner', category: 'tools', description: 'Burn tokens & NFTs' },
  { id: 'paint', name: 'Paint Studio', icon: '🎨', component: 'PaintStudio', category: 'creative', description: 'Create art & NFTs' },
];

const categories = [
  { id: 'trading', name: 'Trading', icon: '📈' },
  { id: 'tools', name: 'Tools', icon: '🛠️' },
  { id: 'creative', name: 'Creative', icon: '🎨' },
  { id: 'system', name: 'System', icon: '⚙️' },
];

export function StartMenu() {
  const { startMenuOpen, closeStartMenu, openWindow } = useDesktopStore();

  const handleAppClick = (app: AppConfig) => {
    openWindow(app.id, app.name, app.icon, app.component);
    closeStartMenu();
  };

  return (
    <AnimatePresence>
      {startMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40"
            onClick={closeStartMenu}
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-14 left-2 w-80 bg-black/95 border border-solana-purple/50 rounded-lg overflow-hidden shadow-2xl z-50"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-solana-purple/20 to-solana-green/10 border-b border-solana-purple/30">
              <h2 className="text-lg font-bold text-solana-purple">SOLANA OS</h2>
              <p className="text-xs text-gray-400">Cognitive Operating System</p>
            </div>

            {/* Categories */}
            <div className="p-2 max-h-96 overflow-y-auto">
              {categories.map((category) => {
                const categoryApps = apps.filter(a => a.category === category.id);
                if (categoryApps.length === 0) return null;

                return (
                  <div key={category.id} className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 uppercase">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </div>
                    <div className="space-y-0.5">
                      {categoryApps.map((app) => (
                        <button
                          key={app.id}
                          onClick={() => handleAppClick(app)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-solana-purple/20 transition-colors text-left"
                        >
                          <span className="text-xl">{app.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-white">{app.name}</p>
                            <p className="text-xs text-gray-500">{app.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-solana-purple/30 flex items-center justify-between text-xs text-gray-500">
              <span>v1.0.0</span>
              <span className="text-solana-green">Connected</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
