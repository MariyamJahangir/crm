// pages/Customers.tsx
import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';

const Customers: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async (q?: string) => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await customerService.list(token, q as any);
      setItems(res.customers);
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]); // [1]

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(search);
  };

  const askDelete = (id: string) => {
    setTargetId(id);
    setConfirmOpen(true);
  };
  const onCancelDelete = () => {
    setConfirmOpen(false);
    setTargetId(null);
  };
  const onConfirmDelete = async () => {
    if (!targetId) return;
    setDeleting(true);
    try {
      await customerService.remove(targetId, token);
      setItems((prev) => prev.filter((c) => c.id !== targetId));
    } catch (e: any) {
      console.error(e?.data?.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setTargetId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <div className="pl-64">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
              <p className="text-gray-600">Manage your customers and contacts.</p>
            </div>
            <Button onClick={() => navigate('/customers/create')}>Create Customer</Button>
          </div>

          <form onSubmit={onSearch} className="mb-4 flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2"
              placeholder="Search company, email, VAT, address..."
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

          <DataTable
            rows={items}
            columns={[
              { key: 'companyName', header: 'Company' },
              { key: 'industry', header: 'Industry' },
              { key: 'category', header: 'Category' },
              { key: 'website', header: 'Website' },
              { key: 'email', header: 'Email' },
              { key: 'contactNumber', header: 'Contact' },
              { key: 'vatNo', header: 'VAT' },
              { key: 'salesman', header: 'Salesman', render: (r) => r.salesman?.name || '-' },
              { key: 'address', header: 'Address' },
              
              {
                key: 'contactedBy',
                header: 'Contacted By',
                width: '120px',
                render: (r: any) => Array.isArray(r.contactedByNames) ? r.contactedByNames : '---',
              },
              // Show count and the first contact's department (if any)
              {
                key: 'contacts',
                header: 'Contacts',
                width: '180px',
                render: (r) => {
                  const count = r.contacts?.length || 0;
                  const firstDept = r.contacts?.department || '';
                  return firstDept ? `${count} · ${firstDept}` : String(count);
                }
              },
              {
                key: 'action',
                header: 'Actions',
                sortable: false,
                render: (r) => (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-3 py-1" onClick={() => navigate(`/customers/${r.id}/edit`)}>Edit</Button>
                    <Button variant="danger" className="px-3 py-1" onClick={() => askDelete(r.id)}>Delete</Button>
                  </div>
                ),
                width: '160px'
              },
            ]}
            filterKeys={['companyName','industry','category','website','email','vatNo','address','salesman.name','contactNumber']}
            initialSort={{ key: 'createdAt', dir: 'DESC' }}
            searchPlaceholder="Filter customers..."
          />
        </main>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
        cancelText="Cancel"
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </div>
  );
};

export default Customers;
