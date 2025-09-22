import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { dealsService, DealDetailsType } from '../services/dealsService';
import DataTable from '../components/DataTable';
import { Eye } from 'lucide-react';
import FormattedDateTime from '../components/FormattedDateTime';
const Deals: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const navigate = useNavigate();

  const [deals, setDeals] = useState<DealDetailsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    dealsService.listAll(token)
      .then(res => setDeals(res.deals))
      .catch(e => setErr(e?.data?.message || 'Failed to load deals.'))
      .finally(() => setLoading(false));
  }, [token]);

  const columns = useMemo(() => {
    const baseCols = [
      { key: 'uniqueNumber', header: 'Lead ID' },
      { key: 'customer.companyName', header: 'Company' },
     { key: 'quote.grandTotal', header: 'Deal Value', render: (r: DealDetailsType) => `$${Number(r.quote?.grandTotal || 0).toFixed(2)}` },
      { key: 'quote.invoice.invoiceNumber', header: 'Invoice #' },
                                         {
      key: 'updatedAt',
      header: 'Date Closed',
      render: (row: { updatedAt?: string }) => 
        row.updatedAt ? <FormattedDateTime isoString={row.updatedAt} /> : '-',
      sortable: true
    },
      {
        key: 'actions',
        header: 'Actions',
        sortable: false,
        render: (r: DealDetailsType) => (
          <div
            className="hidden sm:inline-flex items-center justify-center 
                                  w-8 h-8 rounded-full
                                  bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md 
                                  hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                                  shadow-md transition"
            title="View Deals"
            onClick={() => navigate(`/deals/${r.id}`)}
          >
            <Eye className="w-4 h-4 text-midnight-500" size={18} />
          </div>

        )
      }
    ];

    if (isAdmin) {
      baseCols.splice(2, 0, { key: 'salesman.name', header: 'Salesman' });
    }

    return baseCols;
  }, [isAdmin, navigate]);

  return (
    <div className="flex min-h-screen  z-10 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-ivory-200">
                Closed Deals
              </h1>
              <p className="text-gray-600 dark:text-midnight-400">
                View and manage all closed deals.
              </p>
            </div>
          </div>

          {/* Loading / Error states */}
          {loading && (
            <div className="text-midnight-700 dark:text-ivory-300">Loading deals...</div>
          )}
          {err && (
            <div className="text-red-600 p-3 bg-red-50 rounded mt-4">{err}</div>
          )}

          {/* Data Table */}
          {!loading && !err && (
            <div className="mt-4">
              <DataTable
                rows={deals}
                columns={columns}
                initialSort={{ key: 'updatedAt', dir: 'DESC' }}
                filterKeys={[
                  'uniqueNumber',
                  'customer.companyName',
                  'quote.invoice.invoiceNumber',
                  'salesman.name',
                ]}
                searchPlaceholder="Filter deals..."
                className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                         border border-cloud-300/30 dark:border-midnight-700/30 
                         rounded-2xl p-3"
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );

};

export default Deals;
