// src/components/SetTargetModal.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import Select from 'react-select';
import Button from './Button'; // Import your consistent Button component
import { toast } from 'react-hot-toast';
import CustomSelect from './CustomSelect';

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

// --- UPDATED Styles for react-select to match your theme ---
// const customSelectStyles = {
//     control: (provided: any) => ({
//         ...provided,
//         backgroundColor: 'rgba(30, 41, 59, 0.5)', // dark:bg-midnight-800/50
//         borderColor: 'rgba(51, 65, 85, 0.3)',    // dark:border-midnight-700/30
//         borderRadius: '1.5rem', // rounded-3xl for a more modern feel
//         height: '2.5rem',
//         minHeight: '2.5rem',
//         boxShadow: 'none',
//         '&:hover': {
//             borderColor: 'rgba(56, 189, 248, 0.5)', // focus:border-sky-400
//         },
//     }),
//     singleValue: (provided: any) => ({
//         ...provided,
//         color: '#f5f5f5', // dark:text-ivory-100
//     }),
//     menu: (provided: any) => ({
//         ...provided,
//         backgroundColor: 'rgba(17, 24, 39, 0.8)', // dark:bg-midnight-900 with more opacity
//         backdropFilter: 'blur(12px)',
//         borderRadius: '1rem',
//         border: '1px solid rgba(51, 65, 85, 0.4)', // dark:border-midnight-700/40
//     }),
//     option: (provided: any, state: any) => ({
//         ...provided,
//         color: state.isSelected ? '#FFFFFF' : '#E5E7EB', // ivory-200
//         backgroundColor: state.isSelected
//             ? 'rgba(14, 165, 233, 0.8)' // bg-sky-500
//             : state.isFocused
//             ? 'rgba(51, 65, 85, 0.5)' // midnight-700/50
//             : 'transparent',
//         '&:active': {
//             backgroundColor: 'rgba(14, 165, 233, 0.6)',
//         },
//     }),
//     input: (provided: any) => ({
//         ...provided,
//         color: '#f5f5f5',
//     }),
//     placeholder: (provided: any) => ({
//         ...provided,
//         color: '#9CA3AF', // Corresponds to dark:placeholder-ivory-500
//     }),
// };

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
                setSelectedMember(null);
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
                        {/* <label htmlFor="member" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Select Member</label> */}
                        {/* <Select
                            id="member"
                            value={selectedMember}
                            onChange={setSelectedMember}
                            options={!editTarget ? [{ value: 'all', label: 'All Members' }, ...members] : members}
                            isSearchable
                            isDisabled={!!editTarget}
                            // styles={customSelectStyles}
                            placeholder="Select a member..."
                        /> */}
                        <CustomSelect
                            label="Select Member"
                            value={selectedMember}
                            onChange={setSelectedMember}
                            options={!editTarget ? [{ value: 'all', label: 'All Members' }, ...members] : members}
                            placeholder="Select a member..."
                            isDisabled={!!editTarget}
                        />

                    </div>

                    <div>
                        <label htmlFor="targetAmount" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Target Amount ($)</label>
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
                            disabled={isLoading || !targetAmount}
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

