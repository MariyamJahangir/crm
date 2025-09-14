// // useSocket.ts
// import { useEffect, useRef } from 'react';
// import { io, Socket } from 'socket.io-client';
// import { useAuth } from '../contexts/AuthContext';

// export function useSocket() {
//   const { token } = useAuth();
//   const sock = useRef<Socket | null>(null);

//   useEffect(() => {
//     if (!token) return;
// const url =
//    import.meta.env.VITE_NODE_ENV == 'development'
//     ? import.meta.env.VITE_DEV_API_BASE
//     : import.meta.env.VITE_PROD_API_BASE;



//     const s = io(url, {
//       path: '/socket.io',
//       transports: ['websocket', 'polling'],
//       auth: { token },
//       withCredentials: true,
//       // optional: extend timeouts for slow environments
//       timeout: 20000,
//     });

//     s.on('connect', () => {
//       console.log('socket connected via', s.io.engine.transport.name);
//       s.io.engine.on('upgrade', () => {
//         console.log('socket upgraded to', s.io.engine.transport.name);
//       });
//     });

//     s.on('connect_error', (err: any) => {
//       console.log('connect_error', err?.message ?? err, err?.description ?? '', err?.context ?? '');
//     });

//     sock.current = s;
//     return () => { s.disconnect(); sock.current = null; };
//   }, [token]);

//   return sock.current;
// }
// useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export function useSocket() {
  const { token } = useAuth();
  const sock = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const apiBase =
      import.meta.env.VITE_NODE_ENV == 'development'
        ? import.meta.env.VITE_DEV_API_BASE
        : import.meta.env.VITE_PROD_API_BASE;

    // Important: Socket server is on the origin, not under /api
    // Example: http://localhost:5000 or https://api.example.com
    const origin = apiBase.replace(/\/api\/?$/, '');

    const s = io(origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      withCredentials: true,
      timeout: 20000,
    });

    s.on('connect', () => {
      console.log('socket connected via', s.io.engine.transport.name);
      s.io.engine.on('upgrade', () => {
        console.log('socket upgraded to', s.io.engine.transport.name);
      });
    });

    s.on('connect_error', (err: any) => {
      console.log('connect_error', err?.message ?? err, err?.description ?? '', err?.context ?? '');
    });

    sock.current = s;
    return () => { s.disconnect(); sock.current = null; };
  }, [token]);

  return sock.current;
}
