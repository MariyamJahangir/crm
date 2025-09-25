import React, { useState } from 'react';
import Button from './Button';
import {toast} from 'react-hot-toast';
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
 

  if (!open) return null;

  const save = async () => {
    
    setSaving(true);
    try {
      await onSubmit({
        status,
        description: description || undefined,
        scheduledAt: scheduledAt || undefined
      });
      toast.success('Follow added succesfully')
      onClose();
      // reset after close
      setStatus('Followup');
      setDescription('');
      setScheduledAt('');
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to add followup');
    } finally {
      setSaving(false);
    }
  };

  return (
     <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
    <div className="bg-white/30 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30
                    w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/20 dark:border-midnight-700/30 flex items-center justify-between backdrop-blur-sm">
        <h2 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">Add Followup</h2>
        <button
          className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-ivory-200 hover:bg-white/20 dark:hover:bg-midnight-700/30 transition"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>


      <div className="px-6 py-6 space-y-2 backdrop-blur-sm overflow-auto flex-1">
       

        <div className="text-sm text-midnight-700 dark:text-ivory-200">
          Lead Number: <span className="font-medium">{leadNumber}</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Call Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          >
            {STATUS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Notes about the call..."
            className="w-full px-3 py-2 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Schedule Date/Time</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
                       bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition backdrop-blur-sm"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Optional: only future times will show in the list.
          </div>
        </div>

        <div className="text-sm text-midnight-700 dark:text-ivory-200">
          Salesman: <span className="font-medium">{salesmanName || '-'}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/20 dark:border-midnight-700/30 flex justify-end gap-4 backdrop-blur-sm">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-2xl bg-cloud-100/60 dark:bg-midnight-700/60 
                     border border-cloud-300/40 dark:border-midnight-600/40 
                     text-midnight-700 dark:text-ivory-200 
                     hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 shadow-md transition"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-2xl bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Followup'}
        </Button>
      </div>
    </div>
  </div>
  );
};

export default FollowupModal;
