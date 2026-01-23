import { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useDesktopStore } from '../../store/useDesktopStore';
import type { WindowState } from '../../types';

interface WindowProps {
  window: WindowState;
  children: ReactNode;
}

export function Window({ window: win, children }: WindowProps) {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition } = useDesktopStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    focusWindow(win.id);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - win.position.x,
      y: e.clientY - win.position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || win.isMaximized) return;
      updateWindowPosition(win.id, {
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, win.id, win.isMaximized, updateWindowPosition]);

  if (!win.isOpen || win.isMinimized) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={windowRef}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute bg-black/90 border border-solana-purple/50 rounded-lg overflow-hidden shadow-2xl"
        style={{
          left: win.isMaximized ? 0 : win.position.x,
          top: win.isMaximized ? 0 : win.position.y,
          width: win.isMaximized ? '100%' : win.size.width,
          height: win.isMaximized ? 'calc(100% - 48px)' : win.size.height,
          zIndex: win.zIndex,
        }}
        onClick={() => focusWindow(win.id)}
      >
        {/* Title Bar */}
        <div
          className="h-10 bg-gradient-to-r from-solana-purple/20 to-solana-green/10 border-b border-solana-purple/30 flex items-center px-3 justify-between cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{win.icon}</span>
            <span className="text-sm font-medium text-white/90">{win.title}</span>
          </div>
          <div className="window-controls flex items-center gap-1">
            <button
              onClick={() => minimizeWindow(win.id)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
            >
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button
              onClick={() => maximizeWindow(win.id)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
            >
              {win.isMaximized ? (
                <Square className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => closeWindow(win.id)}
              className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-2.5rem)] overflow-auto">
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
