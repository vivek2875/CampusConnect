import { io } from 'socket.io-client';

let socket;

export function getChatSocket(accessToken) {
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    path: '/socket.io',
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = undefined;
}
