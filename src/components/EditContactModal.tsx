// src/components/EditContactModal.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, UpdateContactPayload } from '../services/contactsService';
import Button from './Button';
import {toast} from 'react-hot-toast'
interface Props {
  open: boolean;
  contactId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const initialForm: UpdateContactPayload = {
  name: '',
  designation: '',
  department: '',
  email: '',
  mobile: '',
  fax: '',
  social: '',
};

const EditContactModal: React.FC<Props> = ({ open, contactId, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
const [companyName, setCompanyName] = useState(''); 
  useEffect(() => {
    if (open && contactId) {
      (async () => {
        setLoading(true);
       
        try {
          const res = await contactsService.getOne(contactId, token);
        setCompanyName(res.contact.Customer?.companyName || 'N/A');
          setForm({
            name: res.contact.name || '',
            designation: res.contact.designation || '',
            department: res.contact.department || '',
            email: res.contact.email || '',
            mobile: res.contact.mobile || '',
            fax: res.contact.fax || '',
            social: res.contact.social || '',
          });
        } catch (e: any) {
          toast.error(e?.data?.message || 'Failed to load contact data.');
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setForm(initialForm); 
      setCompanyName(''); 
    }
  }, [open, contactId, token]);

  const handleChange = (key: keyof UpdateContactPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;

      
     if (!form.name.trim() || !form.designation.trim() || !form.mobile.trim()) {
        toast.error('Name, Designation, and Mobile are all required fields.');
        return;
    }

    // 2. Validate phone number format
    // This regex allows an optional '+' at the start, followed by 7 to 15 digits.
    if (!/^\+?[0-9]{7,15}$/.test(form.mobile.trim())) {
        toast.error('Please enter a valid phone number (digits only, optional +).');
        return;
    }

    // 3. Validate email format if an email is provided
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        toast.error('Please provide a valid email address.');
        return;
    }

    setSaving(true);

    try {
      await contactsService.update(contactId, form, token);
      onSuccess(); // This will trigger a reload on the parent page
      onClose(); // Close modal on success
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/10 backdrop-blur-sm p-6">
      <div className="bg-white/50 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30
                      w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/20 dark:border-midnight-700/30 flex items-center justify-between">
          <h2 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">Edit Contact</h2>
          <button
            className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-ivory-200 hover:bg-white/20 dark:hover:bg-midnight-700/30 transition"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form and Content Area */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-midnight-700 dark:text-ivory-300">Loading...</div>
          ) : (
            <>
              {/* Body */}
              <div className="px-6 py-6 space-y-4 overflow-auto flex-1">
               

                
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                      <div>
                      <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                        Customer
                      </label>
                      <input
                        value={companyName}
                        disabled
                        className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30
                                   bg-cloud-200/50 dark:bg-midnight-800/80 text-midnight-600 dark:text-ivory-400
                                   shadow-sm focus:outline-none cursor-not-allowed text-sm transition"
                      />
                    </div>

                    {/* Reusable Input Style */}
                    {[
                    
                      { key: 'name', label: 'Name*' },
                      { key: 'designation', label: 'Designation' },
                      { key: 'department', label: 'Department' },
                      { key: 'mobile', label: 'Mobile*' },
                      { key: 'email', label: 'Email', type: 'email' },
                      { key: 'fax', label: 'Fax' },
                      { key: 'social', label: 'LinkedIn/Social' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                          {field.label}
                        </label>
                        <input
                          value={form[field.key as keyof UpdateContactPayload]}
                          onChange={handleChange(field.key as keyof UpdateContactPayload)}
                          placeholder={`${field.label}`}
                          type={field.type || 'text'}
                         
                          className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30
                                 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100
                                 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                        />
                      </div>
                    ))}

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
                  disabled={saving}
                  className="px-5 py-2 rounded-2xl bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default EditContactModal;
