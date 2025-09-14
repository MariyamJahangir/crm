// src/components/AddContactModal.tsx
import React, { useState, useEffect } from 'react';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
// Use customerService instead of contactsService
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
    department: '', // Assuming department is a field you want to add
    email: '',
    mobile: '',
    fax: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Use the specific addContact method from customerService
      await customerService.addContact(selectedCustomerId, formData, token);
      onSuccess(); // Notify parent to reload data
      onClose();   // Close the modal
    } catch (err: any) {
      setError(err?.data?.message || 'Failed to add contact.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Add New Contact</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={handleCustomerChange}
              required
              className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="" disabled>-- Select a Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Designation</label>
            <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2" />
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <input type="text" name="department" value={formData.department} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mobile</label>
            <input type="text" name="mobile" value={formData.mobile} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2" />
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700">Fax</label>
            <input type="text" name="fax" value={formData.fax} onChange={handleChange} className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddContactModal;
