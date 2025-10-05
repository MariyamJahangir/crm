import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';

// Assuming DataTable is not used directly in this simplified list view.
// import DataTable from '../components/DataTable';

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

// A custom hook to debounce user input
const useDebounced = (value: string, delay = 350) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const SelectLeadModal: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Set a constant page size since the dropdown is removed
  const pageSize = 20;

  // Reset state when the modal is opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setPage(1);
      setRows([]);
      setTotal(0);
    }
  }, [open]);

  // Effect to fetch data when dependencies (like page or query) change
  useEffect(() => {
    if (!open || !token) return;
    
    let isCancelled = false;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Pass the query and pagination parameters to the service
        const res = await leadsService.myLeads(token);

        if (!isCancelled) {
          setRows(res.leads);
          setTotal(res.total);
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error);
        if (!isCancelled) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
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
        {/* Search Input */}
        <div className="flex items-center gap-2 mb-4">
          <input
            className="flex-1 h-10 rounded-lg form-input px-3"
            placeholder="Search by Lead # or Company name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1); // Reset to first page on new search
            }}
            aria-label="Search Leads"
          />
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

          {!loading && rows.map((r) => (
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
              aria-label={`Select Lead ${r.uniqueNumber}, ${r.companyName}`}
            >
              <div className="col-span-3 font-medium text-midnight-800 dark:text-ivory-200">
                {r.uniqueNumber}
              </div>
              <div className="col-span-3 text-midnight-700 dark:text-ivory-300">
                {r.companyName}
              </div>
              <div className="col-span-3 text-midnight-600 dark:text-ivory-400">
                {r.contactPerson || "-"}
                {r.mobile ? ` • ${r.mobile}` : ""}
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
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1 rounded-lg"
            >
              Prev
            </Button>
            <div className="text-sm">
              Page {page} of {totalPages}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
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
