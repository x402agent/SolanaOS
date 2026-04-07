import React from 'react';
import { CompanionState } from '../types';
import { motion } from 'motion/react';

interface CompanionStatusProps {
  state: CompanionState;
}

export const CompanionStatus: React.FC<CompanionStatusProps> = ({ state }) => {
  const getEmoji = (stage: string) => {
    switch (stage) {
      case 'Egg': return '🥚';
      case 'Larva': return '🦐';
      case 'Juvenile': return '🐹';
      case 'Adult': return '🦊';
      case 'Alpha': return '👑';
      case 'Ghost': return '💀';
      default: return '😐';
    }
  };

  return (
    <div className="bg-cyber-gray border border-white/5 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 bg-solana-purple/10 rounded-full flex items-center justify-center text-4xl border border-solana-purple/30 glow-purple">
            {getEmoji(state.stage)}
          </div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -bottom-1 -right-1 w-5 h-5 bg-solana-green rounded-full border-2 border-cyber-gray flex items-center justify-center text-[10px] font-bold text-black"
          >
            {state.level}
          </motion.div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold uppercase tracking-widest">SolanaOS <span className="text-white/40">v1.0</span></h3>
            <span className="text-[10px] font-mono text-solana-purple uppercase">{state.stage}</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(state.xp % 100)}%` }}
              className="h-full bg-solana-purple"
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-white/40 uppercase">XP: {state.xp}</span>
            <span className="text-[10px] text-white/40 uppercase">Next: 100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
            <span>Energy</span>
            <span className="text-solana-green">{(state.energy * 10).toFixed(0)}%</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-sm ${i < state.energy ? 'bg-solana-green' : 'bg-white/5'}`} 
              />
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
            <span>Hunger</span>
            <span className="text-industrial-orange">{(state.hunger * 10).toFixed(0)}%</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-sm ${i < state.hunger ? 'bg-industrial-orange' : 'bg-white/5'}`} 
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex items-center justify-between">
        <span className="text-xs text-white/60">Current Mood</span>
        <span className="text-xs font-bold text-solana-purple uppercase tracking-widest">{state.mood}</span>
      </div>
    </div>
  );
};
