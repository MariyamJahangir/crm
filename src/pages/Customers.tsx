import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import FilterDropdown, { Filter } from '../components/FilterDropdown';
import FormattedDateTime from '../components/FormattedDateTime';
import { Pencil, Trash2 } from "lucide-react"; // ✅ Added icons

const Customers: React.FC = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const navigate = useNavigate();

  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

  const load = async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await customerService.list(token);
      console.log("DEBUG Customers:", res.customers);
      setItems(res.customers);
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const filterOptions = useMemo(() => ({
    Industry: [...new Set(items.map(item => item.industry).filter(Boolean))],
    Category: [...new Set(items.map(item => item.category).filter(Boolean))],
    Salesman: [...new Set(items.map(item => item.salesman?.name).filter(Boolean))],
  }), [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const searchLower = search.toLowerCase();
      const matchesSearch = !searchLower || (
        item.companyName.toLowerCase().includes(searchLower) ||
        (item.email && item.email.toLowerCase().includes(searchLower)) ||
        (item.vatNo && item.vatNo.toLowerCase().includes(searchLower)) ||
        (item.address && item.address.toLowerCase().includes(searchLower))
      );

      const matchesFilters = appliedFilters.every(filter => {
        if (filter.values.length === 0) return true;
        switch (filter.type) {
          case 'Industry': return item.industry && filter.values.includes(item.industry);
          case 'Category': return item.category && filter.values.includes(item.category);
          case 'Salesman': return item.salesman && filter.values.includes(item.salesman.name);
          default: return true;
        }
      });

      return matchesSearch && matchesFilters;
    });
  }, [items, search, appliedFilters]);

  const onSearch = (e: React.FormEvent) => e.preventDefault();
  const askDelete = (id: string) => { setTargetId(id); setConfirmOpen(true); };
  const onCancelDelete = () => { setConfirmOpen(false); setTargetId(null); };

  const onConfirmDelete = async () => {
    if (!targetId || !token) return;
    setDeleting(true);
    try {
      await customerService.remove(targetId, token);
      setItems(prev => prev.filter(c => c.id !== targetId));
    } catch (e: any) {
      console.error(e?.data?.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setTargetId(null);
    }
  };

  return (
  <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
    <Sidebar />
    <div className="flex-1 overflow-y-auto min-h-screen">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-ivory-200">Customers</h1>
            <p className="text-gray-600 dark:text-midnight-400">
              Manage your customers and contacts.
            </p>
          </div>
          <Button
            className="flex items-center px-4 py-2 bg-cloud-200/50 dark:bg-midnight-700/50 
                       backdrop-blur-md text-midnight-700 dark:text-ivory-300 
                       hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                       shadow-md rounded-xl transition"
            onClick={() => navigate('/customers/create')}
          >
            Create Customer
          </Button>
        </div>

        {/* Loading & Errors */}
        {loading && <div className="text-midnight-700 dark:text-ivory-300">Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}

        {/* Table */}
        {!loading && !error && (
          <DataTable
            rows={filteredItems}
            columns={[
              { key: 'companyName', header: 'Company' },
              { key: 'industry', header: 'Industry' },
              { key: 'category', header: 'Category' },
              { key: 'website', header: 'Website' },
              { key: 'email', header: 'Email' },
              { key: 'contactNumber', header: 'Contact' },
              { key: 'salesman', header: 'Salesman', render: (r) => r.salesman?.name || '-' },
              {
                key: 'createdAt',
                header: 'Created',
                render: (row) => <FormattedDateTime isoString={row.createdAt} />,
              },
              {
                key: 'action',
                header: 'Actions',
                render: (r) => (
                  <div className="flex gap-2">
                    <Pencil
                      className="w-5 h-5 text-sky-500 cursor-pointer"
                      onClick={() => navigate(`/customers/${r.id}/edit`)}
                    />
                    <Trash2
                      className="w-5 h-5 text-red-500 cursor-pointer"
                      onClick={() => askDelete(r.id)}
                    />
                  </div>
                ),
              },
            ]}
            initialSort={{ key: 'createdAt', dir: 'DESC' }}
            searchPlaceholder="Filter customers..."
            className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                       border border-cloud-300/30 dark:border-midnight-700/30 
                       rounded-2xl p-3"
          />
        )}
      </main>
    </div>

    {/* Delete Confirmation */}
    <ConfirmDialog
      open={confirmOpen}
      title="Delete Customer"
      message="Are you sure you want to delete this customer?"
      confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
      cancelText="Cancel"
      onConfirm={onConfirmDelete}
      onCancel={onCancelDelete}
    />
  </div>
);

};

export default Customers;

