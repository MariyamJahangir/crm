// src/pages/Contacts.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, ContactRow } from '../services/contactsService';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import AddContactModal from '../components/AddContactModal';

const Contacts: React.FC = () => {
  const { token } = useAuth();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  const handleAddSuccess = () => {
    setAddModalOpen(false);
    load(search);
  };

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

  useEffect(() => {
    load();
  }, [token]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(search);
  };

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await contactsService.bulkDelete(selectedIds, token);
      await load(search);
      setSelected({});
      setConfirmOpen(false);
    } catch {
      /* ignore */
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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-ivory-200">
                Contacts
              </h1>
              <p className="text-gray-600 dark:text-midnight-400">
                All customer contacts in one place.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={selectedIds.length === 0}
                onClick={() => setConfirmOpen(true)}
                className="flex items-center px-4 py-2 bg-red-200/50 dark:bg-red-800/50 backdrop-blur-md text-red-800 dark:text-ivory-300 hover:bg-red-300/70 dark:hover:bg-red-700/70 shadow-md rounded-xl transition"
              >
                <Trash2 size={18} className="mr-2" />
                Delete Selected ({selectedIds.length})
              </Button>
              <Button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center px-4 py-2 bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-xl transition"
              >
                <Plus size={18} className="mr-2" />
                Add Contact
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          {/* <form onSubmit={onSearch} className="mb-4 flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 bg-cloud-50/30 dark:bg-midnight-900/30 text-midnight-700 dark:text-ivory-300 placeholder-gray-500"
              placeholder="Search name, department, email, mobile, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit">Search</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch('');
                load();
              }}
            >
              Reset
            </Button>
          </form> */}

          {/* Status */}
          {loading && (
            <div className="text-midnight-700 dark:text-ivory-300">Loading...</div>
          )}
          {error && <div className="text-red-600">{error}</div>}

          {/* DataTable */}
          {!loading && !error && (
            <DataTable
              rows={rows}
              columns={[
                {
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
                  ),
                },
                { key: 'name', header: 'Name' },
                { key: 'designation', header: 'Designation' },
                { key: 'department', header: 'Department' },
                { key: 'email', header: 'Email' },
                { key: 'mobile', header: 'Mobile' },
                { key: 'fax', header: 'Fax' },
                { key: 'social', header: 'Social' },
                {
                  key: 'customer',
                  header: 'Company',
                  render: (r: ContactRow) => r.customer?.companyName || '-',
                },
                {
                  key: 'industry',
                  header: 'Industry',
                  render: (r: ContactRow) => r.customer?.industry || '-',
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (r: ContactRow) => r.customer?.category || '-',
                },
              ]}
              filterKeys={[
                'name',
                'designation',
                'department',
                'email',
                'mobile',
                'fax',
                'social',
                'customer.companyName',
                'industry',
                'category',
              ]}
              initialSort={{ key: 'createdAt', dir: 'DESC' }}
              searchPlaceholder="Filter contacts..."
              className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-3"
            />
          )}
        </main>
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete Contacts"
        message={`Are you sure you want to delete ${selectedIds.length} selected contact(s)?`}
        confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
        cancelText="Cancel"
        onConfirm={onBulkDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Add Contact */}
      <AddContactModal
        open={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
};

export default Contacts;
