import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';

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
  if (!token) return; // wait for token to be available
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
}, [token]);


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
            <div className="grid gap-4">
              {leads.map((l) => (
                <div key={l.id} className="bg-white p-4 rounded border shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-medium">{l.division} — {l.contactPerson || l.email || l.mobile || 'Lead'}</div>
                      <div className="text-gray-600 text-sm">
                        {l.stage} • {l.forecastCategory} • #{l.uniqueNumber}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {l.ownerName ? `Owner: ${l.ownerName}` : ''} {l.salesman?.name ? ` | Salesman: ${l.salesman.name}` : ''}
                      </div>
                    </div>
                    <div>
                      <Button variant="secondary" onClick={() => navigate(`/leads/${l.id}`)}>Open</Button>
                    </div>
                  </div>
                </div>
              ))}
              {leads.length === 0 && <div className="text-gray-600">No leads found.</div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Leads;
