import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function CometChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to COMET! I\'m your AI-powered blockchain assistant. I can help you with trading, token analysis, agent creation, and more. What would you like to do today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses: { [key: string]: string } = {
        swap: 'I can help you set up a swap! To proceed, I\'ll need:\n\n1. Input token (e.g., SOL)\n2. Output token (e.g., JUP)\n3. Amount to swap\n\nOr you can describe what you want like: "Swap 1 SOL to JUP"',
        agent: 'Great choice! Let me help you create a trading agent. You can specify:\n\n- Agent type (sniper, DCA, momentum)\n- Trading strategy\n- Risk parameters\n\nWhat kind of agent would you like to create?',
        price: 'Here are the current prices:\n\n- SOL: $178.50 (+2.3%)\n- JUP: $0.85 (-1.2%)\n- BONK: $0.000018 (+5.7%)\n\nWould you like more detailed analysis on any token?',
        default: 'I understand! Let me analyze your request and provide the best assistance. Is there anything specific about Solana trading, token analysis, or agent creation you\'d like help with?',
      };

      const lowerInput = input.toLowerCase();
      let response = responses.default;
      if (lowerInput.includes('swap')) response = responses.swap;
      else if (lowerInput.includes('agent')) response = responses.agent;
      else if (lowerInput.includes('price')) response = responses.price;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col bg-solana-dark">
      {/* Header */}
      <div className="p-4 border-b border-solana-purple/30 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center">
            <span className="text-xl">☄️</span>
          </div>
          <div>
            <h3 className="font-bold text-white">COMET</h3>
            <p className="text-xs text-solana-green">AI Assistant Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-solana-purple/20 border border-solana-purple/30'
                  : 'bg-solana-green/10 border border-solana-green/30'
              }`}
            >
              <p className={`text-xs mb-1 ${
                message.role === 'user' ? 'text-solana-purple' : 'text-solana-green'
              }`}>
                {message.role === 'user' ? 'You' : 'Comet'}
              </p>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-solana-green/10 border border-solana-green/30 p-3 rounded-lg">
              <p className="text-xs text-solana-green mb-1">Comet</p>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-solana-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-solana-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-solana-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-solana-purple/30 bg-black/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Comet anything..."
            className="flex-1 bg-black/50 border border-solana-purple/30 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-solana-green transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-solana-purple/20 border border-solana-purple rounded-lg text-solana-purple hover:bg-solana-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
