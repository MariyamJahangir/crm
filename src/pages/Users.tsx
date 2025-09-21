import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { teamService, TeamUser } from '../services/teamService';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { Pencil, Trash2, RefreshCw,ListRestart, Eye, ChevronLeft, ChevronRight } from "lucide-react";

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
        className={`inline-flex items-center gap-1 text-left ${active ? 'text-midnight-700 dark:text-midnight-300' : 'text-midnight-500 dark:text-midnight-400'
          } ${className || ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:focus-visible:ring-sky-600`}
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
        ${blocked
          ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900 dark:text-red-400 dark:border-red-600'
          : 'border-green-300 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900 dark:text-green-400 dark:border-green-600'
        }
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:focus-visible:ring-sky-600`}
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
    <div className="relative min-h-screen  transition-colors duration-300">

      <div className="flex z-10 min-h-screen">
        <Sidebar />
        <main className="flex-1 transition-all duration-300 
               ml-2 group-hover:ml-56 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-midnight-900 dark:text-ivory-100 drop-shadow-lg">
                Users
              </h1>
              {/* <p className="text-sky-600 mt-1 select-none">
                {isAdmin ? 'Users Data' : 'Your profile'}
              </p> */}
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button className="bg-sky-500/80 backdrop-blur-md text-ivory-50 hover:bg-sky-600/90 shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 focus:ring-4 focus:ring-sky-300/50 dark:focus:ring-sky-700/60 rounded-xl"
                  onClick={() => navigate('/users/create')}>
                  Create User
                </Button>
              )}
              
              <Button
                variant="secondary"
                onClick={load}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-xl transition"
              >
                <RefreshCw /> 
              </Button>
              {/* <Button
                variant="secondary"
                onClick={exportCsv}
                className="bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-xl transition"
              >
                Export CSV
              </Button> */}
{/* 
              {isAdmin && (
                <Button className="bg-sky-500/80 backdrop-blur-md text-ivory-50 hover:bg-sky-600/90 shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 focus:ring-4 focus:ring-sky-300/50 dark:focus:ring-sky-700/60 rounded-xl"
                  onClick={() => navigate('/sales-report')}>
                   Sales Report
                </Button>
              )} */}
            </div>
          </div>

          {/* Controls
          <div className="bg-cloud-100/30 dark:bg-midnight-800/30 backdrop-blur-xl border border-cloud-300/40 dark:border-midnight-600/40 rounded-2xl p-5 mb-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, designation..."
                className="w-full md:flex-1 border border-cloud-400/40 dark:border-midnight-600/40 rounded-xl px-4 py-2 bg-ivory-50/40 dark:bg-midnight-900/40 backdrop-blur-md text-midnight-900 dark:text-ivory-200 placeholder-midnight-400 dark:placeholder-ivory-600 focus:ring-sky-400 focus:border-sky-400 dark:focus:ring-sky-600 dark:focus:border-sky-600 transition"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setPage(1);
                }}
                className="border border-cloud-400/40 dark:border-midnight-600/40 rounded-xl px-4 py-2 bg-ivory-50/40 dark:bg-midnight-900/40 backdrop-blur-md text-midnight-900 dark:text-ivory-200 focus:ring-sky-400 focus:border-sky-400 dark:focus:ring-sky-600 dark:focus:border-sky-600 transition"
              >
                <option value="ALL">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="BLOCKED">Blocked</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-cloud-400/40 dark:border-midnight-600/40 rounded-xl px-4 py-2 bg-ivory-50/40 dark:bg-midnight-900/40 backdrop-blur-md text-midnight-900 dark:text-ivory-200 focus:ring-sky-400 focus:border-sky-400 dark:focus:ring-sky-600 dark:focus:border-sky-600 transition"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div> */}

          {loading && (
            <div className="text-midnight-700 dark:text-ivory-300 font-semibold select-none animate-pulse">
              Loading...
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between bg-red-200/40 dark:bg-red-900/40 backdrop-blur-md border border-red-400/50 dark:border-red-700/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4 shadow-lg">
              <div className="truncate">{error}</div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setError(null)}>
                  Dismiss
                </Button>
                <Button variant="secondary" onClick={load}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-cloud-300/40 dark:divide-midnight-700/40">
                  <thead className="bg-cloud-100/40 dark:bg-midnight-800/40 backdrop-blur-md sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 select-none">
                        <SortButton label="Name" k="name" />
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 select-none">
                        <SortButton label="Email" k="email" />
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 select-none">
                        <SortButton label="Designation" k="designation" />
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 select-none">
                        <SortButton label="Status" k="status" />
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 select-none">
                        <SortButton label="Created" k="createdAt" />
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-midnight-700 dark:text-midnight-300 text-center select-none">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cloud-200/40 dark:divide-midnight-700/40">
                    {paged.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-cloud-200/40 dark:hover:bg-midnight-800/40 transition-colors cursor-pointer select-text"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-midnight-900 dark:text-ivory-100 text-center align-middle">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-midnight-700 dark:text-ivory-200 text-center align-middle">{u.email}</td>
                        <td className="px-4 py-3 text-sm text-midnight-700 dark:text-ivory-200 text-center align-middle">{u.designation || '-'}</td>
                        <td className="px-4 py-3 text-sm text-center align-middle">
                          <button
                            type="button"
                            disabled={!isAdmin || u.id === user?.id || busyId === u.id}
                            onClick={async () => {
                              if (!isAdmin || u.id === user?.id) return;
                              if (busyId) return;
                              setBusyId(u.id);
                              const prev = u.isBlocked;
                              setItems((prevItems) =>
                                prevItems.map((p) => (p.id === u.id ? { ...p, isBlocked: !prev } : p))
                              );
                              try {
                                if (prev) await teamService.unblock(u.id, token);
                                else await teamService.block(u.id, token);
                              } catch (e: any) {
                                console.error(e?.data?.message || 'Failed to toggle block');
                                setItems((prevItems) =>
                                  prevItems.map((p) => (p.id === u.id ? { ...p, isBlocked: prev } : p))
                                );
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md transition
                      ${u.isBlocked
                                ? 'bg-red-200/50 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                                : 'bg-green-200/50 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              }
                      ${!isAdmin || u.id === user?.id
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer hover:scale-105'
                              }
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:focus-visible:ring-sky-600`}
                            title={u.isBlocked ? 'Tap to unblock' : 'Tap to block'}
                            aria-disabled={!isAdmin || u.id === user?.id}
                          >
                            {busyId === u.id && (
                              <svg
                                className="animate-spin h-3 w-3 mr-1"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v3A5 5 0 007 12H4z"
                                />
                              </svg>
                            )}
                            {u.isBlocked ? 'Blocked' : 'Active'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-midnight-700 dark:text-ivory-200 tabular-nums text-center align-middle">
                          {new Date(u.createdAt || '').toLocaleString()}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-sm text-center align-middle">
                            <div className="flex items-center justify-center gap-2">

                              {/* <div className="hidden sm:inline-flex items-center justify-center 
                                  w-8 h-8 rounded-full
                                  bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md 
                                  hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                                  shadow-md transition"
                                onClick={() => navigate(`/users/${u.id}/sales-report`)}
                              >
                                <Eye className="w-4 h-4 text-midnight-500" />
                              </div> */}


                              <div className="hidden sm:inline-flex items-center justify-center 
                                  w-8 h-8 rounded-full
                                  bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md 
                                  hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 
                                  shadow-md transition"
                                onClick={() => navigate(`/users/${u.id}/edit`)}
                              >
                                <Pencil className="w-4 h-4 text-sky-500" />
                              </div>

                              <ToggleIconButton
                                blocked={u.isBlocked}
                                disabled={u.id === user?.id}
                                loading={busyId === u.id}
                                title={u.isBlocked ? 'Unblock user' : 'Block user'}
                                onClick={async () => {
                                  if (busyId) return;
                                  setBusyId(u.id);
                                  const prev = u.isBlocked;
                                  setItems((prevItems) =>
                                    prevItems.map((p) => (p.id === u.id ? { ...p, isBlocked: !prev } : p))
                                  );
                                  try {
                                    if (prev) {
                                      await teamService.unblock(u.id, token);
                                    } else {
                                      await teamService.block(u.id, token);
                                    }
                                  } catch (e: any) {
                                    console.error(e?.data?.message || 'Failed to toggle block');
                                    setItems((prevItems) =>
                                      prevItems.map((p) => (p.id === u.id ? { ...p, isBlocked: prev } : p))
                                    );
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                              />

                              <div
                                className={`hidden sm:inline-flex items-center justify-center 
                                        w-8 h-8 rounded-full
                                        bg-red-200/40 dark:bg-red-700/40 backdrop-blur-md
                                        hover:bg-red-300/60 dark:hover:bg-red-600/60 
                                        shadow-md transition cursor-pointer
                                        ${u.id === user?.id ? 'opacity-50 pointer-events-none' : ''}`}
                                onClick={() => {
                                  if (u.id !== user?.id) askDelete(u.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </div>

                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer: pagination info */}
              <div className="px-4 py-3 bg-cloud-100/30 dark:bg-midnight-800/30 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-midnight-700 dark:text-ivory-300 select-none rounded-b-2xl">
                <div className="text-sm">
                  Showing{" "}
                  <span className="font-semibold">
                    {Math.min((currentPage - 1) * pageSize + 1, total)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {Math.min(currentPage * pageSize, total)}
                  </span>{" "}
                  of <span className="font-semibold">{total}</span> results
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="p-2 bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-lg transition"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <span className="text-sm tabular-nums">
                    Page {currentPage} / {totalPages}
                  </span>

                  <Button
                    variant="secondary"
                    className="p-2 bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-lg transition"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex items-center justify-between bg-ivory-200/40 dark:bg-midnight-700/40 backdrop-blur-md border border-ivory-300/40 dark:border-midnight-600/40 text-midnight-700 dark:text-ivory-300 px-4 py-3 rounded-xl mt-4 shadow-lg select-none">
              <div>{isAdmin ? 'No users match the current filters.' : 'No data available.'}</div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-lg transition"
                  onClick={() => {
                    setQuery('');
                    setStatus('ALL');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
                <Button variant="secondary" onClick={load}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-cloud-200/50 dark:bg-midnight-700/50 backdrop-blur-md text-midnight-700 dark:text-ivory-300 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 shadow-md rounded-xl transition">
                  <ListRestart /> Refresh
                </Button>
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
