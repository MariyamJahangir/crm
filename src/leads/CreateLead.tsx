// pages/CreateLead.tsx
import React, { useEffect,useRef, useLayoutEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';
import { teamService, TeamUser } from '../services/teamService';
import { customerService } from '../services/customerService';
import NewCustomerModal from '../components/NewCustomerModal';
import NewContactModal from '../components/NewContactModal';
import {toast} from 'react-hot-toast';
import CustomSelect from '../components/CustomSelect';
import { Plus } from 'lucide-react';
type CustomerLite = { id: string; companyName: string };


const STAGES = ['Discover', 'Solution Validation', 'Quote Negotiation', 'Deal Closed', 'Deal Lost', 'Fake Lead'] as const;
const FORECASTS = ['Pipeline', 'BestCase', 'Commit'] as const;
const SOURCES = ['Website', 'Referral', 'Advertisement', 'Event', 'Cold Call', 'Other'] as const;


const CreateLead: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';

  const [indicatorStyle, setIndicatorStyle] = useState({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [allSalesmen, setAllSalesmen] = useState<TeamUser[]>([]); // To store the full list
  const [salesmanId, setSalesmanId] = useState(isAdmin ? '' : user?.id || '');

  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; mobile?: string; email?: string }[]>([]);


  const [stage, setStage] = useState<typeof STAGES[number]>('Discover');
  const [forecastCategory, setForecastCategory] = useState<typeof FORECASTS[number]>('Pipeline');


  const [customerId, setCustomerId] = useState('');
  const [contactId, setContactId] = useState<string>('');
  const [source, setSource] = useState('Website');
    const [country, setCountry] = useState(''); // New field
    const [address, setAddress] = useState(''); 

  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileAlt, setMobileAlt] = useState('');
  const [emailField, setEmailField] = useState('');
  const [city, setCity] = useState('');


  const [description, setDescription] = useState('');


  const [submitting, setSubmitting] = useState(false);
    const [accompanySalesman, setAccompanySalesman] = useState(false);
    const [accompaniedMemberId, setAccompaniedMemberId] = useState('');

  const [openNewCustomer, setOpenNewCustomer] = useState(false);
  const [openNewContact, setOpenNewContact] = useState(false);


  // Load team and customers
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [teamRes, customersRes] = await Promise.all([
          teamService.listForSelection(token),
          customerService.list(token),
        ]);
        
         setAllSalesmen(teamRes.users);
      
        console.log(teamRes)
        const liteCustomers = customersRes.customers.map((c) => ({ id: c.id, companyName: c.companyName }));
        setCustomers(liteCustomers);

      } catch {
        toast.error('Failed to load initial data.');
      }
    })();
  }, [token, user?.id, isAdmin]);

  useLayoutEffect(() => {
    const activeIndex = STAGES.indexOf(stage);
    const activeButton = buttonRefs.current[activeIndex];
    
    if (activeButton && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, [stage]);
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
        if (!customerId || !contactId || (isAdmin && !salesmanId)) {
            toast.error('Please fill all required fields: Company, Contact, and Salesman.');
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = {
                stage, forecastCategory, customerId, source,
                contactPerson: contactPerson || undefined,
                mobile: mobile || undefined, mobileAlt: mobileAlt || undefined,
                email: emailField || undefined, city: city || undefined,
                country: country || undefined, address: address || undefined,
                description: description || undefined, contactId: contactId || undefined,
                salesmanId,
            };

            // --- SIMPLIFIED: Conditionally add accompanied salesman ID ---
            if (accompanySalesman && accompaniedMemberId) {
                payload.shareGpData = {
                    sharedMemberId: accompaniedMemberId,
                };
            }

            const out = await leadsService.create(payload, token);
            toast.success('Lead created successfully');
            navigate(`/leads/${out.id}`, { replace: true });
        } catch (e: any) {
            toast.error(e?.data?.message || 'Failed to create lead');
        } finally {
            setSubmitting(false);
        }
    };
console.log(allSalesmen)
const availableForAccompaniment = allSalesmen.filter(member => {
    // Rule 1: Exclude any member who is blocked.
    if (member.isBlocked) {
        return false;
    }
    // Rule 2: Exclude the member who is already the primary salesman for this lead.
    if (member.id === salesmanId) {
        return false;
    }
    // If neither exclusion rule applies, include the member.
    return true;
});



  return (
    <div className="flex min-h-screen  z-10 transition-colors duration-300">
      <Sidebar />

      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-5xl mx-auto py-6 px-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100">
              Create Lead
            </h1>
            <p className="text-gray-700 dark:text-gray-600 mt-1">
              Select company, salesman, and contact. Create new ones inline if needed.
            </p>
          </div>



          <form
            onSubmit={save}
            className="space-y-6 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
           p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30"
          >
            {/* Stage */}
            <div>
              <div className="text-sm font-bold text-midnight-800 dark:text-ivory-200 mb-3 tracking-wide">
                Lead Stage
              </div>
              <div
                ref={containerRef}
                className="relative flex w-full items-center p-1 rounded-full bg-cloud-200/60 dark:bg-midnight-800/60 backdrop-blur-sm border border-cloud-300/40 dark:border-midnight-700/40"
              >
                {/* Sliding Indicator */}
                <span
                  className="absolute top-1 bottom-1 h-auto rounded-full bg-sky-500 shadow-lg transition-all duration-300 ease-in-out"
                  style={indicatorStyle}
                />

                {/* Buttons */}
                {STAGES.map((s, index) => (
                  <button
                    key={s}
                    ref={(el) => (buttonRefs.current[index] = el)}
                    type="button"
                    className={`relative z-10 flex-1 px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 focus-visible:ring-offset-cloud-100 dark:focus-visible:ring-offset-midnight-800 ${stage === s
                      ? 'text-white'
                      : 'text-midnight-600 dark:text-ivory-300 hover:text-midnight-900 dark:hover:text-ivory-100'
                      }`}
                    onClick={() => setStage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Forecast */}
            <div>
              <div className="text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Forecast</div>
              <div className="flex gap-4">
                {FORECASTS.map((f) => (
                  <label key={f} className="inline-flex items-center gap-2 text-sm text-midnight-700 dark:text-ivory-200">
                    <input
                      type="radio"
                      name="forecast"
                      value={f}
                      checked={forecastCategory === f}
                      onChange={() => setForecastCategory(f)}
                    />
                    <span>{f}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Customer + Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Company*
                </label>
                <div className="flex gap-2">
                  <div className='w-full'>
                    <CustomSelect
                      label={null} // Label is already rendered above, so skip inside component
                      options={customers.map((c) => ({
                        value: c.id,
                        label: c.companyName,
                      }))}
                      value={customerId}
                      onChange={setCustomerId}
                      placeholder="Select a company"
                    />
                  </div>
                  <button
                    className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition"
                    type="button"
                    onClick={() => setOpenNewCustomer(true)}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              <div>
                {/* <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Source</label> */}
                <CustomSelect
                  label="Source" // The label is already above, so skip inside the component
                  options={SOURCES.map((s) => ({
                    value: s,
                    label: s,
                  }))}
                  value={source}
                  onChange={setSource}
                  placeholder="Select..."
                />
              </div>
            </div>

            {/* Contact + Salesman */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Contact*</label>
                <div className="flex gap-2">
                  <div className='w-full'>
                    <CustomSelect
                      label={null}
                      value={contactId || ""}
                      onChange={(val) => setContactId(val || "")}
                      options={
                        contacts.length
                          ? contacts.map((c) => ({
                            value: c.id,
                            label: `${c.name}${c.mobile ? ` (${c.mobile})` : ""}`,
                          }))
                          : []
                      }
                      placeholder={
                        contacts.length ? "Select a contact" : "No contacts available"
                      }
                    />
                  </div>

                  <button className='flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition disabled:bg-sky-300 disabled:text-white/60 disabled:cursor-not-allowed' type="button" onClick={() => setOpenNewContact(true)} disabled={!customerId}><Plus size={20} /></button>


                </div>

                <div className="text-xs text-midnight-600 dark:text-ivory-100 mt-1">
                  Modify fields below to override selected contact details for this lead.
                </div>
              </div>


              <div>


                {isAdmin ? (
                  <CustomSelect
                    label="Salesman"
                    value={salesmanId}
                    onChange={(val) => {
                      setSalesmanId(val);
                      // Prevent conflict if the same salesman is chosen for accompaniment
                      if (val === accompaniedMemberId) {
                        setAccompaniedMemberId('');
                      }
                    }}
                    options={allSalesmen.map((s) => ({
                      value: s.id,
                      label: `${s.name}${s.isBlocked ? ' (Blocked)' : ''}`,
                      isDisabled: s.isBlocked, // keep disabled logic
                    }))}
                    placeholder="-- Select Salesman --"
                  />
                ) : (
                  <input
                    value={user?.name || ''}
                    disabled
                    className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
      bg-gray-100 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm"
                  />
                )}
              </div>


            </div>



            {/* Contact Override Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 pt-4 border-t border-cloud-200/40 dark:border-midnight-700/40">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Contact Person Name</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Mobile</label>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Alternative Mobile</label>
                <input value={mobileAlt} onChange={(e) => setMobileAlt(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Email</label>
                <input type="email" value={emailField} onChange={(e) => setEmailField(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 gap-6 pt-4 border-t border-cloud-200/40 dark:border-midnight-700/40">
              <div className='col-span-2'>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm" />
              </div>
            </div>




            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Description / Notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
               bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm"
              />
            </div>
            <div className="p-4 border border-cloud-300 dark:border-midnight-700 rounded-lg space-y-4">
              
              <div className="flex items-center">
                <input
                  id="accompany-salesman-checkbox"
                  type="checkbox"
                  checked={accompanySalesman}
                  onChange={(e) => setAccompanySalesman(e.target.checked)}
                  className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                />
                <label htmlFor="accompany-salesman-checkbox" className="ml-3 block text-sm font-medium">
                  Accompany another Salesman
                </label>
              </div>

              {accompanySalesman && (
                <div className="border-t pt-4">
                  <CustomSelect
                    label="Select Member to Accompany"
                    options={availableForAccompaniment.map((s) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                    value={accompaniedMemberId}
                    onChange={(val) => setAccompaniedMemberId(val)}
                    placeholder="-- Select Member --"
                  />
                </div>

              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant='secondary'
                className="px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition"
                onClick={() => navigate('/leads')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition"
              >
                {submitting ? 'Saving...' : 'Save Lead'}
              </Button>
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
