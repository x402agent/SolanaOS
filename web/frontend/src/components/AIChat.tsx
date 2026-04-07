import React, { useState } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIChatProps {
  endpoint?: string;
}

export const AIChat: React.FC<AIChatProps> = ({ endpoint = '/api/chat' }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'SolanaOS Agent online. Query the daemon, wallet, strategy, or miner stack.' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const payload = await response.json().catch(() => ({}));
      const reply =
        payload?.response ||
        payload?.reply ||
        payload?.message ||
        (response.ok ? 'No response received from SolanaOS.' : `Chat request failed (${response.status}).`);

      setMessages((prev) => [...prev, { role: 'assistant', content: String(reply) }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Neural link offline. Start the SolanaOS gateway or daemon API and try again.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-cyber-gray border border-white/5 rounded-xl flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-white/5 flex items-center justify-between bg-solana-purple/5">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-solana-purple" />
          <span className="text-xs font-bold uppercase tracking-widest">Neural Interface</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
          <span className="text-[9px] text-white/40 uppercase font-bold">Daemon Linked</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.role}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-solana-purple/20 border border-solana-purple/30 text-white'
                    : 'bg-black/40 border border-white/5 text-white/80'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 opacity-40">
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  <span className="text-[9px] uppercase font-bold">{msg.role}</span>
                </div>
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-black/40 border border-white/5 p-3 rounded-lg flex gap-1">
              <div className="w-1 h-1 bg-solana-purple rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-solana-purple rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1 h-1 bg-solana-purple rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-black/20">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Query the agent..."
            className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-3 pr-10 text-xs focus:outline-none focus:border-solana-purple/50 transition-colors"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-solana-purple hover:text-solana-green transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
