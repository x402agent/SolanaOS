import { useEffect } from 'react';
import { useDesktopStore } from './store/useDesktopStore';
import { Background, Window, Taskbar, StartMenu, DesktopIcons } from './components/desktop';
import { CometChat, DexPanel, Portfolio, AgentStudio, LoopCreator, Terminal, SkillsMarket } from './components/apps';
import { SPARK_PHASES } from './types';

const componentMap: { [key: string]: React.ComponentType } = {
  CometChat,
  DexPanel,
  Portfolio,
  AgentStudio,
  LoopCreator,
  Terminal,
  SkillsMarket,
  ChainExplorer: () => <PlaceholderApp name="Chain Explorer" icon="🔍" />,
  SplBurner: () => <PlaceholderApp name="SPL Burner" icon="🔥" />,
  PaintStudio: () => <PlaceholderApp name="Paint Studio" icon="🎨" />,
};

function PlaceholderApp({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-solana-dark">
      <div className="text-center">
        <span className="text-6xl mb-4 block">{icon}</span>
        <h2 className="text-xl font-bold text-white mb-2">{name}</h2>
        <p className="text-gray-500">Coming soon...</p>
      </div>
    </div>
  );
}

function App() {
  const {
    windows,
    sparkRunning,
    sparkPhase,
    setSparkPhase,
    incrementCycle,
    closeStartMenu,
  } = useDesktopStore();

  // SPARK loop animation
  useEffect(() => {
    if (!sparkRunning) return;

    const interval = setInterval(() => {
      setSparkPhase((sparkPhase + 1) % SPARK_PHASES.length);
      if (sparkPhase === SPARK_PHASES.length - 1) {
        incrementCycle();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [sparkRunning, sparkPhase, setSparkPhase, incrementCycle]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden font-mono"
      onClick={(e) => {
        // Close start menu when clicking outside
        if (!(e.target as HTMLElement).closest('[data-start-menu]')) {
          closeStartMenu();
        }
      }}
    >
      {/* Background */}
      <Background />

      {/* Desktop Icons */}
      <DesktopIcons />

      {/* Windows */}
      {windows.map((win) => {
        const Component = componentMap[win.component];
        if (!Component) return null;

        return (
          <Window key={win.id} window={win}>
            <Component />
          </Window>
        );
      })}

      {/* Start Menu */}
      <div data-start-menu>
        <StartMenu />
      </div>

      {/* Taskbar */}
      <Taskbar />

      {/* COMET Floating Button */}
      <button
        onClick={() => useDesktopStore.getState().openWindow('comet', 'COMET Chat', '☄️', 'CometChat')}
        className="fixed bottom-16 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center shadow-lg shadow-solana-purple/30 hover:scale-110 transition-transform z-40"
      >
        <span className="text-2xl">☄️</span>
      </button>
    </div>
  );
}

export default App;
