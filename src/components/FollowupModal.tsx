import React, { useState } from 'react';
import Button from './Button';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { status: string; description?: string; scheduledAt?: string }) => Promise<void>;
  leadNumber: string;
  salesmanName?: string | null;
};

const STATUS = ['Followup', 'Meeting Scheduled', 'No Requirement', 'No Response'] as const;

const FollowupModal: React.FC<Props> = ({ open, onClose, onSubmit, leadNumber, salesmanName }) => {
  const [status, setStatus] = useState<typeof STATUS[number]>('Followup');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string>(''); // local datetime
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      await onSubmit({
        status,
        description: description || undefined,
        scheduledAt: scheduledAt || undefined
      });
      onClose();
      // reset after close
      setStatus('Followup');
      setDescription('');
      setScheduledAt('');
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to add followup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">Add Followup</div>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{err}</div>}

          <div className="text-sm text-gray-700">
            <div>Lead Number: <span className="font-medium">{leadNumber}</span></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Call Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
              {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Notes about the call..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Date/Time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <div className="text-xs text-gray-500 mt-1">Optional: only future times will show in the list.</div>
          </div>

          <div className="text-sm text-gray-700">
            <div>Salesman: <span className="font-medium">{salesmanName || '-'}</span></div>
          </div>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Add Followup'}</Button>
        </div>
      </div>
    </div>
  );
};

export default FollowupModal;
