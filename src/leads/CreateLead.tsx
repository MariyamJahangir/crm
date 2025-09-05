import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';
import { teamService, TeamUser } from '../services/teamService';
import { customerService } from '../services/customerService';
import NewCustomerModal from '../components/NewCustomerModal';
import NewContactModal from '../components/NewContactModal';

type CustomerLite = { id: string; companyName: string };

const STAGES = ['Discover', 'Solution Validation', 'Quote', 'Negotiation', 'Deal Closed', 'Deal Lost', 'Fake Lead'] as const;
const FORECASTS = ['Pipeline', 'BestCase', 'Commit'] as const;
const SOURCES = ['Website', 'Referral', 'Advertisement', 'Event', 'Cold Call', 'Other'] as const;

const CreateLead: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; mobile?: string; email?: string }[]>([]);

  const [stage, setStage] = useState<typeof STAGES[number]>('Discover');
  const [forecastCategory, setForecastCategory] = useState<typeof FORECASTS[number]>('Pipeline');

  // Start with empty selections so placeholders render
  const [customerId, setCustomerId] = useState('');
  const [contactId, setContactId] = useState<string>(''); // empty string = placeholder

  const [source, setSource] = useState('Website');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileAlt, setMobileAlt] = useState('');
  const [emailField, setEmailField] = useState('');
  const [city, setCity] = useState('');

  const [salesmanId, setSalesmanId] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openNewCustomer, setOpenNewCustomer] = useState(false);
  const [openNewContact, setOpenNewContact] = useState(false);

  // Optional inline search for company list
  const [companySearch, setCompanySearch] = useState('');
  const filteredCustomers = customers.filter(c =>
    c.companyName.toLowerCase().includes(companySearch.toLowerCase())
  );

  // Load team and customers (do not auto-select a company; keep placeholder visible)
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const team = await teamService.list(token);
        setSalesmen(team.users);
        const me = team.users.find((u) => u.id === String(user?.id));
        setSalesmanId(me?.id || team.users?.id || '');

        const res = await customerService.list(token);
        const lite = res.customers.map((c) => ({ id: c.id, companyName: c.companyName }));
        setCustomers(lite);
        // leave customerId as '' for placeholder
      } catch {
        // ignore
      }
    })();
  }, [token, user?.id]); // useEffect dependency [10]

  // When customer changes, fetch contacts; set first as primary IFF no contact selected yet
  useEffect(() => {
    (async () => {
      if (!customerId || !token) {
        setContacts([]);
        setContactId('');
        setContactPerson('');
        setMobile('');
        setEmailField('');
        return;
      }
      try {
        const res = await customerService.getContacts(customerId, token);
        const list = res.contacts || [];
        setContacts(list);

        if (list.length > 0 && !contactId) {
          const first = list; // correct indexing
          setContactId(first.id);
          setContactPerson(first.name || '');
          setMobile(first.mobile || '');
          setEmailField(first.email || '');
        }

        if (list.length === 0) {
          setContactId('');
          setContactPerson('');
          setMobile('');
          setEmailField('');
        }
      } catch {
        // ignore
      }
    })();
  }, [customerId, token]); // [10]

  // If selected contact changes, copy into editable fields
  useEffect(() => {
    if (!contactId) return;
    const found = contacts.find((c) => c.id === contactId);
    if (found) {
      setContactPerson(found.name || '');
      setMobile(found.mobile || '');
      setEmailField(found.email || '');
    }
  }, [contactId, contacts]); // [10]

  const refreshCustomersAndSelect = async (newCustomerId?: string) => {
    if (!token) return;
    const res = await customerService.list(token);
    const lite = res.customers.map((c) => ({ id: c.id, companyName: c.companyName }));
    setCustomers(lite);
    if (newCustomerId) setCustomerId(newCustomerId);
  };

  const refreshContactsAndSelectFirst = async () => {
    if (!token || !customerId) return;
    const res = await customerService.getContacts(customerId, token);
    const list = res.contacts || [];
    setContacts(list);
    if (list.length > 0) {
      const first = list;
      setContactId(first.id);
      setContactPerson(first.name || '');
      setMobile(first.mobile || '');
      setEmailField(first.email || '');
    } else {
      setContactId('');
      setContactPerson('');
      setMobile('');
      setEmailField('');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!customerId) {
        setError('Please select a company');
        setSubmitting(false);
        return;
      }
      const payload: any = {
        stage,
        forecastCategory,
        customerId,
        source,
        quoteNumber: quoteNumber || undefined,
        previewUrl: previewUrl || undefined,
        contactPerson: contactPerson || undefined,
        mobile: mobile || undefined,
        mobileAlt: mobileAlt || undefined,
        email: emailField || undefined,
        city: city || undefined,
        description: description || undefined,
      };
      if (contactId) payload.contactId = contactId; 
      if (salesmanId) payload.salesmanId = salesmanId; 
      
      const out = await leadsService.create(payload, token);
      navigate(`/leads/${out.id}`, { replace: true });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Create Lead</h1>
            <p className="text-gray-600">Select division, salesman and contact. Create new customer/contact inline if needed.</p>
          </div>

          <form onSubmit={save} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            {/* Stage */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Stage</div>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`px-3 py-1.5 rounded border ${stage === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    onClick={() => setStage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Forecast */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Forecast</div>
              <div className="flex gap-3">
                {FORECASTS.map((f) => (
                  <label key={f} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="radio" name="forecast" value={f} checked={forecastCategory === f} onChange={() => setForecastCategory(f)} />
                    <span>{f}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Division + Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Division (Company)</label>
                {/* Optional search input */}
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Search company..."
                  className="mb-2 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="" disabled hidden>Select company</option> {/* placeholder */}
                    {filteredCustomers.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                  <Button type="button" variant="secondary" onClick={() => setOpenNewCustomer(true)}>+ New</Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Quote + Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quote Number</label>
                <input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Q-2025-0001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preview URL</label>
                <input value={previewUrl} onChange={(e) => setPreviewUrl(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="https://example.com/preview.png" />
                {previewUrl && <img src={previewUrl} alt="preview" className="mt-2 h-14 w-14 object-cover rounded border" />}
              </div>
            </div>

            {/* Contact + Salesman */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Contact</label>
                <div className="flex gap-2">
                  <select
                    value={contactId || ''}
                    onChange={(e) => setContactId(e.target.value || '')}
                    className="flex-1 rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="" disabled hidden>{contacts.length ? 'Select contact' : 'No contacts'}</option> {/* placeholder */}
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} {c.mobile ? `(${c.mobile})` : ''}</option>)}
                  </select>
                  <Button type="button" variant="secondary" onClick={() => setOpenNewContact(true)}>+ New</Button>
                </div>
                <div className="text-xs text-gray-500 mt-1">Modify below fields to override selected contact details.</div>
              </div>
              <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Salesman</label>
  <select
    value={salesmanId}
    onChange={(e) => setSalesmanId(e.target.value)}
    className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
  >
    <option value="">-- Select Salesman --</option>
    {salesmen.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
      </option>
    ))}
  </select>
</div>

            </div>

            {/* Contact fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternative</label>
                <input value={mobileAlt} onChange={(e) => setMobileAlt(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={emailField} onChange={(e) => setEmailField(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => navigate('/leads')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Lead'}</Button>
            </div>
          </form>
        </main>
      </div>

      {/* Modals */}
      <NewCustomerModal
        open={openNewCustomer}
        onClose={() => setOpenNewCustomer(false)}
        onCreated={async (newCustomerId) => {
          await refreshCustomersAndSelect(newCustomerId);
          await refreshContactsAndSelectFirst();
        }}
      />
      <NewContactModal
        open={openNewContact}
        onClose={() => setOpenNewContact(false)}
        customerId={customerId}
        onCreated={async () => { await refreshContactsAndSelectFirst(); }}
      />
    </div>
  );
};

export default CreateLead;
