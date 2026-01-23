import { useDesktopStore } from '../../store/useDesktopStore';

interface DesktopIcon {
  id: string;
  name: string;
  icon: string;
  component: string;
}

const desktopIcons: DesktopIcon[] = [
  { id: 'comet', name: 'COMET', icon: '☄️', component: 'CometChat' },
  { id: 'dex', name: 'DEX', icon: '📊', component: 'DexPanel' },
  { id: 'portfolio', name: 'Portfolio', icon: '💰', component: 'Portfolio' },
  { id: 'agents', name: 'Agents', icon: '🤖', component: 'AgentStudio' },
  { id: 'terminal', name: 'Terminal', icon: '💻', component: 'Terminal' },
];

export function DesktopIcons() {
  const { openWindow } = useDesktopStore();

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2">
      {desktopIcons.map((icon) => (
        <button
          key={icon.id}
          onDoubleClick={() => openWindow(icon.id, icon.name, icon.icon, icon.component)}
          className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-white/5 transition-colors group w-20"
        >
          <span className="text-4xl group-hover:scale-110 transition-transform">
            {icon.icon}
          </span>
          <span className="text-xs text-white/80 text-center">{icon.name}</span>
        </button>
      ))}
    </div>
  );
}
