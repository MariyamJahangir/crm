import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { quotesService } from '../services/quotesService';

const EditQuote: React.FC = () => {
  const { leadId, quoteId } = useParams<{ leadId: string; quoteId: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [status, setStatus] = useState<string>('Draft');
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('');

  const isAdmin = user?.type === 'ADMIN';

  useEffect(() => {
    if (!token || !leadId || !quoteId) return;
    (async () => {
      setLoading(true); setErr(null); setOk(null);
      try {
        const res = await quotesService.getOne(leadId, quoteId, token);
        setStatus(res.quote.status || 'Draft');
        setApprovedBy(res.quote.approvedBy || null);
        setRejectNote(res.quote.rejectNote || '');
      } catch (e: any) {
        setErr(e?.data?.message || 'Failed to load quote');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, leadId, quoteId]);

  const goBack = () => navigate('/quotes');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !leadId || !quoteId || saving) return;
    setSaving(true); setErr(null); setOk(null);
    try {
      await quotesService.update(leadId, quoteId, { status }, token);
      setOk('Quote updated');
      navigate('/quote', { replace: true });
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to update quote');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!token || !leadId || !quoteId || saving) return;
    setSaving(true); setErr(null); setOk(null);
    try {
      await quotesService.approve(leadId, quoteId, token);
      setOk('Quote approved');
      navigate('/quote', { replace: true });
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to approve quote');
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    if (!token || !leadId || !quoteId || saving) return;
    if (!rejectNote.trim()) {
      setErr('Please add a reason before rejecting.');
      return;
    }
    setSaving(true); setErr(null); setOk(null);
    try {
      await quotesService.reject(leadId, quoteId, { note: rejectNote }, token);
      setOk('Quote rejected');
      navigate('/quote', { replace: true });
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to reject quote');
    } finally {
      setSaving(false);
    }
  };

  const memberAllowedStatuses = ['Draft', 'Sent', 'Expired', 'PendingApproval'];
  const adminAllowedStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'PendingApproval'];
  const allowed = isAdmin ? adminAllowedStatuses : memberAllowedStatuses;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Edit Quote</h1>
          </div>

          {loading && <div>Loading...</div>}
          {err && <div className="text-red-600 mb-4">{err}</div>}
          {ok && <div className="text-green-700 mb-4">{ok}</div>}

          {!loading && (
            <form onSubmit={save} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border rounded px-3 py-2 bg-white"
                  >
                    {allowed.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    {isAdmin ? 'Admins can accept/reject.' : 'Members cannot accept/reject; admin approval required.'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Approved By</label>
                  <input
                    value={approvedBy || ''}
                    readOnly
                    className="w-full border rounded px-3 py-2 bg-gray-100"
                  />
                </div>

                {isAdmin ? (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">Reject Note (admin)</label>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={3}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Add a brief reason when rejecting"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      This note is visible to the member when a quote is rejected.
                    </div>
                  </div>
                ) : (
                  rejectNote && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1">Reject Note</label>
                      <textarea value={rejectNote} readOnly rows={3} className="w-full border rounded px-3 py-2 bg-gray-100" />
                    </div>
                  )
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={goBack}
                  disabled={saving}
                >
                  Cancel
                </Button>
                {!isAdmin && (
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                )}
                {isAdmin && (
                  <>
                    <Button type="button" variant="secondary" onClick={reject} disabled={saving}>
                      {saving ? 'Working...' : 'Reject'}
                    </Button>
                    <Button type="button" onClick={approve} disabled={saving}>
                      {saving ? 'Working...' : 'Approve'}
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default EditQuote;
