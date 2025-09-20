import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, ContactRow } from '../services/contactsService';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import AddContactModal from '../components/AddContactModal';
import EditContactModal from '../components/EditContactModal';
import { Filter } from '../components/FilterDropdown'; // Make sure this path is correct

const Contacts: React.FC = () => {
    const { token, user } = useAuth();
    const isAdmin = user?.type === 'ADMIN';

    // State for the master (unfiltered) list and the displayed (filtered) list
    const [masterRows, setMasterRows] = useState<ContactRow[]>([]);
    const [rows, setRows] = useState<ContactRow[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

    // Modals and selection states
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

    // Initial data load
    const load = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await contactsService.list(token);
            setMasterRows(res.contacts);
            setRows(res.contacts);
        } catch (e: any) {
            setError(e?.data?.message || 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [token]);

    // Apply filters whenever the master list or filters change
    useEffect(() => {
        let filtered = [...masterRows];

        appliedFilters.forEach(filter => {
            if (filter.values.length > 0) {
                const key = filter.type;
                filtered = filtered.filter(contact => {
                    const value = 
                        key === 'Designation' ? contact.designation :
                        key === 'Department' ? contact.department :
                        key === 'Salesman' ? contact.customer?.salesman?.name :
                        null;
                    return value && filter.values.includes(value);
                });
            }
        });

        setRows(filtered);
    }, [appliedFilters, masterRows]);

    // Generate filter options from the master list
    const filterOptions = useMemo(() => ({
        Designation: [...new Set(masterRows.map(c => c.designation).filter(Boolean))],
        Department: [...new Set(masterRows.map(c => c.department).filter(Boolean))],
        ...(isAdmin && { Salesman: [...new Set(masterRows.map(c => c.customer?.salesman?.name).filter(Boolean))] }),
    }), [masterRows, isAdmin]);

    // Handlers for modals and actions
    const handleAddSuccess = () => { setAddModalOpen(false); load(); };
    const handleEditSuccess = () => { setEditModalOpen(false); setEditingContactId(null); load(); };
    const openEditModal = (contactId: string) => { setEditingContactId(contactId); setEditModalOpen(true); };
    const toggle = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

    const onBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setDeleting(true);
        try {
            await contactsService.bulkDelete(selectedIds, token);
            await load();
            setSelected({});
            setConfirmOpen(false);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-ivory-200">Contacts</h1>
                            <p className="text-gray-600 dark:text-midnight-400">All customer contacts in one place.</p>
                        </div>
                        <div className="flex gap-2">
                            {isAdmin && (
            <Button 
                variant="danger" 
                disabled={selectedIds.length === 0} 
                onClick={() => setConfirmOpen(true)}
            >
                <Trash2 size={18} className="mr-2" /> Delete ({selectedIds.length})
            </Button>
        )}
                            <Button onClick={() => setAddModalOpen(true)}>
                                <Plus size={18} className="mr-2" /> 
                            </Button>
                        </div>
                    </div>

                    {loading && <div className="text-midnight-700 dark:text-ivory-300">Loading...</div>}
                    {error && <div className="text-red-600">{error}</div>}

                    {!loading && !error && (
                        <DataTable
                            rows={rows}
                            columns={[
                                ...(isAdmin ? [{ 
        key: 'sel', 
        header: '', 
        width: '40px', 
        sortable: false, 
        render: (r: ContactRow) => (
            <input 
                type="checkbox" 
                className="h-4 w-4" 
                checked={!!selected[r.id]} 
                onChange={() => toggle(r.id)} 
            />
        )
    }] : []),
                                { key: 'name', header: 'Name' },
                                { key: 'designation', header: 'Designation' },
                                { key: 'department', header: 'Department' },
                                { key: 'email', header: 'Email' },
                                { key: 'mobile', header: 'Mobile' },
                                { key: 'customer.companyName', header: 'Company' },
                                { key: 'customer.salesman.name', header: 'Salesman' },
                                { key: 'actions', header: 'Actions', width: '80px', sortable: false, render: (r: ContactRow) => (
                                    <button onClick={() => openEditModal(r.id)} className="p-2 text-gray-500 hover:text-sky-500">
                                        <Pencil size={18} />
                                    </button>
                                )},
                            ]}
                            filterKeys={['name', 'designation', 'department', 'email', 'mobile', 'customer.companyName', 'customer.salesman.name']}
                            initialSort={{ key: 'name', dir: 'ASC' }}
                            searchPlaceholder="Search contacts..."
                            // Props to enable the filter dropdown
                            filterOptions={filterOptions}
                            appliedFilters={appliedFilters}
                            onApplyFilters={setAppliedFilters}
                        />
                    )}
                </main>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                title="Delete Contacts"
                message={`Delete ${selectedIds.length} selected contact(s)?`}
                onConfirm={onBulkDelete}
                onCancel={() => setConfirmOpen(false)}
            />
            <AddContactModal open={isAddModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={handleAddSuccess} />
            <EditContactModal open={isEditModalOpen} contactId={editingContactId} onClose={() => setEditModalOpen(false)} onSuccess={handleEditSuccess} />
        </div>
    );
};

export default Contacts;
