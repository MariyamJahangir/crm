// pages/EditLead.tsx
import React, { useEffect, useState,useRef, useLayoutEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import { customerService } from '../services/customerService';
import { teamService, TeamUser } from '../services/teamService';

const STAGES = ['Discover', 'Solution Validation', 'Quote', 'Negotiation', 'Deal Closed', 'Deal Lost', 'Fake Lead'] as const;
const FORECASTS = ['Pipeline', 'BestCase', 'Commit'] as const;
const SOURCES = ['Website', 'Referral', 'Advertisement', 'Event', 'Cold Call', 'Other'] as const;
type Stage = typeof STAGES[number];

const EditLead: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user, isLoading } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<typeof STAGES[number]>('Discover');
  const [forecastCategory, setForecastCategory] = useState<typeof FORECASTS[number]>('Pipeline');
  const [customerId, setCustomerId] = useState<string>('');
  const [customers, setCustomers] = useState<{ id: string; companyName: string }[]>([]);
  const [source, setSource] = useState('Website');
  
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileAlt, setMobileAlt] = useState('');
  const [emailField, setEmailField] = useState('');
  const [city, setCity] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [description, setDescription] = useState('');
  const [lostReason, setLostReason] = useState<string>('');
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const stageButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!id || !token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [leadRes, custs, team] = await Promise.all([
          leadsService.getOne(id, token),
          customerService.list(token),
          teamService.list(token),
        ]);

        const currentLead = leadRes.lead;
        setLead(currentLead);
        setCustomers(custs.customers.map(c => ({ id: c.id, companyName: c.companyName })));
        setSalesmen(team.users);

        setStage(currentLead.stage);
        setForecastCategory(currentLead.forecastCategory);
        setCustomerId(currentLead.customerId || '');
        setSource(currentLead.source || 'Website');
        setContactPerson(currentLead.contactPerson || '');
        setMobile(currentLead.mobile || '');
        setMobileAlt(currentLead.mobileAlt || '');
        setEmailField(currentLead.email || '');
        setCity(currentLead.city || '');
        setSalesmanId(currentLead.salesman?.id || '');
        setDescription(currentLead.description || '');
        setLostReason(currentLead.lostReason || '');
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load lead');
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [id, token]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        stage,
        forecastCategory,
        source,
        contactPerson,
        mobile,
        mobileAlt,
        email: emailField,
        city,
        description,
        lostReason: stage === 'Deal Lost' ? lostReason : undefined,
      };

      // Only allow admins to change customer and salesman
      if (isAdmin) {
        payload.customerId = customerId || undefined;
        payload.salesmanId = salesmanId || undefined;
      }

      await leadsService.update(id, payload, token);
      navigate(`/leads/${id}`, { replace: true });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };
useLayoutEffect(() => {
    const activeIndex = STAGES.indexOf(stage);
    const activeButton = stageButtonRefs.current[activeIndex];
    
    if (activeButton) {
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
        top: activeButton.offsetTop,
        height: activeButton.offsetHeight,
      });
    }
  }, [stage]); 

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-600">Loading...</div></div>;
  }
  if (!token) return null;

  return (
    <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
    <Sidebar />

    <div className="flex-1 overflow-y-auto h-screen">
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-midnight-800 dark:text-ivory-100">
            Edit Lead #{lead?.uniqueNumber}
          </h1>
          <p className="text-midnight-400 dark:text-ivory-400 mt-1">
            Update lead details.
          </p>
        </div>

        {loading && <div className="text-midnight-600 dark:text-ivory-300">Loading...</div>}
        {error && (
          <div className="bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 
            text-stone-700 dark:text-stone-200 px-4 py-3 rounded-lg mb-6 shadow-sm">
            {error}
          </div>
        )}

        {!loading && lead && (
           <form
              onSubmit={save}
              className="space-y-8 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
                         p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30"
            >
              {/* --- New Integrated Stage Selector --- */}
              
                 <div>
              <div
  ref={stageContainerRef}
  className="relative flex w-full flex-wrap items-center p-1 rounded-full bg-cloud-200/60 dark:bg-midnight-800/60 backdrop-blur-sm border border-cloud-300/40 dark:border-midnight-700/40"
>
  <span
    className="absolute rounded-full bg-sky-500 shadow-lg transition-all duration-300 ease-in-out"
    style={indicatorStyle}
  />
  {STAGES.map((s, index) => (
    <button
      key={s}
      ref={(el) => (stageButtonRefs.current[index] = el)}
      type="button"
      className={`relative z-10 flex-1 h-11 flex items-center justify-center px-3 text-sm font-semibold rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 focus-visible:ring-offset-cloud-100 dark:focus-visible:ring-offset-midnight-800 ${
        stage === s
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
              <div className="flex gap-3">
                {FORECASTS.map((f) => (
                  <label
                    key={f}
                    className="inline-flex items-center gap-2 text-sm text-midnight-700 dark:text-ivory-300"
                  >
                    <input
                      type="radio"
                      name="forecast"
                      value={f}
                      checked={forecastCategory === f}
                      onChange={() => setForecastCategory(f)}
                      className="text-sky-500 focus:ring-sky-400"
                    />
                    <span>{f}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Customer + Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Customer (Company)
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                  disabled={!isAdmin}
                >
                  <option value="">-- Select --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                >
                  {SOURCES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contact + Salesman + Mobile + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Contact Person
                </label>
                <input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Salesman
                </label>
                {isAdmin ? (
                  <select
                    value={salesmanId}
                    onChange={(e) => setSalesmanId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                     bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                     focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                  >
                    <option value="">-- Select --</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={lead.salesman?.name || ''}
                    disabled
                    className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                     bg-midnight-100 dark:bg-midnight-700/40 text-midnight-600 dark:text-ivory-300 shadow-sm"
                  />
                )}
              </div>

              {/* Mobile Fields */}
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Mobile
                </label>
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Alternative Mobile
                </label>
                <input
                  value={mobileAlt}
                  onChange={(e) => setMobileAlt(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={emailField}
                  onChange={(e) => setEmailField(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                Description / Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                 focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
              />
            </div>

            {/* Lost Reason */}
            {stage === 'Deal Lost' && (
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                  Lost Reason
                </label>
                <input
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm 
                   focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition"
                  placeholder="Reason for losing the deal"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                className="px-5 py-2 rounded-xl bg-cloud-100/60 dark:bg-midnight-700/60 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-midnight-700 dark:text-ivory-200 
                 hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 
                 backdrop-blur-md shadow-md transition"
                onClick={() => navigate(`/leads/${id}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-sky-500/90 hover:bg-sky-600 
                 text-white shadow-lg transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  </div>
  );
};

export default EditLead;
