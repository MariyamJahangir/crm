import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import { useSocket } from '../hooks/useSocket';
import { api } from '../services/api';
import FollowupModal from '../components/FollowupModal';
import { quotesService, Quote } from '../services/quotesService';
import PreviewModal from '../components/PreviewModal';
import ChatBox from '../components/ChatBox';

type Followup = {
  id: string;
  status: 'Followup' | 'Meeting Scheduled' | 'No Requirement' | 'No Response';
  description?: string;
  scheduledAt?: string;
  createdAt?: string;
};

const QuotePicker: React.FC<{
  leadId: string;
  currentMain?: string | null;
  onMainChange: (quoteNumber: string | null) => void;
}> = ({ leadId, currentMain, onMainChange }) => {
  const { token } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ open: boolean; html?: string; quote?: Quote; downloading?: boolean }>({ open: false });

  useEffect(() => {
    if (!token || !leadId) return;
    (async () => {
      try {
        const res = await quotesService.listByLead(leadId, token);
                console.log('--- Quotes Loaded from Server ---', res.quotes);

        setQuotes(res.quotes);
      } catch (e: any) {
        setErr(e?.data?.message || 'Failed to load quotes');
      }
    })();
  }, [leadId, token]);

  const openPreview = async (q: Quote) => {
    try {
      const html = await quotesService.previewHtml(q.leadId, q.id, token);
      setPreview({ open: true, html, quote: q, downloading: false });
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to build preview');
    }
  };

  const download = async (q: Quote) => {
    try {
      const blob = await quotesService.downloadPdf(q.leadId, q.id, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${q.quoteNumber}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1200);
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to download PDF');
    }
  };

  const downloadFromPreview = async () => {
    if (!preview.quote) return;
    try {
      setPreview(prev => ({ ...prev, downloading: true }));
      const blob = await quotesService.downloadPdf(preview.quote.leadId, preview.quote.id, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${preview.quote.quoteNumber}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1200);
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to download PDF');
    } finally {
      setPreview(prev => ({ ...prev, downloading: false }));
    }
  };


const selectMain = async (q: Quote) => {
  const originalMainNumber = currentMain;
  onMainChange(q.quoteNumber); // Optimistic UI update
  setBusy(q.id);

  try {
    // This correctly sends the string "Q-2025-..." to the backend
    await quotesService.setMainQuote(leadId, q.quoteNumber, token);
    
    // The backend will now find the quote and update the lead successfully.

  } catch (e: any) {
    setErr(e?.data?.message || 'Failed to set main quote');
    onMainChange(originalMainNumber || null); // Revert on failure
  } finally {
    setBusy(null);
  }
};

  if (err) return <div className="text-red-600">{err}</div>;
  if (!quotes.length) return <div className="text-sm text-gray-600">No quotes yet.</div>;


  return (
     <>
      <div className="flex flex-wrap gap-3">
        {quotes.map((q) => {
          const isMain = currentMain === q.quoteNumber;
          return (
            <div key={q.id} className="flex items-center gap-2 border rounded-full px-3 py-1 bg-white">
              <button
                type="button"
                onClick={() => openPreview(q)}
                className="inline-flex items-center gap-2 text-sm text-gray-800 hover:text-gray-900"
                title="Preview quote"
              >
                <span aria-hidden>📄</span>
                <span className="font-medium">{q.quoteNumber}</span>
              </button>



              <button
                type="button"
                onClick={() => download(q)}
                className="text-gray-600 hover:text-gray-800"
                title="Download PDF"
                aria-label="Download"
              >
                ⬇️
              </button>



              <label className="inline-flex items-center gap-1 text-xs text-gray-600 ml-2">
                <input
                  type="radio"
                  name="main-quote"
                  checked={isMain}
                  onChange={() => selectMain(q)}
                  disabled={busy === q.id}
                  className="h-4 w-4 text-blue-600 border-gray-300"
                  aria-label={isMain ? 'Selected as main quote' : 'Select as main quote'}
                />
                <span>{isMain ? 'Main' : 'Set main'}</span>
              </label>
            </div>
          );
        })}
      </div>



      <PreviewModal
        open={preview.open}
        onClose={() => setPreview({ open: false })}
        html={preview.html}
        onDownload={downloadFromPreview}
        downloading={preview.downloading}
        title={preview.quote ? `Quote ${preview.quote.quoteNumber}` : 'Quote Preview'}
      />
    </>
  );
};

const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading } = useAuth();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);


  const socket = useSocket();


  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);


  const [openFollowup, setOpenFollowup] = useState(false);


  const API_BASE =
    import.meta.env.VITE_NODE_ENV == 'development'
      ? import.meta.env.VITE_DEV_API_BASE
      : import.meta.env.VITE_PROD_API_BASE;
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
  const toFileHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url}`);

  const formatAction = (a: string) => {
    switch (a) {
      case 'LEAD_CREATED': return 'created the lead';
      case 'LEAD_UPDATED': return 'updated the lead';
      case 'ATTACHMENT_ADDED': return 'added attachments';
      case 'ATTACHMENT_DELETED': return 'deleted an attachment';
      case 'FOLLOWUP_ADDED': return 'added a followup';
      case 'QUOTE_CREATED': return 'created a quote';
      default: return a.toLowerCase().replace(/_/g, ' ');
    }
  };

  const loadLead = async () => {
    if (!id || !token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await leadsService.getOne(id, token);
      setLead(res.lead);
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  const loadFollowups = async () => {
    if (!id || !token) return;
    try {
      const res = await api.get<{ success: boolean; followups: Followup[] }>(`/followups/${id}`, token);
      setLead(prev => prev ? ({ ...prev, followups: res.followups as any }) : prev);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!id || !token) return;
    loadLead();
    loadFollowups();
  }, [id, token]);

  useEffect(() => {
    if (!id || !token) return;
    socket?.emit('lead:join', id);
    (async () => {
      try {
        const res = await api.get<{ success: boolean; messages: any[] }>(`/leads/${id}/chat`, token);
        setMessages(res.messages);
      } catch { /* ignore */ }
    })();
  }, [id, token, socket]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (evt: any) => {
      if (evt.leadId !== id) return;
      const f: Followup = evt.followup;
      if (!f.scheduledAt || new Date(f.scheduledAt).getTime() <= Date.now()) return;
      setLead(prev => prev ? (
        (prev.followups as Followup[] | undefined)?.some(x => x.id === f.id)
          ? prev
          : { ...prev, followups: [f, ...(prev.followups as Followup[] || [])] }
      ) : prev);
    };
    socket.on('followup:new', onNew);
    return () => { socket.off('followup:new', onNew); };
  }, [socket, id]);

  useEffect(() => {
    if (!socket) return;
    const onAttNew = (evt: any) => {
      if (evt.leadId !== id) return;
      setLead(prev => {
        if (!prev) return prev;
        const exists = (prev.attachments || []).some(a => a.url === evt.attachment.url && a.filename === evt.attachment.filename);
        return exists ? prev : { ...prev, attachments: [...(prev.attachments || []), evt.attachment] };
      });
    };
    const onAttDel = (evt: any) => {
      if (evt.leadId !== id) return;
      setLead(prev => prev ? ({
        ...prev,
        attachments: (prev.attachments || []).filter(a => !(a.filename === evt.attachment.filename && a.url === evt.attachment.url))
      }) : prev);
    };
    const onLog = (evt: any) => {
      if (evt.leadId !== id) return;
      setLead(prev => {
        if (!prev) return prev;
        const arr = (prev.logs as any[] | undefined) || [];
        if (arr.some(l => l.id === evt.log.id)) return prev;
        return { ...prev, logs: [evt.log, ...arr] };
      });
    };
    socket.on('attachment:new', onAttNew);
    socket.on('attachment:deleted', onAttDel);
    socket.on('log:new', onLog);
    return () => {
      socket.off('attachment:new', onAttNew);
      socket.off('attachment:deleted', onAttDel);
      socket.off('log:new', onLog);
    };
  }, [socket, id]);

  const visibleFollowups = useMemo(() => {
    const all = (lead?.followups as Followup[] | undefined) || [];
    const now = Date.now();
    return all
      .filter(f => f.scheduledAt && new Date(f.scheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  }, [lead?.followups]);


  // CORRECTED LINES
  const upcoming: Followup | null = visibleFollowups.length > 0 ? visibleFollowups[0] : null;
  const others: Followup[] = visibleFollowups.length > 1 ? visibleFollowups.slice(1) : [];


  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length || !id || !token) return;
    try {
      setUploading(true);
      const form = new FormData();
      Array.from(files).forEach(f => form.append('files', f));
      const res = await api.post<{ success: boolean; attachments: { filename: string; url: string; createdAt: string }[] }>(
        `/leads/${id}/attachments`,
        form,
        token
      );
      if (res.attachments?.length) {
        await loadLead();
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      setErr(e?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDeleteAttachment = async (att: { filename: string; url: string }) => {
    if (!id || !token) return;
    try {
      await api.post<{ success: boolean }>(`/leads/${id}/attachments/delete`, { filename: att.filename, url: att.url }, token);
      setLead(prev => prev ? ({ ...prev, attachments: (prev.attachments || []).filter(a => !(a.filename === att.filename && a.url === att.url)) }) : prev);
    } catch (e: any) {
      setErr(e?.data?.message || 'Delete failed');
    }
  };

  const AttachmentChip = ({ filename, url }: { filename: string; url: string }) => {
    const href = toFileHref(url);
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const isImg = ['png','jpg','jpeg','gif','webp','bmp'].includes(ext);
    const label = ext === 'pdf' ? 'PDF' : (ext || 'FILE').toUpperCase();
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => onDeleteAttachment({ filename, url })}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow"
          title="Delete"
          aria-label="Delete attachment"
        >
          ×
        </button>
        <a href={href} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1" title={filename}>
          {isImg ? (
            <img src={href} alt={filename} className="w-[50px] h-[70px] object-cover rounded border" />
          ) : (
            <div className="w-[50px] h-[70px] rounded border flex items-center justify-center bg-gray-100 text-[10px] font-semibold">
              {label}
            </div>
          )}
          <div className="max-w-[60px] truncate text-[11px] text-gray-700">{filename}</div>
        </a>
      </div>
    );
  };

  const sendChat = async () => {
    const t = text.trim(); if (!t || !id || !token) return;
    await api.post<{ success: boolean; message: any }>(`/leads/${id}/chat`, { text: t }, token);
    setText('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {loading && <div>Loading...</div>}
          {err && <div className="text-red-600">{err}</div>}

          {lead && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Lead #{lead.uniqueNumber}</h1>
                  <p className="text-gray-600">{lead.division} • {lead.stage} • {lead.forecastCategory}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => navigate(`/leads/${lead.id}/edit`)}>Edit</Button>
                </div>
              </div>

              {/* Details */}
              <div className="bg-white border rounded p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Lead Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Lead #:</span> {lead.uniqueNumber}</div>
                  <div><span className="text-gray-500">Stage:</span> {lead.stage}</div>
                  <div><span className="text-gray-500">Forecast:</span> {lead.forecastCategory}</div>
                  <div><span className="text-gray-500">Source:</span> {lead.source || '-'}</div>


                  <div><span className="text-gray-500">Company:</span> {lead.companyName || '-'}</div>
                  <div><span className="text-gray-500">Division:</span> {lead.division || '-'}</div>


                  <div><span className="text-gray-500">Quote #:</span> {lead.quoteNumber || '-'}</div>
                  <div><span className="text-gray-500">Preview URL:</span> {lead.previewUrl || '-'}</div>


                  {lead?.nextFollowupAt && (
                    <div className="text-sm">
                      <span className="text-gray-500">Next Follow-up:</span> {new Date(lead.nextFollowupAt).toLocaleString()}
                    </div>
                  )}


                  <div><span className="text-gray-500">Lost Reason:</span> {lead.lostReason || '-'}</div>


                  <div><span className="text-gray-500">Actual Date:</span> {lead.actualDate ? new Date(lead.actualDate).toLocaleString() : '-'}</div>
                  <div><span className="text-gray-500">Created:</span> {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : '-'}</div>
                  <div><span className="text-gray-500">Updated:</span> {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : '-'}</div>

                  <div><span className="text-gray-500">Contact:</span> {lead.contactPerson || '-'}</div>
                  <div><span className="text-gray-500">Mobile:</span> {lead.mobile || '-'} {lead.mobileAlt ? `/ ${lead.mobileAlt}` : ''}</div>
                  <div><span className="text-gray-500">Email:</span> {lead.email || '-'}</div>
                  <div><span className="text-gray-500">City:</span> {lead.city || '-'}</div>
                  <div><span className="text-gray-500">Creator:</span> {lead.creatorType ? `${lead.creatorType} (${lead.creatorId})` : '-'}</div>
                </div>
                {lead.previewUrl && <img src={lead.previewUrl} alt="preview" className="mt-3 h-14 w-14 object-cover rounded border" />}
                {lead.description && <div className="mt-3 text-sm text-gray-800">{lead.description}</div>}
              </div>

              {/* Followups */}
              <div className="bg-white border rounded p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-700">Followups</div>
                  <Button variant="secondary" onClick={() => setOpenFollowup(true)}>Add Followup</Button>
                </div>

                {upcoming && (
                  <div className="mb-4 rounded border-2 border-amber-400 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-700 mb-1">Upcoming</div>
                    <div className="text-sm text-gray-800">{upcoming.status}</div>
                    {upcoming.description && <div className="text-sm text-gray-600">{upcoming.description}</div>}
                    {upcoming.scheduledAt && <div className="text-xs text-gray-500">Scheduled: {new Date(upcoming.scheduledAt).toLocaleString()}</div>}
                  </div>
                )}


                {others.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {others.map((f) => (
                      <li key={f.id} className="border rounded px-3 py-2">
                        <div className="text-gray-800">{f.status}</div>
                        {f.description && <div className="text-gray-600">{f.description}</div>}
                        <div className="text-gray-500 text-xs">Scheduled: {new Date(f.scheduledAt!).toLocaleString()}</div>
                        <div className="text-gray-400 text-xs">{new Date(f.createdAt || '').toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  !upcoming && <div className="text-sm text-gray-600">No followups.</div>
                )}
              </div>

              {/* Attachments */}
              <div className="bg-white border rounded p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Attachments</div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500">Upload related files</div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={e => onUpload(e.target.files)}
                      className="hidden"
                    />
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Add'}
                    </Button>
                  </div>
                </div>
                {lead.attachments?.length ? (
                  <div className="flex flex-wrap gap-3">
                    {lead.attachments.map((a, i) => (
                      <AttachmentChip key={`${a.url}:${a.filename}:${i}`} filename={a.filename} url={a.url} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No attachments.</div>
                )}
              </div>

              {/* Quotes picker */}
              <div className="bg-white border rounded p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Quotes</div>
                <QuotePicker
                  leadId={lead.id}
                  currentMain={lead.quoteNumber || null}
                  onMainChange={(qnum) => setLead(prev => prev ? ({ ...prev, quoteNumber: qnum || undefined }) : prev)}
                />
              </div>

              {/* Logs */}
              <div className="bg-white border rounded p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Logs</div>
                {((lead.logs as any[]) || []).length ? (
                  <ul className="space-y-2 text-sm">
                    {(lead.logs as any[]).map((lg: any) => (
                      <li key={lg.id} className="border rounded px-3 py-2">
                        <div className="text-gray-800">{lg.actorName} {formatAction(lg.action)}</div>
                        <div className="text-gray-600">{lg.message}</div>
                        <div className="text-gray-400 text-xs">{new Date(lg.createdAt).toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-600">No logs yet.</div>
                )}
              </div>

              {lead && (
                <ChatBox leadId={lead.id} />
              )}

              <FollowupModal
                open={openFollowup}
                onClose={() => setOpenFollowup(false)}
                leadNumber={lead.uniqueNumber}
                salesmanName={lead.salesman?.name || null}
                onSubmit={async (payload) => {
                  const body = {
                    status: payload.status as any,
                    description: payload.description,
                    scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt).toISOString() : undefined
                  };
                  await api.post<{ success: boolean; followup: Followup }>(`/followups/${id}`, body, token);
                  await loadFollowups();
                }}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default LeadDetail;
