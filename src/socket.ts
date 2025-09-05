import { io, Socket } from 'socket.io-client';

export function createSocket(token: string) {
  const socketUrl =
      import.meta.env.VITE_NODE_ENV == 'development'
    ? import.meta.env.VITE_DEV_API_BASE
    : import.meta.env.VITE_PROD_API_BASE;

  const socket: Socket = io(socketUrl || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket'],
  });

  return socket;
}
