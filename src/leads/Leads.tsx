import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import FilterDropdown, { Filter } from '../components/FilterDropdown';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';

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

                    <div className="mb-4">
                        <FilterDropdown
                            options={filterOptions}
                            appliedFilters={appliedFilters}
                            onApplyFilters={setAppliedFilters}
                        />
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
                                { key: 'stage', header: 'Stage' },
                                 { key: 'mobile', header: 'Mobile' },
                                  { key: 'email', header: 'Email' },
                                   { key: 'forecastCategory', header: 'Forecast' },
                                    { key: 'createdAt', header: 'Created At' },
                                     { key: 'source', header: 'Source' },
                                { key: 'salesman', header: 'Salesman', render: (r) => r.salesman?.name || '-' },
                                { key: 'nextFollowupAt', header: 'Next Followup', render: (r) => r.nextFollowupAt ? new Date(r.nextFollowupAt).toLocaleString() : '-' },
                                { key: 'action', header: 'Action', sortable: false, render: (r) => (
                                    <Button variant="secondary" onClick={() => navigate(`/leads/${r.id}`)}>Open</Button>
                                )},
                            ]}
                            filterKeys={['uniqueNumber','companyName','contactPerson','email','mobile']}
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
