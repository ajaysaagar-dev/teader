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
import { Avatar } from '@/components/ui/Avatar';
import { resolveUserAvatar } from '@/lib/avatar';

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

  // Sidebar Toggles for member sidebar
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
      userAvatar: resolveUserAvatar(currentUser),
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
    <div className="relative flex flex-1 h-full min-h-0 w-full overflow-hidden bg-[#0F0F0F] text-[var(--text-secondary)]">
      {/* ─── Left Channels Sidebar (Always Shown) ──────────── */}
      <aside
        className="w-56 sm:w-64 shrink-0 bg-[#141414] border-r border-[#141414] flex flex-col justify-between select-none h-full min-h-0"
      >
        <div className="flex flex-col h-full min-h-0">
          <div className="p-3.5 border-b border-[#141414] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-white/15 text-white flex items-center justify-center">
                <Hash size={13} />
              </div>
              <span className="text-xs font-bold text-white tracking-tight">Channels</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">({channels.length})</span>
            </div>

            {isUserAdmin && (
              <button
                onClick={() => setIsNewChannelModalOpen(true)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
                title="Create Channel (Admin Only)"
              >
                <Plus size={14} />
              </button>
            )}
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
                    }}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left truncate cursor-pointer ${
                      isActive
                        ? 'bg-white/15 text-white border border-[var(--border-secondary)] font-bold shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-[#181818]'
                    }`}
                    title={ch.desc || ch.name}
                  >
                    <Hash size={13} className={isActive ? 'text-white shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                    <span className="truncate">{ch.name}</span>
                  </button>

                  {isUserAdmin && !isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChannelToDelete(ch.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-[var(--text-muted)] hover:text-white hover:bg-[#222222] rounded transition-all cursor-pointer"
                      title={`Delete #${ch.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-[#141414] bg-[#000000]/80 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white text-black animate-pulse" />
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
        className={`absolute inset-y-0 right-0 z-30 w-72 bg-[#141414] border-l border-[#141414] flex flex-col justify-between select-none shadow-2xl transition-transform duration-200 ease-in-out ${
          showMembersSidebar ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-3.5 border-b border-[#141414] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-white" />
              <h3 className="text-xs font-bold text-white tracking-tight">Joined Members</h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--bg-card)] text-white border border-[#2E2E2E]">
                {members.length}
              </span>
            </div>
            <button
              onClick={() => setShowMembersSidebar(false)}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6D6D6D]" />
            <input
              type="text"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-[#191919] border border-[#282828] text-white text-[11px] rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:border-[var(--border-secondary)] placeholder-[#666666]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-[#6D6D6D]">
              No members found
            </div>
          ) : (
            filteredMembers.map((m, idx) => {
              const isOwner = m.role === 'owner';
              const isAdmin = m.role === 'admin';

              return (
                <div
                  key={`member_${m.userId || m.id}_${idx}`}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-[#181818] border border-[#141414] hover:border-[#303030] transition-colors"
                >
                  <div className="relative shrink-0">
                    <Avatar
                      user={{ id: m.userId, name: m.userName, email: m.userEmail, avatar: m.userAvatar }}
                      size="sm"
                      className="rounded-lg"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-white text-black border-2 border-[#181818] rounded-full" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate">
                        {m.userName}
                      </span>
                      <span
                        className={`text-[8px] font-mono uppercase font-bold px-1 py-0.2 rounded border ${
                          isOwner
                            ? 'bg-white/15 text-white border-[var(--border-secondary)]'
                            : isAdmin
                            ? 'bg-[var(--ramp-2)] text-white border-[var(--border-secondary)]'
                            : 'bg-[#232323] text-[var(--text-secondary)] border-[#313131]'
                        }`}
                      >
                        {m.role || 'member'}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-[#6D6D6D] truncate">
                      {m.userEmail}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </aside>

      {/* ─── Center: Main Full-Width Chat Panel ─────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-[#000000]">
        {/* Modern Header Banner */}
        <div className="h-12 px-3 sm:px-4 border-b border-[#141414] bg-[#141414]/90 backdrop-blur flex items-center justify-between shrink-0 gap-2">
          {/* Active Channel Display */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-1 text-white font-bold text-xs shrink-0">
              <Hash size={14} className="text-white" />
              <span className="truncate max-w-[140px] sm:max-w-[220px]">{activeChannelObj.name}</span>
            </div>

            {activeChannelObj.desc && (
              <span className="text-[11px] text-[var(--text-muted)] truncate hidden sm:inline" title={activeChannelObj.desc}>
                • {activeChannelObj.desc}
              </span>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowMembersSidebar(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#191919] hover:bg-[#232323] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
              title="View joined members"
            >
              <Users size={13} className="text-white" />
              <span className="font-mono text-[11px]">{members.length}</span>
            </button>
          </div>
        </div>

        {/* Messages Feed Area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-3.5 custom-scrollbar bg-[#1e1e1e]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-xs font-mono text-[var(--text-muted)] space-y-2">
              <Loader2 size={20} className="animate-spin text-white" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12 px-4 select-none">
              <div className="w-12 h-12 rounded-2xl bg-[#191919] border border-[#292929] flex items-center justify-center text-white shadow-lg">
                <MessageSquare size={22} />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-sm font-bold text-white">Welcome to #{activeChannelObj.name}!</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
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
                      <span className="px-2.5 py-0.5 rounded-full bg-[#191919] border border-[#292929] text-[10px] font-mono text-[var(--text-muted)]">
                        {currentDateLabel}
                      </span>
                    </div>
                  )}

                  {/* Message Row - All Left Aligned */}
                  <div className="flex items-start gap-2.5 group/msg justify-start">
                    {/* Author Avatar (Always on Left) */}
                    <Avatar
                      user={{
                        id: msg.userId || (isMe ? currentUser?.id : undefined),
                        name: isMe ? (currentUser?.name || msg.userName) : msg.userName,
                        avatar: isMe ? (msg.userAvatar || currentUser?.avatar) : msg.userAvatar,
                      }}
                      size="sm"
                      className={`rounded-lg mt-0.5 shrink-0 ${isMe ? 'ring-1 ring-[#FFFFFF]/40' : ''}`}
                    />

                    {/* Message Bubble Container */}
                    <div className="flex flex-col min-w-0 max-w-[88%] sm:max-w-[80%] items-start">
                      {/* Sender Info & Role Badge */}
                      <div className="flex items-center gap-1.5 px-1 mb-1 select-none">
                        <span className={`text-[11px] font-bold truncate ${isMe ? 'text-white' : 'text-white'}`}>
                          {isMe ? `${currentUser?.name || msg.userName} (You)` : msg.userName}
                        </span>

                        {isOwner && (
                          <span className="px-1 py-0.1 rounded text-[8px] font-mono font-bold bg-white/15 text-white border border-[var(--border-secondary)]">
                            OWNER
                          </span>
                        )}

                        {isAdmin && (
                          <span className="px-1 py-0.1 rounded text-[8px] font-mono font-bold bg-[var(--ramp-2)] text-white border border-[var(--border-secondary)]">
                            ADMIN
                          </span>
                        )}

                        <span className="text-[9px] font-mono text-[#6F6F6F]">
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
                            ? 'bg-white/10 text-white border border-[var(--border-secondary)] rounded-tl-xs'
                            : 'bg-[#181818] text-[var(--text-secondary)] border border-[#292929] rounded-tl-xs'
                        }`}
                      >
                        {msg.content}

                        {/* Hover Action Menu */}
                        <div
                          className="absolute top-1 left-full ml-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-[#141414]/95 border border-[var(--border-primary)] rounded-lg p-0.5 shadow-md z-10"
                        >
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              toast.success('Copied message text');
                            }}
                            className="p-1 rounded hover:bg-[#232323] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
                            title="Copy text"
                          >
                            <Copy size={11} />
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded hover:bg-[#232323] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
                              title={isUserAdmin && !isMe ? 'Delete (Admin)' : 'Delete'}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Message Input Bar */}
        <div className="p-3 sm:p-3.5 border-t border-[#141414] bg-[#141414]/95 shrink-0 relative">
          {/* Emoji Quick Picker Popup */}
          {showEmojiPicker && (
            <div className="absolute bottom-full right-3 sm:right-4 mb-2 z-40 flex items-center gap-1.5 p-2 bg-[#191919] border border-[var(--border-primary)] rounded-xl shadow-2xl select-none animate-in fade-in zoom-in-95 duration-100">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputValue((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                  className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[#272727] rounded-lg transition-transform hover:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-[#191919] border border-[var(--border-primary)] focus-within:border-[var(--border-secondary)] rounded-2xl p-2 transition-colors">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${activeChannelObj.name}...`}
              rows={1}
              className="flex-1 bg-transparent text-xs text-white placeholder-[#6D6D6D] focus:outline-none resize-none max-h-28 min-h-[32px] py-1 px-1.5 leading-relaxed"
            />

            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showEmojiPicker
                    ? 'bg-white/20 text-white'
                    : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-card)]'
                }`}
                title="Insert emoji"
              >
                <Smile size={16} />
              </button>

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
                className="p-2 rounded-xl bg-white text-black hover:bg-[#FFFFFF] disabled:bg-[var(--bg-card)] disabled:text-[var(--text-muted)] font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
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
          <div className="w-full max-w-md bg-[#141414] border border-[var(--border-primary)] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center">
                  <Hash size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create New Channel</h3>
                  <p className="text-xs text-[var(--text-muted)]">Admins can create channels for team discussions.</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewChannelModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[#141414] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Channel Name</label>
                <div className="flex items-center gap-1.5 bg-[#111111] border border-[var(--border-primary)] focus-within:border-[var(--border-secondary)] rounded-xl px-3 py-2">
                  <span className="text-xs font-mono text-[var(--text-muted)]">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. backend-api, release-v2"
                    className="w-full bg-transparent text-xs text-white placeholder-[#666666] outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Description (Optional)</label>
                <textarea
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  rows={2}
                  className="w-full bg-[#111111] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-xl p-2.5 text-xs text-white placeholder-[#666666] outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChannelModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-white hover:bg-[#141414] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || isCreatingChannel}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-[#FFFFFF] disabled:bg-[#222222] disabled:text-[var(--text-muted)] rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
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
          <div className="w-full max-w-sm bg-[#141414] border border-[var(--border-secondary)] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--ramp-3)]/15 border border-[var(--border-secondary)] flex items-center justify-center text-white shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Channel #{channelToDelete}?</h3>
                <p className="text-xs text-[var(--text-muted)]">All messages in this channel will be permanently removed.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-white hover:bg-[#141414] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingChannel}
                onClick={() => handleDeleteChannel(channelToDelete)}
                className="flex items-center gap-2 px-4 py-2 bg-[#242424] hover:bg-[#2E2E2E] text-white border border-[var(--border-secondary)] rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
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
