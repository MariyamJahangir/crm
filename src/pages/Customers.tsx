import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';

const Customers: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // delete dialog
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

      {/* --- CHANGE: Added pl-64 to offset for the sidebar width --- */}
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

          <div className="grid gap-4">
            {items.map((c) => (
              <div key={c.id} className="bg-white p-4 rounded border shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-medium">{c.companyName}</div>
                    <div className="text-gray-600 text-sm">
                      {c.email || '-'} • {c.contactNumber || '-'} • VAT: {c.vatNo || '-'}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      Salesman: {c.salesman?.name || '-'}
                    </div>
                    {c.address && <div className="text-gray-600 text-sm mt-1">{c.address}</div>}
                    <div className="mt-2 text-sm text-gray-700">
                      Contacts: {c.contacts.length}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-3 py-1" onClick={() => navigate(`/customers/${c.id}/edit`)}>
                      Edit
                    </Button>
                    <Button variant="danger" className="px-3 py-1" onClick={() => askDelete(c.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && !error && items.length === 0 && (
              <div className="text-gray-600">No customers found.</div>
            )}
          </div>
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