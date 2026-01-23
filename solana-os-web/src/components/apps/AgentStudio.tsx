import { useState } from 'react';
import { Play, Pause, Plus, Settings, Zap } from 'lucide-react';
import { useDesktopStore } from '../../store/useDesktopStore';
import { STRATEGIES } from '../../types';
import type { Agent } from '../../types';

const agentTemplates = [
  { name: 'SATOSHI', type: 'privacy' as const, desc: 'Privacy-focused stealth trading', icon: '🥷', strategy: 'STEALTH_ACCUMULATE' },
  { name: 'TOLY', type: 'trading' as const, desc: 'Momentum-based trading agent', icon: '📈', strategy: 'MOMENTUM' },
  { name: 'HUNTER', type: 'sniper' as const, desc: 'New token and NFT sniper', icon: '🎯', strategy: 'SNIPE' },
  { name: 'ORACLE', type: 'analytics' as const, desc: 'On-chain analytics tracker', icon: '🔮', strategy: 'AI_ADAPTIVE' },
];

export function AgentStudio() {
  const { agents, addAgent, updateAgent } = useDesktopStore();
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: 'trading' as Agent['type'],
    strategy: 'MOMENTUM',
  });

  const createAgent = () => {
    if (!newAgent.name.trim()) return;

    const agent: Agent = {
      id: `agent-${Date.now()}`,
      name: newAgent.name.toUpperCase(),
      type: newAgent.type,
      status: 'active',
      profit: 0,
      trades: 0,
      winRate: 0,
      strategy: newAgent.strategy,
    };

    addAgent(agent);
    setNewAgent({ name: '', type: 'trading', strategy: 'MOMENTUM' });
  };

  const toggleAgent = (id: string, currentStatus: Agent['status']) => {
    updateAgent(id, { status: currentStatus === 'active' ? 'paused' : 'active' });
  };

  return (
    <div className="h-full flex bg-solana-dark">
      {/* Create Panel */}
      <div className="w-80 border-r border-solana-purple/30 p-4">
        <h3 className="text-lg font-bold text-solana-purple mb-4">Create Agent</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Agent Name</label>
            <input
              type="text"
              value={newAgent.name}
              onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
              placeholder="e.g., ALPHA"
              className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-solana-green transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select
              value={newAgent.type}
              onChange={(e) => setNewAgent({ ...newAgent, type: e.target.value as Agent['type'] })}
              className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              <option value="trading">Trading Agent</option>
              <option value="privacy">Privacy Agent</option>
              <option value="sniper">Sniper Agent</option>
              <option value="analytics">Analytics Agent</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Strategy</label>
            <select
              value={newAgent.strategy}
              onChange={(e) => setNewAgent({ ...newAgent, strategy: e.target.value })}
              className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-solana-green/10 border border-solana-green/30 rounded-lg">
            <div className="flex items-center gap-2 text-solana-green text-sm font-bold mb-1">
              <Zap className="w-4 h-4" />
              SPARK Intelligence
            </div>
            <p className="text-xs text-gray-400">
              Your agent will learn and improve through the OBSERVE → DECIDE → ACT → MEASURE → LEARN → IMPROVE loop.
            </p>
          </div>

          <button
            onClick={createAgent}
            disabled={!newAgent.name.trim()}
            className="w-full py-3 bg-gradient-to-r from-solana-purple to-solana-green rounded-lg font-bold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>

        {/* Templates */}
        <div className="mt-6">
          <h4 className="text-sm font-bold text-gray-400 mb-3">TEMPLATES</h4>
          <div className="space-y-2">
            {agentTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => setNewAgent({ name: template.name, type: template.type, strategy: template.strategy })}
                className="w-full p-3 bg-black/30 border border-solana-purple/20 rounded-lg hover:border-solana-purple/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{template.icon}</span>
                  <span className="font-bold text-white">{template.name}</span>
                </div>
                <p className="text-xs text-gray-500">{template.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Active Agents</h3>
          <span className="text-sm text-gray-400">{agents.length} agents</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-black/40 border border-solana-purple/30 rounded-lg p-4 hover:border-solana-purple/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-solana-green' : 'bg-gray-500'
                  }`} />
                  <span className="font-bold text-white">{agent.name}</span>
                </div>
                <span className="text-xs px-2 py-0.5 bg-solana-purple/20 text-solana-purple rounded">
                  {agent.type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Trades</p>
                  <p className="font-bold text-white">{agent.trades}</p>
                </div>
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Win Rate</p>
                  <p className="font-bold text-white">{agent.winRate}%</p>
                </div>
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Profit</p>
                  <p className={`font-bold ${agent.profit >= 0 ? 'text-solana-green' : 'text-red-400'}`}>
                    {agent.profit >= 0 ? '+' : ''}{agent.profit} SOL
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleAgent(agent.id, agent.status)}
                  className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm transition-colors ${
                    agent.status === 'active'
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-solana-green/20 text-solana-green hover:bg-solana-green/30'
                  }`}
                >
                  {agent.status === 'active' ? (
                    <>
                      <Pause className="w-4 h-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Start
                    </>
                  )}
                </button>
                <button className="px-3 py-2 bg-black/30 rounded hover:bg-solana-purple/20 transition-colors">
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
