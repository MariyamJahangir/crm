// src/pages/Contacts.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, ContactRow } from '../services/contactsService';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';

const Contacts: React.FC = () => {
  const { token } = useAuth();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
              <p className="text-gray-600">All customer contacts in one place.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                disabled={selectedIds.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                Delete Selected ({selectedIds.length})
              </Button>
            </div>
          </div>

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
            {/* Optional custom header with select-all could go here */}
            <div className="hidden sm:block">
              <DataTable
                rows={rows}
                columns={[
                  { key: 'sel', header: '', width: '40px', sortable: false, render: (r: ContactRow) => (
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!selected[r.id]}
                      onChange={() => toggle(r.id)}
                    />
                  )},
                  { key: 'name', header: 'Name' },
                  { key: 'designation', header: 'Designation' },
                  { key: 'department', header: 'Department' },
                  { key: 'email', header: 'Email' },
                  { key: 'mobile', header: 'Mobile' },
                  { key: 'fax', header: 'Fax' },
                  { key: 'social', header: 'Social' },
                  { key: 'customer', header: 'Company', render: (r: ContactRow) => r.customer?.companyName || '-' },
                  { key: 'industry', header: 'Industry', render: (r: ContactRow) => r.customer?.industry || '-' },
                  { key: 'category', header: 'Category', render: (r: ContactRow) => r.customer?.category || '-' },
                ]}
                filterKeys={['name','designation','department','email','mobile','fax','social','customer.companyName','industry','category']}
                initialSort={{ key: 'createdAt', dir: 'DESC' }}
                searchPlaceholder="Filter contacts..."
              />
            </div>

            {/* Simple mobile list (fallback) */}
            <div className="sm:hidden divide-y">
              {rows.map(r => (
                <div key={r.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-sm text-gray-600">{r.designation || '-'} · {r.department || '-'}</div>
                    </div>
                    <input type="checkbox" className="h-4 w-4 mt-1" checked={!!selected[r.id]} onChange={() => toggle(r.id)} />
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{r.customer?.companyName || '-'}</div>
                  <div className="mt-1 text-sm text-gray-600">{r.email || '-'} · {r.mobile || '-'}</div>
                  {r.social && <div className="mt-1 text-sm text-gray-600 truncate">{r.social}</div>}
                </div>
              ))}
              {rows.length === 0 && <div className="p-3 text-gray-600">No contacts found.</div>}
            </div>
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
    </div>
  );
};

export default Contacts;
