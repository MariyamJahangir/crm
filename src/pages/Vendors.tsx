// src/pages/Vendors.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { vendorService, Vendor, VendorCategory } from '../services/vendorService';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';

const Vendors: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for search and filtering
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // State for selection and bulk actions
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedIds = useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected]);
  
  const loadVendors = useCallback(async (query?: { search?: string; category?: string }) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await vendorService.list(token, query);
      setVendors(res.vendors);
    } catch (err: any) {
      setError(err?.data?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { 
    loadVendors({ search, category: categoryFilter });
  }, [loadVendors, search, categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadVendors({ search, category: categoryFilter });
  };
  
  const onBulkDelete = async () => {
    if (!token || selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await vendorService.bulkDelete(token, selectedIds);
      setSelected({});
      setConfirmOpen(false);
      await loadVendors({ search, category: categoryFilter });
    } catch (err: any) {
      setError(err?.data?.message || "Failed to delete vendors.");
    } finally { 
      setDeleting(false); 
    }
  };

  const columns = useMemo(() => [
      { 
        key: 'sel', header: '', width: '40px', sortable: false, 
        render: (r: Vendor) => (
          <input type="checkbox" className="h-4 w-4" checked={!!selected[r.id]} onChange={() => setSelected(p => ({...p, [r.id]: !p[r.id]}))} />
      )},
      { 
        key: 'vendorName', header: 'Vendor', 
        render: (r: Vendor) => (
          <div className="font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => navigate(`/vendors/${r.id}/edit`)}>
            {r.vendorName}
          </div>
      )},
      { key: 'category', header: 'Category' },
      { key: 'status', header: 'Status', render: (r: Vendor) => <span className={`px-2 py-1 text-xs rounded-full font-medium ${r.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{r.status}</span>},
      { key: 'assignedMember', header: 'Assigned To', render: (r: Vendor) => r.assignedMember?.name || '-' },
      { key: 'contacts', header: 'Contacts', render: (r: Vendor) => r.contacts.length },
  ], [selected, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-0 sm:pl-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Vendors</h1>
              <p className="text-gray-600">Manage all your company's vendors and their contacts.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" disabled={selectedIds.length === 0} onClick={() => setConfirmOpen(true)}>
                Delete ({selectedIds.length})
              </Button>
              <Button variant="primary" onClick={() => navigate('/vendors/new')}>
                Create Vendor
              </Button>
            </div>
          </div>
          <form onSubmit={handleSearch} className="mb-4 flex gap-2">
            <input className="flex-1 border rounded-lg px-3 py-2" placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} />
            
            <select
              className="border rounded-lg px-3 py-2 bg-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {(['Manufacturer', 'Distributor', 'ServiceProvider', 'Other'] as VendorCategory[]).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <Button type="submit">Search</Button>
            <Button type="button" variant="secondary" onClick={() => { setSearch(''); setCategoryFilter(''); }}>Reset</Button>
          </form>
          {loading && <div className="text-center p-4">Loading vendors...</div>}
          {error && <div className="text-center p-4 text-red-600 bg-red-100 rounded-lg">{error}</div>}
          {!loading && !error && (
            <div className="bg-white border rounded shadow-sm">
                <DataTable rows={vendors} columns={columns} initialSort={{key: 'vendorName', dir: 'ASC'}} />
            </div>
          )}
        </main>
      </div>
      <ConfirmDialog 
        open={confirmOpen} 
        title="Delete Vendors" 
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected vendor(s)?`} 
        confirmText={deleting ? 'Deleting...' : 'Confirm Delete'} 
        onConfirm={onBulkDelete} 
        onCancel={() => setConfirmOpen(false)} 
      />
    </div>
  );
};

export default Vendors;
