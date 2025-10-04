// src/pages/CloneQuote.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import SelectLeadModal from '../components/SelectLeadModal';
import { useAuth } from '../contexts/AuthContext';
import { leadsService,Lead } from '../services/leadsService';
import { quotesService } from '../services/quotesService';
import { teamService, TeamUser } from '../services/teamService';
import { customerService } from '../services/customerService';
import PreviewModal from '../components/PreviewModal'; // <-- 1. Import PreviewModal


import { toast } from 'react-hot-toast';

// --- Type Definitions ---
type ItemState = {
  slNo: number;
  product: string;
  description: string;
  quantity: number;
  unitCost: number;
  marginPercent: number;
  vatPercent: number;
};

type QuoteItem = {
  slNo: number;
  product: string;
  description: string;
  quantity: number;
  unitCost: number;
  marginPercent: number;
  vatPercent: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
};

type SavedQuote = {
  id: string;
  number: string;
  isApproved?: boolean;
};

// CSS to hide number input spinners
const noSpinnersCSS = `
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type='number'] { -moz-appearance: textfield; }
`;

const CloneQuote: React.FC = () => {
  const { id: quoteIdToClone } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
const [lead, setLead] = useState<Lead | null>(null);
  // --- State Declarations ---
  const [items, setItems] = useState<ItemState[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadNumber, setLeadNumber] = useState('');
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [salesmanId, setSalesmanId] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string; designation?: string; mobile?: string; email?: string }[]>([]);
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [contactPerson, setContactPerson] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [phone, setPhone] = useState('');
   const [paymentTerms, setPaymentTerms] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [email, setEmail] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validityUntil, setValidityUntil] = useState('');
  const [discountMode, setDiscountMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
  const [lastSavedQuote, setLastSavedQuote] = useState<SavedQuote | null>(null);
  const [leadIsShared, setLeadIsShared] = useState(false);
  const [sharePercent, setSharePercent] = useState<number>(0);

  const today = new Date().toISOString().split('T')[0];

  // --- Live Calculation Logic ---
  const totals = useMemo(() => {
    let subtotal = 0;
    let businessTotalCost = 0;
    let totalVat = 0;

    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || 0);
      const marginPercent = Number(item.marginPercent || 0);
      const itemVatPercent = Number(item.vatPercent || 0);

      const unitPrice = unitCost * (1 + marginPercent / 100);
      const lineTotalPrice = unitPrice * quantity;
      const lineVat = lineTotalPrice * (itemVatPercent / 100);

      subtotal += lineTotalPrice;
      businessTotalCost += unitCost * quantity;
      totalVat += lineVat;
    }

    const discountAmount = discountMode === 'PERCENT' ? (subtotal * discountValue) / 100 : Math.min(discountValue, subtotal);
    const netAfterDiscount = subtotal - discountAmount;
    const grandTotal = netAfterDiscount + totalVat;
    const grossProfit = netAfterDiscount - businessTotalCost;
    const profitPercent = netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0;
    const sharedProfit = leadIsShared ? (grandTotal * (sharePercent || 0)) / 100 : 0;

    return { subtotal, businessTotalCost, totalVat, discountAmount, netAfterDiscount, grandTotal, grossProfit, profitPercent, sharedProfit };
  }, [items, discountMode, discountValue, sharePercent, leadIsShared]);
 useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { users } = await teamService.list(token);
        setSalesmen(users);
      } catch {
        toast.error('Failed to load team members.');
      }
    })();
  }, [token]);
  // --- Core Functions ---
  const addRow = () => setItems(prev => [...prev, { slNo: prev.length + 1, product: '', description: '', quantity: 1, unitCost: 0, marginPercent: 0, vatPercent: 5 }]);
  const removeRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx).map((it, idx2) => ({ ...it, slNo: idx2 + 1 })));
  const handleItemChange = (idx: number, patch: Partial<ItemState>) => setItems(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  
  const clearContactFields = () => {
    setContactId(undefined);
    setContactPerson('');
    setContactDesignation('');
    setPhone('');
    setEmail('');
  };

  const autofillContactFields = (contact: { id: string; name: string; designation?: string; mobile?: string; email?: string }) => {
    setContactId(contact.id);
    setContactPerson(contact.name);
    setContactDesignation(contact.designation || '');
    setPhone(contact.mobile || '');
    setEmail(contact.email || '');
  };

  // --- Save Function (Creates a new quote from the current state) ---
// src/pages/CloneQuote.tsx
    const handlePreview = async () => {
        setPreviewLoading(true);
        try {
            const payload = buildPreviewPayload();
            const { html } = await quotesService.previewHtml(payload, token!);
            setPreview({ open: true, html });
        } catch (err: any) {
            toast.error(err?.data?.message || 'Could not generate preview.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const payload = buildPreviewPayload();
            await quotesService.downloadPdf(payload, token!);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Could not generate PDF.');
        } finally {
            setDownloading(false);
        }
    };
const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteIdToClone) { toast.error("Original Quote ID is missing."); return; }
    if (!salesmanId) { toast.error("A salesman must be assigned."); return; }
    if (!validityUntil) { toast.error('Please select a "Validity Until" date.'); return; }
    if (items.some(it => !it.product.trim() || it.quantity <= 0)) {
        toast.error('Each item must have a product name and quantity > 0.');
        return;
    }

    setSaving(true);

    const requiresApproval = items.some(item => item.marginPercent < 8);

    // --- FULLY UPDATED PAYLOAD ---
    const payload = {
        quoteDate: quoteDate ? new Date(quoteDate).toISOString() : undefined,
        validityUntil: validityUntil ? new Date(validityUntil).toISOString() : undefined,
        salesmanId,
        customerName,
        contactPerson,
        contactDesignation,
        phone,
        email,
        currency,
        address,
        description,
        termsAndConditions, // Included
        paymentTerms,       // Included
        discountMode,
        discountValue,
        sharePercent: leadIsShared ? sharePercent : 0,
        items: items.map(it => ({ ...it })),
        status: requiresApproval && !isAdmin ? 'PendingApproval' : 'Draft',
        isApproved: !requiresApproval,
    };

    try {
        const res = await quotesService.clone(quoteIdToClone, payload, token!);
        toast.success("New quote created from clone successfully!");
        navigate(`/quote`);
    } catch (err: any) {
        const errorMessage = err?.data?.errors?.[0]?.msg || err?.data?.message || 'Failed to clone the quote.';
        toast.error(errorMessage);
    } finally {
        setSaving(false);
    }
};

 useEffect(() => {
    if (!quoteIdToClone || !token || !user) return;

    const fetchQuoteDataForCloning = async () => {
      try {
        const { quote } = await quotesService.getOneById(quoteIdToClone, token);
console.log(quote);

        // --- All fields are now correctly populated ---
        setSelectedLeadId(quote.leadId);
        setCustomerName(quote.customerName || '');
        setContactPerson(quote.contactPerson || '');
        setContactDesignation(quote.contactDesignation || '');
        setPhone(quote.phone || '');
        setEmail(quote.email || '');
        setAddress(quote.address || '');
        setDescription(quote.description || '');
        setPaymentTerms(quote.paymentTerms || '');
        setTermsAndConditions(quote.termsAndConditions || '');
        setCurrency(quote.currency || 'USD');
        setDiscountMode(quote.discountMode || 'PERCENT');
        setDiscountValue(Number(quote.discountValue) || 0);

        if (isAdmin) {
          setSalesmanId(quote.salesmanId);
        } else {
          setSalesmanId(user.id);
        }

        // --- Correctly handle the 'shares' array from the quote object ---
        const isShared = Array.isArray(quote.shares) && quote.shares.length > 0;
        setLeadIsShared(isShared);

        if (isShared) {
          // Find the share object relevant to the current user
          const currentUserShare = quote.shares.find(share => 
            String(share.memberId) === String(user.id) ||
            String(share.sharedMemberId) === String(user.id)
          );
          // Set the percentage from that share
          setSharePercent(Number(currentUserShare?.profitPercentage) || 0);
        } else {
          setSharePercent(0);
        }

        if (quote.items?.length > 0) {
          setItems(quote.items.map((item: any, index: number) => ({
            slNo: index + 1,
            product: item.product,
            description: item.description,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            marginPercent: Number(item.marginPercent),
            vatPercent: Number(item.vatPercent),
          })));
        }
        
        // Fetch and set lead/contact details after getting the leadId
        if (quote.leadId) {
            const { lead: fetchedLead } = await leadsService.getOne(quote.leadId, token);
            setLeadNumber(fetchedLead.uniqueNumber || '');
            if (fetchedLead.customer?.id) {
                const { contacts: fetchedContacts } = await customerService.getContacts(fetchedLead.customer.id, token);
                setContacts(fetchedContacts || []);
            }
        }

      } catch (error) {
        toast.error("Failed to load quote data for cloning.");
        navigate('/quote');
      }
    };

    fetchQuoteDataForCloning();
  }, [quoteIdToClone, token, navigate, isAdmin, user]);


  useEffect(() => {
    if (!token || !selectedLeadId) return;
    (async () => {
      try {
        const { lead } = await leadsService.getOne(selectedLeadId, token);
        setLeadNumber(lead.uniqueNumber || '');
        setLeadIsShared(Array.isArray(lead.shares) && lead.shares.length > 0);
        if (lead.customer?.id) {
          const contactsResp = await customerService.getContacts(lead.customer.id, token);
          setContacts(contactsResp.contacts || []);
        }
      } catch (error) {
        toast.error('Failed to load associated lead details.');
      }
    })();
  }, [token, selectedLeadId]);

  const canViewSharePercent = useMemo(() => {
    // If the user is admin, they can always see it.
    if (isAdmin) {
        return true;
    }
    // For non-admins, show the field only if the lead is shared.
    // The sharePercent state is correctly set in the useEffect hook.
    return leadIsShared;
  }, [leadIsShared, isAdmin]);


  return (
    <>
      <style>{noSpinnersCSS}</style>
      <div className="flex min-h-screen z-10">
        <Sidebar />
        <div className="flex-1 overflow-y-auto h-screen">
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-midnight-900 dark:text-ivory-200">Clone Quote</h1>
                <p className="text-gray-600 dark:text-midnight-400">Editing a copy of a previous quote. A new quote will be created upon saving.</p>
              </div>
            </div>

            <form onSubmit={save} className="space-y-6 bg-cloud-50/40 dark:bg-midnight-900/40 backdrop-blur-xl border border-cloud-300/40 dark:border-midnight-700/40 rounded-2xl p-8 shadow-xl">
              {/* --- Form content is identical to CreateQuote.tsx --- */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Lead Number</label>
                  <input type="text" readOnly value={leadNumber} className="w-full h-11 px-4 rounded-xl border ... bg-gray-100 cursor-not-allowed"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Quote Date</label>
                  <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full h-11 px-4 ..."/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Validity Until</label>
                  <input type="date" value={validityUntil} min={today} onChange={(e) => setValidityUntil(e.target.value)} className="w-full h-11 px-4 ..."/>
                </div>
                <div>
                                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Salesman</label>
                                    {isAdmin ? (
                                        <select
                                            value={salesmanId}
                                            className="w-full h-11 px-4 rounded-xl border ..."
                                            onChange={(e) => setSalesmanId(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>Select salesman</option>
                                            {salesmen.map((s) => (
                                                <option key={s.id} value={s.id} disabled={s.isBlocked}>
                                                    {s.name}{s.isBlocked ? ' (Blocked)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            value={salesmen.find(s => s.id === salesmanId)?.name || user?.name || ''}
                                            disabled
                                            className="w-full h-11 px-4 rounded-xl border bg-cloud-100/60 dark:bg-midnight-800/60"
                                        />
                                    )}
                                </div>
              </div>
              <div className="border-t ... pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold ...">Customer Name</label>
                    <input type="text" className="w-full h-11 px-4 ..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold ...">Contact Person</label>
                    <select className="w-full h-11 px-4 rounded-xl border ..." value={contactId ?? ""}
                      onChange={(e) => {
                        const selectedContact = contacts.find(c => c.id === e.target.value);
                        if (selectedContact) autofillContactFields(selectedContact);
                      }}>
                      <option value="" disabled>Select Contact</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold ...">Phone</label>
                    <input type="text" className="w-full h-11 px-4 ..." value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold ...">Email</label>
                    <input type="email" className="w-full h-11 px-4 ..." value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold ...">Contact Designation</label>
                    <input type="text" className="w-full h-11 px-4 ..." value={contactDesignation} onChange={(e) => setContactDesignation(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold ...">Address</label>
                    <input type="text" className="w-full h-11 px-4 ..." value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="mt-6 sm:w-40">
                    <label className="block text-sm font-semibold ...">Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="select select-bordered w-full" required>
                   <option value="USD">USD - US Dollar</option>
<option value="INR">INR - Indian Rupee</option>
<option value="SAR">SAR - Saudi Riyal</option>
<option value="AED">AED - UAE Dirham</option>
<option value="QAR">QAR - Qatari Riyal</option>
<option value="KWD">KWD - Kuwaiti Dinar</option>
<option value="BHD">BHD - Bahraini Dinar</option>
<option value="OMR">OMR - Omani Rial</option>

                    </select>
                  </div>
                   <div>
        <label className="block text-sm font-semibold ...">Payment Terms</label>
        <textarea
          rows={5}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          className="w-full rounded-xl ..."
          placeholder="e.g., 50% advance, 50% on delivery..."
        />
      </div>
                {canViewSharePercent && (
                <div className="mt-4 w-40">
                  <label className="block text-sm font-semibold mb-1">Share Percentage (%)</label>
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    value={sharePercent} 
                    onChange={(e) => setSharePercent(Number(e.target.value))} 
                    className="input input-bordered w-full" 
                  />
                </div>
              )}
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-semibold ...">Description</label>
                    <textarea rows={3} className="w-full px-4 py-3 ..." value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto mt-6">
                <table className="w-full border ...">
                  <thead>
                    <tr className="text-sm font-semibold ...">
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left w-1/5">Product</th>
                      <th className="px-4 py-2 text-left w-1/4">Description</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Unit Cost</th>
                      <th className="px-4 py-2 text-right">Total Cost</th>
                      <th className="px-4 py-2 text-right">Margin %</th>
                      <th className="px-4 py-2 text-right">Unit Price</th>
                      <th className="px-4 py-2 text-right">Total Price</th>
                      <th className="px-4 py-2 text-right">VAT %</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const unitPrice = item.unitCost * (1 + item.marginPercent / 100);
                      const totalCost = item.unitCost * item.quantity;
                      const totalPrice = unitPrice * item.quantity;
                      return (
                        <tr key={idx} className="text-sm ...">
                          <td className="px-4 py-2">{item.slNo}</td>
                          <td><input value={item.product} onChange={(e) => handleItemChange(idx, { product: e.target.value })} className="input input-sm ..."/></td>
                          <td><input value={item.description} onChange={(e) => handleItemChange(idx, { description: e.target.value })} className="input input-sm ..."/></td>
                          <td><input type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, { quantity: Number(e.target.value) })} className="input input-sm ..."/></td>
                          <td><input type="number" value={item.unitCost} onChange={(e) => handleItemChange(idx, { unitCost: Number(e.target.value) })} className="input input-sm ..."/></td>
                          <td className="px-4 py-2 text-right">{totalCost.toFixed(2)}</td>
                          <td><input type="number" value={item.marginPercent} onChange={(e) => handleItemChange(idx, { marginPercent: Number(e.target.value) })} className="input input-sm ..."/></td>
                          <td className="px-4 py-2 text-right">{unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{totalPrice.toFixed(2)}</td>
                          <td><input type="number" value={item.vatPercent} onChange={(e) => handleItemChange(idx, { vatPercent: Number(e.target.value) })} className="input input-sm ..."/></td>
                          <td className="px-2 py-2"><Button variant="danger" size="sm" onClick={() => removeRow(idx)}>Remove</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3">
                  <Button size="sm" onClick={addRow}>Add Item</Button>
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-semibold ...">Terms and Conditions</label>
                <textarea rows={5} value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} className="w-full rounded-xl ..."/>
              </div>
              <div className="flex flex-col sm:flex-row gap-6 mt-8 w-full">
                <div className="flex-1 p-4 rounded-xl border ...">
                  <label className="block mb-2 text-sm font-semibold ...">Discount</label>
                  <div className="flex items-center gap-3">
                    <select className="select select-bordered w-40" value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "PERCENT" | "AMOUNT")}>
                      <option value="PERCENT">Percent (%)</option>
                      <option value="AMOUNT">Amount</option>
                    </select>
                    <input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} className="input input-bordered ... flex-1"/>
                  </div>
                  {discountMode === "AMOUNT" && totals.subtotal > 0 && <p className="text-xs text-gray-500 mt-2">Approx: {((discountValue / totals.subtotal) * 100).toFixed(2)}%</p>}
                </div>
              </div>
              {totals && (
                <div className="mt-6 p-5 rounded-xl border ... space-y-2">
                  <p className="flex justify-between"><span>Subtotal:</span> {totals.subtotal?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-red-600"><span>Business Cost:</span> {totals.businessTotalCost?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between"><span>Discount:</span> {totals.discountAmount?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between"><span>VAT:</span> {totals.totalVat?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between font-semibold"><span>Grand Total:</span> {totals.grandTotal?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-green-700"><span>Gross Profit:</span> {totals.grossProfit?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-green-700"><span>Profit %:</span> {totals.profitPercent?.toFixed(2) ?? '0.00'}%</p>
                  {canViewSharePercent  && totals.sharedProfit > 0 && (
                    <p className="flex justify-between text-yellow-600"><span>Shared Profit:</span> {totals.sharedProfit.toFixed(2)}</p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6 border-t ... pt-4">
              {/* <Button type="button" variant="outline" onClick={handlePreview} disabled={previewLoading || downloading}>
                                    {previewLoading ? "Generating..." : "Preview"}
                                </Button>
                                <Button type="button" variant="outline" onClick={handleDownload} disabled={downloading || previewLoading}>
                                    {downloading ? "Downloading..." : "Download PDF"}
                                </Button> */}
                                <Button type="submit" disabled={saving || previewLoading || downloading}>
                                    {saving ? "Saving..." : "Save As New Quote"}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => navigate(selectedLeadId ? `/leads/${selectedLeadId}` : "/quote")} disabled={saving}>
                                    Cancel
                                </Button> </div>
            </form>
          </main>
        </div>
      </div>
    </>
  );
};

export default CloneQuote;
