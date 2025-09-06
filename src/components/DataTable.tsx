// src/components/DataTable.tsx
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
  filterKeys?: string[]; // dot-notation allowed for nested props
  initialSort?: InitialSort;
  searchPlaceholder?: string;
  className?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
};

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

function compareVals(a: any, b: any) {
  // Normalize for compare: strings case-insensitive, numbers as-is, dates
  const pa = parseFloat(a);
  const pb = parseFloat(b);
  const da = Date.parse(a);
  const db = Date.parse(b);

  if (!Number.isNaN(pa) && !Number.isNaN(pb)) {
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  }
  if (!Number.isNaN(da) && !Number.isNaN(db)) {
    return da < db ? -1 : da > db ? 1 : 0;
  }
  const sa = (a ?? '').toString().toLowerCase();
  const sb = (b ?? '').toString().toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

const DataTable = <Row extends Record<string, any>>({
  rows,
  columns,
  filterKeys = [],
  initialSort,
  searchPlaceholder = 'Search...',
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
    // Reset to page 1 whenever filters or search change
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
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
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
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const startIdx = (pageSafe - 1) * pageSize;
  const view = sorted.slice(startIdx, startIdx + pageSize);

  return (
    <div className={`w-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="text-sm text-gray-600">{total} record(s)</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Rows per page</label>
          <select
            className="border rounded px-2 py-1 bg-white"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((c) => {
                const isSorted = sortKey === c.key;
                const canSort = c.sortable !== false;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    className={`text-left px-3 py-2 font-medium text-gray-700 ${canSort ? 'cursor-pointer select-none' : ''}`}
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
          <tbody>
            {view.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={columns.length}>
                  No data.
                </td>
              </tr>
            ) : (
              view.map((r, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 align-top">
                      {c.render ? c.render(r) : (() => {
                        const v = getValueByPath(r, c.key);
                        return v != null && v !== '' ? String(v) : '-';
                      })()}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-600">
          Page {pageSafe} of {pageCount}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(1)}
            disabled={pageSafe <= 1}
          >
            « First
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
          >
            ‹ Prev
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={pageSafe >= pageCount}
          >
            Next ›
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(pageCount)}
            disabled={pageSafe >= pageCount}
          >
            Last »
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
