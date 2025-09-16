// import React, { useEffect, useMemo, useState } from 'react';

// type SortDir = 'ASC' | 'DESC';

// type Column<Row> = {
//   key: string;
//   header: string;
//   width?: string;
//   sortable?: boolean;
//   render?: (row: Row) => React.ReactNode;
// };

// type InitialSort = {
//   key: string;
//   dir: SortDir;
// };

// type Props<Row extends Record<string, any>> = {
//   rows: Row[];
//   columns: Column<Row>[];
//   filterKeys?: string[];
//   initialSort?: InitialSort;
//   className?: string;
//   pageSizeOptions?: number[];
//   defaultPageSize?: number;
// };

// // Utility to get a nested value from an object using a dot-notation path
// function getValueByPath(obj: any, path: string): any {
//   if (!obj || !path) return undefined;
//   const parts = path.split('.');
//   let cur = obj;
//   for (const p of parts) {
//     if (cur == null) return undefined;
//     cur = cur[p];
//   }
//   return cur;
// }

// // --- HIGHLIGHTED CHANGE: Corrected Sorting Logic ---
// // The function was updated to check for dates *before* checking for numbers.
// // This prevents ISO date strings (like "2025-...") from being incorrectly
// // treated as simple numbers, thus fixing chronological sorting.
// function compareVals(a: any, b: any) {
//   // First, attempt to parse values as dates.
//   const da = Date.parse(a);
//   const db = Date.parse(b);

//   if (!Number.isNaN(da) && !Number.isNaN(db)) {
//     return da - db; // Compare as numerical timestamps
//   }

//   // If they are not dates, attempt to parse them as numbers.
//   const pa = parseFloat(a);
//   const pb = parseFloat(b);

//   if (!Number.isNaN(pa) && !Number.isNaN(pb)) {
//     return pa - pb;
//   }

//   // As a fallback, perform a case-insensitive string comparison.
//   const sa = (a ?? '').toString().toLowerCase();
//   const sb = (b ?? '').toString().toLowerCase();
//   return sa.localeCompare(sb);
// }
// // --- END HIGHLIGHT ---

// const DataTable = <Row extends Record<string, any>>({
//   rows,
//   columns,
//   filterKeys = [],
//   initialSort,
//   className = '',
//   pageSizeOptions = [10, 20, 50, 100],
//   defaultPageSize = 20,
// }: Props<Row>) => {
//   const [q, setQ] = useState('');
//   const [sortKey, setSortKey] = useState<string | null>(initialSort?.key || null);
//   const [sortDir, setSortDir] = useState<SortDir>(initialSort?.dir || 'ASC');
//   const [pageSize, setPageSize] = useState<number>(defaultPageSize);
//   const [page, setPage] = useState<number>(1);

//   useEffect(() => {
//     setPage(1);
//   }, [q, pageSize, rows]);

//   const onHeaderClick = (col: Column<Row>) => {
//     if (col.sortable === false) return;
//     const key = col.key;
//     if (sortKey !== key) {
//       setSortKey(key);
//       setSortDir('ASC');
//     } else {
//       setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
//     }
//   };

//   const filtered = useMemo(() => {
//     const query = q.trim().toLowerCase();
//     if (!query) return rows;
//     const keys = filterKeys.length ? filterKeys : columns.map((c) => c.key);
//     return rows.filter((r) =>
//       keys.some((k) => {
//         const v = getValueByPath(r, k);
//         return v != null && String(v).toLowerCase().includes(query);
//       })
//     );
//   }, [rows, q, filterKeys, columns]);

//   const sorted = useMemo(() => {
//     if (!sortKey) return filtered;
//     const arr = [...filtered];
//     arr.sort((a, b) => {
//       const va = getValueByPath(a, sortKey);
//       const vb = getValueByPath(b, sortKey);
//       const cmp = compareVals(va, vb);
//       return sortDir === 'ASC' ? cmp : -cmp;
//     });
//     return arr;
//   }, [filtered, sortKey, sortDir, columns]);

//   const total = sorted.length;
//   const pageCount = Math.max(1, Math.ceil(total / pageSize));
//   const pageSafe = Math.min(page, pageCount);
//   const startIdx = (pageSafe - 1) * pageSize;
//   const view = sorted.slice(startIdx, startIdx + pageSize);

//   // --- HIGHLIGHTED CHANGE: Updated Truncation Logic ---
//   // The character limit for truncation was changed from 25 to 20
//   // as per your request.
//   const renderCellContent = (value: any) => {
//     const text = String(value);
//     if (text.length > 20) {
//       return (
//         <span title={text}>
//           {text.substring(0, 20)}...
//         </span>
//       );
//     }
//     return text;
//   };
//   // --- END HIGHLIGHT ---

//   return (
//     <div className={`w-full ${className}`}>
//       <div className="w-full overflow-x-auto border rounded">
//         <table className="min-w-full text-sm">
//           <thead className="bg-gray-50 border-b">
//             <tr>
//               {columns.map((c) => {
//                 const isSorted = sortKey === c.key;
//                 const canSort = c.sortable !== false;
//                 return (
//                   <th
//                     key={c.key}
//                     style={{ width: c.width }}
//                     className={`text-left px-3 py-2 font-medium text-gray-700 ${canSort ? 'cursor-pointer select-none' : ''}`}
//                     onClick={() => canSort && onHeaderClick(c)}
//                   >
//                     <div className="inline-flex items-center gap-1">
//                       <span>{c.header}</span>
//                       {canSort && (
//                         <span className="text-xs text-gray-400">
//                           {isSorted ? (sortDir === 'ASC' ? '▲' : '▼') : '⇵'}
//                         </span>
//                       )}
//                     </div>
//                   </th>
//                 );
//               })}
//             </tr>
//           </thead>
//           <tbody>
//             {view.length === 0 ? (
//               <tr>
//                 <td className="px-3 py-3 text-gray-600" colSpan={columns.length}>
//                   No data.
//                 </td>
//               </tr>
//             ) : (
//               view.map((r, idx) => (
//                 <tr key={idx} className="border-b hover:bg-gray-50">
//                   {columns.map((c) => (
//                     <td key={c.key} className="px-3 py-2 align-top">
//                       {c.render ? c.render(r) : (() => {
//                         const v = getValueByPath(r, c.key);
//                         if (v != null && v !== '') {
//                           return renderCellContent(v);
//                         }
//                         return '-';
//                       })()}
//                     </td>
//                   ))}
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>

//       <div className="flex items-center justify-between mt-3">
//         <div className="text-sm text-gray-600">
//           Page {pageSafe} of {pageCount}
//         </div>
//         <div className="flex items-center gap-2">
//           <button
//             className="px-2 py-1 border rounded disabled:opacity-50"
//             onClick={() => setPage(1)}
//             disabled={pageSafe <= 1}
//           >
//             « First
//           </button>
//           <button
//             className="px-2 py-1 border rounded disabled:opacity-50"
//             onClick={() => setPage((p) => Math.max(1, p - 1))}
//             disabled={pageSafe <= 1}
//           >
//             ‹ Prev
//           </button>
//           <button
//             className="px-2 py-1 border rounded disabled:opacity-50"
//             onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
//             disabled={pageSafe >= pageCount}
//           >
//             Next ›
//           </button>
//           <button
//             className="px-2 py-1 border rounded disabled:opacity-50"
//             onClick={() => setPage(pageCount)}
//             disabled={pageSafe >= pageCount}
//           >
//             Last »
//           </button>
//           <div className="flex items-center gap-2">
//             <label className="text-sm text-gray-700">Rows per page</label>
//             <select
//               className="border rounded px-2 py-1 bg-white"
//               value={pageSize}
//               onChange={(e) => setPageSize(Number(e.target.value))}
//             >
//               {pageSizeOptions.map((n) => (
//                 <option key={n} value={n}>{n}</option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default DataTable;
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
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-20">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
              <p className="text-gray-600">Manage your customers and contacts.</p>
            </div>
            <Button onClick={() => navigate('/customers/create')}>Create Customer</Button>
          </div>

          <div className="bg-white/30 backdrop-blur-md rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <FilterDropdown
                options={filterOptions}
                appliedFilters={appliedFilters}
                onApplyFilters={setAppliedFilters}
              />
              <form onSubmit={onSearch} className="flex gap-2">
                <input
                  className="border rounded-lg px-3 py-2 shadow-sm"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <Button type="submit">Search</Button>
              </form>
            </div>

            {loading && <div>Loading...</div>}
            {error && <div className="text-red-600">{error}</div>}

            <DataTable
              rows={filteredItems}
              columns={[
                { key: 'companyName', header: 'Company' },
                { key: 'industry', header: 'Industry' },
                { key: 'category', header: 'Category' },
                { key: 'website', header: 'Website' },
                { key: 'email', header: 'Email' },
                { key: 'contactNumber', header: 'Contact' },
                // --- HIGHLIGHTED CHANGE ---
                // The 'key' was changed from 'salesman' to 'salesman.name'.
                // This tells the DataTable to sort using the nested 'name'
                // property instead of the entire 'salesman' object.
                { key: 'salesman.name', header: 'Salesman', render: r => r.salesman?.name || '-' },
                // --- END HIGHLIGHT ---
                {
                  key: 'createdAt',
                  header: 'Created At',
                  sortable: true,
                  render: (row) => <FormattedDateTime isoString={row.createdAt} />
                },
                {
                  key: 'action',
                  header: 'Actions',
                  sortable: false,
                  render: r => {
                    const canModify = isAdmin || String(user?.id) === String(r.salesman?.id);
                    return canModify ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" className="px-3 py-1" onClick={() => navigate(`/customers/${r.id}/edit`)}>Edit</Button>
                        <Button variant="danger" className="px-3 py-1" onClick={() => askDelete(r.id)}>Delete</Button>
                      </div>
                    ) : (
                      <Button variant="secondary" className="px-3 py-1" onClick={() => navigate(`/customers/${r.id}/edit`)} disabled>View</Button>
                    );
                  },
                  width: '160px',
                },
              ]}
              initialSort={{ key: 'createdAt', dir: 'DESC' }}
            />
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
