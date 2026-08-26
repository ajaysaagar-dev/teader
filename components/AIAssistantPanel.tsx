'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Bot, 
  User, 
  Copy, 
  Check, 
  Loader2, 
  CornerDownLeft,
  ListTodo,
  FileCode2,
  GitPullRequest,
  Calculator
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface AIAssistantPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  issueContext?: {
    id?: string;
    key?: string;
    title?: string;
    status?: string;
    priority?: string;
    epic?: string;
    description?: string;
    subtasks?: any[];
  };
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  isOpen = false,
  onClose,
  issueContext,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: issueContext?.title
        ? `Hello! I am your AI engineering copilot for **${issueContext.key || 'Task'}**: *${issueContext.title}*. How can I assist you with this task today?`
        : 'Hello! I am your Teader AI engineering copilot. Ask me for architecture advice, code generation, task breakdowns, or PR reviews.',
      createdAt: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputValue.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customPrompt) setInputValue('');
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, initialAssistantMessage]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          issueContext,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to communicate with AI');
      }

      if (!res.body) throw new Error('No response stream received');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Parse SSE stream if Anthropic direct stream
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                accumulatedText += parsed.delta.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulatedText }
                      : msg
                  )
                );
              }
            } catch {
              // Plain text chunk fallback
              accumulatedText += dataStr;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulatedText }
                    : msg
                )
              );
            }
          } else if (line.trim() && !line.startsWith('event:')) {
            accumulatedText += line;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: accumulatedText }
                  : msg
              )
            );
          }
        }
      }

      if (!accumulatedText.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: 'Done. No additional output received.' }
              : msg
          )
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: `⚠️ ${err.message || 'AI service unavailable. Please ensure ANTHROPIC_API_KEY is configured in your .env.'}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied response');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    { label: 'Break into subtasks', prompt: 'Please break this task down into actionable sequential subtasks with clear acceptance criteria.', icon: ListTodo },
    { label: 'Write test cases', prompt: 'Write comprehensive unit and integration test cases for this requirement.', icon: FileCode2 },
    { label: 'Estimate complexity', prompt: 'Estimate the story points and identify potential technical blockers or architectural risks.', icon: Calculator },
    { label: 'Draft PR description', prompt: 'Draft a pull request summary, motivation, testing steps, and checklist for this feature.', icon: GitPullRequest },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 340 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 340 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="fixed right-0 top-0 bottom-0 w-96 max-w-full z-40 bg-[#17181A] border-l border-[#2A2C30] shadow-2xl flex flex-col select-none"
        >
          {/* Header */}
          <div className="h-12 px-4 bg-[#131415] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center">
                <Sparkles size={14} className="text-[#DCB001]" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#CFD4DD] flex items-center gap-1.5">
                  AI Engineering Assistant
                  <span className="px-1.5 py-0.2 bg-[#DCB001]/20 text-[#DCB001] text-[9px] font-mono rounded">
                    Claude 3.5
                  </span>
                </h3>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-md transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-[#2A2C30] text-[#DCB001] flex items-center justify-center shrink-0 mt-0.5 border border-[#3B3D41]">
                    <Bot size={13} />
                  </div>
                )}

                <div
                  className={`relative group max-w-[85%] rounded-xl p-3 leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#DCB001] text-[#0F1011] font-medium rounded-tr-none'
                      : 'bg-[#1B1C1F] text-[#CFD4DD] border border-[#2A2C30] rounded-tl-none font-normal'
                  }`}
                >
                  <p className="whitespace-pre-wrap select-text">{msg.content}</p>
                  
                  {msg.role === 'assistant' && msg.content && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="absolute right-2 top-2 p-1 text-[#787C83] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity bg-[#131415] rounded border border-[#2A2C30]"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={11} />}
                    </button>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-[#DCB001] text-[#0F1011] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                    <User size={12} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-[#DCB001] font-mono p-2 bg-[#1B1C1F] rounded-lg border border-[#2A2C30] w-fit">
                <Loader2 size={13} className="animate-spin" />
                <span>Generating engineering analysis...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Pills */}
          <div className="px-3 pt-2 pb-1 border-t border-[#2A2C30]/60 bg-[#131415]/70">
            <span className="text-[10px] font-mono text-[#787C83] block mb-1.5">Quick Actions:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((qp, idx) => {
                const Icon = qp.icon;
                return (
                  <button
                    key={idx}
                    disabled={isLoading}
                    onClick={() => handleSend(qp.prompt)}
                    className="flex items-center gap-1 px-2 py-1 bg-[#1B1C1F] hover:bg-[#2A2C30] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-md text-[10px] text-[#CFD4DD] hover:text-[#DCB001] transition-all disabled:opacity-50"
                  >
                    <Icon size={11} className="text-[#DCB001]" />
                    <span>{qp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea Input */}
          <div className="p-3 bg-[#131415] border-t border-[#2A2C30]">
            <div className="flex items-end gap-2 bg-[#1B1C1F] border border-[#2A2C30] focus-within:border-[#DCB001] rounded-xl p-2 transition-colors">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask AI anything about this task..."
                rows={2}
                className="flex-1 bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none resize-none"
              />
              <button
                disabled={!inputValue.trim() || isLoading}
                onClick={() => handleSend()}
                className="p-1.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg disabled:opacity-40 transition-colors shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
