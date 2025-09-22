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

// Custom styles for react-select to match the glassmorphism theme
const customSelectStyles = {
    control: (provided: any) => ({
        ...provided,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '0.5rem',
        boxShadow: 'none',
        '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.4)',
        },
    }),
    singleValue: (provided: any) => ({
        ...provided,
        color: '#2e2e2eff', // slate-200
    }),
    menu: (provided: any) => ({
        ...provided,
        backgroundColor: 'rgba(30, 41, 59, 0.8)', // slate-800 with opacity
        backdropFilter: 'blur(10px)',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255, 255, 255, 0.2)',
    }),
    option: (provided: any, state: any) => ({
        ...provided,
        color: state.isSelected ? '#FFFFFF' : '#E2E8F0',
        backgroundColor: state.isFocused ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        '&:active': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
        },
    }),
    input: (provided: any) => ({
        ...provided,
        color: '#FFFFFF',
    }),
    placeholder: (provided: any) => ({
        ...provided,
        color: '#94A3B8', // slate-400
    }),
};

const SetTargetModal: React.FC<SetTargetModalProps> = ({ isOpen, onClose, token, editTarget }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [targetAmount, setTargetAmount] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
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
                setSelectedMember(null); // Default to null for placeholder
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
                res = await api.post('/targets', { ...payload, memberId: selectedMember.value }, token);
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 dark:bg-midnight-800/50 backdrop-blur-lg border border-white/20 dark:border-midnight-700/40 rounded-2xl shadow-2xl p-6 w-full max-w-md transform transition-all">
                
                <div className="flex justify-between items-center border-b border-white/20 dark:border-midnight-700/40 pb-3 mb-5">
                    <h2 className="text-xl font-bold text-white">{editTarget ? `Edit Target for ${editTarget.name}` : 'Set Sales Target'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-ivory-300 hover:bg-white/10 hover:text-white transition-colors">
                        <X size={22} />
                    </button>
                </div>

               <form onSubmit={handleSubmit} className="space-y-5">
    <div>
        <label htmlFor="member" className="block text-sm font-medium text-white mb-1">Select Member</label>
        <Select
            id="member"
            value={selectedMember}
            onChange={setSelectedMember}
            options={[{ value: "all", label: "All Members" }, ...members]}
            isSearchable
            isDisabled={!!editTarget}
            // The placeholder style is controlled here
            styles={{
                ...customSelectStyles,
                placeholder: (provided) => ({
                    ...provided,
                    color: '#bbbbbbff', // A darker, more visible gray (slate-300)
                }),
            }}
            placeholder="Select a member..."
        />
    </div>

    <div>
        <label htmlFor="targetAmount" className="block text-sm font-medium text-white  mb-1">Target Amount ($) for this Month</label>
        <input
            id="targetAmount"
            type="number"
            step="0.01"
            min="0"
            value={targetAmount}
            onChange={e => setTargetAmount(e.target.value)}
            // The placeholder style is controlled here
             className="w-full p-2 h-10 rounded-lg bg-white/10 dark:bg-midnight-700 border border-white/20 dark:border-midnight-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 focus:outline-none transition"
            placeholder="e.g., 50000"
            required
          />
        </div>

    {message && <p className={`text-sm font-semibold text-center ${message.toLowerCase().includes('success') ? 'text-green-800' : 'text-red-400'}`}>{message}</p>}

    <div className="flex justify-end space-x-4 pt-4">
        <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-slate-200 text-gray-700 rounded-lg hover:bg-white/20 border border-white/20 transition-colors disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={isLoading || !targetAmount} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed">
            {isLoading ? 'Saving...' : 'Save Target'}
        </button>
    </div>
</form>

            </div>
        </div>
    );
};

export default SetTargetModal;

