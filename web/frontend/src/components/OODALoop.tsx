import React from 'react';
import { motion } from 'motion/react';

interface OODALoopProps {
  currentStep: 'Observe' | 'Orient' | 'Decide' | 'Act';
}

export const OODALoop: React.FC<OODALoopProps> = ({ currentStep }) => {
  const steps = [
    { name: 'Observe', icon: '👁️', description: 'Helius RPC / DAS' },
    { name: 'Orient', icon: '🧠', description: 'RSI / EMA / ATR' },
    { name: 'Decide', icon: '⚖️', description: 'Confidence Gate' },
    { name: 'Act', icon: '⚡', description: 'Jupiter Swap' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-cyber-gray border border-white/5 rounded-xl glow-purple relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-solana-purple via-solana-green to-industrial-orange opacity-50" />
      {steps.map((step) => (
        <motion.div
          key={step.name}
          initial={false}
          animate={{
            opacity: currentStep === step.name ? 1 : 0.4,
            scale: currentStep === step.name ? 1.05 : 1,
            borderColor: currentStep === step.name ? 'rgba(153, 69, 255, 0.5)' : 'rgba(255, 255, 255, 0.05)',
          }}
          className={`p-3 border rounded-lg flex flex-col items-center justify-center text-center transition-all ${
            currentStep === step.name ? 'bg-solana-purple/10' : 'bg-black/20'
          }`}
        >
          <span className="text-2xl mb-1">{step.icon}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-solana-purple">
            {step.name}
          </span>
          <span className="text-[10px] text-white/40 font-mono mt-1">
            {step.description}
          </span>
          {currentStep === step.name && (
            <motion.div
              layoutId="active-indicator"
              className="mt-2 w-1 h-1 rounded-full bg-solana-green shadow-[0_0_8px_#14F195]"
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};
