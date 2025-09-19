import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

interface Member {
    id: string;
    name: string;
}

interface SetTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string | null;
}

const SetTargetModal: React.FC<SetTargetModalProps> = ({ isOpen, onClose, token }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<string>('');
    const [targetAmount, setTargetAmount] = useState<string>('');
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen && token) {
            api.get('/targets/members', token).then(res => {
                if (res.success && res.data) {
                    setMembers(res.data);
                    // Set default to "All Members"
                    setSelectedMember('all');
                }
            });
        }
    }, [isOpen, token]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');

        try {
            const payload = { year, month, targetAmount };
            let res;
            if (selectedMember === 'all') {
                res = await api.post('/targets/bulk', payload, token);
            } else {
                res = await api.post('/targets', { ...payload, memberId: selectedMember }, token);
            }

            setMessage(res.message || 'Target action complete.');
            setTimeout(() => {
                onClose(); // Close and trigger a data refresh
                setMessage('');
                setTargetAmount('');
            }, 1500);

        } catch (err: any) {
            setMessage(err.message || 'Failed to save target.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md transform transition-all">
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h2 className="text-xl font-bold text-gray-800">Set Sales Target</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 transition-colors"><X size={22} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="member" className="block text-sm font-medium text-gray-700 mb-1">Select Member</label>
                        <select id="member" value={selectedMember} onChange={e => setSelectedMember(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                            <option value="all">All Members</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="flex space-x-4">
                        <div className="flex-1">
                            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <input id="year" type="number" min="2020" value={year} onChange={e => setYear(parseInt(e.target.value, 10))} className="w-full p-2 border border-gray-300 rounded-md" required />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                            <input id="month" type="number" min="1" max="12" value={month} onChange={e => setMonth(parseInt(e.target.value, 10))} className="w-full p-2 border border-gray-300 rounded-md" required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 mb-1">Target Amount ($)</label>
                        <input id="targetAmount" type="number" step="0.01" min="0" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" placeholder="e.g., 50000" required />
                    </div>
                    {message && <p className="font-semibold text-center text-green-600 animate-pulse">{message}</p>}
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300">
                            {isLoading ? 'Saving...' : 'Save Target'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetTargetModal;
