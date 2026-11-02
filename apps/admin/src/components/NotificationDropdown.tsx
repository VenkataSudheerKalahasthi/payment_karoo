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
import { getAdminSocket } from '../services/socket';

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
      // Silent polling fallback
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Poll every 20s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time Socket.IO notification listener
  useEffect(() => {
    const sock = getAdminSocket();
    if (!sock) return;

    const handleNewNotif = (notif: NotificationDto) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
      setUnreadCount((c) => c + 1);
    };

    sock.on('notification:new', handleNewNotif);
    return () => {
      sock.off('notification:new', handleNewNotif);
    };
  }, []);

  // Click outside listener
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
      return <Scale className="w-3.5 h-3.5 text-rose-400" />;
    }
    if (type.includes('REVISION')) {
      return <RotateCcw className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (type.includes('APPROVED') || type.includes('ACCEPTED')) {
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (type.includes('HIRING') || type.includes('PROPOSAL')) {
      return <Send className="w-3.5 h-3.5 text-purple-400" />;
    }
    if (type.includes('CONTRACT') || type.includes('AMENDMENT')) {
      return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    }
    return <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden text-xs text-slate-200">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-sm">Admin Alerts</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isLoading}
                  className="text-[11px] text-slate-400 hover:text-blue-400 transition"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic">
                No administrative alerts right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => !n.isRead && handleMarkAsRead(n.id, e)}
                  className={`p-3 transition cursor-pointer flex items-start space-x-2.5 ${
                    n.isRead ? 'bg-slate-900/40 hover:bg-slate-850' : 'bg-slate-800/40 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(n.type)}</div>

                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${n.isRead ? 'text-slate-300' : 'text-white'}`}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 font-mono block pt-0.5">
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
                      className="p-1 rounded text-slate-500 hover:text-blue-400 transition shrink-0"
                    >
                      <Check className="w-3 h-3" />
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

