import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/teamService';

const CreateUser: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    designation: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await teamService.create(
        {
          name: form.name,
          email: form.email,
          password: form.password,
          designation: form.designation || undefined,
        },
        token
      );
      navigate('/users', { replace: true });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
      <Sidebar />

      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-3xl mx-auto py-6 ">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-midnight-800 dark:text-ivory-100">
              Create User
            </h1>
            <p className="text-midnight-400 dark:text-ivory-400 mt-1">
              Add a user under your account.
            </p>
          </div>

          {error && (
            <div className="bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 px-4 py-3 rounded-lg mb-6 shadow-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="space-y-4 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl 
             p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30"
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                Name
              </label>
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                required
                className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 
                 text-midnight-800 dark:text-ivory-100 
                 placeholder-midnight-300 dark:placeholder-ivory-500 
                 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 
                 transition"
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                required
                className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 
                 text-midnight-800 dark:text-ivory-100 
                 placeholder-midnight-300 dark:placeholder-ivory-500 
                 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 
                 transition"
                placeholder="john@example.com"
              />
            </div>

            {/* Designation */}
            <div>
              <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                Designation
              </label>
              <input
                name="designation"
                value={form.designation}
                onChange={onChange}
                className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                 bg-white/60 dark:bg-midnight-800/60 
                 text-midnight-800 dark:text-ivory-100 
                 placeholder-midnight-300 dark:placeholder-ivory-500 
                 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 
                 transition"
                placeholder="Sales Executive"
              />
            </div>

            {/* Password & Confirm */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 
                   text-midnight-800 dark:text-ivory-100 
                   shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 
                   transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={onChange}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50 
                   bg-white/60 dark:bg-midnight-800/60 
                   text-midnight-800 dark:text-ivory-100 
                   shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 
                   transition"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                className="px-5 py-2 rounded-xl bg-cloud-100/60 dark:bg-midnight-700/60 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-midnight-700 dark:text-ivory-200 
                 hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 
                 backdrop-blur-md shadow-md transition"
                onClick={() => navigate('/users')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-sky-500/90 hover:bg-sky-600 
                 text-white shadow-lg transition disabled:opacity-50"
              >
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
