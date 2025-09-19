// src/components/AddContactModal.tsx
import React, { useState, useEffect } from 'react';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService'; 

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddContactModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    department: '',
    email: '',
    mobile: '',
    fax: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Reset form every time modal opens
  useEffect(() => {
    if (open) {
      setSelectedCustomerId('');
      setFormData({
        name: '',
        designation: '',
        department: '',
        email: '',
        mobile: '',
        fax: '',
      });
      setError(null);
    }
  }, [open]);

  // Fetch customers when the modal is opened
  useEffect(() => {
    if (open && token) {
      customerService.list(token)
        .then(res => setCustomers(res.customers))
        .catch(() => setError('Could not load customers.'));
    }
  }, [open, token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCustomerId(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedCustomerId || !formData.name) {
      setError('Customer and Name are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await customerService.addContact(selectedCustomerId, formData, token);
      onSuccess(); // reload data in parent
      onClose();   // close modal
    } catch (err: any) {
      setError(err?.data?.message || 'Failed to add contact.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

return (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
    <div className="bg-white/30 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30
                    w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/20 dark:border-midnight-700/30 flex items-center justify-between backdrop-blur-sm">
        <h2 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">Add New Contact</h2>
        <button
          className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-ivory-200 hover:bg-white/20 dark:hover:bg-midnight-700/30 transition"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-6 space-y-4 backdrop-blur-sm overflow-auto flex-1">
        {error && (
          <div className="bg-red-50/30 dark:bg-red-900/30 border border-red-200/30 dark:border-red-700/30 
                          text-red-700 dark:text-red-400 px-4 py-2 rounded-xl text-sm shadow-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Customer</label>
          <select
            value={selectedCustomerId}
            onChange={handleCustomerChange}
            required
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          >
            <option value="" disabled>-- Select a Customer --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>

        {/* Designation */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Designation</label>
          <input
            type="text"
            name="designation"
            value={formData.designation}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Department</label>
          <input
            type="text"
            name="department"
            value={formData.department}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Mobile</label>
          <input
            type="text"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>

        {/* Fax */}
        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Fax</label>
          <input
            type="text"
            name="fax"
            value={formData.fax}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/20 dark:border-midnight-700/30 flex justify-end gap-4 backdrop-blur-sm">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-2xl bg-cloud-100/60 dark:bg-midnight-700/60 
                     border border-cloud-300/40 dark:border-midnight-600/40 
                     text-midnight-700 dark:text-ivory-200 
                     hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 shadow-md transition"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-2xl bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Contact'}
        </Button>
      </div>
    </div>
  </div>
);

};

export default AddContactModal;
