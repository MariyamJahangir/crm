import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { customerService } from '../services/customerService';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (customerId: string) => void; // callback with new id
};

const NewCustomerModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';

  const [companyName, setCompanyName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [vatNo, setVatNo] = useState('');
  const [address, setAddress] = useState('');

  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [salesmanId, setSalesmanId] = useState('');

  const [loadingTeam, setLoadingTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    if (!token) return;

    (async () => {
      setLoadingTeam(true);
      try {
        const team = await teamService.list(token);
        setSalesmen(team.users);
        // FIX: default to current user if present, else first user id
        const me = team.users.find(u => String(u.id) === String(user?.id));
        setSalesmanId(me?.id || team.users?.id || '');
      } catch {
        // ignore
      } finally {
        setLoadingTeam(false);
      }
    })();
  }, [open, token, user?.id]);

  const save = async () => {
    if (!token) return;
    setErr(null);

    // Admin must choose a salesman (back-end also enforces, but give fast UX)
    if (isAdmin && !salesmanId) {
      setErr('Please select a salesman');
      return;
    }
    if (!companyName.trim()) {
      setErr('Company name is required');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        companyName: companyName.trim(),
        contactNumber: contactNumber || undefined,
        email: email || undefined,
        vatNo: vatNo || undefined,
        address: address || undefined,
      };
      if (isAdmin) payload.salesmanId = salesmanId; // ensure non-empty for admins

      const out = await customerService.create(payload, token);
      onCreated(out.customerId);
      onClose();
      // reset
      setCompanyName(''); setContactNumber(''); setEmail(''); setVatNo(''); setAddress('');
      // keep salesman selection so repeated adds are faster
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Customer"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !companyName}>
            {saving ? 'Saving...' : 'Create'}
          </Button>
        </>
      }
    >
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Company Name</label>
          <input className="w-full border rounded px-3 py-2" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Contact Number</label>
          <input className="w-full border rounded px-3 py-2" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">VAT No</label>
          <input className="w-full border rounded px-3 py-2" value={vatNo} onChange={e => setVatNo(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Address</label>
          <textarea className="w-full border rounded px-3 py-2" rows={3} value={address} onChange={e => setAddress(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Salesman</label>
          <select
            className="w-full border rounded px-3 py-2 bg-white"
            value={salesmanId}
            onChange={e => setSalesmanId(e.target.value)}
            required={isAdmin}
            disabled={loadingTeam}
          >
            <option value="" disabled>Select salesman</option>
            {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            Admins must choose a salesman; members are auto-assigned to themselves on the server.
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NewCustomerModal;
