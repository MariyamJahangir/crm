import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Pencil, Trash2, Paperclip, Eye, File as FileIcon } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { customerService, Customer, Attachment, CustomerContact } from '../services/customerService';
import { teamService, TeamUser } from '../services/teamService';
import ConfirmDialog from '../components/ConfirmDialog';
import EditContactModal from '../components/EditContactModal';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import { toast } from 'react-hot-toast';
import Select from "react-select";
import CustomSelect from '../components/CustomSelect';


// Defines the structure of the main customer form
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
  country: string;
  sizeOfCompany: '' | '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  status: 'active' | 'inactive' | 'on-hold' | 'closed';
  note: string;
};


// Initial state for a new customer form
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
  country: '',
  sizeOfCompany: '',
  status: 'active',
  note: '',
};


const EditCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isCreate = !id;
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const MAX_ATTACHMENTS = 5;
  // State for the main customer form
  const [form, setForm] = useState<FormState>(initialForm);
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);


  // State for attachments
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);


  // State for contacts management
  const [showContacts, setShowContacts] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', designation: '', department: '', mobile: '', fax: '', email: '', social: '' });
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);


  // Fetches all necessary data when the component mounts or ID changes
  useEffect(() => {
    if (!token) return;


    teamService.list(token)
      .then(res => {
        setSalesmen(res.users);
        if (isCreate && !isAdmin && user) {
          setForm(p => ({ ...p, salesmanId: user.id || '' }));
        }
      })
      .catch(() => toast.error('Failed to load team members.'));


    if (id) {
      loadCustomer();
    }
  }, [id, token, isCreate, isAdmin, user?.id]);


  // Function to load or reload customer data
  const loadCustomer = async () => {
    if (!id || !token) return;
    setLoading(true);
    try {
      const res = await customerService.getOne(id, token);
      const { customer: loadedCustomer } = res;
      setCustomer(loadedCustomer);
      setForm({
        companyName: loadedCustomer.companyName || '',
        contactNumber: loadedCustomer.contactNumber || '',
        salesmanId: loadedCustomer.salesman?.id || '',
        email: loadedCustomer.email || '',
        vatNo: loadedCustomer.vatNo || '',
        address: loadedCustomer.address || '',
        industry: loadedCustomer.industry || '',
        category: loadedCustomer.category || '',
        website: loadedCustomer.website || '',
        country: loadedCustomer.country || '',
        sizeOfCompany: loadedCustomer.sizeOfCompany || '',
        status: loadedCustomer.status || 'active',
        note: loadedCustomer.note || '',
      });
      setAttachments(loadedCustomer.attachments || []);
      // *** FIX: Always set showContacts to true on the edit page ***
      setShowContacts(true);
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to load customer data.');
    } finally {
      setLoading(false);
    }
  };

  // Handles form input changes
  const onChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [key]: e.target.value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const newFiles = Array.from(e.target.files);
    if (attachments.length + newFiles.length > MAX_ATTACHMENTS) {
      toast.error(`You can only have up to ${MAX_ATTACHMENTS} attachments.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFilesToUpload(newFiles);
    setUploadConfirmOpen(true);
  };


  const confirmAndUpload = async () => {
    if (!id || !token || filesToUpload.length === 0) return;
    setUploading(true);
    setUploadConfirmOpen(false);
    try {
      const res = await customerService.uploadAttachments(id, filesToUpload, token);
      setAttachments(res.attachments); // Trust the server and replace the state
      toast.success('File(s) uploaded successfully!');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Upload failed.');
    } finally {
      setFilesToUpload([]);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };



  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!id || !token || !window.confirm('Are you sure you want to delete this file?')) return;
    const originalAttachments = [...attachments];
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
    try {
      await customerService.deleteAttachment(id, attachmentId, token);
      toast.success('File deleted successfully!');
    } catch (err: any) {
      setAttachments(originalAttachments);
      toast.error(err?.data?.message || 'Failed to delete file.');
    }
  };




  // Saves the main customer form (handles both create and update)
  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) return toast.error('Company name is required.');

    setSaving(true);
    try {
      if (isCreate) {
        const out = await customerService.create(form, token);
        navigate(`/customers/${out.customerId}/edit`, { replace: true }); // No need for 'state' anymore
        toast.success('Customer created successfully!');
      } else {
        await customerService.update(id!, form, token);
        navigate('/customers');
        toast.success('Customer saved successfully!');
      }
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to save customer.');
    } finally {
      setSaving(false);
    }
  };

  // Adds a new contact person
  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !token || !contactForm.name) return toast.error('Contact name is required.');
    try {
      await customerService.addContact(id, contactForm, token);
      toast.success('Contact added!');
      await loadCustomer();
      setContactForm({ name: '', designation: '', department: '', mobile: '', fax: '', email: '', social: '' });
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to add contact.');
    }
  };


  const selectedIds = useMemo(() => Object.keys(selectedContacts).filter(k => selectedContacts[k]), [selectedContacts]);


  // Deletes selected contacts in bulk
  const bulkDeleteContacts = async () => {
    if (!id || selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await customerService.bulkDeleteContacts(id, selectedIds, token);
      await loadCustomer();
      setSelectedContacts({});
      setDeleteConfirmOpen(false);
      toast.success(`${selectedIds.length} contact(s) deleted.`);
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to delete contacts.');
    } finally {
      setDeleting(false);
    }
  };


  const openEditModal = (contactId: string) => {
    setEditingContactId(contactId);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditingContactId(null);
    loadCustomer();
    toast.success('Contact updated successfully!');
  };


  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100">{isCreate ? 'Create Customer' : 'Edit Customer'}</h1>
          </div>

          {loading && <p>Loading customer data...</p>}

          {(!loading || isCreate) && (
            <form onSubmit={saveCustomer} className="space-y-8">

              <div className="p-8 rounded-2xl shadow-xl bg-cloud-50/40 dark:bg-midnight-900/40 border border-cloud-300/40">


                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Company Name */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Company Name</label>
                      <input value={form.companyName} onChange={onChange('companyName')} required className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>
                    {/* Industry */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Industry</label>
                      <input value={form.industry} onChange={onChange('industry')} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>

                    {/* Category */}
                    <div>

                      <CustomSelect
                        label="Category"
                        options={[
                          { value: "Enterprise", label: "Enterprise" },
                          { value: "SMB", label: "SMB" },
                          { value: "Individual", label: "Individual" },
                        ]}
                        value={form.category}
                        onChange={(val) => setForm({ ...form, category: val })}
                      />

                    </div>


                    {/* VAT No */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">VAT No</label>
                      <input value={form.vatNo} onChange={onChange('vatNo')} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Email</label>
                      <input type="email" value={form.email} onChange={onChange('email')} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>

                    {/* Contact Number */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Contact Number</label>
                      <input value={form.contactNumber} onChange={onChange('contactNumber')} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>

                    {/* Company Size */}
                    <div>
                      <CustomSelect
                        label="Company Size"
                        options={[
                          { value: "1-10", label: "1-10 Employees" },
                          { value: "11-50", label: "11-50 Employees" },
                          { value: "51-200", label: "51-200 Employees" },
                          { value: "201-500", label: "201-500 Employees" },
                          { value: "500+", label: "500+ Employees" },
                        ]}
                        value={form.sizeOfCompany}
                        onChange={(val) => setForm({ ...form, sizeOfCompany: val })}
                        placeholder="Select company size..."
                      />
                    </div>


                    {/* Website */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Website</label>
                      <input value={form.website} onChange={onChange('website')} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>

                    {/* Salesman */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                        Salesman
                      </label>

                      {isAdmin ? (
                        <CustomSelect
                          label={null} // label already above
                          options={salesmen.map((s) => ({
                            value: s.id,
                            label: s.isBlocked ? `${s.name} (Blocked)` : s.name,
                            isDisabled: s.isBlocked,
                          }))}
                          value={form.salesmanId}
                          onChange={(value) => setForm({ ...form, salesmanId: value })}
                          placeholder="Select salesman"
                        // extra props supported by react-select can still be passed down:
                        // isOptionDisabled={(option) => option.isDisabled}
                        />
                      ) : (
                        <input
                          value={user?.name || ""}
                          disabled
                          className="w-full h-11 px-4 rounded-xl border bg-cloud-100/60 dark:bg-midnight-800/60 text-midnight-700 dark:text-ivory-300 shadow-sm"
                        />
                      )}
                    </div>



                    {/* Status */}


                    <div>
                      <CustomSelect
                        label="Status"
                        options={[
                          { value: "active", label: "Active" },
                          { value: "inactive", label: "Inactive" },
                          { value: "on-hold", label: "On-Hold" },
                          { value: "closed", label: "Closed" },
                        ]}
                        value={form.status}
                        onChange={(val) => setForm({ ...form, status: val })}
                      />
                    </div>

                    {/* Address */}
                    <div >
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Address</label>
                      <textarea value={form.address} onChange={onChange('address')} rows={3} className="w-full h-12 px-4 py-3 rounded-xl border border-cloud-300/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                    </div>
                    {/* Country */}
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Country</label>
                      <input value={form.country} onChange={onChange('country')} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 text-midnight-900 shadow-sm" />
                    </div>


                    {/* Note */}
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Note</label>
                      <textarea value={form.note} onChange={onChange('note')} rows={3} className="w-full px-4 py-3 rounded-xl border border-cloud-300/50 bg-white/70 text-midnight-900 shadow-sm" />
                    </div>
                  </div>
                </div>

                {!isCreate && (
                  <div className="p-8 rounded-2xl mt-8 bg-cloud-50/50 dark:bg-midnight-900/40 border border-cloud-300/40">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Paperclip size={20} /> Attachments</h2>
                    <div className="mt-4">
                      <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} disabled={uploading} />
                      {uploading && <p className="mt-2 text-sm">Uploading...</p>}
                    </div>
                    <div className="mt-4 space-y-3 ">
                      {attachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-cloud-300/20 shadow-sm">

                          {/* The link now uses the absolute URL from the backend */}
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 truncate text-sky-600 hover:underline"
                          >
                            <FileIcon size={20} />
                            <span className="font-medium truncate">{att.name}</span>
                          </a>

                          <div className="flex items-center gap-2">
                            <span className="text-xs">({(att.size / 1024).toFixed(1)} KB)</span>
                            <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="p-1 text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-4">
                  <Button type="button" variant="secondary" onClick={() => navigate('/customers')}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                </div>

              </div>
            </form>
          )}

          {!isCreate && showContacts && (
            <section className="mt-8 p-8 rounded-2xl shadow-xl bg-cloud-50/40 dark:bg-midnight-900/40 border border-cloud-300/40">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold">Contacts</h2>
                <Button variant="danger" disabled={selectedIds.length === 0} onClick={() => setDeleteConfirmOpen(true)}>Delete ({selectedIds.length})</Button>
              </div>
              <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <input className="border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="Name*" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} required />
                <input className="border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="Designation" value={contactForm.designation} onChange={e => setContactForm(p => ({ ...p, designation: e.target.value }))} />
                <input className="border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="Department" value={contactForm.department} onChange={e => setContactForm(p => ({ ...p, department: e.target.value }))} />
                <input className="border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="Mobile" value={contactForm.mobile} onChange={e => setContactForm(p => ({ ...p, mobile: e.target.value }))} />
                <input className="border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="Fax" value={contactForm.fax} onChange={e => setContactForm(p => ({ ...p, fax: e.target.value }))} />
                <input type="email" className="border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="Email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} />
                <div className="sm:col-span-2 flex gap-2">
                  <input className="flex-1 border rounded-xl px-3 py-2 dark:bg-midnight-800" placeholder="LinkedIn/Social" value={contactForm.social} onChange={e => setContactForm(p => ({ ...p, social: e.target.value }))} />
                  <Button type="submit">Add Contact</Button>
                </div>
              </form>
              <div className="overflow-x-auto border rounded-lg border-cloud-200/70">
                <table className="min-w-full text-sm border-collapse">
                  <thead className="bg-cloud-100 dark:bg-midnight-800">
                    <tr className="text-center">
                      <th className="px-4 py-3 text-center align-middle"><input type="checkbox" disabled /></th>
                      <th className="px-4 py-3 text-center align-middle">Name</th>
                      <th className="px-4 py-3 text-center align-middle">Designation</th>
                      <th className="px-4 py-3 text-center align-middle">Mobile</th>
                      <th className="px-4 py-3 text-center align-middle">Email</th>
                      <th className="px-4 py-3 text-center align-middle">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer?.contacts?.map(ct => (
                      <tr key={ct.id} className="text-center">
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={!!selectedContacts[ct.id]}
                              onChange={() => setSelectedContacts(p => ({ ...p, [ct.id]: !p[ct.id] }))}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">{ct.name}</td>
                        <td className="px-4 py-3 align-middle">{ct.designation}</td>
                        <td className="px-4 py-3 align-middle">{ct.mobile}</td>
                        <td className="px-4 py-3 align-middle">{ct.email}</td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-center">
                            <button type="button" onClick={() => openEditModal(ct.id)}>
                              <Pencil size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </section>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={uploadConfirmOpen}
        title="Confirm File Upload"
        confirmText={uploading ? 'Uploading...' : `Upload ${filesToUpload.length} File(s)`}
        onConfirm={confirmAndUpload}
        onCancel={() => {
          setUploadConfirmOpen(false);
          setFilesToUpload([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      >
        <p className="mb-4">You are about to upload the following files:</p>
        <ul className="space-y-2 max-h-48 overflow-y-auto bg-cloud-100 dark:bg-midnight-700 p-3 rounded-lg">
          {filesToUpload.map((file, i) => <li key={i} className="flex items-center gap-2"><FileIcon size={16} /> {file.name}</li>)}
        </ul>
      </ConfirmDialog>

      <AttachmentPreviewModal open={!!previewingAttachment} onClose={() => setPreviewingAttachment(null)} attachment={previewingAttachment} />

      <ConfirmDialog open={deleteConfirmOpen} onConfirm={bulkDeleteContacts} onCancel={() => setDeleteConfirmOpen(false)} title="Delete Contacts" message={`Are you sure you want to delete ${selectedIds.length} contact(s)?`} />

      {isEditModalOpen && editingContactId && (
        <EditContactModal open={isEditModalOpen} onClose={() => setEditModalOpen(false)} onSuccess={handleEditSuccess} contactId={editingContactId} customerId={id!} />
      )}
    </div>
  );
};

export default EditCustomer;
