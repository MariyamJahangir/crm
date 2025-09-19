// import React, { useEffect, useState, useMemo } from 'react';
// import Sidebar from '../components/Sidebar';
// import Button from '../components/Button';
// import { useAuth } from '../contexts/AuthContext';
// import { customerService, Customer } from '../services/customerService';
// import { useNavigate } from 'react-router-dom';
// import ConfirmDialog from '../components/ConfirmDialog';
// import DataTable from '../components/DataTable';
// import FilterDropdown, { Filter } from '../components/FilterDropdown';
// // --- CORRECTED IMPORT ---
// import FormattedDateTime from '../components/FormattedDateTime'; 
// // --- END CORRECTION ---

// const Customers: React.FC = () => {
//   const { token, user } = useAuth();
//   const isAdmin = user?.type === 'ADMIN';
//   const navigate = useNavigate();

//   const [items, setItems] = useState<Customer[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState('');
//   const [error, setError] = useState<string | null>(null);

//   const [confirmOpen, setConfirmOpen] = useState(false);
//   const [targetId, setTargetId] = useState<string | null>(null);
//   const [deleting, setDeleting] = useState(false);

//   const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

//   const load = async () => {
//     if (!token) return;
//     setError(null);
//     setLoading(true);
//     try {
//       const res = await customerService.list(token);
//       setItems(res.customers);
//     } catch (e: any) {
//       setError(e?.data?.message || 'Failed to load customers');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     load();
//   }, [token]);

//   const filterOptions = useMemo(() => ({
//     Industry: [...new Set(items.map(item => item.industry).filter(Boolean))],
//     Category: [...new Set(items.map(item => item.category).filter(Boolean))],
//     Salesman: [...new Set(items.map(item => item.salesman?.name).filter(Boolean))],
//   }), [items]);

//   const filteredItems = useMemo(() => {
//     return items.filter(item => {
//       const searchLower = search.toLowerCase();
//       const matchesSearch = !searchLower || (
//         item.companyName.toLowerCase().includes(searchLower) ||
//         (item.email && item.email.toLowerCase().includes(searchLower)) ||
//         (item.vatNo && item.vatNo.toLowerCase().includes(searchLower)) ||
//         (item.address && item.address.toLowerCase().includes(searchLower))
//       );

//       const matchesFilters = appliedFilters.every(filter => {
//         if (filter.values.length === 0) return true;
        
//         switch (filter.type) {
//           case 'Industry':
//             return item.industry && filter.values.includes(item.industry);
//           case 'Category':
//             return item.category && filter.values.includes(item.category);
//           case 'Salesman':
//             return item.salesman && filter.values.includes(item.salesman.name);
//           default:
//             return true;
//         }
//       });

//       return matchesSearch && matchesFilters;
//     });
//   }, [items, search, appliedFilters]);

//   const onSearch = (e: React.FormEvent) => e.preventDefault();
//   const askDelete = (id: string) => { setTargetId(id); setConfirmOpen(true); };
//   const onCancelDelete = () => { setConfirmOpen(false); setTargetId(null); };

//   const onConfirmDelete = async () => {
//     if (!targetId || !token) return;
//     setDeleting(true);
//     try {
//       await customerService.remove(targetId, token);
//       setItems(prev => prev.filter(c => c.id !== targetId));
//     } catch (e: any) {
//       console.error(e?.data?.message || 'Failed to delete customer');
//     } finally {
//       setDeleting(false);
//       setConfirmOpen(false);
//       setTargetId(null);
//     }
//   };

//   return (
//     <div className="min-h-screen">
//       <Sidebar />
//       <div className="pl-20">
//         <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
//           <div className="flex items-center justify-between mb-6">
//             <div>
//               <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
//               <p className="text-gray-600">Manage your customers and contacts.</p>
//             </div>
//             <Button onClick={() => navigate('/customers/create')}>Create Customer</Button>
//           </div>

//           <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-lg p-6">
//             <div className="flex justify-between items-start mb-4">
//               <FilterDropdown
//                 options={filterOptions}
//                 appliedFilters={appliedFilters}
//                 onApplyFilters={setAppliedFilters}
//               />
//               <form onSubmit={onSearch} className="flex gap-2">
//                 <input
//                   className="border rounded-lg px-3 py-2 shadow-sm"
//                   placeholder="Search..."
//                   value={search}
//                   onChange={e => setSearch(e.target.value)}
//                 />
//                 <Button type="submit">Search</Button>
//               </form>
//             </div>

//             {loading && <div>Loading...</div>}
//             {error && <div className="text-red-600">{error}</div>}

//             <DataTable
//               rows={filteredItems}
//               columns={[
//                 { key: 'companyName', header: 'Company' },
//                 { key: 'industry', header: 'Industry' },
//                 { key: 'category', header: 'Category' },
//                 { key: 'website', header: 'Website' },
//                 { key: 'email', header: 'Email' },
//                 { key: 'contactNumber', header: 'Contact' },
//                 { key: 'salesman', header: 'Salesman', render: r => r.salesman?.name || '-' },
//                 {
//                   key: 'createdAt',
//                   header: 'Created At',
//                   sortable: true,
//                   render: (row) => <FormattedDateTime isoString={row.createdAt} />
//                 },
//                 {
//                   key: 'action',
//                   header: 'Actions',
//                   sortable: false,
//                   render: r => {
//                     const canModify = isAdmin || String(user?.id) === String(r.salesman?.id);
//                     return canModify ? (
//                       <div className="flex gap-2">
//                         <Button variant="secondary" className="px-3 py-1" onClick={() => navigate(`/customers/${r.id}/edit`)}>Edit</Button>
//                         <Button variant="danger" className="px-3 py-1" onClick={() => askDelete(r.id)}>Delete</Button>
//                       </div>
//                     ) : (
//                       <Button variant="secondary" className="px-3 py-1" onClick={() => navigate(`/customers/${r.id}/edit`)} disabled>View</Button>
//                     );
//                   },
//                   width: '160px',
//                 },
//               ]}
//               initialSort={{ key: 'createdAt', dir: 'DESC' }}
//             />
//           </div>
//         </main>
//       </div>

//       <ConfirmDialog
//         open={confirmOpen}
//         title="Delete Customer"
//         message="Are you sure you want to delete this customer? This action cannot be undone."
//         confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
//         cancelText="Cancel"
//         onConfirm={onConfirmDelete}
//         onCancel={onCancelDelete}
//       />
//     </div>
//   );
// };

// export default Customers;
import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import {Pencil,Trash2 } from 'lucide-react'
import FilterDropdown, { Filter } from '../components/FilterDropdown'; // Import Filter type
import FormattedDateTime from '../components/FormattedDateTime.tsx';
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

  // A single state to hold all applied filters
  const [appliedFilters, setAppliedFilters] = useState<Filter[]>([]);

  // Function to load customer data from the service
  const load = async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await customerService.list(token);
      console.log(res.customers)
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

  // Dynamically generate options for the filter dropdown from the customer data
  const filterOptions = useMemo(() => ({
    Industry: [...new Set(items.map(item => item.industry).filter(Boolean))],
    Category: [...new Set(items.map(item => item.category).filter(Boolean))],
    Salesman: [...new Set(items.map(item => item.salesman?.name).filter(Boolean))],
  }), [items]);

  // Memoized logic to filter items based on search term and applied dropdown filters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // First, check if the item matches the search term
      const searchLower = search.toLowerCase();
      const matchesSearch = !searchLower || (
        item.companyName.toLowerCase().includes(searchLower) ||
        (item.email && item.email.toLowerCase().includes(searchLower)) ||
        (item.vatNo && item.vatNo.toLowerCase().includes(searchLower)) ||
        (item.address && item.address.toLowerCase().includes(searchLower))
      );

      // Then, check if the item matches all applied filters
      const matchesFilters = appliedFilters.every(filter => {
        if (filter.values.length === 0) return true;
        
        switch (filter.type) {
          case 'Industry':
            return item.industry && filter.values.includes(item.industry);
          case 'Category':
            return item.category && filter.values.includes(item.category);
          case 'Salesman':
            return item.salesman && filter.values.includes(item.salesman.name);
          default:
            return true;
        }
      });

      return matchesSearch && matchesFilters;
    });
  }, [items, search, appliedFilters]);

  // Handlers for search and delete actions
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
