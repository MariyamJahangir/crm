import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/teamService';
import { Eye, EyeOff } from 'lucide-react';

const passwordMinLength = 8;

const CreateUser: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useAuth();

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    // State to manage password visibility
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    
    // --- THIS IS THE KEY ---
    // State to track if the user has tried to submit the form
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!form.name.trim()) newErrors.name = 'Name is required.';
        if (!form.email.trim()) {
            newErrors.email = 'Email is required.';
        } else if (!/\S+@\S+\.\S+/.test(form.email)) {
            newErrors.email = 'Invalid email format.';
        }
        if (!form.password) {
            newErrors.password = 'Password is required.';
        } else if (form.password.length < passwordMinLength) {
            newErrors.password = `Password must be at least ${passwordMinLength} characters.`;
        }
        if (form.password !== form.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // This effect now only validates if a submission has been attempted
    useEffect(() => {
        if (hasAttemptedSubmit) {
            const isValid = validateForm();
            setIsFormValid(isValid);
        }
    }, [form, hasAttemptedSubmit]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        
        // Mark that a submission has been attempted
        setHasAttemptedSubmit(true);

        const isValid = validateForm();
        if (!isValid) {
            return; // Stop submission if validation fails
        }
 navigate('/users', { replace: true });
        setSubmitting(true);
        try {
            await teamService.create({
                name: form.name,
                email: form.email,
                password: form.password,
                designation: 'Sales',
            }, token);
           
        } catch (e: any) {
            setApiError(e?.data?.message || 'Failed to create user. The email may already be in use.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-3xl mx-auto py-6">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-midnight-600 dark:text-ivory-100">Create User</h1>
                        <p className="text-gray-700 dark:text-ivory-400 mt-1">Add a new sales team member to your account.</p>
                    </div>

                    {apiError && (
                        <div className="bg-red-100 dark:bg-red-800/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6 shadow-sm">
                            {apiError}
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="space-y-4 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30" autoComplete="off">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Name</label>
                            <input name="name" value={form.name} onChange={onChange} required className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.name ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 placeholder-midnight-300 dark:placeholder-ivory-500 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition`} placeholder="John Doe" autoComplete="off" />
                            {hasAttemptedSubmit && errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Email</label>
                            <input type="email" name="email" value={form.email} onChange={onChange} required className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.email ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 placeholder-midnight-300 dark:placeholder-ivory-500 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition`} placeholder="john@example.com" autoComplete="off" />
                            {hasAttemptedSubmit && errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>

                        {/* Designation (Fixed) */}
                        <div>
                            <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Designation</label>
                            <input name="designation" value="Sales" readOnly disabled className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 bg-cloud-100/70 dark:bg-midnight-800/70 text-gray-500 dark:text-ivory-500 shadow-sm cursor-not-allowed" />
                        </div>

                        {/* Password & Confirm */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div className="relative">
                                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Password</label>
                                <input type={passwordVisible ? 'text' : 'password'} name="password" value={form.password} onChange={onChange} required className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.password ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition`} autoComplete="new-password" />
                                <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-9 text-gray-500">
                                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                {hasAttemptedSubmit && errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Confirm Password</label>
                                <input type={confirmPasswordVisible ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={onChange} required className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.confirmPassword ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 transition`} autoComplete="new-password" />
                                <button type="button" onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)} className="absolute right-3 top-9 text-gray-500">
                                    {confirmPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                {hasAttemptedSubmit && errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-4 pt-4">
                            <Button type="button" variant="secondary" onClick={() => navigate('/users')}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={hasAttemptedSubmit && !isFormValid || submitting}>
                                {submitting ? 'Creating...' : 'Create User'}
                            </Button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default CreateUser;
