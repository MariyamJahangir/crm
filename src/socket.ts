import { io, Socket } from 'socket.io-client';

export function createSocket(token: string) {
  const socketUrl =
    import.meta.env.VITE_NODE_ENV === 'production'
      ? import.meta.env.VITE_PROD_SOCKET_URL
      : import.meta.env.VITE_DEV_SOCKET_URL;

  const socket: Socket = io(socketUrl || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket'],
  });

  return socket;
}
