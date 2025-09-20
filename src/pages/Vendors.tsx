// src/pages/Vendors.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { vendorService, Vendor, VendorCategory } from '../services/vendorService';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';

const Vendors: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  const load = async (query?: { search?: string; category?: string }) => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await vendorService.list(token, query);
      setRows(res.vendors);
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ search, category: categoryFilter });
  }, [token]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load({ search, category: categoryFilter });
  };

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await vendorService.bulkDelete(token!, selectedIds);
      await load({ search, category: categoryFilter });
      setSelected({});
      setConfirmOpen(false);
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen  z-10 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-h-screen">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-ivory-200">
                Vendors
              </h1>
              <p className="text-gray-600 dark:text-midnight-400">
                Manage all your company's vendors and their contacts.
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
                onClick={() => navigate('/vendors/new')}
                className="flex items-center px-4 py-2 bg-cloud-200   text-midnight-700  hover:bg-blue-300 dark:hover:bg-midnight-600/70 shadow-md rounded-xl transition"
              >
                <Plus size={18} className="mr-2" />
                Add Vendor
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          {/* <form onSubmit={onSearch} className="mb-4 flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 bg-cloud-50/30 dark:bg-midnight-900/30 text-midnight-700 dark:text-ivory-300 placeholder-gray-500"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="border rounded-lg px-3 py-2 bg-cloud-50/30 dark:bg-midnight-900/30 text-midnight-700 dark:text-ivory-300"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {(['Manufacturer', 'Distributor', 'ServiceProvider', 'Other'] as VendorCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button type="submit">Search</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setCategoryFilter('');
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
                  render: (r: Vendor) => (
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!selected[r.id]}
                      onChange={() => toggle(r.id)}
                    />
                  ),
                },
                {
                  key: 'vendorName',
                  header: 'Vendor',
                  render: (r: Vendor) => (
                    <div
                      className="font-medium text-blue-600 hover:underline cursor-pointer"
                      onClick={() => navigate(`/vendors/${r.id}/edit`)}
                    >
                      {r.vendorName}
                    </div>
                  ),
                },
                { key: 'category', header: 'Category' },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r: Vendor) => (
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${r.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {r.status}
                    </span>
                  ),
                },
                {
                  key: 'assignedMember',
                  header: 'Assigned To',
                  render: (r: Vendor) => r.assignedMember?.name || '-',
                },
                { key: 'contacts', header: 'Contacts', render: (r: Vendor) => r.contacts.length },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (r: Vendor) => (
                    <div className="hidden sm:inline-flex items-center justify-center 
                                  w-8 h-8 rounded-full
                                  bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md 
                                  hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                                  shadow-md transition"
                                onClick={() => navigate(`/vendors/${r.id}/edit`)}
                              >
                                <Pencil className="w-4 h-4 text-sky-500" />
                              </div>
                  ),
                },

              ]}
              filterKeys={['vendorName', 'category', 'status', 'assignedMember.name']}
              initialSort={{ key: 'vendorName', dir: 'ASC' }}
              searchPlaceholder="Filter vendors..."
              className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-3"
            />
          )}
        </main>
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete Vendors"
        message={`Are you sure you want to delete ${selectedIds.length} selected vendor(s)?`}
        confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
        cancelText="Cancel"
        onConfirm={onBulkDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default Vendors;
