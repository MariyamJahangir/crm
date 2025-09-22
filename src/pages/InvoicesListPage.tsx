import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, Download, Plus } from 'lucide-react';

// Component Imports
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import StatusDropdown from '../components/StatusDropdown';
import PreviewModal from '../components/PreviewModal';
import { Filter } from '../components/FilterDropdown'; // Ensure this path is correct
import FormattedDateTime from '../components/FormattedDateTime';
// Service and Type Imports
import { invoiceService, Invoice } from '../services/invoiceService';

const customerTypeStyles: Record<string, string> = {
    Customer: 'bg-blue-100 text-blue-800',
    Vendor: 'bg-green-100 text-green-800',
};

const InvoicesListPage: React.FC = () => {
    const { token, user } = useAuth();
    const isAdmin = user?.type === 'ADMIN';
    const navigate = useNavigate();

    // State for master list (unfiltered) and displayed list (filtered)
    const [masterInvoices, setMasterInvoices] = useState<Invoice[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // State for the filters
    const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

    // Other states
    const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Initial data fetching
    useEffect(() => {
        if (!token) return;
        setLoading(true);
        invoiceService.list(token)
            .then(res => {
                if (res.success) {
                    console.log(res)
                  console.log(res)
                    setMasterInvoices(res.invoices);
                    setInvoices(res.invoices);
                } else {
                    setError('Failed to load invoices.');
                }
            })
            .catch(e => setError(e?.data?.message || 'An error occurred.'))
            .finally(() => setLoading(false));
    }, [token]);

    // Apply filters whenever the master list or the filters themselves change
    useEffect(() => {
        let filtered = [...masterInvoices];

        appliedFilters.forEach(filter => {
            if (filter.values.length > 0) {
                const key = filter.type;
                filtered = filtered.filter(invoice => {
                    const value = 
                        key === 'Billed To' ? invoice.customerName :
                        key === 'Status' ? invoice.status :
                        key === 'Salesman' ? invoice.salesmanName :
                        null;
                    return value && filter.values.includes(value);
                });
            }
        });

        setInvoices(filtered);
    }, [appliedFilters, masterInvoices]);

    // Generate filter options from the master list to ensure they are always available
    const filterOptions = useMemo(() => ({
        'Billed To': [...new Set(masterInvoices.map(inv => inv.customerName).filter(Boolean))],
        Status: [...new Set(masterInvoices.map(inv => inv.status).filter(Boolean))],
        ...(isAdmin && { Salesman: [...new Set(masterInvoices.map(inv => inv.salesmanName).filter(Boolean))] }),
    }), [masterInvoices, isAdmin]);

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
        const updatedMasterList = masterInvoices.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv);
        setMasterInvoices(updatedMasterList);
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
        <div className="flex min-h-screen  z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-ivory-200">Invoices</h1>
                            <p className="text-gray-600 dark:text-midnight-400">
                                Manage, create, and track all your invoices.
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/invoices/create')}
                            className="flex items-center px-4 py-2 bg-sky-500/80 text-white hover:bg-sky-600 shadow-lg rounded-xl transition"
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
                                { key: 'salesmanName', header: 'Salesman' },
                                { key: 'grandTotal', header: 'Amount', render: (r) => `$${Number(r.grandTotal || 0).toFixed(2)}` },
                                { key: 'status', header: 'Status', render: (r) => <StatusDropdown invoice={r} onStatusChange={handleStatusChange} /> },
                               
                                 { key: 'invoiceDate', header: 'Date',  render: (row) => <FormattedDateTime isoString={row.invoiceDate} /> },
                               {
                                    key: 'action',
                                    header: 'Actions',
                                    sortable: false,
                                    render: (r) => (
                                        <div className="flex items-center gap-2">
                                            <Button variant="icon" title="Preview" onClick={() => showPreview(r)}>
                                                <Eye size={18} />
                                            </Button>
                                            <Button variant="icon" title="Download PDF" onClick={() => handleDownload(r)} disabled={downloadingId === r.id}>
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
                            filterKeys={['invoiceNumber', 'customerName', 'status', 'salesmanName']}
                            searchPlaceholder="Search invoices..."
                            // Add these props to enable the filters
                            filterOptions={filterOptions}
                            appliedFilters={appliedFilters}
                            onApplyFilters={setAppliedFilters}
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
