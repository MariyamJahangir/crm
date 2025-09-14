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
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 pl-64  ">
        <div className="max-w-4xl mx-auto">
          {loading && <p>Loading deal details...</p>}
          {err && <p className="text-red-600">{err}</p>}
          {!loading && !deal && <p>Deal not found.</p>}

          {deal && (
            <>
              <div className="mb-6">
                <Button onClick={() => navigate(-1)} variant="secondary">&larr; Back to Deals</Button>
                <h1 className="text-3xl font-bold text-gray-900 mt-2">Deal: {deal.uniqueNumber}</h1>
                <p className="text-gray-500">Closed on {new Date(deal.updatedAt!).toLocaleDateString()}</p>
              </div>

              {/* Lead Information Card */}
              <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Lead Information</h3>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <DetailItem label="Company" value={deal.customer?.companyName} />
                    <DetailItem label="Contact Person" value={deal.contactPerson} />
                    <DetailItem label="Email" value={<a href={`mailto:${deal.email}`} className="text-blue-600 hover:underline">{deal.email}</a>} />
                    <DetailItem label="Mobile" value={deal.mobile} />
                    <div className="sm:col-span-2">
                      <DetailItem label="Address" value={deal.customer?.address} />
                    </div>
                    {deal.description && (
                      <div className="sm:col-span-2">
                        <DetailItem label="Description" value={<p className="whitespace-pre-wrap">{deal.description}</p>} />
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Accepted Quote Card */}
              <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Accepted Quote</h3>
                </div>
                {quote ? (
                  <div className="p-6">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 mb-6">
                      <DetailItem label="Quote Number" value={quote.quoteNumber} />
                      <DetailItem label="Quote Value" value={<span className="font-semibold text-lg">${Number(quote.grandTotal).toFixed(2)}</span>} />
                    </dl>
                    <h4 className="font-medium text-gray-800 mb-2">Quote Items</h4>
                    <div className="overflow-x-auto ring-1 ring-black ring-opacity-5 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">Product</th>
                            <th className="px-3 py-2 text-right text-sm font-semibold text-gray-900">Qty</th>
                            <th className="px-3 py-2 text-right text-sm font-semibold text-gray-900">Rate</th>
                            <th className="px-3 py-2 text-right text-sm font-semibold text-gray-900">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {quote.items.map(item => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 whitespace-nowrap">{item.product}</td>
                              <td className="px-3 py-2 text-right">{item.quantity}</td>
                              <td className="px-3 py-2 text-right">${Number(item.itemRate).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">${Number(item.lineGross).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : <div className="px-6 py-5 text-gray-500">No accepted quote found for this deal.</div>}
              </div>

              {/* Final Invoice Card */}
              <div className="bg-white shadow-sm overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Final Invoice</h3>
                </div>
                {invoice ? (
                  <div className="p-6">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <DetailItem label="Invoice Number" value={invoice.invoiceNumber} />
                      <DetailItem label="Invoice Value" value={<span className="font-semibold text-lg text-green-600">${Number(invoice.grandTotal).toFixed(2)}</span>} />
                    </dl>
                  </div>
                ) : <div className="px-6 py-5 text-gray-500">Invoice has not been generated for this deal yet.</div>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DealDetails;
