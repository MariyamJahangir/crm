import { io, Socket } from 'socket.io-client';

export function createSocket(token: string) {
  const socket: Socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api','') || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}
