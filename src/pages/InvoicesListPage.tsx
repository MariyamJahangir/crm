import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, Edit, Trash2 } from 'lucide-react';

// Component Imports
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import StatusDropdown from '../components/StatusDropdown';
import PreviewModal from '../components/PreviewModal'; // Using the generic PreviewModal

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
  
  // State for the preview modal, similar to the quotes page
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });

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
  
 

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-screen-xl mx-auto py-8 px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
              <p className="text-gray-600">Manage, create, and track all your invoices.</p>
            </div>
            <Button onClick={() => navigate('/invoices/create')}>Create Invoice</Button>
          </div>
          
          {loading && <div className="text-center p-4">Loading invoices...</div>}
          {error && <div className="text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

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
                    </div>
                  )
                }
              ]}
              filterKeys={['invoiceNumber', 'customerName', 'status', 'customerType']}
              searchPlaceholder="Filter invoices..."
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
