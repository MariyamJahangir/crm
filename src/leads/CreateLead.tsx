// pages/CreateLead.tsx
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
  const isAdmin = user?.type === 'ADMIN';


  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; mobile?: string; email?: string }[]>([]);


  const [stage, setStage] = useState<typeof STAGES[number]>('Discover');
  const [forecastCategory, setForecastCategory] = useState<typeof FORECASTS[number]>('Pipeline');


  const [customerId, setCustomerId] = useState('');
  const [contactId, setContactId] = useState<string>('');
  const [source, setSource] = useState('Website');


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


  // Load team and customers
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [teamRes, customersRes] = await Promise.all([
          teamService.list(token),
          customerService.list(token),
        ]);
        
        setSalesmen(teamRes.users);
        if (!isAdmin) {
          setSalesmanId(user?.id || '');
        } else if (teamRes.users.length > 0) {
          // Default to first salesman for admin if none selected
          setSalesmanId(teamRes.users[0].id);
        }
        
        const liteCustomers = customersRes.customers.map((c) => ({ id: c.id, companyName: c.companyName }));
        setCustomers(liteCustomers);

      } catch {
        setError('Failed to load initial data.');
      }
    })();
  }, [token, user?.id, isAdmin]);


  // When customer changes, fetch its contacts
  useEffect(() => {
    if (!customerId || !token) {
      setContacts([]);
      setContactId('');
      return;
    }
    (async () => {
      try {
        const res = await customerService.getContacts(customerId, token);
        const contactList = res.contacts || [];
        setContacts(contactList);
        if (contactList.length > 0) {
          // Auto-select the first contact
          setContactId(contactList[0].id);
        } else {
          setContactId('');
        }
      } catch {
        // ignore
      }
    })();
  }, [customerId, token]);


  // If selected contact changes, copy details into editable fields
  useEffect(() => {
    const found = contacts.find((c) => c.id === contactId);
    if (found) {
      setContactPerson(found.name || '');
      setMobile(found.mobile || '');
      setEmailField(found.email || '');
    } else {
      // Clear fields if no contact is selected or found
      setContactPerson('');
      setMobile('');
      setEmailField('');
    }
  }, [contactId, contacts]);


  const refreshCustomersAndSelect = async (newCustomerId: string) => {
    if (!token) return;
    const res = await customerService.list(token);
    setCustomers(res.customers.map((c) => ({ id: c.id, companyName: c.companyName })));
    setCustomerId(newCustomerId);
  };


  const refreshContactsAndSelectFirst = async () => {
    if (!token || !customerId) return;
    const res = await customerService.getContacts(customerId, token);
    const list = res.contacts || [];
    setContacts(list);
    if (list.length > 0) {
      setContactId(list[0].id);
    } else {
      setContactId('');
    }
  };


  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (isAdmin && !salesmanId) {
      setError('Please select a salesman.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        stage,
        forecastCategory,
        customerId,
        source,
        contactPerson: contactPerson || undefined,
        mobile: mobile || undefined,
        mobileAlt: mobileAlt || undefined,
        email: emailField || undefined,
        city: city || undefined,
        description: description || undefined,
        contactId: contactId || undefined,
        salesmanId,
      };


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
            <p className="text-gray-600">Select company, salesman, and contact. Create new ones inline if needed.</p>
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


            {/* Customer + Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Company)</label>
                <div className="flex gap-2">
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="flex-1 rounded-md border-gray-300 bg-white shadow-sm"
                  >
                    <option value="" disabled>Select a company</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                  <Button type="button" variant="secondary" onClick={() => setOpenNewCustomer(true)}>+ New</Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm">
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
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
                    className="flex-1 rounded-md border-gray-300 bg-white shadow-sm"
                    disabled={!customerId}
                  >
                    <option value="" disabled>{contacts.length ? 'Select a contact' : 'No contacts available'}</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} {c.mobile ? `(${c.mobile})` : ''}</option>)}
                  </select>
                  <Button type="button" variant="secondary" onClick={() => setOpenNewContact(true)} disabled={!customerId}>+ New</Button>
                </div>
                <div className="text-xs text-gray-500 mt-1">Modify fields below to override selected contact details for this lead.</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salesman</label>
                {isAdmin ? (
                  <select
                    value={salesmanId}
                    onChange={(e) => setSalesmanId(e.target.value)}
                    className="w-full rounded-md border-gray-300 bg-white shadow-sm"
                    required
                  >
                    <option value="" disabled>-- Select Salesman --</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={user?.name || ''}
                    disabled
                    className="w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
                  />
                )}
              </div>
            </div>


            {/* Contact Override Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Name</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Mobile</label>
                <input value={mobileAlt} onChange={(e) => setMobileAlt(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={emailField} onChange={(e) => setEmailField(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border-gray-300 shadow-sm" />
            </div>


            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => navigate('/leads')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Lead'}</Button>
            </div>
          </form>
        </main>
      </div>


      <NewCustomerModal
        open={openNewCustomer}
        onClose={() => setOpenNewCustomer(false)}
        onCreated={refreshCustomersAndSelect}
      />
      <NewContactModal
        open={openNewContact}
        onClose={() => setOpenNewContact(false)}
        customerId={customerId}
        onCreated={refreshContactsAndSelectFirst}
      />
    </div>
  );
};


export default CreateLead;
