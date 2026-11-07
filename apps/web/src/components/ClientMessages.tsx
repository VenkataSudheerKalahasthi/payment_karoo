import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  Search,
  RefreshCw,
  User,
  Clock,
  CheckCheck,
  FileText,
  AlertCircle,
  Plus,
  ShieldCheck,
  Paperclip,
  Image as ImageIcon,
  X,
  Phone,
  Video,
  MoreVertical,
  Check,
  Smile,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { apiService } from '../services/api';
import { ContractDto, WorkerProfileDto } from '@trustpay/shared';

interface Participant {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    role?: { name: string };
  };
}

interface MessageItem {
  id: string;
  content: string;
  attachments?: string[];
  senderId: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    role?: { name: string };
  };
}

interface ConversationItem {
  id: string;
  contractId?: string | null;
  updatedAt: string;
  participants: Participant[];
  messages?: MessageItem[];
  contract?: {
    id: string;
    contractNumber: string;
    title: string;
    status: string;
  } | null;
}

interface ClientMessagesProps {
  currentUserId?: string;
  targetRecipientId?: string | null;
  onClearTargetRecipient?: () => void;
}

export const ClientMessages: React.FC<ClientMessagesProps> = ({
  currentUserId,
  targetRecipientId,
  onClearTargetRecipient,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Image attachment state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [specialistsList, setSpecialistsList] = useState<any[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (currentUserId) {
        socket.emit('join:user', currentUserId);
      }
    });

    socket.on('message:new', (newMsg: MessageItem) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Update conversation last message snippet in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === (newMsg as any).conversationId
            ? { ...c, messages: [newMsg], updatedAt: new Date().toISOString() }
            : c
        )
      );
    });

    socket.on('message:received', (data: { conversationId: string; message: MessageItem }) => {
      if (activeConversation?.id === data.conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      fetchConversations(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, activeConversation?.id]);

  // Join active conversation room on socket
  useEffect(() => {
    if (activeConversation && socketRef.current) {
      socketRef.current.emit('join:conversation', activeConversation.id);
    }
    return () => {
      if (activeConversation && socketRef.current) {
        socketRef.current.emit('leave:conversation', activeConversation.id);
      }
    };
  }, [activeConversation?.id]);

  const fetchConversations = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await apiService.listConversations();
      if (res.success && res.data) {
        const convList = res.data as ConversationItem[];
        setConversations(convList);

        // If targetRecipientId was passed from another page (Marketplace, Proposals, etc.)
        if (targetRecipientId) {
          const match = convList.find((c) =>
            c.participants.some((p) => p.userId === targetRecipientId)
          );
          if (match) {
            setActiveConversation(match);
            onClearTargetRecipient?.();
          } else {
            // Automatically initialize direct conversation with target
            initConversationWithUser(targetRecipientId);
          }
        } else if (!activeConversation && convList.length > 0) {
          setActiveConversation(convList[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const initConversationWithUser = async (recipientId: string) => {
    try {
      const res = await apiService.getOrCreateConversation({ recipientId });
      if (res.success && res.data) {
        setShowNewChatModal(false);
        await fetchConversations(false);
        setActiveConversation(res.data as ConversationItem);
        onClearTargetRecipient?.();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to start conversation');
    }
  };

  const fetchSpecialistsForNewChat = async () => {
    try {
      setLoadingSpecialists(true);
      const res = await apiService.listWorkers({ limit: 50 });
      if (res.success && res.data) {
        setSpecialistsList(res.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load specialists for new chat:', err);
    } finally {
      setLoadingSpecialists(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [targetRecipientId]);

  // Fetch messages when active conversation changes
  const fetchMessages = async (convId: string) => {
    try {
      const res = await apiService.getConversationMessages(convId);
      if (res.success && res.data) {
        setMessages((res.data.items as MessageItem[]) || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Image Selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WebP, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      setPreviewImageUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setPreviewImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversation || (!inputText.trim() && !selectedImage) || sending) return;

    const content = inputText.trim();
    const attachments = selectedImage ? [selectedImage] : [];

    setInputText('');
    handleClearImage();
    setSending(true);

    try {
      const res = await apiService.sendMessage(activeConversation.id, content, attachments);
      if (res.success && res.data) {
        // Optimistically add to message thread if socket hasn't arrived yet
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.id)) return prev;
          return [...prev, res.data];
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get recipient (the counterparty)
  const getRecipient = (conv: ConversationItem) => {
    if (!conv.participants || conv.participants.length === 0) return null;
    const other = conv.participants.find((p) => p.userId !== currentUserId) || conv.participants[0];
    return other?.user;
  };

  // Filtered conversations
  const filteredConversations = conversations.filter((c) => {
    const recipient = getRecipient(c);
    const name = `${recipient?.firstName || ''} ${recipient?.lastName || ''}`.toLowerCase();
    const contract = (c.contract?.title || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || contract.includes(q);
  });

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatConversationDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* WhatsApp Container Box */}
      <div className="h-[750px] flex rounded-2xl overflow-hidden border dark:border-[#272B38] border-slate-200 dark:bg-[#0c0d0c] bg-white shadow-xl">
        
        {/* ========================================================================= */}
        {/* LEFT PANEL: WhatsApp Chat List & Search */}
        {/* ========================================================================= */}
        <div className="w-full sm:w-80 md:w-96 flex flex-col border-r dark:border-[#272B38] border-slate-200 dark:bg-[#111311] bg-[#F8FAFC]">
          {/* Header */}
          <div className="p-4 border-b dark:border-[#272B38] border-slate-200 flex items-center justify-between dark:bg-[#191B25] bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center font-bold text-xs dark:text-[#8FB5FF] text-[#5046E5]">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold dark:text-white text-slate-900">Chats</h2>
                <p className="text-[10px] dark:text-zinc-400 text-slate-500 font-mono">
                  {conversations.length} Active Conversations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  fetchSpecialistsForNewChat();
                  setShowNewChatModal(true);
                }}
                className="p-2 rounded-xl dark:bg-[#191D2A] bg-slate-100 hover:dark:bg-[#282a28] hover:bg-slate-200 dark:text-[#8FB5FF] text-[#5046E5] transition"
                title="Start New Chat with Specialist"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchConversations()}
                disabled={loading}
                className="p-2 rounded-xl dark:bg-[#191D2A] bg-slate-100 hover:dark:bg-[#282a28] hover:bg-slate-200 text-slate-500 dark:text-zinc-400 transition"
                title="Refresh Chats"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b dark:border-[#272B38] border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search or start new chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs dark:bg-[#1a1c1a] bg-white border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none dark:focus:border-[#1F61EF]/60 focus:border-[#5046E5]"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y dark:divide-[#1c1f1c] divide-slate-100">
            {loading ? (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 dark:text-[#8FB5FF] text-[#5046E5] animate-spin" />
                <p className="text-xs dark:text-zinc-400 text-slate-500">Loading chats...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs font-semibold dark:text-zinc-300 text-slate-700">No conversations yet</p>
                <p className="text-[11px] dark:text-zinc-500 text-slate-400">
                  Select a specialist in the Marketplace or click (+) to start a chat.
                </p>
                <button
                  onClick={() => {
                    fetchSpecialistsForNewChat();
                    setShowNewChatModal(true);
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const recipient = getRecipient(conv);
                const recipientName = recipient
                  ? [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || 'Specialist'
                  : 'Specialist Counterparty';
                const isSelected = activeConversation?.id === conv.id;
                const lastMsg = conv.messages?.[0];
                const hasAttachment = lastMsg?.attachments && lastMsg.attachments.length > 0;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className={`w-full p-3.5 flex items-start gap-3 transition text-left cursor-pointer ${
                      isSelected
                        ? 'dark:bg-[#1a2e1a] bg-[#EEF2FF] border-l-4 dark:border-[#1F61EF] border-[#5046E5]'
                        : 'dark:hover:bg-[#161816] hover:bg-slate-100'
                    }`}
                  >
                    {/* Avatar with Online Dot */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full dark:bg-[#191D2A] bg-slate-200 flex items-center justify-center font-bold text-xs dark:text-[#8FB5FF] text-[#5046E5] overflow-hidden border dark:border-[#272B38] border-slate-300">
                        {recipient?.avatarUrl ? (
                          <img src={recipient.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          recipientName[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 dark:ring-[#111311] ring-white" />
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold dark:text-white text-slate-900 truncate">
                          {recipientName}
                        </span>
                        <span className="text-[10px] font-mono dark:text-zinc-500 text-slate-400 shrink-0">
                          {formatConversationDate(conv.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <p className="dark:text-zinc-400 text-slate-500 truncate flex items-center gap-1">
                          {lastMsg ? (
                            <>
                              {lastMsg.senderId === currentUserId && (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              )}
                              {hasAttachment && <ImageIcon className="w-3 h-3 text-emerald-400 shrink-0" />}
                              <span>{lastMsg.content || 'Photo'}</span>
                            </>
                          ) : (
                            <span className="italic text-[10px]">No messages yet</span>
                          )}
                        </p>
                      </div>

                      {conv.contract && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded dark:bg-[#191D2A] bg-slate-200/60 dark:text-zinc-300 text-slate-700 w-fit">
                          <FileText className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[150px]">{conv.contract.title}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: WhatsApp Active Conversation Viewport */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col dark:bg-[#0a0b0a] bg-[#ECE5DD]/20 relative">
          {activeConversation ? (
            <>
              {/* WhatsApp Active Header */}
              {(() => {
                const recipient = getRecipient(activeConversation);
                const recipientName = recipient
                  ? [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || 'Specialist'
                  : 'Specialist Counterparty';

                return (
                  <div className="p-3.5 px-5 border-b dark:border-[#272B38] border-slate-200 dark:bg-[#191B25] bg-white flex items-center justify-between z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full dark:bg-[#191D2A] bg-slate-200 flex items-center justify-center font-bold text-xs dark:text-[#8FB5FF] text-[#5046E5] overflow-hidden border dark:border-[#272B38] border-slate-300">
                          {recipient?.avatarUrl ? (
                            <img src={recipient.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            recipientName[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 dark:ring-[#151715] ring-white" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold dark:text-white text-slate-900">{recipientName}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5]">
                            {recipient?.role?.name === 'WORKER' ? 'Specialist' : 'Client'}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online • Direct encrypted link
                        </p>
                      </div>
                    </div>

                    {/* Linked Contract pill if any */}
                    {activeConversation.contract && (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-[#191B25] bg-slate-100 border dark:border-[#272B38] border-slate-200 text-xs">
                        <FileText className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                        <span className="font-semibold dark:text-white text-slate-900 truncate max-w-[200px]">
                          {activeConversation.contract.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400">
                          {activeConversation.contract.status}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Chat Messages Body (WhatsApp Bubbles) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 dark:bg-[#0B0D14] bg-[#E5DDD5]/30">
                {/* Security encryption banner */}
                <div className="flex justify-center my-2">
                  <div className="px-3 py-1 rounded-lg dark:bg-[#191B25]/80 bg-white/80 border dark:border-[#272B38] border-slate-200 text-[10px] dark:text-zinc-400 text-slate-500 flex items-center gap-1.5 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5 dark:text-[#8FB5FF] text-[#5046E5]" />
                    <span>Messages and shared files are protected with cryptographic ledger identity.</span>
                  </div>
                </div>

                {messages.length === 0 ? (
                  <div className="py-16 text-center text-xs dark:text-zinc-500 text-slate-400">
                    No messages in this chat yet. Type a message or send an image below to start chatting!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentUserId;
                    const hasImages = msg.attachments && msg.attachments.length > 0;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-sm ${
                            isMe
                              ? 'dark:bg-[#005c4b] bg-[#5046E5] text-white rounded-tr-none'
                              : 'dark:bg-[#1a1c1a] bg-white dark:text-white text-slate-900 border dark:border-[#272B38] border-slate-200 rounded-tl-none'
                          }`}
                        >
                          {/* Attached Image if present */}
                          {hasImages && (
                            <div className="mb-2 space-y-1.5">
                              {msg.attachments!.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setLightboxImage(imgUrl)}
                                  className="rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition border border-black/10 max-h-72"
                                >
                                  <img
                                    src={imgUrl}
                                    alt="Shared attachment"
                                    className="w-full h-auto object-cover rounded-xl"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Message Text */}
                          {msg.content && (
                            <p className="text-xs whitespace-pre-wrap leading-relaxed break-words font-sans">
                              {msg.content}
                            </p>
                          )}

                          {/* Time & Double Checkmark */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isMe ? 'text-white/80' : 'text-slate-400 dark:text-zinc-400'
                            }`}
                          >
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isMe && <CheckCheck className="w-3.5 h-3.5 text-sky-300" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Image Preview Floating Bar (Before Sending) */}
              {previewImageUrl && (
                <div className="p-3 border-t dark:border-[#272B38] border-slate-200 dark:bg-[#191B25] bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={previewImageUrl}
                      alt="Selected attachment"
                      className="w-14 h-14 object-cover rounded-xl border dark:border-[#1F61EF]/40 border-[#5046E5]"
                    />
                    <div>
                      <p className="text-xs font-bold dark:text-white text-slate-900">Image Attached</p>
                      <p className="text-[10px] dark:text-zinc-400 text-slate-500">
                        Ready to send in this conversation
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearImage}
                    className="p-1.5 rounded-full hover:dark:bg-zinc-800 hover:bg-slate-200 text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* WhatsApp Message Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t dark:border-[#272B38] border-slate-200 dark:bg-[#191B25] bg-white flex items-end gap-2"
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-full hover:dark:bg-[#191D2A] hover:bg-slate-100 text-slate-500 dark:text-zinc-400 transition"
                  title="Attach Photo / Image"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Textarea Input */}
                <div className="flex-1 rounded-2xl dark:bg-[#1a1c1a] bg-slate-100 border dark:border-[#272B38] border-slate-300 focus-within:dark:border-[#1F61EF]/60 focus-within:border-[#5046E5] p-2 px-3 transition">
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message (Press Enter to send)..."
                    className="w-full bg-transparent text-xs dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none max-h-28 overflow-y-auto"
                  />
                </div>

                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedImage) || sending}
                  className="p-2.5 rounded-full dark:bg-[#1F61EF] bg-[#5046E5] hover:opacity-90 dark:text-black text-white font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#5046E5]/25"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* Empty State (WhatsApp Web style) */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full dark:bg-[#1C2740] bg-[#EEF2FF] border dark:border-[#1F61EF]/30 border-[#C7D2FE] flex items-center justify-center">
                <MessageSquare className="w-8 h-8 dark:text-[#8FB5FF] text-[#5046E5]" />
              </div>
              <div className="max-w-md">
                <h3 className="text-lg font-bold dark:text-white text-slate-900">
                  TrustPay Secure Direct Messaging
                </h3>
                <p className="text-xs dark:text-zinc-400 text-slate-500 mt-1">
                  Send real-time messages and share deliverable images with specialists and clients. Select a conversation on the left or click (+) to start a new chat.
                </p>
              </div>
              <button
                onClick={() => {
                  fetchSpecialistsForNewChat();
                  setShowNewChatModal(true);
                }}
                className="px-4 py-2 rounded-xl dark:bg-[#1F61EF] bg-[#5046E5] dark:text-black text-white text-xs font-bold transition"
              >
                Start New Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Lightbox Modal (Click Image to Enlarge) */}
      {/* ========================================================================= */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Enlarged shared image"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* New Chat Modal (Pick any Specialist / Client) */}
      {/* ========================================================================= */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b dark:border-[#272B38] border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 dark:text-[#8FB5FF] text-[#5046E5]" />
                <h3 className="text-sm font-bold dark:text-white text-slate-900">Start New Chat</h3>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search specialist by name or headline..."
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs dark:bg-[#1a1c1a] bg-slate-50 border dark:border-[#272B38] border-slate-300 dark:text-white text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y dark:divide-[#1c1f1c] divide-slate-100 pr-1">
              {loadingSpecialists ? (
                <div className="p-8 text-center text-xs dark:text-zinc-400 text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 dark:text-[#8FB5FF] text-[#5046E5]" />
                  Loading specialists...
                </div>
              ) : specialistsList.length === 0 ? (
                <div className="p-8 text-center text-xs dark:text-zinc-500 text-slate-400">
                  No specialists found.
                </div>
              ) : (
                specialistsList
                  .filter((w) => {
                    const name = `${w.user?.firstName || ''} ${w.user?.lastName || ''}`.toLowerCase();
                    const headline = (w.headline || '').toLowerCase();
                    const q = newChatSearch.toLowerCase();
                    return name.includes(q) || headline.includes(q);
                  })
                  .map((worker) => {
                    const name =
                      [worker.user?.firstName, worker.user?.lastName].filter(Boolean).join(' ') ||
                      worker.user?.email ||
                      'Specialist';

                    return (
                      <button
                        key={worker.userId}
                        onClick={() => initConversationWithUser(worker.userId)}
                        className="w-full p-2.5 flex items-center justify-between hover:dark:bg-[#191B25] hover:bg-slate-50 rounded-xl transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full dark:bg-[#191D2A] bg-slate-200 flex items-center justify-center font-bold text-xs dark:text-[#8FB5FF] text-[#5046E5] overflow-hidden">
                            {worker.user?.avatarUrl ? (
                              <img src={worker.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              name[0]?.toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold dark:text-white text-slate-900">{name}</p>
                            <p className="text-[10px] dark:text-zinc-400 text-slate-500 truncate max-w-[220px]">
                              {worker.headline || 'Verified Specialist'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg dark:bg-[#1C2740] bg-[#EEF2FF] dark:text-[#8FB5FF] text-[#5046E5]">
                          Chat
                        </span>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
