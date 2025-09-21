import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';
import { Eye, EyeOff } from 'lucide-react';

const passwordMinLength = 8;

const EditUser: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { token, user: authUser } = useAuth();

    const [initialData, setInitialData] = useState<TeamUser | null>(null);
    const [form, setForm] = useState({
        name: '',
        email: '',
        designation: '',
        password: '',
        confirmPassword: '',
    });

    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !token) return;
        
        const fetchUser = async () => {
            setLoading(true);
            try {
                const res = await teamService.getOne(id, token);
                setInitialData(res.user);
                setForm({
                    name: res.user.name,
                    email: res.user.email,
                    designation: res.user.designation || 'Sales',
                    password: '',
                    confirmPassword: '',
                });
            } catch (e: any) {
                setApiError(e?.data?.message || 'Failed to load user data.');
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [id, token]);
    
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!form.name.trim()) newErrors.name = 'Name is required.';
        if (!form.email.trim()) {
            newErrors.email = 'Email is required.';
        } else if (!/\S+@\S+\.\S+/.test(form.email)) {
            newErrors.email = 'Invalid email format.';
        }

        // Only validate password fields if a new password is being entered
        if (form.password) {
            if (form.password.length < passwordMinLength) {
                newErrors.password = `Password must be at least ${passwordMinLength} characters.`;
            }
            if (form.password !== form.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match.';
            }
        } else if (form.confirmPassword) {
            // If confirm password has a value but password doesn't
            newErrors.password = 'Please enter the new password first.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    useEffect(() => {
        if (hasAttemptedSubmit) {
            setIsFormValid(validateForm());
        }
    }, [form, hasAttemptedSubmit]);
    
    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        setHasAttemptedSubmit(true);

        const isValid = validateForm();
        if (!isValid || !id) return;

        setSaving(true);
        try {
            const payload: { name: string; email: string; designation: string; password?: string } = {
                name: form.name,
                email: form.email,
                designation: form.designation,
            };
            if (form.password) {
                payload.password = form.password;
            }

            await teamService.update(id, payload, token);
            navigate('/users', { replace: true });
        } catch (e: any) {
            setApiError(e?.data?.message || 'Failed to update user.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    const isSelf = initialData?.id === authUser?.id;

    return (
        <div className="flex min-h-screen z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-3xl mx-auto py-6">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-midnight-800 dark:text-ivory-100">
                            {isSelf ? 'Edit Profile' : 'Edit User'}
                        </h1>
                    </div>

                    {apiError && (
                        <div className="bg-red-100 dark:bg-red-800/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6 shadow-sm">
                            {apiError}
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="space-y-4 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30" autoComplete="off">
                        {/* Name, Email, Designation */}
                        <div>
                            <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Name</label>
                            <input name="name" value={form.name} onChange={onChange} required className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.name ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 transition`} />
                            {hasAttemptedSubmit && errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Email</label>
                            <input type="email" name="email" value={form.email} onChange={onChange} required className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.email ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 transition`} />
                            {hasAttemptedSubmit && errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Designation</label>
                            <input name="designation" value={form.designation} readOnly disabled className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 bg-cloud-100/70 dark:bg-midnight-800/70 cursor-not-allowed" />
                        </div>
                        
                        {/* Password Fields */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div className="relative">
                                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">New Password (Optional)</label>
                                <input type={passwordVisible ? 'text' : 'password'} name="password" value={form.password} onChange={onChange} className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.password ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 transition`} autoComplete="new-password" placeholder="Leave blank to keep current" />
                                <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-9 text-gray-500">
                                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                {hasAttemptedSubmit && errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Confirm New Password</label>
                                <input type={confirmPasswordVisible ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={onChange} className={`w-full h-10 px-3 rounded-xl border ${hasAttemptedSubmit && errors.confirmPassword ? 'border-red-500' : 'border-cloud-200/50 dark:border-midnight-600/50'} bg-white/60 dark:bg-midnight-800/60 transition`} autoComplete="new-password" disabled={!form.password} />
                                <button type="button" onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)} className="absolute right-3 top-9 text-gray-500" disabled={!form.password}>
                                    {confirmPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                {hasAttemptedSubmit && errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-4 pt-4">
                            <Button type="button" variant="secondary" onClick={() => navigate('/users')}>Cancel</Button>
                            <Button type="submit" disabled={saving || (hasAttemptedSubmit && !isFormValid)}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default EditUser;
