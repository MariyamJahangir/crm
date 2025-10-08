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
  const [country, setCountry] = useState('');
  const [sizeOfCompany, setSizeOfCompany] = useState('');
  const [note, setNote] = useState('');
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
        //  setSalesmanId(me?.id ? String(me.id) : (users.length ? String(users[0].id) : ''));
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
        country: country || undefined,
        sizeOfCompany: sizeOfCompany || undefined,
        note: note || undefined,
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
          className="px-4 py-2 rounded-lg border border-gray-300/40 text-gray-600
                     bg-white/60 backdrop-blur-md
                     hover:text-gray-800 hover:border-gray-400/70
                     hover:bg-white/70 hover:shadow-md
                     transition-all duration-200"
        >
          Cancel
        </Button>

        <Button
          onClick={save}
          disabled={saving || !companyName.trim()}
          className={`px-5 py-2 rounded-lg font-medium
                      bg-blue-600 text-white 
                      border border-blue-500
                      hover:bg-blue-700 hover:shadow-lg
                      transition-all duration-300 ease-in-out
                      ${
                        saving || !companyName.trim()
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
        >
          {saving ? "Saving..." : "Create"}
        </Button>
      </>
    }
  >
    <div className="max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Reusable input fields */}
        {[
          {
            label: "Company Name*",
            value: companyName,
            setter: setCompanyName,
            placeholder: "Apex Engineering Pvt Ltd",
            required: true,
          },
          {
            label: "Contact Number*",
            value: contactNumber,
            setter: setContactNumber,
            placeholder: "+971 44xxxxxxx",
          },
          {
            label: "Email",
            type: "email",
            value: email,
            setter: setEmail,
            placeholder: "info@company.com",
          },
          {
            label: "VAT No",
            value: vatNo,
            setter: setVatNo,
            placeholder: "TIN/VAT number",
          },
        ].map((field, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
              {field.label}
            </label>
            <input
              type={field.type || "text"}
              className="w-full rounded-lg px-3 py-2
                         bg-white/70 dark:bg-midnight-800/60
                         border border-cloud-300/40 dark:border-midnight-700/50
                         text-midnight-800 dark:text-ivory-100
                         placeholder-slate-400
                         focus:outline-none focus:ring-2 focus:ring-blue-400/40
                         hover:shadow-[0_0_8px_rgba(0,0,0,0.08)]
                         transition-all duration-200"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          </div>
        ))}

        {/* Industry */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Industry
          </label>
          <input
            className="w-full rounded-lg px-3 py-2
                       bg-white/70 dark:bg-midnight-800/60
                       border border-cloud-300/40 dark:border-midnight-700/50
                       text-midnight-800 dark:text-ivory-100
                       placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-400/40
                       hover:shadow-[0_0_8px_rgba(0,0,0,0.08)]
                       transition-all duration-200"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Manufacturing, EPC, Pharma..."
          />
        </div>

        {/* Website */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Website
          </label>
          <input
            className="w-full rounded-lg px-3 py-2
                       bg-white/70 dark:bg-midnight-800/60
                       border border-cloud-300/40 dark:border-midnight-700/50
                       text-midnight-800 dark:text-ivory-100
                       placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-400/40
                       hover:shadow-[0_0_8px_rgba(0,0,0,0.08)]
                       transition-all duration-200"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Category
          </label>
          <select
            className="w-full rounded-lg px-3 py-2
                       bg-white/70 dark:bg-midnight-800/60
                       border border-cloud-300/40 dark:border-midnight-700/50
                       text-midnight-800 dark:text-ivory-100
                       focus:outline-none focus:ring-2 focus:ring-blue-400/40
                       transition-all duration-200"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">-- Select --</option>
            <option value="Enterprise">Enterprise</option>
            <option value="SMB">SMB</option>
            <option value="Individual">Individual</option>
          </select>
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Country
          </label>
          <input
            className="w-full rounded-lg px-3 py-2
                       bg-white/70 dark:bg-midnight-800/60
                       border border-cloud-300/40 dark:border-midnight-700/50
                       text-midnight-800 dark:text-ivory-100
                       focus:outline-none focus:ring-2 focus:ring-blue-400/40
                       transition-all duration-200"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        {/* Company Size */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Company Size
          </label>
          <select
            className="w-full rounded-lg px-3 py-2
                       bg-white/70 dark:bg-midnight-800/60
                       border border-cloud-300/40 dark:border-midnight-700/50
                       text-midnight-800 dark:text-ivory-100
                       focus:outline-none focus:ring-2 focus:ring-blue-400/40
                       transition-all duration-200"
            value={sizeOfCompany}
            onChange={(e) => setSizeOfCompany(e.target.value)}
          >
            <option value="">-- Select --</option>
            <option value="1-10">1-10</option>
            <option value="11-50">11-50</option>
            <option value="51-200">51-200</option>
            <option value="201-500">201-500</option>
            <option value="500+">500+</option>
          </select>
        </div>

        {/* Salesman */}
        <div>
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Salesman
          </label>
          {isAdmin ? (
            <>
              <select
                className="w-full rounded-lg px-3 py-2
                           bg-white/70 dark:bg-midnight-800/60
                           border border-cloud-300/40 dark:border-midnight-700/50
                           text-midnight-800 dark:text-ivory-100
                           focus:outline-none focus:ring-2 focus:ring-blue-400/40
                           transition-all duration-200"
                value={salesmanId}
                onChange={(e) => setSalesmanId(e.target.value)}
                disabled={loadingTeam}
              >
                <option value="" disabled>
                  Select salesman
                </option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.isBlocked}>
                    {s.name}
                    {s.isBlocked ? " (Blocked)" : ""}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                Admins must choose a salesman.
              </div>
            </>
          ) : (
            <>
              <input
                className="w-full rounded-lg px-3 py-2
                           bg-gray-200/40 border border-cloud-300/40
                           text-gray-700 cursor-not-allowed"
                value={(() => {
                  const assignedSalesman = salesmen.find(
                    (s) => String(s.id) === String(user?.id)
                  );
                  const name = user?.name || "";
                  return assignedSalesman?.isBlocked
                    ? `${name} (Blocked)`
                    : name;
                })()}
                disabled
              />
              <div className="text-xs text-gray-500 mt-1">
                You are assigned as the salesman for this customer.
              </div>
            </>
          )}
        </div>

        {/* Note */}
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-sm font-semibold text-midnight-800/80 dark:text-ivory-200">
            Note
          </label>
          <textarea
            className="w-full min-h-[80px] rounded-lg px-3 py-2
                       bg-white/70 dark:bg-midnight-800/60
                       border border-cloud-300/40 dark:border-midnight-700/50
                       text-midnight-800 dark:text-ivory-100
                       focus:outline-none focus:ring-2 focus:ring-blue-400/40
                       transition-all duration-200"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        
      </div>
    </div>
  </Modal>

  );



};

export default NewCustomerModal;
