import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { dealsService, DealDetailsType } from '../services/dealsService';

// A reusable component for displaying a label and its value.
const DetailItem: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-400">-</span>}</dd>
  </div>
);

// The main DealDetails component with the integrated layout.
const DealDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="flex min-h-screen  z-10 transition-colors duration-300">
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
                <h1 className="text-3xl font-extrabold text-midnight-900 dark:text-ivory-100 drop-shadow-lg">
                  Deal #{deal.uniqueNumber}
                </h1>
                <p className="text-midnight-800 dark:text-ivory-400 text-sm mt-1">
                  Closed on {new Date(deal.updatedAt!).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Lead Information Card */}
            <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                            border border-cloud-300/30 dark:border-midnight-700/30 
                            rounded-2xl p-5 shadow-lg mb-6">
              <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                Lead Information
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-midnight-700 dark:text-ivory-200">
                <DetailItem label="Company" value={deal.customer?.companyName} />
                <DetailItem label="Contact Person" value={deal.contactPerson} />
                <DetailItem
                  label="Email"
                  value={<a href={`mailto:${deal.email}`} className="text-sky-600 hover:underline">{deal.email}</a>}
                />
                <DetailItem label="Mobile" value={deal.mobile} />
                <div className="sm:col-span-2">
                  <DetailItem label="Address" value={deal.customer?.address} />
                </div>
                {deal.description && (
                  <div className="sm:col-span-2 text-sm italic text-midnight-600 dark:text-ivory-400">
                    {deal.description}
                  </div>
                )}
              </dl>
            </div>

            {/* Accepted Quote Card */}
            <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                            border border-cloud-300/30 dark:border-midnight-700/30 
                            rounded-2xl p-5 shadow-lg mb-6">
              <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                Accepted Quote
              </div>
              {quote ? (
                <div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-midnight-700 dark:text-ivory-200 mb-6">
                    <DetailItem label="Quote Number" value={quote.quoteNumber} />
                    <DetailItem
                      label="Quote Value"
                      value={<span className="font-semibold text-lg">${Number(quote.grandTotal).toFixed(2)}</span>}
                    />
                  </dl>
                  <h4 className="font-medium text-midnight-800 dark:text-ivory-200 mb-2">Quote Items</h4>
                  <div className="overflow-x-auto ring-1 ring-black/10 rounded-lg">
                    <table className="min-w-full divide-y divide-cloud-300 dark:divide-midnight-700 text-sm">
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
                            <td className="px-3 py-2 text-right">${Number(item.itemRate).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-medium">${Number(item.lineGross).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-midnight-500 dark:text-ivory-500 italic">
                  No accepted quote found for this deal.
                </div>
              )}
            </div>

            {/* Final Invoice Card */}
            <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                            border border-cloud-300/30 dark:border-midnight-700/30 
                            rounded-2xl p-5 shadow-lg mb-6">
              <div className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
                Final Invoice
              </div>
              {invoice ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-midnight-700 dark:text-ivory-200">
                  <DetailItem label="Invoice Number" value={invoice.invoiceNumber} />
                  <DetailItem
                    label="Invoice Value"
                    value={<span className="font-semibold text-lg text-green-600">${Number(invoice.grandTotal).toFixed(2)}</span>}
                  />
                </dl>
              ) : (
                <div className="text-sm text-midnight-500 dark:text-ivory-500 italic">
                  Invoice has not been generated for this deal yet.
                </div>
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
