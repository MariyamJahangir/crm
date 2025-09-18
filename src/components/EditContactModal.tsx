import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contactsService, UpdateContactPayload } from '../services/contactsService';
import Button from './Button';
import Modal from './Modal'; // Assuming you have a generic Modal component

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && contactId) {
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await contactsService.getOne(contactId, token);
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
          setError(e?.data?.message || 'Failed to load contact data.');
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setForm(initialForm); // Reset form when modal is closed or no ID
    }
  }, [open, contactId, token]);

  const handleChange = (key: keyof UpdateContactPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;

    if (!form.name.trim() || !form.designation.trim() || !form.mobile.trim()) {
      setError('Name, Designation, and Mobile are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await contactsService.update(contactId, form, token);
      onSuccess(); // This will trigger a reload on the parent page
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Contact">
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600 p-4">{error}</div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <input value={form.name} onChange={handleChange('name')} placeholder="Name*" required className="w-full border rounded px-3 py-2" />
          <input value={form.designation} onChange={handleChange('designation')} placeholder="Designation*" required className="w-full border rounded px-3 py-2" />
          <input value={form.department} onChange={handleChange('department')} placeholder="Department" className="w-full border rounded px-3 py-2" />
          <input value={form.mobile} onChange={handleChange('mobile')} placeholder="Mobile*" required className="w-full border rounded px-3 py-2" />
          <input value={form.email} type="email" onChange={handleChange('email')} placeholder="Email" className="w-full border rounded px-3 py-2" />
          <input value={form.fax} onChange={handleChange('fax')} placeholder="Fax" className="w-full border rounded px-3 py-2" />
          <input value={form.social} onChange={handleChange('social')} placeholder="LinkedIn/Social" className="w-full border rounded px-3 py-2" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default EditContactModal;
