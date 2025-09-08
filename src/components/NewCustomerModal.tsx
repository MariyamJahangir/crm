import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { customerService } from '../services/customerService';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (customerId: string) => void; // callback with new id (UUID)
};

const NewCustomerModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';

  const [companyName, setCompanyName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [vatNo, setVatNo] = useState('');
  const [address, setAddress] = useState('');

  // New fields on Customer
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState<'Enterprise' | 'SMB' | 'Individual' | ''>('');

  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [salesmanId, setSalesmanId] = useState('');

  const [loadingTeam, setLoadingTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    if (!token) return;

    (async () => {
      setLoadingTeam(true);
      try {
        const team = await teamService.list(token);
        const users = team.users || [];
        setSalesmen(users);
        // BUGFIX: team.users.id was incorrect; pick current or first
        const me = users.find(u => String(u.id) === String(user?.id));
        setSalesmanId(me?.id ? String(me.id) : (users.length ? String(users.id) : ''));
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

    if (!companyName.trim()) {
      setErr('Company name is required');
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setErr('Please provide a valid email');
      return;
    }
    if (website && !/^https?:\/\/.+/i.test(website)) {
      setErr('Website must start with http:// or https://');
      return;
    }
    if (isAdmin && !salesmanId) {
      setErr('Please select a salesman');
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
        industry: industry || undefined,
        website: website || undefined,
        category: category || undefined,
      };
      if (isAdmin) payload.salesmanId = salesmanId;

      const out = await customerService.create(payload, token);
      onCreated(out.customerId);
      onClose();

      // Reset fields (keep salesman for speed)
      setCompanyName('');
      setContactNumber('');
      setEmail('');
      setVatNo('');
      setAddress('');
      setIndustry('');
      setWebsite('');
      setCategory('');
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
          <Button onClick={save} disabled={saving || !companyName.trim()}>
            {saving ? 'Saving...' : 'Create'}
          </Button>
        </>
      }
    >
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3">{err}</div>}

      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Company Name</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Apex Engineering Pvt Ltd"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Contact Number</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={contactNumber}
              onChange={e => setContactNumber(e.target.value)}
              placeholder="+91 44xxxxxxx"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="info@company.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">VAT No</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={vatNo}
              onChange={e => setVatNo(e.target.value)}
              placeholder="TIN/VAT number"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Address</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={3}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Billing address"
            />
          </div>

          {/* New fields */}
          <div>
            <label className="text-sm font-medium text-gray-700">Industry</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="Manufacturing, EPC, Pharma..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Website</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              className="w-full border rounded px-3 py-2 bg-white"
              value={category}
              onChange={e => setCategory(e.target.value as any)}
            >
              <option value="">-- Select --</option>
              <option value="Enterprise">Enterprise</option>
              <option value="SMB">SMB</option>
              <option value="Individual">Individual</option>
            </select>
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
              Admins must choose a salesman; members are auto-assigned on the server.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NewCustomerModal;
