import { useState } from 'react';
import { Play, Pause, Plus, Infinity } from 'lucide-react';
import { useDesktopStore } from '../../store/useDesktopStore';
import { STRATEGIES, SPARK_PHASES } from '../../types';
import type { SparkLoop } from '../../types';

export function LoopCreator() {
  const { loops, addLoop, updateLoop, sparkPhase, sparkRunning } = useDesktopStore();
  const [newLoop, setNewLoop] = useState({
    name: '',
    token: 'SOL',
    amount: '1.0',
    strategy: 'RECURSIVE_COMPOUND',
    infinite: true,
    stopLoss: '5',
    takeProfit: '50',
  });

  const createLoop = () => {
    if (!newLoop.name.trim() || !newLoop.token.trim()) return;

    const loop: SparkLoop = {
      id: `loop-${Date.now()}`,
      name: newLoop.name,
      token: newLoop.token,
      strategy: newLoop.strategy,
      status: 'ready',
      recursions: 0,
      profit: 0,
      infinite: newLoop.infinite,
      stopLoss: parseFloat(newLoop.stopLoss),
      takeProfit: parseFloat(newLoop.takeProfit),
    };

    addLoop(loop);
    setNewLoop({
      name: '',
      token: 'SOL',
      amount: '1.0',
      strategy: 'RECURSIVE_COMPOUND',
      infinite: true,
      stopLoss: '5',
      takeProfit: '50',
    });
  };

  const toggleLoop = (id: string, currentStatus: SparkLoop['status']) => {
    updateLoop(id, { status: currentStatus === 'running' ? 'paused' : 'running' });
  };

  return (
    <div className="h-full flex bg-solana-dark">
      {/* Create Panel */}
      <div className="w-80 border-r border-solana-purple/30 p-4">
        <h3 className="text-lg font-bold text-solana-purple mb-4">Create SPARK Loop</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Loop Name</label>
            <input
              type="text"
              value={newLoop.name}
              onChange={(e) => setNewLoop({ ...newLoop, name: e.target.value })}
              placeholder="e.g., SOL Momentum"
              className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-solana-green"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Token</label>
            <input
              type="text"
              value={newLoop.token}
              onChange={(e) => setNewLoop({ ...newLoop, token: e.target.value })}
              placeholder="SOL"
              className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-solana-green"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Amount</label>
              <input
                type="text"
                value={newLoop.amount}
                onChange={(e) => setNewLoop({ ...newLoop, amount: e.target.value })}
                className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Strategy</label>
              <select
                value={newLoop.strategy}
                onChange={(e) => setNewLoop({ ...newLoop, strategy: e.target.value })}
                className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
              >
                {STRATEGIES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Stop Loss %</label>
              <input
                type="text"
                value={newLoop.stopLoss}
                onChange={(e) => setNewLoop({ ...newLoop, stopLoss: e.target.value })}
                className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Take Profit %</label>
              <input
                type="text"
                value={newLoop.takeProfit}
                onChange={(e) => setNewLoop({ ...newLoop, takeProfit: e.target.value })}
                className="w-full bg-black/50 border border-solana-purple/30 rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newLoop.infinite}
              onChange={(e) => setNewLoop({ ...newLoop, infinite: e.target.checked })}
              className="accent-solana-green"
            />
            <Infinity className="w-4 h-4 text-solana-purple" />
            <span className="text-sm">Infinite Recursive Mode</span>
          </label>

          <button
            onClick={createLoop}
            disabled={!newLoop.name.trim()}
            className="w-full py-3 bg-gradient-to-r from-solana-purple to-solana-green rounded-lg font-bold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Loop
          </button>
        </div>

        {/* SPARK Visualization */}
        <div className="mt-6 p-4 bg-black/30 border border-solana-purple/30 rounded-lg">
          <h4 className="text-sm font-bold text-gray-400 mb-3">SPARK CYCLE</h4>
          <div className="grid grid-cols-3 gap-2">
            {SPARK_PHASES.map((phase, i) => (
              <div
                key={phase}
                className={`p-2 rounded text-center text-xs transition-all ${
                  sparkRunning && i === sparkPhase
                    ? 'bg-solana-green/20 text-solana-green border border-solana-green/50'
                    : 'bg-black/30 text-gray-500'
                }`}
              >
                {phase}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loops List */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Active Loops</h3>
          <span className="text-sm text-gray-400">
            {loops.filter((l) => l.status === 'running').length} running
          </span>
        </div>

        <div className="space-y-4">
          {loops.map((loop) => (
            <div
              key={loop.id}
              className="bg-black/40 border border-solana-purple/30 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-white">{loop.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{loop.token}</span>
                </div>
                <div className="flex items-center gap-2">
                  {loop.infinite && (
                    <Infinity className="w-4 h-4 text-solana-purple" />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    loop.status === 'running'
                      ? 'bg-solana-green/20 text-solana-green'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {loop.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-3">{loop.strategy.replace('_', ' ')}</div>

              <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Recursions</p>
                  <p className="font-bold text-white">{loop.recursions.toLocaleString()}</p>
                </div>
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Profit</p>
                  <p className={`font-bold ${loop.profit >= 0 ? 'text-solana-green' : 'text-red-400'}`}>
                    {loop.profit >= 0 ? '+' : ''}{loop.profit} SOL
                  </p>
                </div>
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Stop Loss</p>
                  <p className="font-bold text-red-400">{loop.stopLoss}%</p>
                </div>
                <div className="bg-black/30 p-2 rounded">
                  <p className="text-xs text-gray-400">Take Profit</p>
                  <p className="font-bold text-solana-green">{loop.takeProfit}%</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-black/50 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-solana-purple to-solana-green transition-all"
                  style={{ width: `${Math.min(100, (loop.recursions / 2000) * 100)}%` }}
                />
              </div>

              <button
                onClick={() => toggleLoop(loop.id, loop.status)}
                className={`w-full py-2 rounded flex items-center justify-center gap-2 text-sm transition-colors ${
                  loop.status === 'running'
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-solana-green/20 text-solana-green hover:bg-solana-green/30'
                }`}
              >
                {loop.status === 'running' ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause Loop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Loop
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
