import React, { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import { teamService, TeamUser } from '../services/teamService';
import ConfirmDialog from '../components/ConfirmDialog';
import EditContactModal from '../components/EditContactModal';

type FormState = {
  companyName: string;
  contactNumber: string;
  salesmanId: string;
  email: string;
  vatNo: string;
  address: string;
  industry: string;
  category: '' | 'Enterprise' | 'SMB' | 'Individual';
  website: string;
};

const initialForm: FormState = {
  companyName: '',
  contactNumber: '',
  salesmanId: '',
  email: '',
  vatNo: '',
  address: '',
  industry: '',
category: '',
  website: '',
};

const EditCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isCreate = !id;
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';

  const [form, setForm] = useState<FormState>(initialForm);
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    designation: '',
    department: '',
    mobile: '',
    fax: '',
    email: '',
    social: '',
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const loadCustomer = async () => {
    if (!id || !token) return;
    setLoading(true);
    try {
      const res = await customerService.getOne(id, token);
      setCustomer(res.customer);
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to reload customer data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await teamService.list(token);
        setSalesmen(res.users);
        if (isCreate && !isAdmin) {
          setForm((p) => ({ ...p, salesmanId: user?.id || '' }));
        }
      } catch { /* ignore */ }
    })();
  }, [token, isCreate, isAdmin, user?.id]);

  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await customerService.getOne(id, token);
        setCustomer(res.customer);
        setForm({
          companyName: res.customer.companyName || '',
          contactNumber: res.customer.contactNumber || '',
          salesmanId: res.customer.salesman?.id || '',
          email: res.customer.email || '',
          vatNo: res.customer.vatNo || '',
          address: res.customer.address || '',
          industry: (res.customer as any).industry || '',
          category: ((res.customer as any).category as any) || '',
          website: (res.customer as any).website || '',
        });
        if (!location.state?.justCreated) {
          setShowContacts(true);
        }
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token, location.state]);

  const onChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value as any }));
    };

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.website && !/^(https?:\/\/|www\.).+/i.test(form.website)) {
      setError('Website must start with http://, https://, or www.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<FormState> = { ...form };
      if (!isAdmin) {
        delete (payload as Partial<FormState>).salesmanId;
      }
      if (isCreate) {
        const out = await customerService.create(payload as any, token);
        navigate(`/customers/${out.customerId}/edit`, { 
            replace: true, 
            state: { justCreated: true } 
        });
      } else {
        await customerService.update(id!, payload as any, token);
        navigate('/customers');
      }
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !token) return;
    setContactError(null);
    if (!contactForm.name.trim()) {
      setContactError('Contact name is required');
      return;
    }
    if (!contactForm.designation.trim()) {
      setContactError('Designation is required');
      return;
    }
    if (!contactForm.mobile.trim()) {
      setContactError('Mobile number is required');
      return;
    }
    try {
      await customerService.addContact(id, {
          name: contactForm.name.trim(),
          designation: contactForm.designation || undefined,
          department: contactForm.department || undefined,
          mobile: contactForm.mobile || undefined,
          fax: contactForm.fax || undefined,
          email: contactForm.email || undefined,
          social: contactForm.social || undefined,
        },
        token
      );
      await loadCustomer();
      setContactForm({ name: '', designation: '', department: '', mobile: '', fax: '', email: '', social: '' });
    } catch (e: any) {
      setContactError(e?.data?.message || 'Failed to add contact');
    }
  };

  const toggleContactSelect = (cid: string) => {
    setSelectedContacts((prev) => ({ ...prev, [cid]: !prev[cid] }));
  };

  const selectedIds = useMemo(
    () => Object.keys(selectedContacts).filter((k) => selectedContacts[k]),
    [selectedContacts]
  );

  const bulkDeleteContacts = async () => {
    if (!id || selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await customerService.bulkDeleteContacts(id, selectedIds, token);
      await loadCustomer();
      setSelectedContacts({});
      setConfirmOpen(false);
    } catch { /* ignore */ }
    finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditingContactId(null);
    loadCustomer();
  };

  const openEditModal = (contactId: string) => {
    setEditingContactId(contactId);
    setEditModalOpen(true);
  };

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">{isCreate ? 'Create Customer' : 'Edit Customer'}</h1>
            <p className="text-gray-600">{isCreate ? 'Add a new customer.' : 'Update customer and manage contacts.'}</p>
          </div>

          {loading && !isCreate && <div>Loading...</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

          {(!loading || isCreate) && (
            <>
              <form onSubmit={saveCustomer} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border mb-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input value={form.companyName} onChange={onChange('companyName')} required className="w-full rounded-md border-gray-300 shadow-sm" placeholder="Acme Pvt Ltd" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                    <input value={form.contactNumber} onChange={onChange('contactNumber')} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salesman</label>
                    {isAdmin ? (
                      <select value={form.salesmanId} onChange={onChange('salesmanId')} required className="w-full rounded-md border-gray-300 bg-white shadow-sm">
                        <option value="" disabled>Select salesman</option>
                        {salesmen.map((s) => (<option key={s.id} value={s.id}>{s.name} {s.designation ? `(${s.designation})` : ''}</option>))}
                      </select>
                    ) : (
                      <input value={salesmen.find(s => String(s.id) === String(form.salesmanId))?.name || user?.name || ''} disabled className="w-full rounded-md border-gray-300 bg-gray-100 shadow-sm" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={onChange('email')} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="sales@acme.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT No</label>
                    <input value={form.vatNo} onChange={onChange('vatNo')} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="GST/VAT number" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea value={form.address} onChange={onChange('address')} rows={3} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="Full address" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <input value={form.industry} onChange={onChange('industry')} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="Manufacturing, IT, Healthcare, ..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={form.category} onChange={onChange('category')} className="w-full rounded-md border-gray-300 bg-white shadow-sm">
                      <option value="">Select category</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="SMB">SMB</option>
                      <option value="Individual">Individual</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input value={form.website} onChange={onChange('website')} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="https://example.com" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => navigate('/customers')}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isCreate ? 'Create Customer' : 'Save Changes'}</Button>
                </div>
              </form>
              
              {!isCreate && !showContacts && (
                <div className="text-center py-8">
                  <Button onClick={() => setShowContacts(true)}>Add Customer Contacts</Button>
                </div>
              )}

              {(!isCreate && showContacts) && (
                <section className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
                    <div className="flex gap-2">
                    <Button variant="danger" disabled={selectedIds.length === 0} onClick={() => setConfirmOpen(true)}>Delete Selected ({selectedIds.length})</Button>
                    </div>
                  </div>
                  <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                    <input className="border rounded px-3 py-2" placeholder="Name*" value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} required />
                    <input className="border rounded px-3 py-2" placeholder="Designation*" value={contactForm.designation} onChange={(e) => setContactForm((p) => ({ ...p, designation: e.target.value }))} required />
                    <input className="border rounded px-3 py-2" placeholder="Department" value={contactForm.department} onChange={(e) => setContactForm((p) => ({ ...p, department: e.target.value }))} />
                    <input className="border rounded px-3 py-2" placeholder="Mobile*" value={contactForm.mobile} onChange={(e) => setContactForm((p) => ({ ...p, mobile: e.target.value }))} required />
                    <input className="border rounded px-3 py-2" placeholder="Fax" value={contactForm.fax} onChange={(e) => setContactForm((p) => ({ ...p, fax: e.target.value }))} />
                    <input className="border rounded px-3 py-2" placeholder="Email" type="email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} />
                    <div className="sm:col-span-2 flex gap-2">
                    <input className="flex-1 border rounded px-3 py-2" placeholder="LinkedIn/Social" value={contactForm.social} onChange={(e) => setContactForm((p) => ({ ...p, social: e.target.value }))} />
                    <Button type="submit">Add</Button>
                    </div>
                  </form>
                  {contactError && <div className="text-red-600 mb-3">{contactError}</div>}
                  <div className="border rounded overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><input type="checkbox" className="h-4 w-4" disabled /></th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Social</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customer?.contacts.map((ct) => (
                      <tr key={ct.id}>
                        <td className="px-4 py-2 whitespace-nowrap"><input type="checkbox" className="h-4 w-4" checked={!!selectedContacts[ct.id]} onChange={() => toggleContactSelect(ct.id)} /></td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{ct.name}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{ct.designation || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{(ct as any).department || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{ct.mobile || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{ct.email || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {(ct as any).social ? <a href={(ct as any).social} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">Profile</a> : '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <button onClick={() => openEditModal(ct.id)} className="text-gray-500 hover:text-indigo-600">
                            <Pencil size={18} />
                          </button>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                    </table>
                    {customer && customer.contacts.length === 0 && (<div className="px-3 py-4 text-center text-gray-600">No contacts yet.</div>)}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      <ConfirmDialog open={confirmOpen} title="Delete Contacts" message={`Are you sure you want to delete ${selectedIds.length} selected contact(s)?`} confirmText={deleting ? 'Deleting...' : 'Yes, Delete'} cancelText="Cancel" onConfirm={bulkDeleteContacts} onCancel={() => setConfirmOpen(false)} />
      <EditContactModal
        open={isEditModalOpen}
        contactId={editingContactId}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default EditCustomer;
