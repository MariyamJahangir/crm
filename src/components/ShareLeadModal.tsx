// src/components/ShareLeadModal.tsx

import React,{  useState ,useEffect} from 'react';
import toast from 'react-hot-toast';
import { leadsService } from '../services/leadsService';
import { teamService, TeamUser } from '../services/teamService';
import { useAuth } from '../contexts/AuthContext';


interface ShareLeadModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  creatorId?: string | null;
}

const ShareLeadModal: React.FC<ShareLeadModalProps> = ({ open, onClose, leadId, creatorId }) => {
  const { token, user } = useAuth();
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [profitPercentage, setProfitPercentage] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && token) {
      teamService.list(token)
        .then(res => {
          // Filter out the current user/creator from the list of members to share with
          const filteredUsers = res.users.filter(u => u.id !== creatorId && u.id !== user?.id);
          setMembers(filteredUsers);
        })
        .catch(() => toast.error('Failed to load team members.'));
    }
  }, [open, token, creatorId, user?.id]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !selectedMember) {
      toast.error('Please select a member to share with.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sharedMemberId: selectedMember,
        profitPercentage: profitPercentage ? parseFloat(profitPercentage) : undefined,
        profitAmount: profitAmount ? parseFloat(profitAmount) : undefined,
      };
      await leadsService.shareLead(leadId, payload, token);
      toast.success('Lead shared successfully!');
      onClose();
      // Reset form
      setSelectedMember('');
      setProfitPercentage('');
      setProfitAmount('');
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to share lead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-midnight-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-midnight-900 dark:text-ivory-100">Share Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="member" className="block text-sm font-medium text-gray-700 dark:text-ivory-200">Share with Member</label>
            <select
              id="member"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="mt-1 block w-full h-10 px-3 rounded-xl border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 dark:bg-midnight-700 dark:border-midnight-600 dark:text-white"
            >
              <option value="" disabled>Select a member</option>
              {members.map(member => (
                <option key={member.id} value={member.id} disabled={member.isBlocked}>
                  {member.name} {member.isBlocked ? '(Blocked)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="profitPercentage" className="block text-sm font-medium text-gray-700 dark:text-ivory-200">Profit Percentage (%)</label>
                  <input
                    type="number"
                    id="profitPercentage"
                    value={profitPercentage}
                    onChange={(e) => setProfitPercentage(e.target.value)}
                    className="mt-1 block w-full h-10 px-3 rounded-xl border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 dark:bg-midnight-700 dark:border-midnight-600 dark:text-white"
                    placeholder="e.g., 10"
                    min="0" max="100" step="0.01"
                  />
              </div>
               <div>
                  <label htmlFor="profitAmount" className="block text-sm font-medium text-gray-700 dark:text-ivory-200">Profit Amount</label>
                  <input
                    type="number"
                    id="profitAmount"
                    value={profitAmount}
                    onChange={(e) => setProfitAmount(e.target.value)}
                    className="mt-1 block w-full h-10 px-3 rounded-xl border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 dark:bg-midnight-700 dark:border-midnight-600 dark:text-white"
                    placeholder="e.g., 500"
                    min="0" step="0.01"
                  />
              </div>
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-midnight-500 text-gray-700 dark:text-ivory-200">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:bg-gray-400">
              {submitting ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShareLeadModal;
