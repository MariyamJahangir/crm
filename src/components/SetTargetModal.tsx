import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import Select from 'react-select';
import Button from './Button';

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
    const [members, setMembers] = useState<{ value: string; label: string }[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<{ value: string; label: string }[]>([]);
    const [targetAmount, setTargetAmount] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) {
            setMessage('');
            setIsLoading(false);
            setSelectedMembers([]);
            setTargetAmount('');
            return;
        }

        if (token) {
            api.get('/targets/members', token).then(res => {
                if (res.success && res.data) {
                    setMembers(res.data.map((m: Member) => ({ value: m.id, label: m.name })));
                }
            });

            if (editTarget) {
                setSelectedMembers([{ value: editTarget.id, label: editTarget.name }]);
                setTargetAmount(editTarget.target?.toString() || '');
            } else {
                setSelectedMembers([]);
                setTargetAmount('');
            }
        }
    }, [isOpen, token, editTarget]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');

        if (!selectedMembers || selectedMembers.length === 0) {
            setMessage('Please select at least one member.');
            setIsLoading(false);
            return;
        }

        if (targetAmount === '' || isNaN(parseFloat(targetAmount)) || parseFloat(targetAmount) < 0) {
            setMessage('Please enter a valid target amount.');
            setIsLoading(false);
            return;
        }

        try {
            const memberIds = selectedMembers.map(m => m.value);
            const payload = { targetValue: parseFloat(targetAmount) };

            let res;

            if (memberIds.length === members.length) {
                // Bulk update all active members
                res = await api.post('/targets/bulk', payload, token);
            } else {
                // Individual update for selected members
                const promises = memberIds.map(id =>
                    api.post('/targets', { ...payload, memberId: id }, token)
                );
                const results = await Promise.all(promises);

                if (results.every(r => r.success)) {
                    res = { success: true, message: 'Targets successfully set/updated for selected members.' };
                } else {
                    res = { success: false, message: 'One or more targets failed to set.' };
                }
            }

            if (res.success) {
                setMessage(res.message || 'Target action complete.');
                setTimeout(() => onClose(), 1500);
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
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/20 backdrop-blur-sm p-6">
            <div className="bg-white/60 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30
                            w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-white/20 dark:border-midnight-700/30 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">
                        {editTarget ? `Edit Target for ${editTarget.name}` : 'Set Sales Target'}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-ivory-200 hover:bg-white/20 dark:hover:bg-midnight-700/30 transition">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    <div>
                        <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Select Members</label>
                        <Select
                            isMulti
                            options={members}
                            value={selectedMembers}
                            onChange={(selected) => setSelectedMembers(Array.isArray(selected) ? selected : [])}
                            isDisabled={!!editTarget}
                            placeholder="Select one or more members..."
                            closeMenuOnSelect={false}
                        />

                    </div>

                    <div>
                        <label htmlFor="targetAmount" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                            Target Amount ($)
                        </label>
                        <input
                            id="targetAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={targetAmount}
                            onChange={e => setTargetAmount(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-white/30 dark:border-midnight-700/30
                                       bg-white/50 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100
                                       shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                            placeholder="e.g., 50000"
                            required
                        />
                    </div>

                    {message && <p className={`text-sm font-semibold text-center ${message.toLowerCase().includes('success') || message.toLowerCase().includes('complete') ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{message}</p>}

                    <div className="flex justify-end gap-4 pt-4 border-t border-white/20 dark:border-midnight-700/30">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || targetAmount === '' || selectedMembers.length === 0}
                        >
                            {isLoading ? 'Saving...' : 'Save Target'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetTargetModal;
