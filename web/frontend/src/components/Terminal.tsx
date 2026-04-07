import React, { useEffect, useRef } from 'react';

interface TerminalProps {
  logs: string[];
}

export const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black border border-white/5 rounded-xl p-4 font-mono text-[11px] h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 flex gap-1">
        <div className="w-2 h-2 rounded-full bg-red-500/50" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
        <div className="w-2 h-2 rounded-full bg-green-500/50" />
      </div>
      <div className="text-white/20 mb-2 uppercase tracking-widest text-[9px] font-bold">System Daemon Logs</div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 custom-scrollbar"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
            <span className={
              log.includes('ERROR') ? 'text-red-400' : 
              log.includes('SUCCESS') ? 'text-solana-green' : 
              log.includes('OODA') ? 'text-solana-purple' : 
              'text-white/60'
            }>
              {log}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
        <span className="text-solana-green">solanaos@operator:~$</span>
        <div className="w-2 h-4 bg-solana-green animate-pulse" />
      </div>
    </div>
  );
};
