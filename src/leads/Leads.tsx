import React, { useEffect, useState } from 'react';
import { Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import { Filter } from '../components/FilterDropdown';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import { teamService, TeamUser } from '../services/teamService';
import FormattedDateTime from '../components/FormattedDateTime'
const STAGES = ['Discover', 'Solution Validation', 'Quote Negotiation', 'Deal Closed', 'Deal Lost', 'Fake Lead'];
const FORECASTS = ['Pipeline', 'BestCase', 'Commit'];

const Leads: React.FC = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth(); // Get the user object
    const isAdmin = user?.type === 'ADMIN'; // Check if the user is an admin

    const [leads, setLeads] = useState<Lead[]>([]);
    const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

    const handleCreateLead = () => navigate('/leads/create');

    // --- Conditionally build filter options based on user role ---
    const filterOptions = {
        stage: STAGES,
        forecastCategory: FORECASTS,

    };

    // Effect to fetch initial salesmen list (only needed for admins)
    useEffect(() => {
        if (!token || !isAdmin) {
            setSalesmen([]); // Clear salesmen if not admin
            return;
        }

        const loadSalesmen = async () => {
            try {
                const teamRes = await teamService.list(token);
            
                setSalesmen(teamRes.users);
            } catch (e) {
                console.error("Failed to load salesmen list for admin.");
            }
        };

        loadSalesmen();
    }, [token, isAdmin]);

    // Effect to fetch leads based on token and applied filters
    useEffect(() => {
        if (!token) return;

        const controller = new AbortController();
        const signal = controller.signal;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await leadsService.list(token, appliedFilters, signal);
                if (!signal.aborted) {
                        console.log(res.leads)
                    setLeads(res.leads);
                }
            } catch (e: any) {
                if (!signal.aborted) {
                    setError(e?.data?.message || 'Failed to load leads');
                }
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [token, appliedFilters]);

    return (
        <div className="flex min-h-screen  z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-700 dark:text-ivory-200">Leads</h1>
                            <p className="text-gray-700 dark:text-midnight700">
                                Manage potential customers and track progress.
                            </p>
                        </div>
                        <Button
                            onClick={handleCreateLead}
                            className="flex items-center px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition"
                        >
                            <Plus size={18} className="mr-2" />
                            Create Lead
                        </Button>
                    </div>

                    {loading && <div className="text-center py-4 text-midnight-700 dark:text-ivory-300">Loading...</div>}
                    {error && <div className="text-center py-4 text-red-600">{error}</div>}

                    {!loading && !error && (
                        <DataTable
                            rows={leads}
                            columns={[
                                { key: 'uniqueNumber', header: 'Lead #', width: '120px' },
                                { key: 'companyName', header: 'Company' },
                                { key: 'contactPerson', header: 'Contact' },
                                { key: 'stage', header: 'Stage' },
                                { key: 'forecastCategory', header: 'Forecast' },
                                { key: 'salesman.name', header: 'Salesman' },
                                 { key: 'source', header: 'Source' },
                                  
                                    {
      key: 'nextFollowupAt',
      header: 'nextFollowupAt',
      render: (row: { nextFollowupAt?: string }) => 
        row.nextFollowupAt ? <FormattedDateTime isoString={row.nextFollowupAt} /> : '-',
      sortable: true
    },
                                   {
      key: 'createdAt',
      header: 'Created At',
      render: (row: { createdAt?: string }) => 
        row.createdAt ? <FormattedDateTime isoString={row.createdAt} /> : '-',
      sortable: true
    },
                                {
                                    key: 'action',
                                    header: 'Action',
                                    sortable: false,
                                    render: (r) => (
                                        <div className="flex justify-center">
                                            <button
                                                className="p-2 rounded-full hover:bg-cloud-200 dark:hover:bg-midnight-700 transition"
                                                title="View Lead"
                                                onClick={() => navigate(`/leads/${r.id}`)}
                                            >
                                                <Eye className="w-5 h-5 text-sky-500" />
                                            </button>
                                        </div>
                                    ),
                                },
                            ]}
                            filterKeys={['uniqueNumber', 'companyName', 'contactPerson', 'salesman.name', 'email', 'mobile']}
                            initialSort={{ key: 'createdAt', dir: 'DESC' }}
                            searchPlaceholder="Search leads..."
                            filterOptions={filterOptions}
                            appliedFilters={appliedFilters}
                            onApplyFilters={setAppliedFilters}
                        />
                    )}
                </main>
            </div>
        </div>
    );
};

export default Leads;
