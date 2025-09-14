// src/components/ChatBox.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { Send } from "lucide-react"
type ChatMessage = {
  id?: string;
  leadId: string;
  fromType: 'ADMIN' | 'MEMBER';
  text: string;
  createdAt: string;
};

type Props = {
  leadId: string;
};

const ChatBox: React.FC<Props> = ({ leadId }) => {
  const { token, user } = useAuth();
  const socket = useSocket();

  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Determine which side to align for the current user
  const meType = (user as any)?.subjectType || (user as any)?.type || 'MEMBER';

  const fetchHistory = async () => {
    if (!token || !leadId) return;
    try {
      const res = await api.get<{ success: boolean; messages: ChatMessage[] }>(`/leads/${leadId}/chat`, token);
      setHistory(res.messages || []);
      // scroll to bottom after history load (when open, auto-scroll; if closed, scroll on open)
      if (open) {
        setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }), 0);
      }
    } catch {
      // ignore chat load errors
    }
  };

  useEffect(() => {
    if (!token || !leadId) return;
    fetchHistory();
  }, [token, leadId]); // [attached_file:1]

  // Join this lead's room
  useEffect(() => {
    if (!socket || !leadId) return;
    socket.emit('lead:join', leadId);
  }, [socket, leadId]); // [attached_file:1]

  // Live updates via socket
  useEffect(() => {
    if (!socket) return;
    const onNew = (evt: any) => {
      if (!evt || evt.leadId !== leadId || !evt.message) return;
      setHistory((prev) => [...prev, evt.message]);
      if (open) {
        setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' }), 0);
      }
    };
    socket.on('chat:new', onNew);
    return () => {
      socket.off('chat:new', onNew);
    };
  }, [socket, leadId, open]); // [attached_file:1]

  // Auto-scroll when box is opened or history grows
  useEffect(() => {
    if (open) {
      setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }), 0);
    }
  }, [open, history.length]); // [attached_file:1]

  const canSend = useMemo(() => !!text.trim() && !!token && !!leadId && !sending, [text, token, leadId, sending]); // [attached_file:1]

  const send = async () => {
    const t = text.trim();
    if (!t || !token || !leadId) return;
    setSending(true);
    try {
      const res = await api.post<{ success: boolean; message: ChatMessage }>(`/leads/${leadId}/chat`, { text: t }, token);
      // Optimistically append; dedupe by id if server echoes via socket soon after
      setHistory((prev) => {
        const exists = prev.some((m) => m.id && res.message.id && m.id === res.message.id);
        return exists ? prev : [...prev, res.message];
      });
      setText('');
      setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' }), 0);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-blue-600 text-white shadow-lg w-12 h-12 flex items-center justify-center hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label={open ? 'Close chat' : 'Open chat'}
        title={open ? 'Close chat' : 'Open chat'}
      >
        💬
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-[340px] max-w-[92vw] bg-white border rounded-lg shadow-xl flex flex-col">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="font-medium text-gray-800">Lead Chat</div>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setOpen(false)}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>

          {/* Scrollable messages pane with responsive cap: min(400px, 60vh) */}
          <div
            ref={scrollerRef}
            className="overflow-y-auto p-3 space-y-2 bg-gray-50"
            style={{
              maxHeight: 'min(400px, 60vh)',
              width: '100%',
            }}
          >
            {history.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-6">No messages yet.</div>
            )}

            {history.map((m, i) => {
              const mine = m.fromType === meType;
              const ts = new Date(m.createdAt).toLocaleString();
              return (
                <div key={m.id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  {/* Bubble with hover timestamp via native tooltip */}
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${mine ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border'}`}
                    title={ts}
                  >
                    <div>{m.text}</div>
                    {/* Keep inline timestamp for immediate visibility; can be removed if desired */}
                    <div className={`text-[10px] mt-1 ${mine ? 'text-blue-200' : 'text-gray-500'}`}>
                      {ts}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t flex items-center gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && canSend) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              className={`px-3 py-2 rounded text-white ${canSend ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
              onClick={send}
              disabled={!canSend}
              title={canSend ? 'Send' : 'Type a message to send'}
            >
             <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBox;
