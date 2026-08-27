'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Hash,
  Users,
  Smile,
  Clock,
  Trash2,
  Copy,
  ChevronDown,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProjectMessage } from '@/lib/db';

interface Member {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userAvatar: string;
  role: string;
}

interface ProjectConversationViewProps {
  projectId: number | string;
  projectName?: string;
  projectKey?: string;
  currentUser?: any;
}

const CHANNELS = [
  { id: 'general', name: 'general', desc: 'General project discussions and team syncs' },
  { id: 'dev-stream', name: 'dev-stream', desc: 'Autonomous coding agent updates & commits' },
  { id: 'architecture', name: 'architecture', desc: 'System design, schemas & API reviews' },
  { id: 'qa-sync', name: 'qa-sync', desc: 'Bug reports, test results & QA verification' },
];

const EMOJIS = ['🚀', '⚡', '🔥', '✅', '👏', '🎉', '💡', '🤖', '👀', '❤️'];

export function ProjectConversationView({
  projectId,
  projectName,
  projectKey,
  currentUser,
}: ProjectConversationViewProps) {
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchMember, setSearchMember] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!projectId) return;
    try {
      const url = `/api/conversations?projectId=${projectId}&channel=${activeChannel}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to load project conversation:', err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [projectId, activeChannel]);

  useEffect(() => {
    fetchMessages(true);
  }, [fetchMessages]);

  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [projectId, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !projectId || isSending) return;

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    const optimisticMsg: ProjectMessage = {
      id: Date.now(),
      projectId: Number(projectId),
      userId: currentUser?.id || 1,
      userName: currentUser?.name || 'You',
      userAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      userRole: 'member',
      content,
      channel: activeChannel,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(projectId),
          channel: activeChannel,
          content,
        }),
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json();
      if (data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? data.message : m))
        );
      }
    } catch {
      toast.error('Failed to deliver message.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      await fetch(`/api/conversations?id=${msgId}`, { method: 'DELETE' });
      toast.success('Message removed');
    } catch {
      toast.error('Could not delete message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeChannelObj = CHANNELS.find((c) => c.id === activeChannel) || CHANNELS[0];
  const filteredMembers = members.filter(
    (m) =>
      m.userName?.toLowerCase().includes(searchMember.toLowerCase()) ||
      m.userEmail?.toLowerCase().includes(searchMember.toLowerCase())
  );

  return (
    <div className="flex flex-1 h-full min-h-0 w-full overflow-hidden bg-[#0D0E11] text-[#CFD4DD]">
      {/* ─── Left Column: Channel Switcher ─────────────────────────── */}
      <aside className="w-56 shrink-0 bg-[#111215] border-r border-[#222428] flex flex-col justify-between select-none h-full min-h-0">
        <div>
          <div className="p-3 border-b border-[#222428] flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#787C83] font-medium">
              Channels
            </span>
            <span className="text-[10px] font-mono text-[#585C60]">{CHANNELS.length}</span>
          </div>

          <div className="p-2 space-y-1">
            {CHANNELS.map((ch) => {
              const isActive = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 font-semibold shadow-sm'
                      : 'text-[#8E939D] hover:text-white hover:bg-[#16171B]'
                  }`}
                >
                  <Hash size={13} className={isActive ? 'text-[#DCB001]' : 'text-[#585C60]'} />
                  <span className="truncate">{ch.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-[#222428] bg-[#0E0F12]/60">
          <div className="flex items-center justify-between text-[11px] text-[#787C83]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </span>
            <span className="font-mono text-[10px]">{members.length} members</span>
          </div>
        </div>
      </aside>

      {/* ─── Center: Main Chat Messages ────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-[#0E0F12]">
        {/* Messages Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-xs font-mono text-[#787C83] space-y-2">
              <div className="w-6 h-6 border-2 border-[#DCB001] border-t-transparent rounded-full animate-spin" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-16 select-none">
              <div className="w-12 h-12 rounded-2xl bg-[#191A1E] border border-[#2A2C30] flex items-center justify-center text-[#DCB001] shadow-lg">
                <MessageSquare size={22} />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-sm font-bold text-white">Welcome to #{activeChannelObj.name}!</h3>
                <p className="text-xs text-[#787C83]">
                  Coordinate with joined teammates in <span className="text-[#DCB001]">#{activeChannelObj.name}</span> for {projectName || 'this project'}.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.userId === currentUser?.id;
              const isOwner = msg.userRole === 'owner';
              const isAdmin = msg.userRole === 'admin';

              return (
                <div
                  key={`msg_${msg.id ?? 'opt'}_${idx}`}
                  className={`group flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                    isMe ? 'bg-[#15161A]/50 hover:bg-[#18191E]' : 'hover:bg-[#15161A]'
                  }`}
                >
                  <img
                    src={msg.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                    alt={msg.userName}
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#2A2C30] shrink-0 mt-0.5"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-white truncate">
                        {msg.userName}
                      </span>

                      {isOwner && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30">
                          OWNER
                        </span>
                      )}

                      {isAdmin && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          ADMIN
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-[#6A6E75]">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="text-xs text-[#CFD4DD] leading-relaxed break-words whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>

                  {(isMe || currentUser?.id === 1) && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2A2C30] text-[#787C83] hover:text-[#EF4444] transition-opacity"
                      title="Delete message"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[#222428] bg-[#111215]/90 shrink-0">
          {showEmojiPicker && (
            <div className="flex items-center gap-1.5 mb-2.5 p-2 bg-[#17181C] border border-[#2A2C30] rounded-xl select-none">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputValue((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                  className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[#24262B] rounded-lg transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-[#17181C] border border-[#2A2C30] focus-within:border-[#DCB001] rounded-xl p-2 transition-colors">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${activeChannelObj.name}... (Enter to send, Shift+Enter for new line)`}
              rows={1}
              className="flex-1 bg-transparent text-xs text-white placeholder-[#686C74] focus:outline-none resize-none max-h-32 min-h-[36px] py-2 px-1"
            />

            <div className="flex items-center gap-1 shrink-0 pb-1">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showEmojiPicker
                    ? 'bg-[#DCB001]/20 text-[#DCB001]'
                    : 'text-[#787C83] hover:text-white hover:bg-[#222428]'
                }`}
                title="Add emoji"
              >
                <Smile size={16} />
              </button>

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
                className="p-2 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] disabled:bg-[#222428] text-[#0A0B0D] disabled:text-[#585C60] font-bold transition-all shadow-md"
                title="Send message (Enter)"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Right Column: Joined Persons ──────────────────────────── */}
      <aside className="w-64 shrink-0 bg-[#111215] border-l border-[#222428] hidden lg:flex flex-col select-none h-full min-h-0">
        <div className="p-3.5 border-b border-[#222428] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#DCB001]" />
              <h3 className="text-xs font-bold text-white tracking-tight">Joined Persons</h3>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1E2024] text-[#DCB001] border border-[#2B2D33]">
              {members.length}
            </span>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#686C74]" />
            <input
              type="text"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              placeholder="Search joined..."
              className="w-full bg-[#17181C] border border-[#25272C] text-white text-[11px] rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:border-[#DCB001] placeholder-[#585C60]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-[#686C74]">
              No members found
            </div>
          ) : (
            filteredMembers.map((m, idx) => {
              const isOwner = m.role === 'owner';
              const isAdmin = m.role === 'admin';

              return (
                <div
                  key={`member_${m.userId || m.id}_${idx}`}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-[#16171B] border border-[#222428] hover:border-[#2C2E35] transition-colors"
                >
                  <div className="relative shrink-0">
                    <img
                      src={m.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                      alt={m.userName}
                      className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#2E3138]"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-2 border-[#16171B] rounded-full" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate">
                        {m.userName}
                      </span>
                      <span
                        className={`text-[8px] font-mono uppercase font-bold px-1 py-0.1 rounded border ${
                          isOwner
                            ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/30'
                            : isAdmin
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-[#202227] text-[#8E939D] border-[#2D3036]'
                        }`}
                      >
                        {m.role || 'member'}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-[#686C74] truncate">
                      {m.userEmail}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-[#222428] bg-[#0E0F12]/80 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-white">Project Key</span>
            <span className="font-mono text-[#787C83]">Share to join</span>
          </div>
          <div
            onClick={() => {
              if (projectKey) {
                navigator.clipboard.writeText(projectKey);
                toast.success(`Copied Project Key: ${projectKey}`);
              }
            }}
            className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#16171B] border border-[#27292F] hover:border-[#DCB001]/40 text-xs font-mono text-[#DCB001] cursor-pointer transition-colors"
          >
            <span className="truncate">{projectKey || '...'}</span>
            <Copy size={12} className="shrink-0 text-[#8E939D]" />
          </div>
        </div>
      </aside>
    </div>
  );
}
