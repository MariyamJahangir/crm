import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { dealsService, DealDetailsType } from '../services/dealsService';

// Reusable component for displaying a label and its value
const DetailItem: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-400">-</span>}</dd>
  </div>
);

// Reusable component for status badges
const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return null;
  const lowerStatus = status.toLowerCase();
  let colorClasses = 'bg-gray-100 text-gray-800';
  if (lowerStatus === 'paid' || lowerStatus === 'accepted') colorClasses = 'bg-green-100 text-green-800';
  else if (lowerStatus === 'pending' || lowerStatus === 'sent') colorClasses = 'bg-yellow-100 text-yellow-800';
  else if (lowerStatus === 'rejected' || lowerStatus === 'lost') colorClasses = 'bg-red-100 text-red-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}>
      {status}
    </span>
  );
};

const DealDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [deal, setDeal] = useState<DealDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    dealsService.getOne(id, token)
      .then(res => setDeal(res.deal))
      .catch(e => setErr(e?.data?.message || 'Failed to load deal details.'))
      .finally(() => setLoading(false));
  }, [id, token]);
  
  const quote = deal?.quote;
  const invoice = quote?.invoice;
  const customer = deal?.customer; // Added for easier access

  return (
    <div className="flex min-h-screen z-10 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {loading && <div>Loading deal details...</div>}
          {err && <div className="text-red-600">{err}</div>}
          {!loading && !deal && <div className="text-red-500">Deal not found.</div>}

          {deal && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-extrabold text-midnight-900 dark:text-ivory-100 drop-shadow-lg">
                      Deal #{deal.uniqueNumber}
                    </h1>
                    <StatusBadge status={invoice?.status} />
                  </div>
                  <p className="text-midnight-800 dark:text-ivory-400 text-sm mt-2">
                    Managed by <span className="font-semibold">{deal.salesman?.name}</span>
                  </p>
                </div>
              </div>

              {/* Lead Information Card */}
              <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-5 shadow-lg mb-6">
                <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                  Lead Information
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-midnight-700 dark:text-ivory-200">
                  <DetailItem label="Contact Person" value={deal.contactPerson} />
                  <DetailItem
                    label="Email"
                    value={<a href={`mailto:${deal.email}`} className="text-sky-600 hover:underline">{deal.email}</a>}
                  />
                  <DetailItem label="Mobile" value={deal.mobile} />
                  <DetailItem label="Source" value={deal.source} />
                  <DetailItem label="Created By" value={deal.createdBy} /> {/* ADDED */}
                  <DetailItem label="Created On" value={new Date(deal.createdAt).toLocaleDateString()} /> {/* ADDED */}
                </dl>
              </div>

              {/* --- NEW CUSTOMER DETAILS CARD --- */}
              <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-5 shadow-lg mb-6">
                <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                  Customer Details
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-midnight-700 dark:text-ivory-200">
                  <DetailItem label="Company Name" value={customer?.companyName} />
                  <DetailItem label="Industry" value={customer?.industry} />
                  <DetailItem label="Company Size" value={customer?.sizeOfCompany} />
                  <DetailItem label="Category" value={customer?.category} />
                  <DetailItem
                    label="Website"
                    value={
                      customer?.website ? (
                        <a href={`http://${customer.website}`} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                          {customer.website}
                        </a>
                      ) : null
                    }
                  />
                  <div className="lg:col-span-3">
                     <DetailItem label="Address" value={customer?.address} />
                  </div>
                </dl>
              </div>

              {/* Accepted Quote Card */}
              <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-5 shadow-lg mb-6">
                <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                  Accepted Quote
                </div>
                {quote ? (
                  <div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-midnight-700 dark:text-ivory-200 mb-6">
                      <DetailItem label="Quote Number" value={quote.quoteNumber} />
                      <DetailItem label="Status" value={<StatusBadge status={quote.status} />} />
                      <DetailItem label="Payment Terms" value={quote.paymentTerms} />
                      <DetailItem label="Valid Until" value={new Date(quote.validityUntil).toLocaleDateString()} />
                      <DetailItem
                        label="Quote Value"
                        value={<span className="font-semibold text-lg">${Number(quote.grandTotal).toFixed(2)}</span>}
                      />
                    </dl>
                    <h4 className="font-medium text-midnight-800 dark:text-ivory-200 mb-2">Quote Items</h4>
                    <div className="overflow-x-auto ring-1 ring-black/10 rounded-lg">
                      <table className="min-w-full divide-y divide-cloud-300 dark:divide-midnight-700 text-sm">
                        {/* Table Head and Body... */}
                        <thead className="bg-cloud-100/40 dark:bg-midnight-800/40">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Product</th>
                            <th className="px-3 py-2 text-right font-semibold">Qty</th>
                            <th className="px-3 py-2 text-right font-semibold">Rate</th>
                            <th className="px-3 py-2 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cloud-200 dark:divide-midnight-700">
                          {quote.items.map(item => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.product}</td>
                              <td className="px-3 py-2 text-right">{item.quantity}</td>
                              <td className="px-3 py-2 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">${Number(item.totalPrice).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-midnight-500 dark:text-ivory-500 italic">No quote found.</div>
                )}
              </div>

              {/* Final Invoice Card */}
              <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-5 shadow-lg mb-6">
                <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                  Final Invoice
                </div>
                {invoice ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-midnight-700 dark:text-ivory-200">
                    <DetailItem label="Invoice Number" value={invoice.invoiceNumber} />
                    <DetailItem label="Status" value={<StatusBadge status={invoice.status} />} />
                    <DetailItem label="Invoice Date" value={new Date(invoice.invoiceDate).toLocaleDateString()} />
                    <DetailItem label="Due Date" value={new Date(invoice.dueDate).toLocaleDateString()} />
                    <DetailItem label="Paid On" value={new Date(invoice.paidAt!).toLocaleDateString()} />
                    <DetailItem
                      label="Invoice Value"
                      value={<span className="font-semibold text-lg text-green-600">${Number(invoice.grandTotal).toFixed(2)}</span>}
                    />
                  </dl>
                ) : (
                  <div className="text-sm text-midnight-500 dark:text-ivory-500 italic">No invoice found.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default DealDetails;