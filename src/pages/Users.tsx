import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';

const Users: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // delete dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

const load = async () => {
  if (!token) return;
  setError(null);
  setLoading(true);
  try {
    const res = await teamService.list(token);
    setItems(res.users);
  } catch (e: any) {
    setError(e?.data?.message || 'Failed to load users');
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isAdminView = items.some((u) => u.id !== user?.id);

  const askDelete = (id: string) => {
    setTargetId(id);
    setConfirmOpen(true);
  };

  const onCancelDelete = () => {
    setConfirmOpen(false);
    setTargetId(null);
  };

  const onConfirmDelete = async () => {
    if (!targetId) return;
    setDeleting(true);
    try {
      await teamService.remove(targetId, token);
      setItems((prev) => prev.filter((u) => u.id !== targetId));
    } catch (e: any) {
      console.error(e?.data?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setTargetId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
   
      <div className="pl-64">
        <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
              <p className="text-gray-600">
                {isAdminView ? 'Manage users under your account.' : 'Your profile'}
              </p>
            </div>
            {isAdminView && (
              <Button onClick={() => navigate('/users/create')}>Create User</Button>
            )}
          </div>

          {loading && <div>Loading...</div>}
          {error && <div className="text-red-600">{error}</div>}

          <div className="grid gap-4">
            {items.map((u) => (
              <div key={u.id} className="bg-white p-4 rounded border shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-medium">{u.name}</div>
                    <div className="text-gray-600 text-sm">{u.designation || '-'}</div>
                    <div className="text-gray-600 text-sm">{u.email}</div>
                    
                  </div>
                  {isAdminView && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="px-3 py-1"
                        onClick={() => navigate(`/users/${u.id}/edit`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3 py-1"
                        onClick={() => askDelete(u.id)}
                        disabled={u.id === user?.id} // cannot delete yourself
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!loading && !error && items.length === 0 && (
              <div className="text-gray-600">
                {isAdminView ? 'No users yet. Create one.' : 'No data available.'}
              </div>
            )}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
        cancelText="Cancel"
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </div>
  );
};

export default Users;