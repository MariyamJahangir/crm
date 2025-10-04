import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, Company } from '../services/contactsService';
import Modal from './Modal';
function useDebounced<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
interface SelectContactModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (company: Company) => void;
}

const SelectContactModal: React.FC<SelectContactModalProps> = ({ open, onClose, onSelect }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 300); // 300ms debounce delay
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) {
      setCompanies([]);
      return;
    }

    setLoading(true);
    // Use the correct service function
    contactsService.searchCompanies(token, debouncedQuery)
      .then(res => {
        if (res.success) {
          console.log(res)
          setCompanies(res.contacts);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  }, [open, token, debouncedQuery]);

  return (
    <Modal open={open} onClose={onClose} title="Select Company" size="lg">
      <input
        type="text"
        className="w-full h-10 rounded-lg form-input mb-4 p-2"
        placeholder="Search by company name or contact..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="border rounded-lg max-h-96 overflow-y-auto">
        {loading && <div className="p-4 text-center text-gray-500">Loading...</div>}
        {!loading && companies.map((company) => (
          <div
            key={company.id}
            className="grid grid-cols-2 gap-4 p-3 border-b last:border-b-0 hover:bg-indigo-50 cursor-pointer"
            onClick={() => {
              onSelect(company);
              onClose();
            }}
          >
            <div className="font-semibold text-midnght-700">{company.companyName}</div>
             <div className="text-sm text-gray-500 font-extrabold text-center">{company.uniqueNumber}</div>
            <div className="text-right">
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                company.entityType === 'Vendor' ? 'bg-green-100 text-green-800' 
                : company.entityType === 'Customer' ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
              }`}>
                {company.entityType}
              </span>
            </div>
          </div>
        ))}
        {!loading && companies.length === 0 && (
          <div className="p-4 text-center text-gray-500">No companies found for your query.</div>
        )}
      </div>
    </Modal>
  );
};

export default SelectContactModal;
