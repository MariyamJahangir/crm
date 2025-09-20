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
    <div className="relative min-h-screen">
      {/* Background with overlay */}
      {/* <div className="absolute inset-0">
        <img
          src="/images/bg-pattern.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-midnight-800/50 backdrop-blur-sm" />
      </div> */}

      {/* Foreground content */}
      <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 overflow-y-auto h-screen">
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {/* Page header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100 drop-shadow-md">
                {isCreate ? 'Create Customer' : 'Edit Customer'}
              </h1>
              <p className="text-midnight-600 dark:text-ivory-400 mt-1">
                {isCreate ? 'Add a new customer.' : 'Update customer and manage contacts.'}
              </p>
            </div>

            {/* Status messages */}
            {loading && !isCreate && (
              <div className="text-midnight-700 dark:text-ivory-300">Loading...</div>
            )}
            {error && (
              <div className="bg-red-50/80 dark:bg-red-900/40 border border-red-200 dark:border-red-700 
                    text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-6 shadow-sm">
                {error}
              </div>
            )}

            {/* Customer form */}
            {(!loading || isCreate) && (
              <>
                <form
                  onSubmit={saveCustomer}
                  className="space-y-6 bg-cloud-50/40 dark:bg-midnight-900/40 backdrop-blur-xl 
                   p-8 rounded-2xl shadow-xl border border-cloud-300/40 dark:border-midnight-700/40"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Company Name */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Company Name
                      </label>
                      <input
                        value={form.companyName}
                        onChange={onChange('companyName')}
                        required
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="Acme Pvt Ltd"
                      />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Contact Number
                      </label>
                      <input
                        value={form.contactNumber}
                        onChange={onChange('contactNumber')}
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    {/* Salesman */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Salesman
                      </label>
                      {isAdmin ? (
                        <select
                          value={form.salesmanId}
                          onChange={onChange('salesmanId')}
                          required
                          className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                           bg-white/70 dark:bg-midnight-800/60 
                           text-midnight-900 dark:text-ivory-100 
                           shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        >
                          <option value="" disabled>
                            Select salesman
                          </option>
                          {salesmen.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.designation ? `(${s.designation})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={
                            salesmen.find((s) => String(s.id) === String(form.salesmanId))?.name ||
                            user?.name ||
                            ''
                          }
                          disabled
                          className="w-full h-11 px-4 rounded-xl border border-cloud-200/40 dark:border-midnight-600/40 
                           bg-cloud-100/60 dark:bg-midnight-800/60 
                           text-midnight-700 dark:text-ivory-300 shadow-sm"
                        />
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={onChange('email')}
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="sales@acme.com"
                      />
                    </div>

                    {/* VAT No */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        VAT No
                      </label>
                      <input
                        value={form.vatNo}
                        onChange={onChange('vatNo')}
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="VAT number"
                      />
                    </div>

                    {/* Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Address
                      </label>
                      <textarea
                        value={form.address}
                        onChange={onChange('address')}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="Full address"
                      />
                    </div>

                    {/* Industry */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Industry
                      </label>
                      <input
                        value={form.industry}
                        onChange={onChange('industry')}
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="Manufacturing, IT, Healthcare, ..."
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Category
                      </label>
                      <select
                        value={form.category}
                        onChange={onChange('category')}
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                      >
                        <option value="">Select category</option>
                        <option value="Enterprise">Enterprise</option>
                        <option value="SMB">SMB</option>
                        <option value="Individual">Individual</option>
                      </select>
                    </div>

                    {/* Website */}
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Website
                      </label>
                      <input
                        value={form.website}
                        onChange={onChange('website')}
                        className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                         bg-white/70 dark:bg-midnight-800/60 
                         text-midnight-900 dark:text-ivory-100 
                         placeholder-midnight-400 dark:placeholder-ivory-500 
                         shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>

                  {/* Form buttons */}
                  <div className="flex justify-end gap-4 pt-6">
                    <Button
                      type="button"
                      className="px-6 py-2.5 rounded-xl bg-cloud-100/70 dark:bg-midnight-700/60 
                       border border-cloud-300/50 dark:border-midnight-600/50 
                       text-midnight-800 dark:text-ivory-200 
                       hover:bg-cloud-200/80 dark:hover:bg-midnight-600/70 
                       backdrop-blur-md shadow transition"
                      onClick={() => navigate('/customers')}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 
                       text-white shadow-lg transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : isCreate ? 'Create Customer' : 'Save Changes'}
                    </Button>
                  </div>
                </form>

                {/* Conditional Contacts */}
                {!isCreate && !showContacts && (
                  <div className="text-center py-10">
                    <Button onClick={() => setShowContacts(true)}>Add Customer Contacts</Button>
                  </div>
                )}

                {!isCreate && showContacts && (
                  <section className="mt-8 bg-cloud-50/50 dark:bg-midnight-900/40 backdrop-blur-xl 
                            p-6 rounded-2xl shadow-lg border border-cloud-300/40 dark:border-midnight-700/40">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-bold text-midnight-900 dark:text-ivory-100">
                        Contacts
                      </h2>
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          disabled={selectedIds.length === 0}
                          onClick={() => setConfirmOpen(true)}
                        >
                          Delete Selected ({selectedIds.length})
                        </Button>
                      </div>
                    </div>

                    {/* Contact form */}
                    <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                      <input
                        className="border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                         dark:text-ivory-100"
                        placeholder="Name*"
                        value={contactForm.name}
                        onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                        required
                      />
                      <input
                        className="border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                         dark:text-ivory-100"
                        placeholder="Designation*"
                        value={contactForm.designation}
                        onChange={(e) => setContactForm((p) => ({ ...p, designation: e.target.value }))}
                        required
                      />
                      <input
                        className="border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                         dark:text-ivory-100"
                        placeholder="Department"
                        value={contactForm.department}
                        onChange={(e) => setContactForm((p) => ({ ...p, department: e.target.value }))}
                      />
                      <input
                        className="border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                         dark:text-ivory-100"
                        placeholder="Mobile*"
                        value={contactForm.mobile}
                        onChange={(e) => setContactForm((p) => ({ ...p, mobile: e.target.value }))}
                        required
                      />
                      <input
                        className="border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                         dark:text-ivory-100"
                        placeholder="Fax"
                        value={contactForm.fax}
                        onChange={(e) => setContactForm((p) => ({ ...p, fax: e.target.value }))}
                      />
                      <input
                        className="border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                         dark:text-ivory-100"
                        placeholder="Email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      />
                      <div className="sm:col-span-2 flex gap-2">
                        <input
                          className="flex-1 border rounded-xl px-3 py-2 dark:bg-midnight-800 dark:border-midnight-700 
                           dark:text-ivory-100"
                          placeholder="LinkedIn/Social"
                          value={contactForm.social}
                          onChange={(e) => setContactForm((p) => ({ ...p, social: e.target.value }))}
                        />
                        <Button type="submit">Add</Button>
                      </div>
                    </form>

                    {contactError && (
                      <div className="text-red-600 dark:text-red-400 mb-3">{contactError}</div>
                    )}

                    {/* Contact table */}
                    <div className="border rounded-xl overflow-x-auto dark:border-midnight-700">
                      <table className="min-w-full divide-y divide-cloud-300/40 dark:divide-midnight-700 text-sm">
                        <thead className="bg-cloud-100 dark:bg-midnight-800 text-midnight-800 dark:text-ivory-200">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold">
                              <input type="checkbox" className="h-4 w-4" disabled />
                            </th>
                            <th className="px-4 py-2 text-left font-semibold">Name</th>
                            <th className="px-4 py-2 text-left font-semibold">Designation</th>
                            <th className="px-4 py-2 text-left font-semibold">Department</th>
                            <th className="px-4 py-2 text-left font-semibold">Mobile</th>
                            <th className="px-4 py-2 text-left font-semibold">Email</th>
                            <th className="px-4 py-2 text-left font-semibold">Social</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cloud-300/40 dark:divide-midnight-700 
                               text-midnight-900 dark:text-ivory-200">
                          {customer?.contacts.map((ct) => (
                            <tr key={ct.id}>
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={!!selectedContacts[ct.id]}
                                  onChange={() => toggleContactSelect(ct.id)}
                                />
                              </td>
                              <td className="px-4 py-2">{ct.name}</td>
                              <td className="px-4 py-2">{ct.designation || '-'}</td>
                              <td className="px-4 py-2">{(ct as any).department || '-'}</td>
                              <td className="px-4 py-2">{ct.mobile || '-'}</td>
                              <td className="px-4 py-2">{ct.email || '-'}</td>
                              <td className="px-4 py-2">
                                {(ct as any).social ? (
                                  <a
                                    href={(ct as any).social}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-600 dark:text-sky-400 hover:underline"
                                  >
                                    Profile
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {customer && customer.contacts.length === 0 && (
                        <div className="px-4 py-6 text-center text-midnight-600 dark:text-ivory-400">
                          No contacts yet.
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>

        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete Contacts"
          message={`Are you sure you want to delete ${selectedIds.length} selected contact(s)?`}
          confirmText={deleting ? 'Deleting...' : 'Yes, Delete'}
          cancelText="Cancel"
          onConfirm={bulkDeleteContacts}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </div>
  );
};

export default EditCustomer;
