'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Hash,
  Users,
  Smile,
  Trash2,
  Copy,
  Search,
  Plus,
  X,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProjectMessage } from '@/lib/db';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';

interface Channel {
  id?: number | string;
  name: string;
  desc?: string;
  description?: string;
}

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

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'general', name: 'general', desc: 'General project discussions and team syncs' },
  { id: 'dev-stream', name: 'dev-stream', desc: 'Autonomous coding agent updates & commits' },
  { id: 'architecture', name: 'architecture', desc: 'System design, schemas & API reviews' },
  { id: 'qa-sync', name: 'qa-sync', desc: 'Bug reports, test results & QA verification' },
];

const EMOJIS = ['🚀', '⚡', '🔥', '✅', '👏', '🎉', '💡', '🤖', '👀', '❤️', '👍', '🙌'];

function formatMessageDate(dateStr?: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectConversationView({
  projectId,
  projectName,
  projectKey,
  currentUser,
}: ProjectConversationViewProps) {
  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isUserAdmin, setIsUserAdmin] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Sidebar Toggles for responsive drawer alignment
  const [showChannelsSidebar, setShowChannelsSidebar] = useState(false);
  const [showMembersSidebar, setShowMembersSidebar] = useState(false);

  // Channel Creation Modal State
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // Channel Delete Confirmation State
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!projectId) return;
    try {
      const url = `/api/conversations?projectId=${projectId}&channel=${encodeURIComponent(activeChannel)}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      if (data.channels && Array.isArray(data.channels) && data.channels.length > 0) {
        setChannels(
          data.channels.map((c: any) => ({
            id: c.id || c.name,
            name: c.name,
            desc: c.description || c.desc || '',
          }))
        );
      }
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.members) {
        setMembers(data.members);
      }
      if (typeof data.isUserAdmin === 'boolean') {
        setIsUserAdmin(data.isUserAdmin);
      } else if (currentUser) {
        const isAdmin =
          currentUser.id === 1 ||
          currentUser.role === 'owner' ||
          currentUser.role === 'admin';
        setIsUserAdmin(isAdmin);
      }
    } catch (err) {
      console.error('Failed to load project conversation:', err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [projectId, activeChannel, currentUser]);

  useEffect(() => {
    fetchMessages(true);
  }, [fetchMessages]);

  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(false);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [projectId, fetchMessages]);

  // Real-time WebSocket dynamic message synchronization
  useRealtimeSubscription({
    projectId,
    onEvent: useCallback((event: RealtimeEvent) => {
      if (event.type === 'MESSAGE_SENT' && event.payload) {
        const msg = event.payload;
        if (msg.channel === activeChannel) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const tempIdx = prev.findIndex(
              (m) =>
                String(m.id).startsWith('temp_') &&
                m.content === msg.content &&
                Number(m.userId) === Number(msg.userId)
            );
            if (tempIdx !== -1) {
              const copy = [...prev];
              copy[tempIdx] = msg;
              return copy;
            }
            return [...prev, msg];
          });
          scrollToBottom();
        }
      } else if (event.type === 'MESSAGE_DELETED' && event.payload?.id) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(event.payload.id)));
      }
    }, [activeChannel]),
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !projectId || isCreatingChannel) return;

    const formattedName = newChannelName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!formattedName) {
      toast.error('Please enter a valid channel name');
      return;
    }

    setIsCreatingChannel(true);
    try {
      const res = await fetch('/api/conversations/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(projectId),
          name: formattedName,
          description: newChannelDesc.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create channel');
      }

      const data = await res.json();
      if (data.channel) {
        setChannels((prev) => [
          ...prev.filter((c) => c.name !== data.channel.name),
          {
            id: data.channel.id,
            name: data.channel.name,
            desc: data.channel.description || '',
          },
        ]);
        setActiveChannel(data.channel.name);
        setIsNewChannelModalOpen(false);
        setNewChannelName('');
        setNewChannelDesc('');
        toast.success(`Created channel #${data.channel.name}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not create channel');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async (chName: string) => {
    if (chName === 'general') {
      toast.error('The default #general channel cannot be deleted');
      return;
    }

    setIsDeletingChannel(true);
    try {
      const res = await fetch(
        `/api/conversations/channels?projectId=${projectId}&name=${encodeURIComponent(chName)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete channel');
      }

      setChannels((prev) => prev.filter((c) => c.name !== chName));
      if (activeChannel === chName) {
        setActiveChannel('general');
      }
      setChannelToDelete(null);
      toast.success(`Deleted channel #${chName}`);
    } catch (err: any) {
      toast.error(err.message || 'Could not delete channel');
    } finally {
      setIsDeletingChannel(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !projectId || isSending) return;

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    const optimisticId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg: ProjectMessage = {
      id: optimisticId,
      projectId: Number(projectId),
      userId: currentUser?.id || 1,
      userName: currentUser?.name || 'You',
      userAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      userRole: isUserAdmin ? 'owner' : 'member',
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
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) {
            return prev.filter((m) => m.id !== optimisticId);
          }
          return prev.map((m) => (m.id === optimisticId ? data.message : m));
        });
      }
    } catch {
      toast.error('Failed to deliver message.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (msgId: number | string) => {
    try {
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msgId)));
      const res = await fetch(`/api/conversations?id=${msgId}&projectId=${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete message');
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

  const activeChannelObj = channels.find((c) => c.name === activeChannel) || channels[0] || { name: activeChannel, desc: '' };
  const filteredMembers = members.filter(
    (m) =>
      m.userName?.toLowerCase().includes(searchMember.toLowerCase()) ||
      m.userEmail?.toLowerCase().includes(searchMember.toLowerCase())
  );

  const handleCopyKey = () => {
    if (!projectKey) return;
    navigator.clipboard.writeText(projectKey);
    setCopiedKey(true);
    toast.success(`Copied Project Key: ${projectKey}`);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="relative flex flex-1 h-full min-h-0 w-full overflow-hidden bg-[#0D0E11] text-[#CFD4DD]">
      {/* ─── Collapsible / Slide-Out Left Channels Sidebar ──────────── */}
      {showChannelsSidebar && (
        <div
          onClick={() => setShowChannelsSidebar(false)}
          className="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`absolute inset-y-0 left-0 z-30 w-64 bg-[#111215] border-r border-[#222428] flex flex-col justify-between select-none shadow-2xl transition-transform duration-200 ease-in-out ${
          showChannelsSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full min-h-0">
          <div className="p-3.5 border-b border-[#222428] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center">
                <Hash size={13} />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">Channels</span>
              <span className="text-[10px] font-mono text-[#787C83]">({channels.length})</span>
            </div>

            <div className="flex items-center gap-1">
              {isUserAdmin && (
                <button
                  onClick={() => setIsNewChannelModalOpen(true)}
                  className="p-1 rounded-md text-[#787C83] hover:text-[#DCB001] hover:bg-[#1E2024] transition-colors cursor-pointer"
                  title="Create Channel (Admin Only)"
                >
                  <Plus size={14} />
                </button>
              )}
              <button
                onClick={() => setShowChannelsSidebar(false)}
                className="p-1 rounded-md text-[#787C83] hover:text-white hover:bg-[#1E2024] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
            {channels.map((ch) => {
              const isActive = activeChannel === ch.name;
              const isDefault = ch.name === 'general';

              return (
                <div key={ch.id || ch.name} className="group relative flex items-center">
                  <button
                    onClick={() => {
                      setActiveChannel(ch.name);
                      setShowChannelsSidebar(false);
                    }}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left truncate cursor-pointer ${
                      isActive
                        ? 'bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 font-bold shadow-sm'
                        : 'text-[#8E939D] hover:text-white hover:bg-[#16171B]'
                    }`}
                    title={ch.desc || ch.name}
                  >
                    <Hash size={13} className={isActive ? 'text-[#DCB001] shrink-0' : 'text-[#585C60] shrink-0'} />
                    <span className="truncate">{ch.name}</span>
                  </button>

                  {isUserAdmin && !isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChannelToDelete(ch.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-[#787C83] hover:text-[#EF4444] hover:bg-[#1F2026] rounded transition-all cursor-pointer"
                      title={`Delete #${ch.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-[#222428] bg-[#0E0F12]/80 flex items-center justify-between text-[11px] text-[#787C83]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px]">Realtime Synced</span>
            </span>
            <span className="font-mono text-[10px]">{members.length} members</span>
          </div>
        </div>
      </aside>

      {/* ─── Collapsible / Slide-Out Right Members Sidebar ─────────── */}
      {showMembersSidebar && (
        <div
          onClick={() => setShowMembersSidebar(false)}
          className="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`absolute inset-y-0 right-0 z-30 w-72 bg-[#111215] border-l border-[#222428] flex flex-col justify-between select-none shadow-2xl transition-transform duration-200 ease-in-out ${
          showMembersSidebar ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-3.5 border-b border-[#222428] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#DCB001]" />
              <h3 className="text-xs font-bold text-white tracking-tight">Joined Members</h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#1E2024] text-[#DCB001] border border-[#2B2D33]">
                {members.length}
              </span>
            </div>
            <button
              onClick={() => setShowMembersSidebar(false)}
              className="p-1 rounded-md text-[#787C83] hover:text-white hover:bg-[#1E2024] transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#686C74]" />
            <input
              type="text"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-[#17181C] border border-[#25272C] text-white text-[11px] rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:border-[#DCB001] placeholder-[#585C60]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
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
                        className={`text-[8px] font-mono uppercase font-bold px-1 py-0.2 rounded border ${
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
          <button
            onClick={handleCopyKey}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#16171B] border border-[#27292F] hover:border-[#DCB001]/40 text-xs font-mono text-[#DCB001] cursor-pointer transition-colors"
          >
            <span className="truncate">{projectKey || '...'}</span>
            {copiedKey ? <Check size={12} className="text-emerald-400 shrink-0" /> : <Copy size={12} className="shrink-0 text-[#8E939D]" />}
          </button>
        </div>
      </aside>

      {/* ─── Center: Main Full-Width Chat Panel ─────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-[#0E0F12]">
        {/* Modern Header Banner */}
        <div className="h-12 px-3 sm:px-4 border-b border-[#222428] bg-[#111215]/90 backdrop-blur flex items-center justify-between shrink-0 gap-2">
          {/* Channel Selector Pill Button */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowChannelsSidebar(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#17181C] hover:bg-[#202227] border border-[#2A2C30] hover:border-[#DCB001]/40 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
              title="View all channels"
            >
              <Hash size={13} className="text-[#DCB001]" />
              <span className="truncate max-w-[120px] sm:max-w-[160px]">{activeChannelObj.name}</span>
              <ChevronDown size={12} className="text-[#787C83]" />
            </button>

            {activeChannelObj.desc && (
              <span className="text-[11px] text-[#787C83] truncate hidden sm:inline" title={activeChannelObj.desc}>
                • {activeChannelObj.desc}
              </span>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {projectKey && (
              <button
                onClick={handleCopyKey}
                className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-[#16171B] border border-[#26282E] hover:border-[#DCB001]/40 text-[10px] font-mono text-[#DCB001] transition-colors cursor-pointer"
                title="Copy project key"
              >
                <span>{projectKey}</span>
                {copiedKey ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} className="text-[#787C83]" />}
              </button>
            )}

            <button
              onClick={() => setShowMembersSidebar(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#17181C] hover:bg-[#202227] border border-[#2A2C30] hover:border-[#DCB001]/40 text-xs font-semibold text-[#CFD4DD] hover:text-white transition-colors cursor-pointer"
              title="View joined members"
            >
              <Users size={13} className="text-[#DCB001]" />
              <span className="font-mono text-[11px]">{members.length}</span>
            </button>
          </div>
        </div>

        {/* Messages Feed Area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-3.5 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-xs font-mono text-[#787C83] space-y-2">
              <Loader2 size={20} className="animate-spin text-[#DCB001]" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12 px-4 select-none">
              <div className="w-12 h-12 rounded-2xl bg-[#17181C] border border-[#26282E] flex items-center justify-center text-[#DCB001] shadow-lg">
                <MessageSquare size={22} />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-sm font-bold text-white">Welcome to #{activeChannelObj.name}!</h3>
                <p className="text-xs text-[#787C83] leading-relaxed">
                  Start the conversation with your team. Anyone in {projectName || 'this project'} can join and send messages.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = Number(msg.userId) === Number(currentUser?.id) || msg.userName === currentUser?.name || msg.userName === 'You';
              const isOwner = msg.userRole === 'owner';
              const isAdmin = msg.userRole === 'admin';
              const canDelete = isMe || isUserAdmin || currentUser?.id === 1;

              // Date separator check
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const currentDateLabel = formatMessageDate(msg.createdAt);
              const prevDateLabel = prevMsg ? formatMessageDate(prevMsg.createdAt) : null;
              const showDateSeparator = currentDateLabel !== prevDateLabel;

              return (
                <React.Fragment key={`msg_frag_${msg.id ?? 'opt'}_${idx}`}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-3 select-none">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#17181C] border border-[#26282E] text-[10px] font-mono text-[#787C83]">
                        {currentDateLabel}
                      </span>
                    </div>
                  )}

                  {/* Message Row with Proper Alignment */}
                  <div
                    className={`flex items-end gap-2 group/msg ${
                      isMe ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Teammate Avatar (Left Side Only) */}
                    {!isMe && (
                      <img
                        src={msg.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                        alt={msg.userName}
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#26282E] shrink-0 mb-0.5"
                      />
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`flex flex-col min-w-0 max-w-[86%] sm:max-w-[78%] ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* Sender Info & Role Badge */}
                      <div className="flex items-center gap-1.5 px-1 mb-1 select-none">
                        <span className="text-[11px] font-bold text-white truncate">
                          {isMe ? 'You' : msg.userName}
                        </span>

                        {isOwner && (
                          <span className="px-1 py-0.1 rounded text-[8px] font-mono font-bold bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30">
                            OWNER
                          </span>
                        )}

                        {isAdmin && (
                          <span className="px-1 py-0.1 rounded text-[8px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            ADMIN
                          </span>
                        )}

                        <span className="text-[9px] font-mono text-[#6A6E75]">
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      {/* Text Bubble */}
                      <div
                        className={`relative px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap shadow-sm transition-all ${
                          isMe
                            ? 'bg-[#DCB001]/15 text-white border border-[#DCB001]/35 rounded-br-xs'
                            : 'bg-[#16171B] text-[#CFD4DD] border border-[#26282E] rounded-bl-xs'
                        }`}
                      >
                        {msg.content}

                        {/* Hover Action Menu */}
                        <div
                          className={`absolute top-1 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-[#111215]/95 border border-[#2A2C30] rounded-lg p-0.5 shadow-md ${
                            isMe ? 'right-full mr-1.5' : 'left-full ml-1.5'
                          }`}
                        >
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              toast.success('Copied message text');
                            }}
                            className="p-1 rounded hover:bg-[#202227] text-[#787C83] hover:text-white transition-colors cursor-pointer"
                            title="Copy text"
                          >
                            <Copy size={11} />
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded hover:bg-[#202227] text-[#787C83] hover:text-[#EF4444] transition-colors cursor-pointer"
                              title={isUserAdmin && !isMe ? 'Delete (Admin)' : 'Delete'}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Current User Avatar (Right Side) */}
                    {isMe && (
                      <img
                        src={msg.userAvatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                        alt="You"
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#DCB001]/40 shrink-0 mb-0.5"
                      />
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Message Input Bar */}
        <div className="p-3 sm:p-3.5 border-t border-[#222428] bg-[#111215]/95 shrink-0 relative">
          {/* Emoji Quick Picker Popup */}
          {showEmojiPicker && (
            <div className="absolute bottom-full right-3 sm:right-4 mb-2 z-40 flex items-center gap-1.5 p-2 bg-[#17181C] border border-[#2A2C30] rounded-xl shadow-2xl select-none animate-in fade-in zoom-in-95 duration-100">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputValue((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                  className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[#24262B] rounded-lg transition-transform hover:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-[#17181C] border border-[#2A2C30] focus-within:border-[#DCB001] rounded-2xl p-2 transition-colors">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${activeChannelObj.name}...`}
              rows={1}
              className="flex-1 bg-transparent text-xs text-white placeholder-[#686C74] focus:outline-none resize-none max-h-28 min-h-[32px] py-1 px-1.5 leading-relaxed"
            />

            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showEmojiPicker
                    ? 'bg-[#DCB001]/20 text-[#DCB001]'
                    : 'text-[#787C83] hover:text-white hover:bg-[#222428]'
                }`}
                title="Insert emoji"
              >
                <Smile size={16} />
              </button>

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
                className="p-2 rounded-xl bg-[#DCB001] hover:bg-[#E5B800] disabled:bg-[#222428] text-[#0A0B0D] disabled:text-[#585C60] font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                title="Send (Enter)"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Admin Modal: Create New Channel ───────────────────────── */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#16171A] border border-[#2A2C30] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center">
                  <Hash size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create New Channel</h3>
                  <p className="text-xs text-[#787C83]">Admins can create channels for team discussions.</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewChannelModalOpen(false)}
                className="p-1 rounded-lg text-[#787C83] hover:text-white hover:bg-[#202226] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CFD4DD]">Channel Name</label>
                <div className="flex items-center gap-1.5 bg-[#101113] border border-[#2A2C30] focus-within:border-[#DCB001] rounded-xl px-3 py-2">
                  <span className="text-xs font-mono text-[#787C83]">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. backend-api, release-v2"
                    className="w-full bg-transparent text-xs text-white placeholder-[#585C60] outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CFD4DD]">Description (Optional)</label>
                <textarea
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  rows={2}
                  className="w-full bg-[#101113] border border-[#2A2C30] focus:border-[#DCB001] rounded-xl p-2.5 text-xs text-white placeholder-[#585C60] outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChannelModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#787C83] hover:text-white hover:bg-[#202226] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || isCreatingChannel}
                  className="flex items-center gap-2 px-4 py-2 bg-[#DCB001] hover:bg-[#c49c00] disabled:bg-[#2A2C30] text-[#0F1011] disabled:text-[#585C60] rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {isCreatingChannel ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Channel</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Admin Modal: Delete Channel Confirmation ──────────────── */}
      {channelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-[#16171A] border border-[#EF4444]/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Channel #{channelToDelete}?</h3>
                <p className="text-xs text-[#787C83]">All messages in this channel will be permanently removed.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#787C83] hover:text-white hover:bg-[#202226] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingChannel}
                onClick={() => handleDeleteChannel(channelToDelete)}
                className="flex items-center gap-2 px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {isDeletingChannel ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Channel</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
