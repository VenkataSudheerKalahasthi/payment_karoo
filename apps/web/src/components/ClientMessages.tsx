import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { apiService } from '../services/api';
import { ContractDto } from '@trustpay/shared';

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

export const ClientMessages: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await apiService.listConversations();
      if (res.success && res.data) {
        setConversations(res.data as ConversationItem[]);
        if (!activeConversation && res.data.length > 0) {
          setActiveConversation(res.data[0] as ConversationItem);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const res = await apiService.listContracts();
      if (res.success && res.data) {
        setContracts(res.data);
      }
    } catch (err) {
      console.error('Error fetching contracts for chat:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchContracts();
  }, []);

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
      const timer = setInterval(() => {
        fetchMessages(activeConversation.id);
      }, 5000); // Polling for live chat updates
      return () => clearInterval(timer);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !inputText.trim() || sending) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await apiService.sendMessage(activeConversation.id, content);
      if (res.success) {
        await fetchMessages(activeConversation.id);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleStartConversationForContract = async (contract: ContractDto) => {
    try {
      const res = await apiService.getOrCreateConversation({
        contractId: contract.id,
        recipientId: contract.workerId,
      });

      if (res.success && res.data) {
        setShowNewChatModal(false);
        await fetchConversations();
        setActiveConversation(res.data as ConversationItem);
      }
    } catch (err: any) {
      alert(err?.message || 'Error starting chat');
    }
  };

  // Find other participant
  const getOtherParticipant = (conv: ConversationItem) => {
    // Return first participant that has user details
    const other = conv.participants?.find((p) => p.user?.role?.name === 'WORKER') || conv.participants?.[0];
    return other?.user;
  };

  // Filtered conversations
  const filteredConversations = conversations.filter((c) => {
    const other = getOtherParticipant(c);
    const name = `${other?.firstName || ''} ${other?.lastName || ''}`.toLowerCase();
    const contract = (c.contract?.title || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || contract.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#121412] dark:bg-[#121412] border border-[#262926] p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#8BFF24]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Direct Project Messages</h1>
            <p className="text-sm text-zinc-400">
              End-to-end encrypted messaging with verified contract specialists.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition shadow-[0_0_12px_rgba(139,255,36,0.2)]"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button
            onClick={fetchConversations}
            disabled={loading}
            className="p-2 rounded-xl bg-[#1e201e] border border-[#2e322e] text-zinc-300 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Chat Layout: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[650px] bg-[#121412] border border-[#262926] rounded-2xl overflow-hidden">
        {/* Left Column: Conversation List */}
        <div className="md:col-span-4 border-r border-[#262926] flex flex-col h-full bg-[#101210]">
          {/* Search Bar */}
          <div className="p-3.5 border-b border-[#262926]">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#181a18] border border-[#2e322e] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
              />
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#202220]">
            {loading ? (
              <div className="p-8 text-center text-zinc-500 text-xs flex flex-col items-center">
                <RefreshCw className="w-5 h-5 text-[#8BFF24] animate-spin mb-2" />
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No active conversations found.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const isActive = activeConversation?.id === conv.id;
                const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className={`w-full text-left p-3.5 transition flex items-start gap-3 ${
                      isActive ? 'bg-[#181a18] border-l-2 border-[#8BFF24]' : 'hover:bg-[#141614]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs flex-shrink-0">
                      {other?.firstName ? other.firstName[0] : 'S'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-xs text-white truncate">
                          {other?.firstName ? `${other.firstName} ${other.lastName || ''}` : 'Specialist'}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {conv.contract && (
                        <p className="text-[11px] text-[#8BFF24] truncate flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          {conv.contract.title}
                        </p>
                      )}

                      <p className="text-xs text-zinc-400 truncate mt-1">
                        {lastMsg ? lastMsg.content : 'No messages yet. Say hello!'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Window */}
        <div className="md:col-span-8 flex flex-col h-full bg-[#121412]">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#262926] bg-[#101210] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center text-[#8BFF24] font-bold text-sm">
                    {getOtherParticipant(activeConversation)?.firstName ? getOtherParticipant(activeConversation)!.firstName![0] : 'S'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {getOtherParticipant(activeConversation)?.firstName
                        ? `${getOtherParticipant(activeConversation)!.firstName} ${getOtherParticipant(activeConversation)!.lastName || ''}`
                        : 'Specialist'}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Online
                      </span>
                    </h3>
                    {activeConversation.contract && (
                      <p className="text-xs text-zinc-400">
                        Contract: {activeConversation.contract.title} ({activeConversation.contract.contractNumber})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-[#8BFF24]" />
                  <span>Escrow Safe Chat</span>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs">
                    <MessageSquare className="w-8 h-8 text-zinc-600 mb-2" />
                    <p>No messages in this conversation yet.</p>
                    <p className="text-zinc-600">Send a message below to start communicating.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const otherUser = getOtherParticipant(activeConversation);
                    const isMe = m.senderId !== otherUser?.id;
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                            isMe
                              ? 'bg-[#8BFF24] text-black font-medium shadow-[0_0_12px_rgba(139,255,36,0.15)] rounded-br-none'
                              : 'bg-[#181a18] text-white border border-[#2e322e] rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#262926] bg-[#101210] flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message... (Press Enter to send)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-[#181a18] border border-[#2e322e] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#8BFF24]/60"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="px-4 py-2.5 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs">
              <MessageSquare className="w-10 h-10 text-zinc-600 mb-3" />
              <p>Select a conversation from the left to start chatting.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal: Choose Contract / Specialist */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121412] border border-[#262926] w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Start New Conversation</h3>
            <p className="text-xs text-zinc-400">Select an active contract to message your assigned specialist:</p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contracts.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-3">No active contracts found.</p>
              ) : (
                contracts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleStartConversationForContract(c)}
                    className="w-full text-left p-3 rounded-xl bg-[#181a18] hover:bg-[#202220] border border-[#262926] transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{c.title}</p>
                      <span className="text-[11px] text-zinc-500 font-mono">{c.contractNumber}</span>
                    </div>
                    <span className="text-[11px] text-[#8BFF24] font-semibold">Start Chat →</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
