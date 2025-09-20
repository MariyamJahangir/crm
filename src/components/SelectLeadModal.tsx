// components/SelectLeadModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';
import DataTable from '../components/DataTable';

type LeadRow = {
  id: string;
  uniqueNumber: string;
  companyName: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  customerId?: string | null;
  salesman?: { id: string; name: string; email?: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (lead: LeadRow) => void;
};

const useDebounced = (value: string, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const SelectLeadModal: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 350); 
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPage(1);
    setRows([]);
    setTotal(0);
  }, [open]);

  useEffect(() => {
    if (!open || !token) return;
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const res = await leadsService.myLeads(token);
        
        if (!abort) {
          setRows(res.leads);
          setTotal(res.total);
        }
      } catch {
        if (!abort) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [open, token, debouncedQuery, page, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const handleRowSelect = (row: LeadRow) => {
    onSelect(row);
    onClose();
  };

return (
  <Modal open={open} onClose={onClose} title="Select Lead" size="lg">
    <div className="flex flex-col h-[70vh]">
      {/* Search & Page size */}
      <div className="flex items-center gap-2 mb-4">
        <input
          className="flex-1 h-10 rounded-lg form-input px-3"
          placeholder="Search by Lead # or Company name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          aria-label="Search Leads"
        />
        <select
          className="h-10 rounded-lg border border-cloud-200 dark:border-midnight-600 px-2"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          aria-label="Rows per page"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Leads List */}
      <div className="flex-1 border rounded-lg overflow-y-auto">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-cloud-50 dark:bg-midnight-800 border-b 
                        text-xs font-semibold text-midnight-700 dark:text-ivory-300 sticky top-0 z-10 text-center">
          <div className="col-span-3">Lead #</div>
          <div className="col-span-3">Company</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-3">Salesman</div>
          
        </div>

        {loading && (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        )}

        {!loading &&
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 gap-2 p-3 border-b last:border-b-0 
                         text-sm items-center hover:bg-sky-50 dark:hover:bg-midnight-700/50 
                         cursor-pointer transition text-center"
              role="row"
              tabIndex={0}
              onClick={() => handleRowSelect(r)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleRowSelect(r);
                }
              }}
              aria-label={`Lead ${r.uniqueNumber}, ${r.companyName}`}
            >
              <div className="col-span-3 font-medium text-midnight-800 dark:text-ivory-200">
                {r.uniqueNumber}
              </div>
              <div className="col-span-3 text-midnight-700 dark:text-ivory-300">
                {r.companyName}
              </div>
              <div className="col-span-3 text-midnight-600 dark:text-ivory-400">
                {r.contactPerson || "-"}{" "}
                {r.mobile ? ` • ${r.mobile}` : ""}{" "}
                {r.email ? ` • ${r.email}` : ""}
              </div>
              <div className="col-span-3 text-midnight-600 dark:text-ivory-400">
                {r.salesman?.name || "-"}
              </div>
              
            </div>
          ))}

        {!loading && rows.length === 0 && (
          <div className="p-4 text-center text-gray-500">No leads found.</div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-600">Total: {total}</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded-lg"
          >
            Prev
          </Button>
          <div className="text-sm">
            Page {page} / {totalPages}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded-lg"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  </Modal>
);

};

export default SelectLeadModal;
