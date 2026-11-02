import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSuperadminSocket(): Socket | null {
  return socket;
}

export function initSuperadminSocket(token: string): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    // Superadmin socket connected
  });

  socket.on('connect_error', (_err) => {
    // Handled in dev
  });

  return socket;
}

export function disconnectSuperadminSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

