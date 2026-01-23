import { useDesktopStore } from '../../store/useDesktopStore';
import { SPARK_PHASES } from '../../types';

export function Taskbar() {
  const {
    windows,
    sparkPhase,
    sparkRunning,
    startMenuOpen,
    toggleStartMenu,
    focusWindow,
  } = useDesktopStore();

  const openWindows = windows.filter(w => w.isOpen);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-12 bg-black/80 backdrop-blur-md border-t border-solana-purple/30 flex items-center px-2 z-50">
      {/* Start Button */}
      <button
        onClick={toggleStartMenu}
        className={`px-4 py-2 rounded font-bold text-sm transition-all ${
          startMenuOpen
            ? 'bg-solana-purple/30 text-solana-green'
            : 'bg-solana-purple/20 text-solana-purple hover:bg-solana-purple/30'
        }`}
      >
        START
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-solana-purple/30 mx-2" />

      {/* Open Windows */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {openWindows.map((win) => (
          <button
            key={win.id}
            onClick={() => focusWindow(win.id)}
            className={`px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-all max-w-[150px] truncate ${
              !win.isMinimized
                ? 'bg-solana-purple/30 text-white'
                : 'bg-black/30 text-gray-400 hover:bg-solana-purple/20'
            }`}
          >
            <span>{win.icon}</span>
            <span className="truncate">{win.title}</span>
          </button>
        ))}
      </div>

      {/* SPARK Status */}
      <div className="flex items-center gap-2 px-3">
        <span className="text-xs text-gray-400">SPARK:</span>
        <div className="flex gap-0.5">
          {SPARK_PHASES.map((phase, i) => (
            <span
              key={phase}
              className={`text-[10px] px-1 py-0.5 rounded transition-all ${
                sparkRunning && i === sparkPhase
                  ? 'bg-solana-green/20 text-solana-green'
                  : 'text-gray-600'
              }`}
            >
              {phase.slice(0, 3)}
            </span>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div className="flex items-center gap-3 text-xs text-gray-400 px-3 border-l border-solana-purple/30">
        <span className="text-solana-green">Mainnet</span>
        <span className="text-white">8bit.sol</span>
      </div>
    </div>
  );
}
