import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, Download, Plus } from 'lucide-react';

// Component Imports
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import StatusDropdown from '../components/StatusDropdown';
import PreviewModal from '../components/PreviewModal';

// Service and Type Imports
import { invoiceService, Invoice } from '../services/invoiceService';

const customerTypeStyles: Record<string, string> = {
  Customer: 'bg-blue-100 text-blue-800',
  Vendor: 'bg-green-100 text-green-800',
};

const InvoicesListPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for the preview modal
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
  
  // Track downloading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    invoiceService.list(token)
      .then(res => {
        if (res.success) {
          setInvoices(res.invoices);
        } else {
          setError('Failed to load invoices.');
        }
      })
      .catch(e => setError(e?.data?.message || 'An error occurred.'))
      .finally(() => setLoading(false));
  }, [token]);

  const showPreview = async (invoice: Invoice) => {
    if (!token) return;
    setPreview({ open: true, html: '<div>Loading preview...</div>' });
    try {
      const res = await invoiceService.previewHtml(invoice.id, token);
      if (res.success) {
        setPreview({ open: true, html: res.html });
      } else {
        throw new Error('Failed to load preview content.');
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to load preview.';
      setPreview({ open: true, html: `<div style="color:red;padding:20px;">${errorMessage}</div>` });
    }
  };

  const handleStatusChange = (updatedInvoice: Invoice) => {
    setInvoices(prevInvoices =>
      prevInvoices.map(inv => (inv.id === updatedInvoice.id ? updatedInvoice : inv))
    );
  };

  const handleDownload = async (invoice: Invoice) => {
    if (!token) return;
    setDownloadingId(invoice.id);
    setError(null);

    try {
      const pdfBlob = await invoiceService.downloadPdf(invoice.id, token);
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e: any) {
      setError(e?.message || 'Failed to download invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-ivory-200">Invoices</h1>
              <p className="text-gray-600 dark:text-midnight-400">
                Manage, create, and track all your invoices.
              </p>
            </div>
            <Button
              onClick={() => navigate('/invoices/create')}
              className="flex items-center px-4 py-2 bg-cloud-200/50 dark:bg-midnight-700/50 
                         backdrop-blur-md text-midnight-700 dark:text-ivory-300 
                         hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                         shadow-md rounded-xl transition"
            >
              <Plus size={18} className="mr-2" />
              Create Invoice
            </Button>
          </div>

          {loading && <div className="text-midnight-700 dark:text-ivory-300">Loading invoices...</div>}
          {error && <div className="text-red-600">{error}</div>}

          {!loading && !error && (
            <DataTable
              rows={invoices}
              columns={[
                { key: 'invoiceNumber', header: 'Invoice #' },
                { 
                  key: 'customerName', 
                  header: 'Billed To',
                  render: (r) => (
                    <div>
                      <div>{r.customerName}</div>
                      {r.customerType && (
                        <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${customerTypeStyles[r.customerType] || 'bg-gray-100'}`}>
                          {r.customerType}
                        </span>
                      )}
                    </div>
                  )
                },
                { 
                  key: 'invoiceDate', 
                  header: 'Date', 
                  render: (r) => new Date(r.invoiceDate).toLocaleDateString()
                },
                { 
                  key: 'grandTotal', 
                  header: 'Amount',
                  render: (r) => `$${Number(r.grandTotal || 0).toFixed(2)}`
                },
                { 
                  key: 'status', 
                  header: 'Status',
                  render: (r) => <StatusDropdown invoice={r} onStatusChange={handleStatusChange} />
                },
                {
                  key: 'action',
                  header: 'Actions',
                  sortable: false,
                  render: (r) => (
                    <div className="flex items-center gap-2">
                      <Button variant="icon" title="Preview" onClick={() => showPreview(r)}>
                        <Eye size={18} />
                      </Button>
                      <Button
                        variant="icon"
                        title="Download PDF"
                        onClick={() => handleDownload(r)}
                        disabled={downloadingId === r.id}
                      >
                        {downloadingId === r.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        ) : (
                          <Download size={18} />
                        )}
                      </Button>
                    </div>
                  )
                }
              ]}
              filterKeys={['invoiceNumber', 'customerName', 'status']}
              searchPlaceholder="Filter invoices..."
              className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                         border border-cloud-300/30 dark:border-midnight-700/30 
                         rounded-2xl p-3"
            />
          )}
        </main>
      </div>

      <PreviewModal
        open={preview.open}
        onClose={() => setPreview({ open: false, html: undefined })}
        html={preview.html}
        title="Invoice Preview"
      />
    </div>
  );
};

export default InvoicesListPage;
