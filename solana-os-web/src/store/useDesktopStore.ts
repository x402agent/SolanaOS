import { create } from 'zustand';
import type { WindowState, Agent, SparkLoop, Skill, SparkPhase } from '../types';

interface DesktopState {
  // Windows
  windows: WindowState[];
  activeWindowId: string | null;
  nextZIndex: number;

  // SPARK
  sparkPhase: number;
  sparkRunning: boolean;
  cycleCount: number;

  // Agents
  agents: Agent[];

  // Loops
  loops: SparkLoop[];

  // Skills
  skills: Skill[];

  // Start Menu
  startMenuOpen: boolean;

  // Actions - Windows
  openWindow: (id: string, title: string, icon: string, component: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;

  // Actions - SPARK
  setSparkPhase: (phase: number) => void;
  toggleSpark: () => void;
  incrementCycle: () => void;

  // Actions - Agents
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;

  // Actions - Loops
  addLoop: (loop: SparkLoop) => void;
  updateLoop: (id: string, updates: Partial<SparkLoop>) => void;

  // Actions - Skills
  installSkill: (skill: Skill) => void;

  // Actions - Start Menu
  toggleStartMenu: () => void;
  closeStartMenu: () => void;
}

const defaultAgents: Agent[] = [
  { id: 'satoshi-001', name: 'SATOSHI', type: 'privacy', status: 'active', profit: 4.2, trades: 127, winRate: 72, strategy: 'STEALTH_ACCUMULATE' },
  { id: 'toly-001', name: 'TOLY', type: 'trading', status: 'active', profit: 2.8, trades: 89, winRate: 68, strategy: 'MOMENTUM' },
];

const defaultLoops: SparkLoop[] = [
  { id: 'loop-001', name: 'SOL Momentum', token: 'SOL', strategy: 'RECURSIVE_COMPOUND', status: 'running', recursions: 1247, profit: 3.2, infinite: true, stopLoss: 5, takeProfit: 50 },
  { id: 'loop-002', name: 'Privacy Mixer', token: 'SOL', strategy: 'STEALTH_ACCUMULATE', status: 'running', recursions: 892, profit: 1.8, infinite: true, stopLoss: 3, takeProfit: 25 },
];

const defaultSkills: Skill[] = [
  { id: 'jupiter-swap', name: 'Jupiter Swap', category: 'trading', installed: true },
  { id: 'pump-sniper', name: 'Pump.fun Sniper', category: 'trading', installed: true },
  { id: 'bags-launch', name: 'Bags Token Launch', category: 'launch', installed: true },
  { id: 'helius-das', name: 'Helius DAS API', category: 'data', installed: true },
  { id: 'privacy-mixer', name: 'Privacy Mixer', category: 'privacy', installed: true },
  { id: 'recursive-loop', name: 'Recursive Loop Engine', category: 'automation', installed: true },
];

export const useDesktopStore = create<DesktopState>((set) => ({
  // Initial state
  windows: [],
  activeWindowId: null,
  nextZIndex: 1,
  sparkPhase: 0,
  sparkRunning: true,
  cycleCount: 0,
  agents: defaultAgents,
  loops: defaultLoops,
  skills: defaultSkills,
  startMenuOpen: false,

  // Window actions
  openWindow: (id, title, icon, component) => set((state) => {
    const existing = state.windows.find(w => w.id === id);
    if (existing) {
      return {
        windows: state.windows.map(w =>
          w.id === id ? { ...w, isOpen: true, isMinimized: false, zIndex: state.nextZIndex } : w
        ),
        activeWindowId: id,
        nextZIndex: state.nextZIndex + 1,
        startMenuOpen: false,
      };
    }

    const offset = state.windows.length * 30;
    const newWindow: WindowState = {
      id,
      title,
      icon,
      component,
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      position: { x: 100 + offset, y: 50 + offset },
      size: { width: 800, height: 600 },
      zIndex: state.nextZIndex,
    };

    return {
      windows: [...state.windows, newWindow],
      activeWindowId: id,
      nextZIndex: state.nextZIndex + 1,
      startMenuOpen: false,
    };
  }),

  closeWindow: (id) => set((state) => ({
    windows: state.windows.map(w => w.id === id ? { ...w, isOpen: false } : w),
    activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
  })),

  minimizeWindow: (id) => set((state) => ({
    windows: state.windows.map(w => w.id === id ? { ...w, isMinimized: true } : w),
    activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
  })),

  maximizeWindow: (id) => set((state) => ({
    windows: state.windows.map(w =>
      w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
    ),
  })),

  focusWindow: (id) => set((state) => ({
    windows: state.windows.map(w =>
      w.id === id ? { ...w, zIndex: state.nextZIndex, isMinimized: false } : w
    ),
    activeWindowId: id,
    nextZIndex: state.nextZIndex + 1,
  })),

  updateWindowPosition: (id, position) => set((state) => ({
    windows: state.windows.map(w => w.id === id ? { ...w, position } : w),
  })),

  updateWindowSize: (id, size) => set((state) => ({
    windows: state.windows.map(w => w.id === id ? { ...w, size } : w),
  })),

  // SPARK actions
  setSparkPhase: (phase) => set({ sparkPhase: phase }),
  toggleSpark: () => set((state) => ({ sparkRunning: !state.sparkRunning })),
  incrementCycle: () => set((state) => ({ cycleCount: state.cycleCount + 1 })),

  // Agent actions
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map(a => a.id === id ? { ...a, ...updates } : a),
  })),

  // Loop actions
  addLoop: (loop) => set((state) => ({ loops: [...state.loops, loop] })),
  updateLoop: (id, updates) => set((state) => ({
    loops: state.loops.map(l => l.id === id ? { ...l, ...updates } : l),
  })),

  // Skill actions
  installSkill: (skill) => set((state) => ({
    skills: [...state.skills, { ...skill, installed: true }],
  })),

  // Start Menu actions
  toggleStartMenu: () => set((state) => ({ startMenuOpen: !state.startMenuOpen })),
  closeStartMenu: () => set({ startMenuOpen: false }),
}));
