import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import { customerService } from '../services/customerService';
import { teamService, TeamUser } from '../services/teamService';
import { toast } from 'react-hot-toast';

const STAGES = ['Discover', 'Solution Validation', 'Quote Negotiation', 'Deal Closed', 'Deal Lost', 'Fake Lead'] as const;
const FORECASTS = ['Pipeline', 'BestCase', 'Commit'] as const;
const SOURCES = ['Website', 'Referral', 'Advertisement', 'Event', 'Cold Call', 'Other'] as const;

const EditLead: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user, isLoading } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const navigate = useNavigate();

  // State
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Master data
  const [customers, setCustomers] = useState<{ id: string; companyName: string }[]>([]);
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
    // --- NEW: Integrated Accompaniment State ---

  // Controlled form fields
  const [stage, setStage] = useState<typeof STAGES[number]>('Discover');
  const [forecastCategory, setForecastCategory] = useState<typeof FORECASTS[number]>('Pipeline');
  const [customerId, setCustomerId] = useState('');
  const [source, setSource] = useState('Website');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileAlt, setMobileAlt] = useState('');
  const [emailField, setEmailField] = useState('');
  const [city, setCity] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [description, setDescription] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');

  const [isAlreadyShared, setIsAlreadyShared] = useState(false);
  const [accompanySalesman, setAccompanySalesman] = useState(false);
  const [accompaniedMemberId, setAccompaniedMemberId] = useState('');
  // UI Refs
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const stageButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  const loadLeadData = async () => {
    if (!id || !token) return;
    setLoading(true);
    try {
      const [leadRes, custs, team] = await Promise.all([
        leadsService.getOne(id, token),
        customerService.list(token),
        teamService.listForSelection(token)
      ]);
console.log(leadRes)
console.log(custs)
      const currentLead = leadRes.lead;
      setLead(currentLead);
      setCustomers(custs.customers.map(c => ({ id: c.id, companyName: c.companyName })));
      setSalesmen(team.users);
if (currentLead.shares && currentLead.shares.length > 0) {
        const currentShare = currentLead.shares[0]; 
        if (currentShare.sharedWithMember?.id) {
          setAccompanySalesman(true);
          setAccompaniedMemberId(currentShare.sharedWithMember.id);
        }
      }
         if (currentLead.shares && currentLead.shares.length > 0) {
        setIsAlreadyShared(true);
      }
      setStage(currentLead.stage);
      setForecastCategory(currentLead.forecastCategory);
      setCustomerId(currentLead.customerId || '');
      setSource(currentLead.source || 'Website');
      setContactPerson(currentLead.contactPerson || '');
      setMobile(currentLead.mobile || '');
      setMobileAlt(currentLead.mobileAlt || '');
      setEmailField(currentLead.email || '');
      setCity(currentLead.city || '');
      setCountry(currentLead.country || '');
      setAddress(currentLead.address || '');
      setSalesmanId(currentLead.salesman?.id || '');
      setDescription(currentLead.description || '');
      setLostReason(currentLead.lostReason || '');
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to load lead data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeadData();
  }, [id, token]);

  useLayoutEffect(() => {
    const activeIndex = STAGES.indexOf(stage);
    const activeButton = stageButtonRefs.current[activeIndex];
    if (activeButton && stageContainerRef.current) {
      const containerRect = stageContainerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width
      });
    }
  }, [stage, loading]);

  const isCreator = user?.id === lead?.creatorId || isAdmin;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const payload: any = {
        stage, forecastCategory, source, contactPerson, mobile, mobileAlt,
        email: emailField, city, country, address, description
      };
      if (stage === 'Deal Lost') payload.lostReason = lostReason;
      if (isAdmin) {
        payload.customerId = customerId || undefined;
        payload.salesmanId = salesmanId || undefined;
      }
        const isCreatorOrAdmin = user?.id === lead?.creatorId || isAdmin;
       if (isCreator && !isAlreadyShared && accompanySalesman && accompaniedMemberId) {
        payload.accompaniedMemberId = accompaniedMemberId;
      }
      await leadsService.update(id, payload, token);
      toast.success('Lead updated successfully');
      navigate(`/leads/${id}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

 const availableForAccompaniment = salesmen.filter(s => {
        if (s.isBlocked) return false;
        if (s.id === salesmanId) return false;
        // The current selection should still be in the list
        if (s.id === accompaniedMemberId) return true;
        // Exclude anyone else who might be shared (if multi-share was a feature)
        if ((lead?.shares ?? []).some(share => share.sharedWithMember.id === s.id)) return false;
        return true;
    });

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-5xl mx-auto py-6 px-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-midnight-800 dark:text-ivory-100">
              Edit Lead #{lead?.uniqueNumber}
            </h1>
            <p className="text-midnight-600 dark:text-ivory-400 mt-1">
              Update lead details.
            </p>
          </div>
          <form onSubmit={save}
            className="space-y-8 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30">
            <div>
              <div ref={stageContainerRef}
                className="relative flex w-full flex-wrap items-center p-1 rounded-full bg-cloud-200/60 dark:bg-midnight-800/60 border border-cloud-300/40 dark:border-midnight-700/40">
                <span className="absolute rounded-full bg-sky-500 shadow-lg transition-all duration-300 ease-in-out"
                  style={indicatorStyle} />
                {STAGES.map((s, index) => (
                  <button key={s} ref={el => (stageButtonRefs.current[index] = el)} type="button"
                    className={`relative z-10 flex-1 h-11 flex items-center justify-center px-3 text-sm font-semibold rounded-full transition-colors duration-300 ${stage === s ? 'text-white' : 'text-midnight-600 dark:text-ivory-300 hover:text-midnight-900 dark:hover:text-ivory-100'}`}
                    onClick={() => setStage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Forecast</div>
              <div className="flex gap-4">
                {FORECASTS.map((f) => (
                  <label key={f} className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="forecast" value={f} checked={forecastCategory === f} onChange={() => setForecastCategory(f)} />
                    <span>{f}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div>
    <label className="block text-sm font-medium mb-2">Company</label>
    {/* REPLACED select with disabled input */}
    <input
      value={lead?.companyName || ''}
      disabled
      className="w-full h-10 px-3 rounded-xl border bg-gray-100 dark:bg-midnight-800 cursor-not-allowed"
    />
  </div>
              <div>
                <label className="block text-sm font-medium mb-2">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full h-10 px-3 rounded-xl border">
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Contact Person</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full h-10 px-3 rounded-xl border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Salesman</label>
                {isAdmin ? (
                  <select value={salesmanId} onChange={e => setSalesmanId(e.target.value)} className="w-full h-10 px-3 rounded-xl border" required>
                    <option value="">-- Select Salesman --</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.isBlocked}>{s.name} {s.isBlocked ? '(Blocked)' : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input value={lead?.salesman?.name || ''} disabled className="w-full h-10 px-3 rounded-xl border" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mobile</label>
                <input value={mobile} onChange={e => setMobile(e.target.value)} className="w-full h-10 px-3 rounded-xl border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Alternative Mobile</label>
                <input value={mobileAlt} onChange={e => setMobileAlt(e.target.value)} className="w-full h-10 px-3 rounded-xl border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input type="email" value={emailField} onChange={e => setEmailField(e.target.value)} className="w-full h-10 px-3 rounded-xl border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <input value={city} onChange={e => setCity(e.target.value)} className="w-full h-10 px-3 rounded-xl border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Country</label>
                <input value={country} onChange={e => setCountry(e.target.value)} className="w-full h-10 px-3 rounded-xl border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full px-3 py-2 rounded-xl border" rows={1} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description / Notes</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-xl border" />
            </div>
            {stage === 'Deal Lost' && (
              <div>
                <label className="block text-sm font-medium mb-2">Lost Reason</label>
                <input value={lostReason} onChange={e => setLostReason(e.target.value)} className="w-full h-10 px-3 rounded-xl border" placeholder="Reason for losing the deal" />
              </div>
            )}
            {isCreator && (
        <div className="p-4 border border-cloud-300 dark:border-midnight-700 rounded-lg space-y-4">
          {isAlreadyShared ? (
            <div>
              <label className="block text-sm font-medium mb-1">Shared With</label>
              <p className="font-semibold text-midnight-800 dark:text-ivory-200">
                {lead?.shares?.[0]?.sharedWithMember?.name || 'An unknown member'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                This lead has already been shared and cannot be modified.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center">
                <input
                  id="accompany-salesman-checkbox"
                  type="checkbox"
                  checked={accompanySalesman}
                  onChange={(e) => {
                    setAccompanySalesman(e.target.checked);
                    if (!e.target.checked) {
                      setAccompaniedMemberId('');
                    }
                  }}
                  className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                />
                <label htmlFor="accompany-salesman-checkbox" className="ml-3 block text-sm font-medium">
                  Accompany another Salesman
                </label>
              </div>

              {accompanySalesman && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium mb-1">Select Member to Accompany</label>
                  <select
                    value={accompaniedMemberId}
                    onChange={e => setAccompaniedMemberId(e.target.value)}
                    required={accompanySalesman}
                    className="w-full sm:w-1/2 h-10 px-3 rounded-xl border"
                  >
                    <option value="" disabled>-- Select Member --</option>
                    {availableForAccompaniment.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      )}
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate(`/leads/${id}`)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};

export default EditLead;

