import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { quotesService, Quote } from '../services/quotesService';
import { invoiceService } from '../services/invoiceService';
import DataTable from '../components/DataTable';
import PreviewModal from '../components/PreviewModal';
import { Eye, Download } from 'lucide-react'; // 👈 added icons
import { Filter } from '../components/FilterDropdown';
import FormattedDateTime from '../components/FormattedDateTime';
import {toast} from 'react-hot-toast';
// --- Rejection Dialog Sub-component ---
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
    try {
      await onSubmit(note.trim());
      onClose();
      setNote('');
    } finally {
      setSaving(false);
    }
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


// --- Constants ---
const memberStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as const;
const adminStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as const;
const FINAL_STATES = ['Accepted', 'Rejected', 'Expired'];


// --- Main Quotes Component ---
const Quotes: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const navigate = useNavigate();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [masterQuotes, setMasterQuotes] = useState<Quote[]>([]);
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Quote | null>(null);
    const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

  // --- Data Fetching ---
useEffect(() => {
        if (!token) return;
        (async () => {
            setLoading(true);
     
            try {
                const res = await quotesService.listAll(token);
             console.log(res.quotes);
             
                setMasterQuotes(res.quotes);
                setQuotes(res.quotes); // Initially display all quotes
            } catch (e: any) {
                 toast.error(e?.data?.message || 'Failed to load quotes');
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    // --- Client-Side Filtering ---
    useEffect(() => {
        let filtered = [...masterQuotes];

        appliedFilters.forEach(filter => {
            if (filter.values.length > 0) {
                const key = filter.type.toLowerCase();
                filtered = filtered.filter(quote => {
                    const value = key === 'company' ? quote.customerName :
                                  key === 'salesman' ? quote.salesmanName :
                                  (quote as any)[key];
                    return value && filter.values.includes(value);
                });
            }
        });
        
        setQuotes(filtered);
    }, [appliedFilters, masterQuotes]);

    // --- Memoized Filter Options ---
    const filterOptions = useMemo(() => ({
        Company: [...new Set(masterQuotes.map(q => q.customerName).filter(Boolean))],
        Status: [...new Set(masterQuotes.map(q => q.status).filter(Boolean))],
        ...(isAdmin && { Salesman: [...new Set(masterQuotes.map(q => q.salesmanName).filter(Boolean))] }),
    }), [masterQuotes, isAdmin]);
  
  // --- PDF Download Handler ---
  const handleDownload = async (quote: Quote) => {
    if (!token) return;
    setPendingAction(quote.id);
   
    try {
      const blob = await quotesService.downloadPdf(quote.leadId, quote.id, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quote.quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
         toast.success('Quote download started')
    } catch (e: any) {
       toast.error(e.message || 'Failed to download PDF.');
    } finally {
      setPendingAction(null);
    
    }
  };

  // --- Action Handlers ---
  const showPreview = async (quote: Quote) => {
    if (!token) return;
    setPreview({ open: true, html: '<div>Loading preview...</div>' });
    try {
      const res = await quotesService.previewHtml(quote.leadId, quote.id, token);

      if (res.success) {
        setPreview({ open: true, html: res.html });
      } else {
        throw new Error('Failed to load preview content.');
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to load preview.';
      setPreview({ open: true, html: `<div style="color:red;padding:20px;">${errorMessage}</div>` });
         toast.error('Quote preview failed')
    }
  };

  const approveQuote = async (q: Quote) => {
    if (!token) return;
    setPendingAction(q.id);
    try {
      await quotesService.approve(q.leadId, q.id, token);
      setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: 'Draft', isApproved: true, rejectNote: null } : p));
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to approve quote');
    } finally {
      setPendingAction(null);
      toast.success('Quote approved')
    }
  };

  const rejectQuote = async (q: Quote, note: string) => {
    if (!token) return;
    setPendingAction(q.id);
    try {
      await quotesService.reject(q.leadId, q.id, { note }, token);
      setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: 'Rejected', isApproved: false, rejectNote: note } : p));
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to reject quote');
    } finally {
      setPendingAction(null);
      setRejectFor(null);
      toast.error('Quote rejected')
    }
  };
  
  const updateStatus = async (q: Quote, newStatus: string) => {
    if (!token) return;
    setPendingAction(q.id);
    try {
      await quotesService.update(q.leadId, q.id, { status: newStatus }, token);
      setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: newStatus } : p));
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to update status');
    } finally {
      setPendingAction(null);
      toast.success('Quote status updated')
    }
  };

  const convertToInvoice = async (q: Quote) => {
    if (!token) return;
    setPendingAction(q.id);
   
    try {
      const res = await invoiceService.create({ quoteId: q.id }, token);
      if (res.success && res.invoice) {
        navigate(`/invoices`);
      } else {
        throw new Error(res.message || 'Failed to convert quote.');
      }
    } catch (e: any) {
      toast.error(e?.data?.message || e.message || 'An error occurred during conversion.');
    } finally {
      setPendingAction(null);
      toast.success('Quote converted to invoice')
    }
  };

  // --- Action Column Renderer ---
  const renderActions = (quote: Quote) => {
    const status = quote.status || 'Draft';
    const isFinal = FINAL_STATES.includes(status);
    const isPending = status === 'PendingApproval';
    const canDownload = quote.isApproved || isAdmin;
    const isBusy = pendingAction === quote.id;
    const isAccepted = status === 'Accepted';
    const hasInvoice = !!quote.invoiceId;

    return (
      <div className="flex items-center gap-1 justify-end flex-wrap mr-5">
        {isAccepted && !hasInvoice && (
          <Button size="sm" variant="success" onClick={() => convertToInvoice(quote)} disabled={isBusy} className='px-3'>
            {isBusy ? 'Converting...' : 'Convert to Invoice'}
          </Button>
        )}
        {isAccepted && hasInvoice && (
          <span className="text-xs font-semibold text-green-600 bg-green-100 rounded-full px-3 py-1">Invoice Created</span>
        )}

        {!isPending && !isAccepted && (
          <select value={status} onChange={(e) => updateStatus(quote, e.target.value)} disabled={isFinal || isBusy} className="select select-bordered select-sm rounded-md">
            {(isAdmin ? adminStatuses : memberStatuses).map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        )}

        {isAdmin && isPending && !isFinal && (
          <div className="flex gap-2">
            <Button size="sm" variant="success" onClick={() => approveQuote(quote)} disabled={isBusy} className='px-3'>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => setRejectFor(quote)} disabled={isBusy} className="px-3">Reject</Button>
          </div>
        )}

        {/* 👁 Preview Icon */}
        <button
          onClick={() => showPreview(quote)}
          disabled={isBusy}
          title="Preview"
          className="p-2 text-gray-600 hover:text-sky-600 disabled:opacity-50"
        >
          <Eye className="w-5 h-5" />
        </button>

        {/* ⬇ Download Icon */}
        <button
          onClick={() => handleDownload(quote)}
          disabled={!canDownload || isBusy}
          title={!canDownload ? "Waiting for admin approval" : "Download PDF"}
          className="p-2 text-gray-600 hover:text-sky-600 disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    );
  };

  // --- Main Component Render ---
return (
  <div className="flex min-h-screen  transition-colors duration-300">
    {/* Sidebar */}
    <Sidebar />

    {/* Scrollable content area */}
    <div className="flex-1 overflow-y-auto h-screen">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-gray-900">Quotes</h1>

          {/* Search + Create button aligned center */}
          <div className="flex items-center gap-2">
            <Button
              className="h-10 bg-sky-500/80 hover:bg-color-sky-700/80 text-white rounded-xl px-4 whitespace-nowrap flex items-center justify-center"
              onClick={() => navigate('/create-quote')}
            >
              Create Quote
            </Button>
          </div>
        </div>

        {loading && <div>Loading quotes...</div>}
        <DataTable
          rows={quotes}
          columns={[
            { key: 'quoteNumber', header: 'Quote #' },
            { key: 'customerName', header: 'Company' },
            { key: 'salesmanName', header: 'SalesMan' },
 { 
  key: 'profitPercent', 
  header: 'Profit', 
  render: (row) => `${parseFloat(row.profitPercent).toFixed(2)}%`
},

            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <div className="flex flex-col">
                  <span
                    className={`font-medium ${
                      r.status === 'PendingApproval' ? 'text-yellow-600' : ''
                    }`}
                  >
                    {r.status}
                  </span>
                  {r.status === 'Rejected' && r.rejectNote && (
                    <span
                      className="text-xs text-red-600 mt-0.5"
                      title={r.rejectNote}
                    >
                      Reason: {r.rejectNote}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'grandTotal',
              header: 'Total',
              render: (r) => Number(r.grandTotal || 0).toFixed(2),
              width: '120px',
            },
             {
              key: 'validityUntil',
              header: 'Date',
             render: (row) => <FormattedDateTime isoString={row.validityUntil} />,
            },
            {
              key: 'createdAt',
              header: 'Date',
             render: (row) => <FormattedDateTime isoString={row.createdAt} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: renderActions,
              width: '360px',
            },
          ]}
          initialSort={{ key: 'quoteDate', dir: 'DESC' }}
           filterKeys={['quoteNumber', 'customerName', 'salesmanName']}
                        searchPlaceholder="Search quotes..."
                        filterOptions={filterOptions}
                        appliedFilters={appliedFilters}
                        onApplyFilters={setAppliedFilters}
          className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-3"
        />
      </main>
    </div>

    {/* Modals */}
    <RejectDialog
      open={!!rejectFor}
      onClose={() => setRejectFor(null)}
      onSubmit={(note) => rejectQuote(rejectFor!, note)}
    />
    <PreviewModal
      open={preview.open}
      onClose={() => setPreview({ open: false, html: undefined })}
      html={preview.html}
      title="Quote Preview"
    />
  </div>
);


};

export default Quotes;
