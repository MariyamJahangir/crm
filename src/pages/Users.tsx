import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';

type SortKey = 'name' | 'email' | 'designation' | 'createdAt' | 'status';
type SortDir = 'asc' | 'desc';

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

  // per-row busy state for toggle
  const [busyId, setBusyId] = useState<string | null>(null);

  // derive admin from user role (preferred)
  const isAdmin = user?.type === 'ADMIN';

  // table controls
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const load = async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await teamService.list(token);
      setItems(res.users || []);
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
      setPage((p) => Math.max(1, p));
    } catch (e: any) {
      console.error(e?.data?.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setTargetId(null);
    }
  };

  // derived rows: filter -> search -> sort -> paginate
  const filtered = useMemo(() => {
    let rows = [...items];

    if (status !== 'ALL') {
      rows = rows.filter((r) => (status === 'BLOCKED' ? r.isBlocked : !r.isBlocked));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        return (
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.designation || '').toLowerCase().includes(q)
        );
      });
    }

    rows.sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortKey) {
        case 'name':
          av = a.name?.toLowerCase() || '';
          bv = b.name?.toLowerCase() || '';
          break;
        case 'email':
          av = a.email?.toLowerCase() || '';
          bv = b.email?.toLowerCase() || '';
          break;
        case 'designation':
          av = (a.designation || '').toLowerCase();
          bv = (b.designation || '').toLowerCase();
          break;
        case 'status':
          av = a.isBlocked ? 1 : 0;
          bv = b.isBlocked ? 1 : 0;
          break;
        case 'createdAt':
        default:
          av = new Date(a.createdAt || '').getTime();
          bv = new Date(b.createdAt || '').getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [items, query, status, sortKey, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // clamp page when filters shrink list
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > tp) setPage(tp);
  }, [filtered.length, page, pageSize]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Designation', 'Status', 'Created At'];
    const rows = filtered.map((u) => [
      u.name,
      u.email,
      u.designation || '',
      u.isBlocked ? 'Blocked' : 'Active',
      new Date(u.createdAt || '').toISOString(),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortButton: React.FC<{ label: string; k: SortKey; className?: string }> = ({ label, k, className }) => {
    const active = sortKey === k;
    const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
    return (
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 text-left ${active ? 'text-gray-900' : 'text-gray-600'} ${className || ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className="text-xs">{arrow}</span>
      </button>
    );
  };

  const ToggleIconButton: React.FC<{
    blocked: boolean;
    disabled?: boolean;
    loading?: boolean;
    onClick: () => void;
    title: string;
  }> = ({ blocked, disabled, loading, onClick, title }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition
        ${blocked ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100' : 'border-green-300 text-green-600 bg-green-50 hover:bg-green-100'}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      aria-label={title}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3A5 5 0 007 12H4z" />
        </svg>
      ) : blocked ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm3 8H9V6a3 3 0 016 0v3z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 8h-1V7a4 4 0 10-8 0h2a2 2 0 114 0v1H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-8a2 2 0 00-2-2z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
              <p className="text-gray-600">
                {isAdmin ? 'Manage users under your account.' : 'Your profile'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button onClick={() => navigate('/users/create')}>Create User</Button>
              )}
              <Button variant="secondary" onClick={load}>Refresh</Button>
              <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white border rounded-lg p-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search name, email, designation..."
                className="w-full md:flex-1 border rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
                className="border rounded-md px-3 py-2"
              >
                <option value="ALL">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="BLOCKED">Blocked</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border rounded-md px-3 py-2"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          {loading && <div>Loading...</div>}
          {error && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-3">
              <div className="truncate">{error}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setError(null)}>Dismiss</Button>
                <Button variant="secondary" onClick={load}>Retry</Button>
              </div>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th aria-sort={sortKey==='name' ? (sortDir==='asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <SortButton label="Name" k="name" />
                      </th>
                      <th aria-sort={sortKey==='email' ? (sortDir==='asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <SortButton label="Email" k="email" />
                      </th>
                      <th aria-sort={sortKey==='designation' ? (sortDir==='asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <SortButton label="Designation" k="designation" />
                      </th>
                      <th aria-sort={sortKey==='status' ? (sortDir==='asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <SortButton label="Status" k="status" />
                      </th>
                      <th aria-sort={sortKey==='createdAt' ? (sortDir==='asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                        <SortButton label="Created" k="createdAt" />
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paged.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{u.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{u.designation || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {/* Status pill also acts as mobile toggle */}
                          <button
                            type="button"
                            disabled={!isAdmin || u.id === user?.id || busyId === u.id}
                            onClick={async () => {
                              if (!isAdmin || u.id === user?.id) return;
                              if (busyId) return;
                              setBusyId(u.id);
                              const prev = u.isBlocked;
                              setItems(prevItems => prevItems.map(p => p.id === u.id ? { ...p, isBlocked: !prev } : p));
                              try {
                                if (prev) await teamService.unblock(u.id, token);
                                else await teamService.block(u.id, token);
                              } catch (e: any) {
                                console.error(e?.data?.message || 'Failed to toggle block');
                                setItems(prevItems => prevItems.map(p => p.id === u.id ? { ...p, isBlocked: prev } : p));
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                              ${u.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                              ${(!isAdmin || u.id === user?.id) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                              focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
                            title={u.isBlocked ? 'Tap to unblock' : 'Tap to block'}
                            aria-disabled={!isAdmin || u.id === user?.id}
                          >
                            {busyId === u.id && (
                              <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3A5 5 0 007 12H4z" />
                              </svg>
                            )}
                            {u.isBlocked ? 'Blocked' : 'Active'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                          {new Date(u.createdAt || '').toLocaleString()}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                className="px-3 py-1 hidden sm:inline-flex"
                                onClick={() => navigate(`/users/${u.id}/edit`)}
                              >
                                Edit
                              </Button>

                              <ToggleIconButton
                                blocked={u.isBlocked}
                                disabled={u.id === user?.id}
                                loading={busyId === u.id}
                                title={u.isBlocked ? 'Unblock user' : 'Block user'}
                                onClick={async () => {
                                  if (busyId) return;
                                  setBusyId(u.id);
                                  const prev = u.isBlocked;
                                  setItems(prevItems => prevItems.map(p => p.id === u.id ? { ...p, isBlocked: !prev } : p));
                                  try {
                                    if (prev) {
                                      await teamService.unblock(u.id, token);
                                    } else {
                                      await teamService.block(u.id, token);
                                    }
                                  } catch (e: any) {
                                    console.error(e?.data?.message || 'Failed to toggle block');
                                    setItems(prevItems => prevItems.map(p => p.id === u.id ? { ...p, isBlocked: prev } : p));
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                              />

                              <Button
                                variant="danger"
                                className="px-3 py-1 hidden sm:inline-flex"
                                onClick={() => askDelete(u.id)}
                                disabled={u.id === user?.id}
                              >
                                Delete
                              </Button>
                            </div>

                            {/* Mobile actions */}
                            <div className="mt-2 flex items-center justify-end gap-2 sm:hidden">
                              <Button
                                variant="secondary"
                                className="px-2 py-1"
                                onClick={() => navigate(`/users/${u.id}/edit`)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                className="px-2 py-1"
                                onClick={() => askDelete(u.id)}
                                disabled={u.id === user?.id}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer: pagination info */}
              <div className="px-4 py-3 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{Math.min((currentPage - 1) * pageSize + 1, total)}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * pageSize, total)}</span> of{' '}
                  <span className="font-medium">{total}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-gray-700 tabular-nums">
                    Page {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mt-4">
              <div>{isAdmin ? 'No users match the current filters.' : 'No data available.'}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setQuery(''); setStatus('ALL'); setPage(1); }}>Clear filters</Button>
                <Button variant="secondary" onClick={load}>Refresh</Button>
              </div>
            </div>
          )}
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
