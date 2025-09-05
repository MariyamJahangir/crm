// pages/EditCustomer.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer } from '../services/customerService';
import { teamService, TeamUser } from '../services/teamService';
import ConfirmDialog from '../components/ConfirmDialog';

type FormState = {
  companyName: string;
  contactNumber: string;
  salesmanId: string;
  email: string;
  vatNo: string;
  address: string;
};

const initialForm: FormState = {
  companyName: '',
  contactNumber: '',
  salesmanId: '',
  email: '',
  vatNo: '',
  address: '',
};

const EditCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isCreate = !id;
  const { token, user } = useAuth();

  const isAdmin = user?.subjectType === 'ADMIN';

  const [form, setForm] = useState<FormState>(initialForm);
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [contactForm, setContactForm] = useState({ name: '', designation: '', mobile: '', fax: '', email: '' });
  const [contactError, setContactError] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Always load team users for the dropdown, for both admins and members
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await teamService.list(token);
        setSalesmen(res.users);
        if (isCreate && res.users.length > 0) {
          setForm((p) => ({ ...p, salesmanId: res.users.id }));
        }
      } catch {
        // optionally handle error
      }
    })();
  }, [token, isCreate]);

  useEffect(() => {
    if (!id) return;
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
        });
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const onChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
    };

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isCreate) {
        const payload: {
          companyName: string;
          contactNumber?: string;
          salesmanId?: string;
          email?: string;
          vatNo?: string;
          address?: string;
        } = {
          companyName: form.companyName,
          contactNumber: form.contactNumber || undefined,
          email: form.email || undefined,
          vatNo: form.vatNo || undefined,
          address: form.address || undefined,
          salesmanId: form.salesmanId || undefined, // always send if chosen
        };
        const out = await customerService.create(payload, token);
        navigate(`/customers/${out.customerId}/edit`, { replace: true });
      } else {
        const payload: Partial<{
          companyName: string;
          contactNumber: string;
          salesmanId: string;
          email: string;
          vatNo: string;
          address: string;
        }> = {
          companyName: form.companyName,
          contactNumber: form.contactNumber,
          email: form.email,
          vatNo: form.vatNo,
          address: form.address,
          salesmanId: form.salesmanId || undefined, // always include selection
        };
        await customerService.update(id!, payload, token);
        const res = await customerService.getOne(id!, token);
        setCustomer(res.customer);
      }
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setContactError(null);
    if (!contactForm.name.trim()) {
      setContactError('Contact name is required');
      return;
    }
    try {
      await customerService.addContact(
        id,
        {
          name: contactForm.name,
          designation: contactForm.designation || undefined,
          mobile: contactForm.mobile || undefined,
          fax: contactForm.fax || undefined,
          email: contactForm.email || undefined,
        },
        token
      );
      const res = await customerService.getOne(id, token);
      setCustomer(res.customer);
      setContactForm({ name: '', designation: '', mobile: '', fax: '', email: '' });
    } catch (e: any) {
      setContactError(e?.data?.message || 'Failed to add contact');
    }
  };

  const toggleContactSelect = (cid: string) => {
    setSelectedContacts((prev) => ({ ...prev, [cid]: !prev[cid] }));
  };

  const selectedIds = useMemo(() => Object.keys(selectedContacts).filter((k) => selectedContacts[k]), [selectedContacts]);

  const bulkDeleteContacts = async () => {
    if (!id || selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await customerService.bulkDeleteContacts(id, selectedIds, token);
      const res = await customerService.getOne(id, token);
      setCustomer(res.customer);
      setSelectedContacts({});
      setConfirmOpen(false);
    } catch {
      // optional toast
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
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
                    <input
                      value={form.companyName}
                      onChange={onChange('companyName')}
                      required
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Acme Pvt Ltd"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                    <input
                      value={form.contactNumber}
                      onChange={onChange('contactNumber')}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  {/* Always show Salesman dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salesman</label>
                    <select
                      value={form.salesmanId}
                      onChange={onChange('salesmanId')}
                      required
                      className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                    {/* No role-based note; dropdown always visible */}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={onChange('email')}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="sales@acme.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT No</label>
                    <input
                      value={form.vatNo}
                      onChange={onChange('vatNo')}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="GST/VAT number"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={form.address}
                      onChange={onChange('address')}
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Full address"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => navigate('/customers')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : isCreate ? 'Create Customer' : 'Save Changes'}
                  </Button>
                </div>
              </form>

              {!isCreate && (
                <section className="bg-white p-6 rounded-lg shadow-sm border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
                    <div className="flex gap-2">
                      <Button variant="danger" disabled={selectedIds.length === 0} onClick={() => setConfirmOpen(true)}>
                        Delete Selected ({selectedIds.length})
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
                    <input
                      className="border rounded px-3 py-2"
                      placeholder="Name*"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                    <input
                      className="border rounded px-3 py-2"
                      placeholder="Designation"
                      value={contactForm.designation}
                      onChange={(e) => setContactForm((p) => ({ ...p, designation: e.target.value }))}
                    />
                    <input
                      className="border rounded px-3 py-2"
                      placeholder="Mobile"
                      value={contactForm.mobile}
                      onChange={(e) => setContactForm((p) => ({ ...p, mobile: e.target.value }))}
                    />
                    <input
                      className="border rounded px-3 py-2"
                      placeholder="Fax"
                      value={contactForm.fax}
                      onChange={(e) => setContactForm((p) => ({ ...p, fax: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded px-3 py-2"
                        placeholder="Email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      />
                      <Button type="submit">Add</Button>
                    </div>
                  </form>
                  {contactError && <div className="text-red-600 mb-3">{contactError}</div>}

                  <div className="border rounded">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
                      <div className="col-span-1" />
                      <div className="col-span-3">Name</div>
                      <div className="col-span-2">Designation</div>
                      <div className="col-span-2">Mobile</div>
                      <div className="col-span-2">Fax</div>
                      <div className="col-span-2">Email</div>
                    </div>
                    {customer?.contacts.map((ct) => (
                      <div key={ct.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b text-sm items-center">
                        <div className="col-span-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!!selectedContacts[ct.id]}
                            onChange={() => toggleContactSelect(ct.id)}
                          />
                        </div>
                        <div className="col-span-3">{ct.name}</div>
                        <div className="col-span-2">{ct.designation || '-'}</div>
                        <div className="col-span-2">{ct.mobile || '-'}</div>
                        <div className="col-span-2">{ct.fax || '-'}</div>
                        <div className="col-span-2">{ct.email || '-'}</div>
                      </div>
                    ))}
                    {customer && customer.contacts.length === 0 && (
                      <div className="px-3 py-4 text-gray-600">No contacts yet.</div>
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
  );
};

export default EditCustomer;
