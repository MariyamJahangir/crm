// pages/Quotes.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { quotesService, Quote } from '../services/quotesService';
import DataTable from '../components/DataTable';
const PreviewModal: React.FC<{ open: boolean; onClose: () => void; html?: string }> = ({ open, onClose, html }) => {
  if (!open) return null;

  // A4 at ~96dpi
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-[1200px] max-h-[90vh] flex flex-col">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="font-semibold">Quote Preview</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">×</button>
        </div>

        {/* Content area that computes scale to fit A4 into available space */}
        <div className="flex-1 overflow-auto p-3">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: 'calc(90vh - 100px)' }} // leave space for header/footer
          >
            <div
              className="relative"
              style={{
                transformOrigin: 'top left',
                width: `${A4_WIDTH}px`,
                height: `${A4_HEIGHT}px`,
              }}
            >
              <iframe
                title="Quote Preview"
                style={{
                  width: `${A4_WIDTH}px`,
                  height: `${A4_HEIGHT}px`,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  borderRadius: 4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
                srcDoc={html || '<div style="padding:20px;font-family:Arial;color:#555">Loading...</div>'}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

const Quotes: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(x =>
      (x.quoteNumber || '').toLowerCase().includes(q) ||
      (x.customerName || '').toLowerCase().includes(q)
    );
  }, [quotes, search]);

  const openPreview = async (q: Quote) => {
    try {
      const html = await quotesService.previewHtml(q.leadId, q.id, token);
      setPreview({ open: true, html });
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
      setTimeout(() => window.URL.revokeObjectURL(url), 2500);
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to download PDF');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900">Quotes</h1>
            <div className="flex items-center gap-3">
              <div className="w-64">
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="Search by number or company"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => navigate('/create-quote')}>Create Quote</Button>
            </div>
          </div>

          {loading && <div>Loading...</div>}
          {err && <div className="text-red-600 mb-3">{err}</div>}

          {!loading && !filtered.length && <div className="text-gray-600">No quotes found.</div>}

          <DataTable
  rows={filtered}
  columns={[
    { key: 'quoteNumber', header: 'Quote #' },
    { key: 'customerName', header: 'Company' },
    { key: 'leadId', header: 'Lead ID' },
    { key: 'quoteDate', header: 'Date', render: (r) => new Date(r.quoteDate).toLocaleDateString() },
    { key: 'status', header: 'Status' },
    { key: 'preparedBy', header: 'Prepared By' },
    { key: 'approvedBy', header: 'Approved By' },
    { key: 'grandTotal', header: 'Total', render: (r) => Number(r.grandTotal || 0).toFixed(2), width: '120px' },
    { key: 'actions', header: 'Actions', sortable: false, render: (r) => (
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => openPreview(r)}>Preview</Button>
        <Button onClick={() => download(r)}>Download</Button>
      </div>
    ), width: '200px' },
  ]}
  filterKeys={['quoteNumber','customerName','leadId','status','preparedBy','approvedBy']}
  initialSort={{ key: 'quoteDate', dir: 'DESC' }}
  searchPlaceholder="Filter quotes..."
/>

        </main>
      </div>

      <PreviewModal open={preview.open} onClose={() => setPreview({ open: false })} html={preview.html} />
    </div>
  );
};

export default Quotes;
