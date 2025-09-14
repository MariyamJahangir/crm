import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import DataTable from '../components/DataTable';

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCreateLead = () => {
    navigate('/leads/create');
  };

  useEffect(() => {
    if (!token) return;
    let abort = false;

    (async () => {
      setError(null);
      setLoading(true);
      try {
        const res = await leadsService.list(token);
        if (!abort) setLeads(res.leads);
      } catch (e: any) {
        if (!abort) setError(e?.data?.message || 'Failed to load leads');
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => { abort = true; };
  }, [token]); // [1]

  return (
    <div className="flex min-h-screen pl-64 bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
              <p className="text-gray-600">Manage potential customers and track progress.</p>
            </div>
            <Button onClick={handleCreateLead} className="flex items-center">
              <Plus size={18} className="mr-2" />
              Create Lead
            </Button>
          </div>

          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          {!loading && !error && (
            <DataTable
              rows={leads}
              columns={[
                { key: 'uniqueNumber', header: 'Lead #', width: '120px' },
                { key: 'companyName', header: 'Company' },
                { key: 'contactPerson', header: 'Contact' },
                { key: 'email', header: 'Email' },
                { key: 'mobile', header: 'Mobile' },
                { key: 'stage', header: 'Stage' },
                { key: 'forecastCategory', header: 'Forecast' },
                { key: 'salesman', header: 'Salesman', render: (r) => r.salesman?.name || '-' },
                { key: 'nextFollowupAt', header: 'Next Followup', render: (r) => r.nextFollowupAt ? new Date(r.nextFollowupAt).toLocaleString() : '-' },
                { key: 'lostReason', header: 'Lost Reason' },
                { key: 'action', header: 'Action', sortable: false, render: (r) => (
                  <Button variant="secondary" onClick={() => navigate(`/leads/${r.id}`)}>Open</Button>
                ) },
              ]}
              filterKeys={['uniqueNumber','companyName','contactPerson','email','mobile','stage','forecastCategory','city','lostReason']}
              initialSort={{ key: 'createdAt', dir: 'DESC' }}
              searchPlaceholder="Filter leads..."
              className="bg-white p-3 rounded border"
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Leads;
