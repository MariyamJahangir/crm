import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { dealsService, DealDetailsType } from '../services/dealsService';
import DataTable from '../components/DataTable';

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
      { key: 'updatedAt', header: 'Date Closed', render: (r: DealDetailsType) => new Date(r.updatedAt!).toLocaleDateString() },
      { key: 'quote.grandTotal', header: 'Deal Value', render: (r: DealDetailsType) => `$${Number(r.quote?.grandTotal || 0).toFixed(2)}` },
      { key: 'quote.invoice.invoiceNumber', header: 'Invoice #' },
      {
        key: 'actions',
        header: 'Actions',
        sortable: false,
        render: (r: DealDetailsType) => (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/deals/${r.id}`)}>
            View Details
          </Button>
        )
      }
    ];

    if (isAdmin) {
      baseCols.splice(2, 0, { key: 'salesman.name', header: 'Salesman' });
    }

    return baseCols;
  }, [isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Closed Deals</h1>
          {loading && <div className="mt-4">Loading deals...</div>}
          {err && <div className="text-red-600 p-3 bg-red-50 rounded mt-4">{err}</div>}
          {!loading && !err && (
            <div className="mt-6">
              <DataTable
                rows={deals}
                columns={columns}
                initialSort={{ key: 'updatedAt', dir: 'DESC' }}
                filterKeys={['uniqueNumber', 'customer.companyName', 'quote.invoice.invoiceNumber', 'salesman.name']}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Deals;
