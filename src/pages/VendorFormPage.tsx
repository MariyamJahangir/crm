// src/pages/VendorFormPage.tsx

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendorService, Vendor, VendorContact, VendorStatus, VendorCategory, PaymentTerms } from '../services/vendorService';
import { teamService } from '../services/teamService';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';

interface Member { id: string; name: string; }

const VendorFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [vendor, setVendor] = useState<Partial<Vendor>>({ status: 'Active' });
  const [contacts, setContacts] = useState<Partial<VendorContact>[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isEditMode = Boolean(id);
  const isAdmin = user?.type === 'ADMIN';

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        if (isEditMode && id) {
          const res = await vendorService.getById(token, id);
          setVendor(res.vendor);
          setContacts(res.vendor.contacts.length > 0 ? res.vendor.contacts : [{ name: '' }]);
        } else {
          setVendor({ status: 'Active', assignedTo: user?.id });
          setContacts([{ name: '' }]);
        }
      } catch {
        setError('Failed to fetch initial data.');
      } finally {
        setLoading(false);
      }
    };
    
    const fetchMembers = async () => {
      if (isAdmin) {
        try {
          const res = await teamService.list(token);
          setMembers(res.users || []);
        } catch {
          setError("Failed to load team members.");
        }
      }
    };

    fetchInitialData();
    fetchMembers();
  }, [id, isEditMode, token, isAdmin, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setVendor(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleContactChange = (index: number, field: keyof VendorContact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const addContact = () => setContacts([...contacts, { name: '' }]);
  const removeContact = (index: number) => setContacts(contacts.filter((_, i) => i !== index));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = { ...vendor, contacts: contacts.filter(c => c && c.name) as VendorContact[] };
      
      if (isEditMode && id) {
        await vendorService.update(token, id, payload);
      } else {
        await vendorService.create(token, payload);
      }
      navigate('/vendors');
    } catch (err: any) {
      setError(err?.data?.message || 'An error occurred while saving the vendor.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
      if (!token || !id) return;
      setIsSubmitting(true);
      try {
          await vendorService.remove(token, id);
          navigate('/vendors');
      } catch (err: any) {
          setError(err?.data?.message || 'Failed to delete vendor.');
      } finally {
        setIsSubmitting(false);
        setConfirmDeleteOpen(false);
      }
  };

  const TabButton: React.FC<{tab: string; label: string}> = ({tab, label}) => (
      <button type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          {label}
      </button>
  );

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-0 sm:pl-64">
        <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <form onSubmit={handleSubmit}>
                <div className="bg-white rounded-lg shadow-sm">
                    <div className="p-6 border-b flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">{isEditMode ? 'Edit Vendor' : 'Create New Vendor'}</h1>
                            {isEditMode && <p className="text-gray-500">{vendor.vendorName}</p>}
                        </div>
                        {isEditMode && isAdmin && (
                            <Button type="button" variant="danger" onClick={() => setConfirmDeleteOpen(true)}>Delete</Button>
                        )}
                    </div>
                    <div className="border-b">
                        <nav className="flex space-x-4 px-6">
                          <TabButton tab="basic" label="Basic Info" />
                          <TabButton tab="contacts" label="Contacts" />
                          <TabButton tab="business" label="Business & Financial" />
                        </nav>
                    </div>
                    <div className="p-6 space-y-6">
                        {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
                        
                        {activeTab === 'basic' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <input name="vendorName" placeholder="Vendor Name*" value={vendor.vendorName || ''} onChange={handleChange} className="p-2 border rounded w-full lg:col-span-2" required />
                                <select name="status" value={vendor.status || 'Active'} onChange={handleChange} className="p-2 border rounded w-full">
                                    {(['Active', 'Inactive', 'OnHold', 'Blacklisted'] as VendorStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input type="email" name="email" placeholder="Email" value={vendor.email || ''} onChange={handleChange} className="p-2 border rounded w-full" />
                                <input name="phone" placeholder="Phone" value={vendor.phone || ''} onChange={handleChange} className="p-2 border rounded w-full" />
                                <input name="website" placeholder="Website URL" value={vendor.website || ''} onChange={handleChange} className="p-2 border rounded w-full" />
                                <textarea name="address" placeholder="Address" value={vendor.address || ''} onChange={handleChange} className="p-2 border rounded w-full md:col-span-3" rows={2}/>
                                {isAdmin && (
                                  <div className="lg:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                                    <select name="assignedTo" value={vendor.assignedTo || ''} onChange={handleChange} className="p-2 border rounded w-full self-start">
                                      <option value="">-- Select a Member --</option>
                                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                  </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'contacts' && (
                           <div className="space-y-3">
                                {contacts.map((c, i) => (
                                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center p-3 border rounded-md bg-gray-50">
                                        <input placeholder="Name*" value={c.name || ''} onChange={e => handleContactChange(i, 'name', e.target.value)} className="p-2 border rounded" required={i === 0}/>
                                        <input placeholder="Designation" value={c.designation || ''} onChange={e => handleContactChange(i, 'designation', e.target.value)} className="p-2 border rounded"/>
                                        <input type="email" placeholder="Email" value={c.email || ''} onChange={e => handleContactChange(i, 'email', e.target.value)} className="p-2 border rounded"/>
                                        <div className="flex items-center gap-2">
                                            <input placeholder="Phone" value={c.phone || ''} onChange={e => handleContactChange(i, 'phone', e.target.value)} className="p-2 border rounded w-full"/>
                                            {contacts.length > 1 && <button type="button" onClick={() => removeContact(i)} className="text-red-500 font-bold p-1">&times;</button>}
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={addContact} className="text-sm text-blue-600 hover:underline">+ Add Contact</button>
                            </div>
                        )}
                        
                        {activeTab === 'business' && (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <input name="industry" placeholder="Industry" value={vendor.industry || ''} onChange={handleChange} className="p-2 border rounded w-full" />
                                <select name="category" value={vendor.category || ''} onChange={handleChange} className="p-2 border rounded w-full">
                                    <option value="">Select Category</option>
                                    {(['Manufacturer', 'Distributor', 'ServiceProvider', 'Other'] as VendorCategory[]).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <select name="paymentTerms" value={vendor.paymentTerms || ''} onChange={handleChange} className="p-2 border rounded w-full">
                                    <option value="">Payment Terms</option>
                                    {(['Advance', 'Net15', 'Net30', 'Net60'] as PaymentTerms[]).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <input name="gstNo" placeholder="GST No." value={vendor.gstNo || ''} onChange={handleChange} className="p-2 border rounded w-full" />
                                <input name="panNo" placeholder="PAN No." value={vendor.panNo || ''} onChange={handleChange} className="p-2 border rounded w-full" />
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-lg">
                        <Button type="button" variant="secondary" onClick={() => navigate('/vendors')}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                    </div>
                </div>
            </form>
        </main>
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Vendor"
        message={`Are you sure you want to permanently delete this vendor? This action cannot be undone.`}
        confirmText={isSubmitting ? 'Deleting...' : 'Confirm Delete'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default VendorFormPage;
