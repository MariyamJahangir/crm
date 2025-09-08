import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { quotesService, Quote } from '../services/quotesService';
import DataTable from '../components/DataTable';
import PreviewModal from '../components/PreviewModal';

const RejectDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}> = ({ open, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try { await onSubmit(note.trim()); onClose(); setNote(''); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-4 py-3 border-b font-semibold">Reject Quote</div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">Provide a short reason for rejection. This will be visible to the member.</p>
          <textarea
            rows={4}
            className="w-full border rounded px-3 py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection..."
          />
        </div>
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !note.trim()}>{saving ? 'Rejecting...' : 'Confirm Reject'}</Button>
        </div>
      </div>
    </div>
  );
};

const memberStatuses = ['Draft', 'Sent'] as const;
const adminStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as const;
const FINAL_STATES = ['Accepted', 'Rejected', 'Expired'];

const Quotes: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const navigate = useNavigate();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
  const [pendingAction, setPendingAction] = useState<string | null>(null); // For any async action on a quote row
  const [rejectFor, setRejectFor] = useState<Quote | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await quotesService.listAll(token);
        setQuotes(res.quotes);
      } catch (e: any) {
        setErr(e?.data?.message || 'Failed to load quotes');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(x =>
      (x.quoteNumber || '').toLowerCase().includes(q) ||
      (x.customerName || '').toLowerCase().includes(q)
    );
  }, [quotes, search]);

  const approveQuote = async (q: Quote) => {
    if (!token) return;
    setPendingAction(q.id);
    try {
      await quotesService.approve(q.leadId, q.id, token);
      setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: 'Accepted', isApproved: true, rejectNote: null } : p));
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to approve quote');
    } finally {
      setPendingAction(null);
    }
  };

  const rejectQuote = async (q: Quote, note: string) => {
    if (!token) return;
    setPendingAction(q.id);
    try {
      await quotesService.reject(q.leadId, q.id, { note }, token);
      setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: 'Rejected', isApproved: false, rejectNote: note } : p));
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to reject quote');
    } finally {
      setPendingAction(null);
      setRejectFor(null);
    }
  };
  
  const updateStatus = async (q: Quote, newStatus: string) => {
    if (!token) return;
    setPendingAction(q.id);
    try {
      await quotesService.update(q.leadId, q.id, { status: newStatus }, token);
      setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: newStatus } : p));
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to update status');
    } finally {
      setPendingAction(null);
    }
  };

  const renderActions = (quote: Quote) => {
    const status = quote.status || 'Draft';
    const isFinal = FINAL_STATES.includes(status);
    const isPending = status === 'PendingApproval';
    const canDownload = quote.isApproved || isAdmin;
    const isBusy = pendingAction === quote.id;

    return (
      <div className="flex items-center gap-1 justify-end flex-wrap">
        {/* Status Dropdown */}
        {!isPending && (
            <select
              value={status}
              onChange={(e) => updateStatus(quote, e.target.value)}
              disabled={isFinal || isBusy}
              className="select select-bordered select-sm"
            >
              {(isAdmin ? adminStatuses : memberStatuses).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
        )}

        {/* Admin Approval/Rejection Buttons */}
        {isAdmin && isPending && !isFinal && (
          <>
            <Button size="sm" variant="success" onClick={() => approveQuote(quote)} disabled={isBusy}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => setRejectFor(quote)} disabled={isBusy}>Reject</Button>
          </>
        )}

       
        <Button
          size="sm"
          onClick={() => canDownload ? quotesService.downloadPdf(quote.leadId, quote.id, token) : undefined}
          disabled={!canDownload || isBusy}
          title={!canDownload ? "Waiting for admin approval" : "Download PDF"}
        >
          Download
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900">Quotes</h1>
            <div className="flex items-center gap-3">
              <input
                className="input input-bordered w-64"
                placeholder="Search by number or company"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <Button onClick={() => navigate('/create-quote')}>Create Quote</Button>
            </div>
          </div>

          {loading && <div>Loading quotes...</div>}
          {err && <div className="text-red-600 p-3 bg-red-50 rounded mb-3">{err}</div>}
          
          <DataTable
            rows={filteredQuotes}
            columns={[
              { key: 'quoteNumber', header: 'Quote #' },
              { key: 'customerName', header: 'Company' },
              { key: 'quoteDate', header: 'Date', render: (r) => new Date(r.quoteDate).toLocaleDateString() },
              { key: 'status', header: 'Status', render: (r) => (
                  <div className="flex flex-col">
                    <span className={`font-medium ${r.status === 'PendingApproval' ? 'text-yellow-600' : ''}`}>{r.status}</span>
                    {r.status === 'Rejected' && r.rejectNote && (
                      <span className="text-xs text-red-600 mt-0.5" title={r.rejectNote}>Reason: {r.rejectNote}</span>
                    )}
                  </div>
              )},
              { key: 'grandTotal', header: 'Total', render: (r) => Number(r.grandTotal || 0).toFixed(2), width: '120px' },
              { key: 'actions', header: 'Actions', sortable: false, render: renderActions, width: '360px' },
            ]}
            initialSort={{ key: 'quoteDate', dir: 'DESC' }}
          />
        </main>
      </div>
      <RejectDialog
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onSubmit={(note) => rejectQuote(rejectFor!, note)}
      />
    </div>
  );
};

export default Quotes;
