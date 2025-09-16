// pages/EditLead.tsx
import React, { useEffect, useState } from 'react';
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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-600">Loading...</div></div>;
  }
  if (!token) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Edit Lead #{lead?.uniqueNumber}</h1>
            <p className="text-gray-600">Update lead details.</p>
          </div>

          {loading && <div>Loading...</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

          {!loading && lead && (
            <form onSubmit={save} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Company)</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-md border-gray-300 bg-white shadow-sm"
                    disabled={!isAdmin}
                  >
                    <option value="">-- Select --</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm">
                    {SOURCES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salesman</label>
                  {isAdmin ? (
                    <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} className="w-full rounded-md border-gray-300 bg-white shadow-sm">
                      <option value="">-- Select --</option>
                      {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <input value={lead.salesman?.name || ''} disabled className="w-full rounded-md border-gray-300 bg-gray-100 shadow-sm" />
                  )}
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

              {stage === 'Deal Lost' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lost Reason</label>
                  <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Reason for losing the deal" />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => navigate(`/leads/${id}`)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default EditLead;
