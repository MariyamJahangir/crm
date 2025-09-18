import React, { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react'; // Icon for editing
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, ContactRow } from '../services/contactsService';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import AddContactModal from '../components/AddContactModal';
import EditContactModal from '../components/EditContactModal'; // --- NEW ---

const Contacts: React.FC = () => {
  const { token } = useAuth();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);

  // --- NEW --- States for edit modal
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedIds = useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected]);

  const load = async (q?: string) => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await contactsService.list(token, q);
      setRows(res.contacts);
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddSuccess = () => {
    setAddModalOpen(false);
    load(search);
  };
  
  // --- NEW ---
  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditingContactId(null);
    load(search);
  };
  
  // --- NEW ---
  const openEditModal = (contactId: string) => {
    setEditingContactId(contactId);
    setEditModalOpen(true);
  };

  useEffect(() => { load(); }, [token]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(search);
  };

  const toggle = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await contactsService.bulkDelete(selectedIds, token);
      await load(search);
      setSelected({});
      setConfirmOpen(false);
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header remains the same */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
              <p className="text-gray-600">All customer contacts in one place.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" disabled={selectedIds.length === 0} onClick={() => setConfirmOpen(true)}>
                Delete Selected ({selectedIds.length})
              </Button>
              <Button variant="primary" onClick={() => setAddModalOpen(true)}>
                Add Contact
              </Button>
            </div>
          </div>

          {/* Search form remains the same */}
          <form onSubmit={onSearch} className="mb-4 flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2"
              placeholder="Search name, department, email, mobile, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit">Search</Button>
            <Button type="button" variant="secondary" onClick={() => { setSearch(''); load(); }}>
              Reset
            </Button>
          </form>

          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          <div className="bg-white border rounded shadow-sm">
            <div className="hidden sm:block">
              <DataTable
                rows={rows}
                columns={[
                  { key: 'sel', header: '', width: '40px', sortable: false, render: (r: ContactRow) => (
                    <input type="checkbox" className="h-4 w-4" checked={!!selected[r.id]} onChange={() => toggle(r.id)} />
                  )},
                  { key: 'name', header: 'Name' },
                  { key: 'designation', header: 'Designation' },
                  { key: 'department', header: 'Department' },
                  { key: 'email', header: 'Email' },
                  { key: 'mobile', header: 'Mobile' },
                  { key: 'customer', header: 'Company', render: (r: ContactRow) => r.customer?.companyName || '-' },
                  // --- NEW --- Edit Action Column
                  { key: 'actions', header: 'Actions', width: '80px', sortable: false, render: (r: ContactRow) => (
                    <button onClick={() => openEditModal(r.id)} className="text-gray-500 hover:text-indigo-600">
                      <Pencil size={18} />
                    </button>
                  )},
                ]}
                filterKeys={['name','designation','department','email','mobile','customer.companyName']}
                initialSort={{ key: 'createdAt', dir: 'DESC' }}
                searchPlaceholder="Filter contacts..."
              />
            </div>
            {/* Mobile list needs update too if used */}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Contacts"
        message={`Are you sure you want to delete ${selectedIds.length} selected contact(s)?`}
        confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
        cancelText="Cancel"
        onConfirm={onBulkDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      
      <AddContactModal
        open={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* --- NEW --- Render the Edit Modal */}
      <EditContactModal
        open={isEditModalOpen}
        contactId={editingContactId}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default Contacts;
