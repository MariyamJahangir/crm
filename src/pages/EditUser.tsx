import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';

const EditUser: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();

  const [data, setData] = useState<TeamUser | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    designation: '',
    password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const res = await teamService.getOne(id, token);
        setData(res.user);
        setForm({
          name: res.user.name,
          email: res.user.email,
          designation: res.user.designation || '',
          password: '',
        });
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load user');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        designation: form.designation,
      };
      if (form.password) payload.password = form.password;

      await teamService.update(id, payload, token);
      navigate('/users', { replace: true });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const isSelf = data && data.id === String(user?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">{isSelf ? 'Edit Profile' : 'Edit User'}</h1>
            <p className="text-gray-600">{isSelf ? 'Update your profile' : 'Update user details'}</p>
          </div>

          {loading && <div>Loading...</div>}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {!loading && data && (
            <form onSubmit={onSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  required
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  name="designation"
                  value={form.designation}
                  onChange={onChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (optional)</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => navigate('/users')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default EditUser;