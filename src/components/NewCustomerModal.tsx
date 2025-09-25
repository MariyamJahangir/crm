import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { customerService } from '../services/customerService';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';
import { Toaster, toast } from 'react-hot-toast';
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
  //const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    if (!token) return;

    (async () => {
      setLoadingTeam(true);
      try {
        const team = await teamService.list(token);
        const users = team.users || [];
        setSalesmen(users);
        // Set the current user as the default salesman
        const me = users.find(u => String(u.id) === String(user?.id));
        setSalesmanId(me?.id ? String(me.id) : (users.length ? String(users[0].id) : ''));
      } catch {
         toast.error("Failed to load team members.");
      } finally {
        setLoadingTeam(false);
      }
    })();
  }, [open, token, user?.id]);
const getErrorMessage = (error: any, defaultMessage: string): string => {
    if (typeof error?.response?.data?.message === 'string') {
        return error.response.data.message;
    }
    return defaultMessage;
  };
  const save = async () => {
    if (!token) return;
   

   if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    
    // 1. New validation rule: Enforce Email or Contact Number
    if (!email.trim() && !contactNumber.trim()) {
      toast.error('Please provide either an email or a contact number.');
      return;
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please provide a valid email');
      return;
    }
    
    if (website && !/^(https?:\/\/|www\.).+/i.test(website)) {
      toast.error('Website must start with http://, https://, or www.');
      return;
    }
  
    if (isAdmin && !salesmanId) {
       toast.error('Please select a salesman');
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
       if (isAdmin && salesmanId) {
        payload.salesmanId = salesmanId;
     }


      const out = await customerService.create(payload, token);
      toast.success('Customer created successfully!');
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
         toast.error(getErrorMessage(e, 'Failed to create customer'));
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
          <Button
            variant="secondary"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray text-gray-400
                   bg-white/5 backdrop-blur-sm
                   hover:text-gray-800 hover:border-white/60
                   hover:bg-slate/10
                   hover:shadow-[0_0_12px_rgba(255,255,255,0.5)]
                   transition-all"
          >
            Cancel
          </Button>

          <Button
    onClick={save}
    disabled={saving || !companyName.trim()}
    className={`
        px-4 py-2 rounded-lg 
        bg-blue-600 text-white 
        border border-blue-500
        hover:bg-blue-700 hover:shadow-lg
        transition-all duration-300 ease-in-out
        ${saving || !companyName.trim() ? 'opacity-50 cursor-not-allowed' : ''}
    `}
>
    {saving ? 'Saving...' : 'Create'}
</Button>

        </>
      }
    >
      

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Reusable glass input style */}
          {[
            {
              label: 'Company Name*',
              value: companyName,
              setter: setCompanyName,
              placeholder: 'Apex Engineering Pvt Ltd',
              required: true,
            },
            {
              label: 'Contact Number*',
              value: contactNumber,
              setter: setContactNumber,
              placeholder: '+971 44xxxxxxx',
            },
            {
              label: 'Email',
              type: 'email',
              value: email,
              setter: setEmail,
              placeholder: 'info@company.com',
            },
            {
              label: 'VAT No',
              value: vatNo,
              setter: setVatNo,
              placeholder: 'TIN/VAT number',
            },
          ].map((field, i) => (
            <div key={i}>
              <label className="text-sm font-medium text-midnight-900/80">{field.label}</label>
              <input
                type={field.type || 'text'}
                className="w-full rounded-lg px-3 py-2 
                       bg-white/50 border border-white/20 text-midnight-900/90
                       placeholder-slate-500 backdrop-blur-sm
                       focus:outline-none focus:border-white/50
                       hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]
                       transition-all"
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
              />
            </div>
          ))}

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-midnight-900/80">Address</label>
            <textarea
              className="w-full rounded-lg px-3 py-2 
                     bg-white/50 border border-white/20 text-midnight-900/90
                      placeholder-slate-500 backdrop-blur-sm
                     focus:outline-none focus:border-white/50
                     hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]
                     transition-all"
              rows={3}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Billing address"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-midnight-900/80">Industry</label>
            <input
              className="w-full rounded-lg px-3 py-2 
                     bg-white/50 border border-white/20 text-midnight-900/90
                     placeholder-slate-500 backdrop-blur-sm
                     focus:outline-none focus:border-white/50
                     hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]
                     transition-all"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="Manufacturing, EPC, Pharma..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-midnight-900/80">Website</label>
            <input
              className="w-full rounded-lg px-3 py-2 
                     bg-white/50 border border-white/20 text-midnight-900/90
                      placeholder-slate-500 backdrop-blur-sm
                     focus:outline-none focus:border-white/50
                     hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]
                     transition-all"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-midnight-900/80">Category</label>
            <select
              className="w-full rounded-lg px-3 py-2 
                     bg-white/50 border border-white/20 text-midnight-400/90
                     backdrop-blur-sm
                     focus:outline-none focus:border-white/50
                     hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]
                     transition-all"
              value={category}
              onChange={e => setCategory(e.target.value as any)}
            >
              <option value="" className='bg-cloud-100'>-- Select --</option>
              <option value="Enterprise" className='bg-cloud-100'>Enterprise</option>
              <option value="SMB" className='bg-cloud-100'>SMB</option>
              <option value="Individual" className='bg-cloud-100'>Individual</option>
            </select>
          </div>

          {/* Conditional salesman field */}
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-midnight-400">Salesman</label>
            {isAdmin ? (
              <>
                <select
                  className="w-full rounded-lg px-3 py-2 
                         bg-white/50 border border-white/20 text-midnight-900/90
                         backdrop-blur-sm
                         focus:outline-none focus:border-white/50
                         hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]
                         transition-all"
                  value={salesmanId}
                  onChange={e => setSalesmanId(e.target.value)}
                  required={isAdmin}
                  disabled={loadingTeam}
                >
                  <option value="" disabled>Select salesman</option>
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="text-xs text-white/60 mt-1">
                  Admins must choose a salesman.
                </div>
              </>
            ) : (
              <>
                <input
                  className="w-full rounded-lg px-3 py-2 
                         bg-gray-500/20 border border-white/20 text-white/90
                         backdrop-blur-sm cursor-not-allowed"
                  value={user?.name || ''}
                  disabled
                />
                <div className="text-xs text-white/60 mt-1">
                  You are assigned as the salesman for this customer.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>

  );



};

export default NewCustomerModal;
