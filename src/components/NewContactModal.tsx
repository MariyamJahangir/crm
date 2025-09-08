import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { customerService } from '../services/customerService';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;          // UUID per model change
  onCreated: () => void;       // callback to refresh and reselect
};

const NewContactModal: React.FC<Props> = ({ open, onClose, customerId, onCreated }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobile, setMobile] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  // New fields
  const [department, setDepartment] = useState('');
  const [social, setSocial] = useState('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    setName('');
    setDesignation('');
    setMobile('');
    setFax('');
    setEmail('');
    setDepartment('');
    setSocial('');
  }, [open]);

  const save = async () => {
    if (!token || !customerId) return;
    setErr(null);

    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setErr('Please provide a valid email');
      return;
    }

    setSaving(true);
    try {
      await customerService.addContact(
        customerId,
        {
          name: name.trim(),
          designation: designation || undefined,
          mobile: mobile || undefined,
          fax: fax || undefined,
          email: email || undefined,
          department: department || undefined,
          social: social || undefined,
        },
        token
      );
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to create contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Customer Contact"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Create'}
          </Button>
        </>
      }
    >
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3">{err}</div>}

      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Priya Menon"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Designation</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder="Procurement Head"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Department</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="Purchasing"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Mobile</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="+91 98xxxxxxx"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Fax</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={fax}
              onChange={e => setFax(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">LinkedIn / Social</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={social}
              onChange={e => setSocial(e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NewContactModal;
