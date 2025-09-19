import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import Select from 'react-select';

interface Member {
    id: string;
    name: string;
}

interface SetTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string | null;
    editTarget?: any;
}

const SetTargetModal: React.FC<SetTargetModalProps> = ({ isOpen, onClose, token, editTarget }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [targetAmount, setTargetAmount] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        // ★★★ FIX: Reset state when modal opens or closes ★★★
        if (!isOpen) {
            setMessage('');
            setIsLoading(false);
            return;
        }

        if (token) {
            api.get('/targets/members', token).then(res => {
                if (res.success && res.data) {
                    setMembers(res.data.map((m: Member) => ({ value: m.id, label: m.name })));
                }
            });

            if (editTarget) {
                setSelectedMember({ value: editTarget.id, label: editTarget.name });
                setTargetAmount(editTarget.target?.toString() || '');
            } else {
                setSelectedMember({ value: 'all', label: 'All Members' });
                setTargetAmount('');
            }
        }
    }, [isOpen, token, editTarget]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');

        if (!selectedMember || !selectedMember.value) {
            setMessage('Please select a member.');
            setIsLoading(false);
            return;
        }

        try {
            const payload = { targetAmount: parseFloat(targetAmount) };
            let res;

            if (selectedMember.value === 'all') {
                res = await api.post('/targets/bulk', payload, token);
            } else {
                // Ensure memberId is included in the payload
                res = await api.post('/targets', { ...payload, memberId: selectedMember.value }, token);
            }

            if (res.success) {
                setMessage(res.message || 'Target action complete.');
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setMessage(res.message || 'An unknown error occurred.');
            }

        } catch (err: any) {
            setMessage(err.response?.data?.message || err.message || 'Failed to save target.');
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md transform transition-all">
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h2 className="text-xl font-bold text-gray-800">{editTarget ? `Edit Target for ${editTarget.name}` : 'Set Sales Target'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="member" className="block text-sm font-medium text-gray-700 mb-1">Select Member</label>
                        <Select
                            id="member"
                            value={selectedMember}
                            onChange={setSelectedMember}
                            options={[{ value: 'all', label: 'All Members' }, ...members]}
                            isSearchable
                            isDisabled={!!editTarget}
                        />
                    </div>

                    <div>
                        <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 mb-1">Target Amount ($) for this Month</label>
                        <input id="targetAmount" type="number" step="0.01" min="0" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., 50000" required />
                    </div>

                    {message && <p className={`font-semibold text-center animate-pulse ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}

                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Cancel</button>
                        <button type="submit" disabled={isLoading || !targetAmount} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed">
                            {isLoading ? 'Saving...' : 'Save Target'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetTargetModal;
