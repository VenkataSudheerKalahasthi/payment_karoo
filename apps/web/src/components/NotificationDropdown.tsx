import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCircle,
  FileText,
  Scale,
  Send,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import { apiService } from '../services/api';
import { NotificationDto } from '@trustpay/shared';
import { io, Socket } from 'socket.io-client';

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiService.listNotifications();
      if (res.success && res.data) {
        setNotifications(res.data.items);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Background fetch silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const socketServerUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
    let socket: Socket | null = null;
    try {
      socket = io(socketServerUrl, {
        transports: ['websocket', 'polling'],
      });
      socket.on('notification:new', (notif: NotificationDto) => {
        setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
        setUnreadCount((c) => c + 1);
      });
    } catch {
      // Fallback to polling
    }

    return () => {
      socket?.disconnect();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiService.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Failed to mark read
    }
  };

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      await apiService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('DISPUTE')) {
      return <Scale className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (type.includes('REVISION')) {
      return <RotateCcw className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (type.includes('APPROVED') || type.includes('ACCEPTED') || type.includes('SETTLED')) {
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (type.includes('HIRING') || type.includes('PROPOSAL')) {
      return <Send className="w-3.5 h-3.5 text-[#5046E5] dark:text-[#CDCBCA]" />;
    }
    if (type.includes('CONTRACT') || type.includes('AMENDMENT')) {
      return <FileText className="w-3.5 h-3.5 text-[#5046E5] dark:text-[#CDCBCA]" />;
    }
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl dark:bg-[#171717] bg-white hover:dark:bg-[#202020] hover:bg-[#F1F5F9] dark:text-[#CDCBCA] text-[#242424] border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] transition flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-[#5046E5] shadow-sm"
        title="Notifications"
        aria-label="Toggle notifications dropdown"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-mono font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl dark:bg-[#171717] bg-white border dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] shadow-2xl z-50 overflow-hidden text-xs dark:text-[#CDCBCA] text-[#242424] font-sans">
          {/* Header */}
          <div className="p-3.5 border-b dark:border-[rgba(205,203,202,0.18)] border-[#E2E8F0] flex items-center justify-between dark:bg-[#202020] bg-[#F1F5F9]">
            <div className="flex items-center space-x-2">
              <span className="font-bold dark:text-[#CDCBCA] text-[#242424] text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isLoading}
                  className="text-[11px] dark:text-[#A5A5A5] text-[#64748B] hover:text-[#5046E5] dark:hover:text-white transition font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="dark:text-[#777777] text-[#64748B] hover:dark:text-[#CDCBCA] hover:text-[#242424] p-1 rounded-lg hover:dark:bg-[#303030] hover:bg-[#E2E8F0] transition"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y dark:divide-[rgba(205,203,202,0.1)] divide-[#E2E8F0]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center dark:text-[#777777] text-[#64748B] italic">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => !n.isRead && handleMarkAsRead(n.id, e)}
                  className={`p-3.5 transition cursor-pointer flex items-start space-x-3 ${
                    n.isRead
                      ? 'dark:bg-[#171717] bg-white hover:dark:bg-[#202020] hover:bg-[#F8FAFC]'
                      : 'dark:bg-[#202020]/70 bg-[#EEF2FF] hover:dark:bg-[#202020] hover:bg-[#C7D2FE]/60'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(n.type)}</div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${n.isRead ? 'dark:text-[#A5A5A5] text-[#475569]' : 'dark:text-[#CDCBCA] text-[#242424]'}`}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#5046E5] shrink-0 ml-1.5" />
                      )}
                    </div>
                    <p className="dark:text-[#A5A5A5] text-[#64748B] text-[11px] leading-relaxed">{n.message}</p>
                    <span className="text-[10px] dark:text-[#777777] text-[#64748B] font-mono tabular-nums block pt-0.5">
                      {new Date(n.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      title="Mark as read"
                      className="p-1 rounded-md dark:text-[#777777] text-[#64748B] hover:text-[#5046E5] dark:hover:text-[#CDCBCA] transition shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
