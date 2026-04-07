import React from 'react';
import { StrategyParams } from '../types';
import { Sliders, Save } from 'lucide-react';

interface StrategyControlsProps {
  params: StrategyParams | null;
}

export const StrategyControls: React.FC<StrategyControlsProps> = ({ params }) => {
  if (!params) return null;

  const ControlRow = ({ label, value, unit = '' }: { label: string, value: number, unit?: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40 uppercase font-bold tracking-tighter">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-solana-purple">{value}{unit}</span>
        <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-solana-purple/40" style={{ width: `${Math.min(value * 2, 100)}%` }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-cyber-gray border border-white/5 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-solana-purple" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Strategy Engine</h3>
        </div>
        <button className="flex items-center gap-1 px-2 py-1 bg-solana-purple/20 hover:bg-solana-purple/30 text-solana-purple rounded text-[10px] font-bold uppercase tracking-widest transition-colors">
          <Save className="w-3 h-3" />
          Save
        </button>
      </div>

      <div className="space-y-1">
        <ControlRow label="RSI Period" value={params.rsi_period} />
        <ControlRow label="RSI Overbought" value={params.rsi_overbought} />
        <ControlRow label="RSI Oversold" value={params.rsi_oversold} />
        <ControlRow label="EMA Fast" value={params.ema_fast} />
        <ControlRow label="EMA Slow" value={params.ema_slow} />
        <ControlRow label="Stop Loss" value={params.stop_loss} unit="%" />
        <ControlRow label="Take Profit" value={params.take_profit} unit="%" />
        <ControlRow label="Position Size" value={params.position_size} unit="%" />
      </div>

      <div className="mt-2 p-3 bg-industrial-orange/5 border border-industrial-orange/20 rounded-lg">
        <p className="text-[10px] text-industrial-orange/80 leading-relaxed">
          <span className="font-bold">AUTO-OPTIMIZER:</span> Active. Adjusting RSI zones based on rolling win rate (42.5%).
        </p>
      </div>
    </div>
  );
};
