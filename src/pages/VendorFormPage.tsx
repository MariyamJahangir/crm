// src/pages/VendorFormPage.tsx

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendorService, Vendor, VendorContact, VendorStatus, VendorCategory, PaymentTerms } from '../services/vendorService';
import { teamService } from '../services/teamService';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import { X } from "lucide-react";

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

  const TabButton: React.FC<{ tab: string; label: string }> = ({ tab, label }) => (
    <button type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
      {label}
    </button>
  );

  if (loading) return <div className="p-8 text-center">Loading...</div>;

return (
  <div className="flex min-h-screen  z-10 transition-colors duration-300">
    <Sidebar />

    <div className="flex-1 overflow-y-auto h-screen">
      <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-midnight-800 dark:text-ivory-100">
            {isEditMode ? "Edit Vendor" : "Create New Vendor"}
          </h1>
          {isEditMode && (
            <p className="text-midnight-400 dark:text-ivory-400 mt-1">
              {vendor.vendorName}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700
                          text-stone-700 dark:text-stone-200 px-4 py-3 rounded-lg mb-6 shadow-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl
                     p-6 rounded-2xl shadow-xl border border-cloud-300/30 dark:border-midnight-700/30"
        >
          {/* Tabs */}
          <div className="flex gap-4 border-b border-cloud-300/40 dark:border-midnight-700/40 pb-3">
            <TabButton tab="basic" label="Basic Info" />
            <TabButton tab="contacts" label="Contacts" />
            <TabButton tab="business" label="Business" />
          </div>

          {/* Basic Info */}
          {activeTab === "basic" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Vendor Name (spans 2 cols on large screens) */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Vendor Name
                </label>
                <input
                  name="vendorName"
                  placeholder="Vendor Name*"
                  value={vendor.vendorName || ""}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             placeholder-midnight-400 dark:placeholder-ivory-500 shadow-sm
                             focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={vendor.status || "Active"}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                >
                  {(["Active", "Inactive", "OnHold", "Blacklisted"] as VendorStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={vendor.email || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             placeholder-midnight-400 dark:placeholder-ivory-500 shadow-sm
                             focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Phone
                </label>
                <input
                  name="phone"
                  placeholder="Phone"
                  value={vendor.phone || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             placeholder-midnight-400 dark:placeholder-ivory-500 shadow-sm
                             focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Website
                </label>
                <input
                  name="website"
                  placeholder="Website URL"
                  value={vendor.website || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             placeholder-midnight-400 dark:placeholder-ivory-500 shadow-sm
                             focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>

              {/* Address - spans full row on md+ */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Address
                </label>
                <textarea
                  name="address"
                  placeholder="Address"
                  value={vendor.address || ""}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             placeholder-midnight-400 dark:placeholder-ivory-500 shadow-sm
                             focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>

              {/* Assign To (admin only) */}
              {isAdmin && (
                <div className="lg:col-span-3">
                  <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                    Assign To
                  </label>
                  <select
                    name="assignedTo"
                    value={vendor.assignedTo || ""}
                    onChange={handleChange}
                    className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                               bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                               shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                  >
                    <option value="">-- Select a Member --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Contacts */}
          {activeTab === "contacts" && (
            <div className="space-y-4">
              {contacts.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center
                             p-4 border border-cloud-300/30 dark:border-midnight-700/30
                             rounded-2xl bg-white/10 dark:bg-midnight-800/50 shadow-sm"
                >
                  <div>
                    <label className="block text-xs font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                      Name
                    </label>
                    <input
                      placeholder="Name*"
                      value={c.name || ""}
                      onChange={(e) => handleContactChange(i, "name", e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                                 bg-white/60 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                                 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/40 transition"
                      required={i === 0}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                      Designation
                    </label>
                    <input
                      placeholder="Designation"
                      value={c.designation || ""}
                      onChange={(e) => handleContactChange(i, "designation", e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                                 bg-white/60 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                                 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="Email"
                      value={c.email || ""}
                      onChange={(e) => handleContactChange(i, "email", e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                                 bg-white/60 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                                 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-midnight-700 dark:text-ivory-200 mb-1">
                      Phone
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Phone"
                        value={c.phone || ""}
                        onChange={(e) => handleContactChange(i, "phone", e.target.value)}
                        className="flex-1 h-10 px-3 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                                   bg-white/60 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                                   shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/40 transition"
                      />
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeContact(i)}
                          className="hidden sm:inline-flex items-center justify-center 
                                        w-5 h-5 rounded-full
                                        bg-red-200/40 dark:bg-red-700/40 backdrop-blur-md
                                        hover:bg-red-300/60 dark:hover:bg-red-600/60 
                                        shadow-md transition cursor-pointer"
                          aria-label="Remove contact"
                        >
                          <X className="w-4 h-4 text-red-500" />
                          
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={addContact}
                  className="px-4 py-2 rounded-xl bg-sky-600/90 text-white shadow hover:bg-sky-600 
               transition font-medium text-sm"
                >
                  + Add Contact
                </button>
              </div>
            </div>
          )}

          {/* Business & Financial */}
          {activeTab === "business" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Industry
                </label>
                <input
                  name="industry"
                  placeholder="Industry"
                  value={vendor.industry || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Category
                </label>
                <select
                  name="category"
                  value={vendor.category || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                >
                  <option value="">Select Category</option>
                  {(["Manufacturer", "Distributor", "Service Provider", "Other"] as VendorCategory[]).map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                  Payment Terms
                </label>
                <select
                  name="paymentTerms"
                  value={vendor.paymentTerms || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                >
                  <option value="">Payment Terms</option>
                  {(["Advance", "Net15", "Net30", "Net60"] as PaymentTerms[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div> */}

             

              <div>
                <label className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">
                 VAT No.
                </label>
                <input
                  name="panNo"
                  placeholder="VAT No."
                  value={vendor.panNo || ""}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-200/50 dark:border-midnight-600/50
                             bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100
                             shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                />
              </div>
            </div>
          )}

          {/* Form actions */}
          <div className="flex justify-end gap-4 pt-4">
           <Button
  type="button"
  className="px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition"
  onClick={() => navigate("/vendors")}
>
  Cancel
</Button>


            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </main>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Vendor"
        message={`Are you sure you want to permanently delete this vendor? This action cannot be undone.`}
        confirmText={isSubmitting ? "Deleting..." : "Confirm Delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  </div>
);


};

export default VendorFormPage;
