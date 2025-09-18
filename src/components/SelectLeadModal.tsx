// components/SelectLeadModal.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';

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
  
  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // When the search query changes, reset page and rows
  useEffect(() => {
    setPage(1);
    setRows([]);
    setTotal(0);
  }, [debouncedQuery]);

  // Data fetching effect
  useEffect(() => {
    if (!open || !token) return;

    let abort = false;
    const fetchLeads = async () => {
        setLoading(true);
        try {
            // Assume leadsService.myLeads can accept pagination and query params
            const res = await leadsService.myLeads(token, {
                query: debouncedQuery,
                page,
                pageSize,
            });
            
            if (!abort) {
                // Append new leads to the existing list
                setRows(prevRows => [...prevRows, ...res.leads]);
                setTotal(res.total);
            }
        } catch {
            if (!abort) {
                // On error, don't add more rows
            }
        } finally {
            if (!abort) setLoading(false);
        }
    };

    fetchLeads();

    return () => {
      abort = true;
    };
  }, [open, token, debouncedQuery, page, pageSize]);

  // Effect for handling infinite scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        // Check if user is near the bottom
        if (scrollHeight - scrollTop - clientHeight < 10) {
            // Load more if there are more items and not already loading
            if (rows.length < total && !loading) {
                setPage(prevPage => prevPage + 1);
            }
        }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading, rows.length, total]); // Re-attach if these dependencies change

  const handleRowSelect = (row: LeadRow) => {
    onSelect(row);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Lead"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="Search by Lead # or Company name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search Leads"
        />
        <select
          className="border rounded px-2 py-2"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1); // Reset page when size changes
            setRows([]);
          }}
          aria-label="Rows per page"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Attach the ref and add scrolling classes */}
      <div 
        ref={scrollContainerRef}
        className="border rounded max-h-96 overflow-y-auto"
        role="grid"
        aria-label="Leads list"
      >
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700 sticky top-0 z-10">
          <div className="col-span-2">Lead #</div>
          <div className="col-span-3">Company</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Salesman</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-12 gap-2 px-3 py-2 border-b text-sm items-center hover:bg-gray-50 cursor-pointer"
            role="row"
            tabIndex={0}
            onClick={() => handleRowSelect(r)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowSelect(r);
              }
            }}
            aria-label={`Lead ${r.uniqueNumber}, ${r.companyName}`}
          >
            <div className="col-span-2">{r.uniqueNumber}</div>
            <div className="col-span-3">{r.companyName}</div>
            <div className="col-span-3">
              {r.contactPerson || '-'} {r.mobile ? ` • ${r.mobile}` : ''}
            </div>
            <div className="col-span-2">{r.salesman?.name || '-'}</div>
            <div className="col-span-2 text-right">
              <Button type="button" onClick={(e) => { e.stopPropagation(); handleRowSelect(r); }}>
                Select
              </Button>
            </div>
          </div>
        ))}
        
        {loading && <div className="px-3 py-3 text-sm text-center text-gray-600">Loading more...</div>}

        {!loading && rows.length === 0 && <div className="px-3 py-4 text-center text-gray-600">No leads found.</div>}
      </div>

      <div className="flex justify-between items-center mt-3">
        <div className="text-sm text-gray-600">
          Showing {rows.length} of {total}
        </div>
      </div>
    </Modal>
  );
};

export default SelectLeadModal;
