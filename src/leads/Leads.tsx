import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import FilterDropdown, { Filter } from '../components/FilterDropdown';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import {Eye} from 'lucide-react'
const STAGES = ['Discover', 'Solution Validation', 'Quote', 'Negotiation', 'Deal Closed', 'Deal Lost', 'Fake Lead'];
const FORECASTS = ['Pipeline', 'BestCase', 'Commit'];

const Leads: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useAuth();

    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

    const handleCreateLead = () => navigate('/leads/create');

    const filterOptions = {
        stage: STAGES,
        forecastCategory: FORECASTS,
        followup: ['Upcoming', 'Overdue', 'No Followup'], // Updated for new backend logic
    };

    // Single effect to fetch leads when token or filters change
    useEffect(() => {
        if (!token) return;
        
        const controller = new AbortController();
        const signal = controller.signal;

        (async () => {
            setError(null);
            setLoading(true);
            try {
                const res = await leadsService.list(token, appliedFilters, signal);
                console.log(res)
                if (!signal.aborted) {
                    setLeads(res.leads);
                }
            } catch (e: any) {
                // Ignore errors from aborted requests
                if (!signal.aborted) {
                    setError(e?.data?.message || 'Failed to load leads');
                }
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                }
            }
        })();

        // Cleanup function to abort request on unmount or re-render
        return () => controller.abort();
    }, [token, appliedFilters]); // This correctly re-runs the effect on filter changes

    return (
       <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
      <Sidebar />


      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-ivory-200">Leads</h1>
              <p className="text-gray-600 dark:text-midnight-400">
                Manage potential customers and track progress.
              </p>
            </div>
            <Button
              onClick={handleCreateLead}
              className="flex items-center px-4 py-2 bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-xl transition"
            >
              <Plus size={18} className="mr-2" />
              Create Lead
            </Button>
          </div>

          {loading && <div className="text-midnight-700 dark:text-ivory-300">Loading...</div>}
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
                {
                  key: 'nextFollowupAt',
                  header: 'Next Followup',
                  render: (r) => r.nextFollowupAt ? new Date(r.nextFollowupAt).toLocaleString() : '-',
                },
                { key: 'lostReason', header: 'Lost Reason' },
                {
                  key: 'action',
                  header: 'Action',
                  sortable: false,
                  render: (r) => (
                    <div
                      
                      className="hidden sm:inline-flex items-center justify-center 
                                  w-8 h-8 rounded-full
                                  bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md 
                                  hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                                  shadow-md transition"
                      title="View Lead"
                      onClick={() => navigate(`/leads/${r.id}`)}
                    >
                      <Eye className="w-4 h-4 text-midnight-500"  size={18} />
                    </div>
                  ),
                },
              ]}
              filterKeys={['uniqueNumber', 'companyName', 'contactPerson', 'email', 'mobile', 'stage', 'forecastCategory', 'city', 'lostReason']}
              initialSort={{ key: 'createdAt', dir: 'DESC' }}
              searchPlaceholder="Filter leads..."
              className=" min-h-full min-w-full table-auto text-sm bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-3"
            />
          )}
        </main>
      </div>
    </div>
    );
};

export default Leads;
