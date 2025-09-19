import React, { useEffect, useMemo, useState } from 'react';

type SortDir = 'ASC' | 'DESC';

type Column<Row> = {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (row: Row) => React.ReactNode;
};

type InitialSort = {
  key: string;
  dir: SortDir;
};

type Props<Row extends Record<string, any>> = {
  rows: Row[];
  columns: Column<Row>[];
  filterKeys?: string[];
  initialSort?: InitialSort;
  className?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
};

// Get nested value
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

// Sorting function (dates > numbers > strings)
function compareVals(a: any, b: any) {
  const da = Date.parse(a);
  const db = Date.parse(b);

  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;

  const pa = parseFloat(a);
  const pb = parseFloat(b);
  if (!Number.isNaN(pa) && !Number.isNaN(pb)) return pa - pb;

  const sa = (a ?? '').toString().toLowerCase();
  const sb = (b ?? '').toString().toLowerCase();
  return sa.localeCompare(sb);
}

const DataTable = <Row extends Record<string, any>>({
  rows,
  columns,
  filterKeys = [],
  initialSort,
  className = '',
  pageSizeOptions = [10, 20, 50, 100],
  defaultPageSize = 20,
}: Props<Row>) => {
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key || null);
  const [sortDir, setSortDir] = useState<SortDir>(initialSort?.dir || 'ASC');
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize, rows]);

  const onHeaderClick = (col: Column<Row>) => {
    if (col.sortable === false) return;
    const key = col.key;
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('ASC');
    } else {
      setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
    }
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    const keys = filterKeys.length ? filterKeys : columns.map((c) => c.key);
    return rows.filter((r) =>
      keys.some((k) => {
        const v = getValueByPath(r, k);
        return v != null && String(v).toLowerCase().includes(query);
      })
    );
  }, [rows, q, filterKeys, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = getValueByPath(a, sortKey);
      const vb = getValueByPath(b, sortKey);
      const cmp = compareVals(va, vb);
      return sortDir === 'ASC' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, columns]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const view = sorted.slice(startIdx, startIdx + pageSize);

  const renderCellContent = (value: any) => {
    const text = String(value);
    if (text.length > 20) {
      return <span title={text}>{text.substring(0, 20)}...</span>;
    }
    return text;
  };

  return (
    <div>
      {/* Search Input */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search..."
          className="w-full md:flex-1 border border-cloud-400/40 dark:border-midnight-600/40 rounded-xl px-4 py-2 bg-ivory-50/40 dark:bg-midnight-900/40 backdrop-blur-md text-midnight-900 dark:text-ivory-200 placeholder-midnight-400 dark:placeholder-ivory-600 focus:ring-sky-400 focus:border-sky-400 dark:focus:ring-sky-600 dark:focus:border-sky-600 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-cloud-100/40 dark:bg-midnight-800/40 sticky top-0 z-10 border-b backdrop-blur-md">
              <tr>
                {columns.map((c) => {
                  const isSorted = sortKey === c.key;
                  const canSort = c.sortable !== false;
                  return (
                    <th
                      key={c.key}
                      style={{ width: c.width }}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 select-none ${canSort ? 'cursor-pointer' : ''
                        }`}
                      onClick={() => canSort && onHeaderClick(c)}
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>{c.header}</span>
                        {canSort && (
                          <span className="text-xs text-gray-400">
                            {isSorted ? (sortDir === 'ASC' ? '▲' : '▼') : '⇵'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-cloud-200/40 dark:divide-midnight-700/40">
              {view.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-midnight-700 dark:text-ivory-300" colSpan={columns.length}>
                    No data.
                  </td>
                </tr>
              ) : (
                view.map((r, idx) => (
                  <tr key={idx} className="hover:bg-cloud-200/40 dark:hover:bg-midnight-800/40 transition cursor-pointer">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-sm text-center align-middle">
                        {c.render ? c.render(r) : renderCellContent(getValueByPath(r, c.key) ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-cloud-100/30 dark:bg-midnight-800/30 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 text-midnight-700 dark:text-ivory-300 select-none rounded-b-2xl">
          {/* Left side - results info */}
          <div className="text-sm">
            Showing{" "}
            <span className="font-semibold">{Math.min(startIdx + 1, total)}</span> to{" "}
            <span className="font-semibold">
              {Math.min(startIdx + view.length, total)}
            </span>{" "}
            of <span className="font-semibold">{total}</span> results
          </div>

          {/* Right side - pagination */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Prev / First */}
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 
                 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium
                 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
            >
              «
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 
                 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium
                 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              ‹
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                )
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => setPage(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium shadow-md transition 
              ${currentPage === page
                        ? "bg-sky-500 text-white"
                        : "bg-cloud-200/50 dark:bg-midnight-700/50 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-midnight-700 dark:text-ivory-300"
                      }`}
                  >
                    {page}
                  </button>
                ))}
            </div>

            {/* Next / Last */}
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 
                 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium
                 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              ›
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 
                 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium
                 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              »
            </button>

            {/* Rows per page */}
            <div className="flex items-center gap-2 ml-2">
              <label className="text-sm">Rows:</label>
              <select
                className="border rounded-lg px-2 py-1 bg-white dark:bg-midnight-700/40 
                   text-midnight-900 dark:text-ivory-300 text-sm"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>




      </div>
    </div>
  );
};

export default DataTable;

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

