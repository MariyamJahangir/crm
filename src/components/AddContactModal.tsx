// src/components/AddContactModal.tsx
import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import NewCustomerModal from './NewCustomerModal';



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
    social: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);



  const fetchCustomers = async () => {
    if (!token) return;
    try {
      const res = await customerService.list(token);
      setCustomers(res.customers);
    } catch {
      setError('Could not load customers.');
    }
  };


  // Reset form every time modal opens, but not when returning from NewCustomerModal
  useEffect(() => {
    if (open && !isNewCustomerModalOpen) {
      setSelectedCustomerId('');
      setFormData({
        name: '',
        designation: '',
        department: '',
        email: '',
        mobile: '',
        fax: '',
        social:'',
      });
      setError(null);
    }
  }, [open, isNewCustomerModalOpen]);



  // Fetch customers when the modal is opened
  useEffect(() => {
    if (open && !isNewCustomerModalOpen) {
      fetchCustomers();
    }
  }, [open, token, isNewCustomerModalOpen]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };



  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCustomerId(e.target.value);
  };

  const handleOpenNewCustomerModal = () => {
    setIsNewCustomerModalOpen(true);
  };


  const handleCustomerCreated = async (newCustomerId: string) => {
    setIsNewCustomerModalOpen(false); // Close the new customer modal
    await fetchCustomers(); // Refresh the customer list
    setSelectedCustomerId(newCustomerId); // Pre-select the newly created customer
  };
  
  const handleCloseNewCustomerModal = () => {
    setIsNewCustomerModalOpen(false);
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
    <>
      {/* Main Modal - hidden when NewCustomerModal is open */}
      <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/10 backdrop-blur-sm p-6 ${isNewCustomerModalOpen ? 'hidden' : ''}`}>
        <div className="bg-white/50 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30
                        w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="px-6 py-4 border-b border-white/20 dark:border-midnight-700/30 flex items-center justify-between">
            <h2 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">Add New Contact</h2>
            <button
              className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-ivory-200 hover:bg-white/20 dark:hover:bg-midnight-700/30 transition"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Wrap content in a form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            {/* Body */}
            <div className="px-6 py-6 space-y-4 overflow-auto flex-1">
              {error && (
                <div className="bg-red-50/30 dark:bg-red-900/30 border border-red-200/30 dark:border-red-700/30
                                 text-red-700 dark:text-red-400 px-4 py-2 rounded-xl text-sm shadow-sm">
                  {error}
                </div>
              )}
              
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>

                {/* Customer */}
                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Customer</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCustomerId}
                      onChange={handleCustomerChange}
                      required
                      className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30
                                 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100
                                 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                    >
                      <option value="" disabled>-- Select a Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleOpenNewCustomerModal}
                      className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition"
                      aria-label="Add New Customer"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
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
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

                {/* ... other input fields ... */}
                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Mobile</label>
                  <input
                    type="text"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Fax</label>
                  <input
                    type="text"
                    name="fax"
                    value={formData.fax}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">LinkedIn/Social</label>
                  <input
                    type="text"
                    name="social"
                    value={formData.social}
                    onChange={handleChange}
                    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                               shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                  />
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/20 dark:border-midnight-700/30 flex justify-end gap-4">
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
          </form>
        </div>
      </div>

      {/* New Customer Modal - rendered on top when open */}
      {isNewCustomerModalOpen && (
        <NewCustomerModal
          open={isNewCustomerModalOpen}
          onClose={handleCloseNewCustomerModal}
          onCreated={handleCustomerCreated}
        />
      )}
    </>
  );
};



export default AddContactModal;
