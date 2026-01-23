import { useState, useRef, useEffect } from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';
import type { TerminalLine } from '../../types';

export function Terminal() {
  const { agents, loops, skills, installSkill, sparkRunning, cycleCount } = useDesktopStore();
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: 'info', text: 'SOLANA OS TERMINAL v1.0.0', timestamp: new Date().toLocaleTimeString() },
    { type: 'success', text: "Type 'help' for available commands.", timestamp: new Date().toLocaleTimeString() },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const addOutput = (type: TerminalLine['type'], text: string) => {
    setHistory((prev) => [...prev, { type, text, timestamp: new Date().toLocaleTimeString() }]);
  };

  const handleCommand = (cmd: string) => {
    addOutput('input', `$ ${cmd}`);
    const args = cmd.toLowerCase().trim().split(' ');
    const command = args[0];

    switch (command) {
      case 'help':
        addOutput('output', `
Available Commands:
  help                        Show this help message
  npx skills install <name>   Install a skill
  npx skills list             List available skills
  agent list                  List all agents
  agent status <name>         Show agent status
  loop list                   List all SPARK loops
  spark status                SPARK engine status
  wallet                      Show wallet info
  clear                       Clear terminal
        `);
        break;

      case 'npx':
        if (args[1] === 'skills') {
          if (args[2] === 'install' && args[3]) {
            addOutput('success', `Installing skill: ${args[3]}...`);
            setTimeout(() => {
              addOutput('success', `Skill ${args[3]} installed successfully!`);
              addOutput('info', `Added to /mnt/skills/user/${args[3]}`);
              installSkill({ id: args[3], name: args[3], category: 'custom', installed: true });
            }, 500);
          } else if (args[2] === 'list') {
            addOutput('output', `
Available Skills (npx skills):
  @solana/jupiter-swap     DEX aggregation
  @solana/pump-sniper      New token sniping
  @solana/bags-launch      Token launches
  @solana/privacy-mixer    Privacy transactions
  @solana/whale-tracker    Whale monitoring
  @solana/nft-sniper       NFT mint sniping
  @solana/arbitrage        Cross-DEX arbitrage
  @solana/grid-trading     Grid trading bot
  @solana/dca-engine       DCA automation
            `);
          }
        }
        break;

      case 'agent':
        if (args[1] === 'list') {
          const agentList = agents.map((a) =>
            `  ${a.status === 'active' ? '●' : '○'} ${a.name.padEnd(12)} ${a.type.padEnd(10)} +${a.profit} SOL`
          ).join('\n');
          addOutput('output', `Active Agents:\n${agentList}`);
        } else if (args[1] === 'status' && args[2]) {
          const agent = agents.find((a) => a.name.toLowerCase() === args[2]);
          if (agent) {
            addOutput('output', `
Agent: ${agent.name}
Type: ${agent.type}
Status: ${agent.status}
Strategy: ${agent.strategy}
Trades: ${agent.trades}
Win Rate: ${agent.winRate}%
Profit: +${agent.profit} SOL
            `);
          } else {
            addOutput('error', `Agent not found: ${args[2]}`);
          }
        }
        break;

      case 'loop':
        if (args[1] === 'list') {
          const loopList = loops.map((l) =>
            `  ${l.status === 'running' ? '●' : '○'} ${l.name.padEnd(15)} ${l.strategy.padEnd(20)} ${l.recursions} recursions`
          ).join('\n');
          addOutput('output', `SPARK Loops:\n${loopList}`);
        }
        break;

      case 'spark':
        if (args[1] === 'status') {
          addOutput('output', `
SPARK Engine Status
-------------------
Status: ${sparkRunning ? 'RUNNING' : 'PAUSED'}
Cycle Count: ${cycleCount}
Active Loops: ${loops.filter((l) => l.status === 'running').length}
Total Recursions: ${loops.reduce((a, l) => a + l.recursions, 0)}
          `);
        }
        break;

      case 'wallet':
        addOutput('output', `
Wallet: 8bit.sol
Address: 8bIt...Wx7z
Balance: 24.5 SOL ($4,200)
Network: Mainnet-beta
        `);
        break;

      case 'clear':
        setHistory([]);
        return;

      default:
        addOutput('error', `Command not found: ${command}. Type 'help' for available commands.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleCommand(input);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-black font-mono">
      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {history.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap mb-1 ${
              line.type === 'input' ? 'text-white' :
              line.type === 'success' ? 'text-solana-green' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'warning' ? 'text-yellow-400' :
              line.type === 'info' ? 'text-solana-purple' :
              'text-gray-400'
            }`}
          >
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-solana-green/30 p-2 flex items-center gap-2">
        <span className="text-solana-green">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-white outline-none"
          autoFocus
        />
        <span className="w-2 h-4 bg-solana-green terminal-cursor" />
      </form>
    </div>
  );
}
