import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import SelectLeadModal from '../components/SelectLeadModal';
import { useAuth } from '../contexts/AuthContext';
import { leadsService, Lead } from '../services/leadsService';
import { quotesService } from '../services/quotesService';
import { teamService, TeamUser } from '../services/teamService';
import { customerService } from '../services/customerService';
import PreviewModal from '../components/PreviewModal';
import { toast } from 'react-hot-toast';


// --- Type Definitions ---
type ItemState = {
  slNo: number;
  product: string;
  description: string;
  quantity: number;
  unitCost: number;      // Wholesale purchase price
  marginPercent: number;  // Margin to add on top
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
  unitPrice: number;      // Calculated: cost plus margin
  totalCost: number;      // Cost * quantity
  totalPrice: number;     // Unit price * quantity
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


const CreateQuote: React.FC = () => {
  const { id: routeLeadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';


  // --- All State Declarations ---
  const [items, setItems] = useState<ItemState[]>([
    { slNo: 1, product: '', description: '', quantity: 1, unitCost: 0, marginPercent: 0, vatPercent: 5 },
  ]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(routeLeadId || null);
  const [leadNumber, setLeadNumber] = useState('');
  const [lead, setLead] = useState<Lead | null>(null);
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [salesmanId, setSalesmanId] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string; designation?: string; mobile?: string; email?: string }[]>([]);
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [contactPerson, setContactPerson] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [paymentTerms, setPaymentTerms] = useState(''); 
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
  const [openLeadModal, setOpenLeadModal] = useState(false);
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


  const resetAllFields = () => {
    setLead(null);
    setContacts([]);
    clearContactFields();
    setAddress('');
    setCustomerName('');
    setCustomerId(null);
    if (isAdmin) setSalesmanId('');
    setLeadNumber('');
    setSelectedLeadId(routeLeadId || null);
    setLeadIsShared(false);
    setSharePercent(0);
    setDescription('');
    setQuoteDate(today);
    setValidityUntil('');
    setDiscountMode('PERCENT');
    setDiscountValue(0);
    setItems([{ slNo: 1, product: '', description: '', quantity: 1, unitCost: 0, marginPercent: 0, vatPercent: 5 }]);
    setLastSavedQuote(null);
    setSaving(false);
  };


  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) { toast.error('Please select a lead.'); return; }
    if (!customerName.trim()) { toast.error('Customer Name is required.'); return; }
    if (items.some(it => !it.product.trim() || it.quantity <= 0)) {
      toast.error('Each item must have a product name and quantity > 0.');
      return;
    }
    if (!validityUntil) { toast.error('Please select a "Validity Until" date.'); return; }


    setSaving(true);


    const preparedItems: QuoteItem[] = items.map(it => {
      const unitPrice = it.unitCost * (1 + it.marginPercent / 100);
      return {
        ...it,
        unitPrice,
        totalCost: it.unitCost * it.quantity,
        totalPrice: unitPrice * it.quantity,
      };
    });


    const requiresApproval = preparedItems.some(item => item.marginPercent < 8);


    const payload = {
      quoteDate: quoteDate ? new Date(quoteDate).toISOString() : undefined,
      validityUntil: validityUntil ? new Date(validityUntil).toISOString() : undefined,
      salesmanId,
      customerId,
      customerName,
      contactPerson,
      contactDesignation,
      phone,
      paymentTerms,
      email,
      currency,
      address,
      description,
      termsAndConditions,
      discountMode,
      discountValue,
      vatPercent: items[0]?.vatPercent ?? 5,
      sharePercent: leadIsShared ? sharePercent : 0,
      items: preparedItems,
      status: requiresApproval ? 'PendingApproval' : 'Draft',
      isApproved: !requiresApproval,
    };


    try {
      const res = await quotesService.create(selectedLeadId, payload, token!);
      toast.success("Quote saved successfully");
      setLastSavedQuote({ id: res.quoteId, number: res.quoteNumber, isApproved: !requiresApproval });
    } catch (err: any) {
      const errorMessage = err?.data?.errors?.[0]?.msg || err?.data?.message || 'Failed to save quote.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };


  const showPreview = async () => {
    if (!lastSavedQuote || !token || !selectedLeadId) return;
    setPreviewLoading(true);
    setPreview({ open: true, html: '<div>Loading preview...</div>' });
    try {
      const res = await quotesService.previewHtml(selectedLeadId, lastSavedQuote.id, token);
      if (res.success) setPreview({ open: true, html: res.html });
      else throw new Error('Failed to load preview content.');
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to load preview.';
      setPreview({ open: true, html: `<div style="color:red;padding:20px;">${errorMessage}</div>` });
    } finally {
      setPreviewLoading(false);
    }
  };


  const downloadPdf = async () => {
    if (!token || !selectedLeadId || !lastSavedQuote) return;
    if (!isAdmin && lastSavedQuote.isApproved === false) {
      toast.error('This quote requires admin approval before it can be downloaded.');
      return;
    }
    try {
      const blob = await quotesService.downloadPdf(selectedLeadId, lastSavedQuote.id, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lastSavedQuote.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 3000);
    } catch (e: any) {
      toast.error(e?.data?.message || 'Failed to download PDF');
    }
  };


  // --- Data Loading Effects ---
  useEffect(() => {
    if (routeLeadId) setSelectedLeadId(routeLeadId);
  }, [routeLeadId]);


  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { users } = await teamService.list(token);
        setSalesmen(users);
        if (!isAdmin && user) {
          const me = users.find(u => String(u.id) === String(user.id));
          setSalesmanId(me?.id || '');
        }
      } catch { toast.error('Failed to load team data.'); }
    })();
  }, [token, user, isAdmin]);


  // --- FINAL CORRECTED useEffect ---
  useEffect(() => {
    if (!token || !selectedLeadId) {
      resetAllFields();
      return;
    }

    (async () => {
      try {
        const { lead: fetchedLead } = await leadsService.getOne(selectedLeadId, token);
        
        setLead(fetchedLead); 
        
        setLeadNumber(fetchedLead.uniqueNumber || '');
        setCustomerId(fetchedLead.customer?.id || null);
        if (isAdmin && fetchedLead.salesmanId) setSalesmanId(fetchedLead.salesmanId);
        
        const isShared = Array.isArray(fetchedLead.sharedWith) && fetchedLead.sharedWith.length > 0;
        setLeadIsShared(isShared);

        if (isShared) {
          // Find the specific share details for the current user
          const currentUserShare = fetchedLead.sharedWith.find(share => 
              String(share.ShareGp?.memberId) === String(user?.id) ||
              String(share.ShareGp?.sharedMemberId) === String(user?.id)
          );
          // Set the percentage from that specific share, defaulting to 0
          setSharePercent(Number(currentUserShare?.ShareGp?.profitPercentage) || 0);
        } else {
          setSharePercent(0);
        }

        if (fetchedLead.customer?.id) {
          const [contactsResp, custResp] = await Promise.all([
            customerService.getContacts(fetchedLead.customer.id, token),
            customerService.getOne(fetchedLead.customer.id, token),
          ]);

          setCustomerName(custResp.customer.companyName || '');
          setContacts(contactsResp.contacts || []);
          setAddress(custResp.customer.address || '');

          const preferredContact = contactsResp.contacts?.find(c => c.name === fetchedLead.contactPerson) || contactsResp.contacts?.[0];
          if (preferredContact) {
            autofillContactFields(preferredContact);
          } else {
            clearContactFields();
          }
        } else {
          setCustomerName(fetchedLead.companyName || '');
          if (fetchedLead.contactPerson) {
            const standaloneContact = { id: fetchedLead.id, name: fetchedLead.contactPerson, mobile: fetchedLead.mobile || '', email: fetchedLead.email || '', designation: fetchedLead.designation || '' };
            setContacts([standaloneContact]);
            setAddress(fetchedLead.city || '');
            autofillContactFields(standaloneContact);
          } else {
            setContacts([]);
            clearContactFields();
            setAddress(fetchedLead.city || '');
          }
        }
      } catch (error: any) {
        toast.error(error?.data?.message || 'Failed to load lead details.');
        resetAllFields();
      }
    })();
  }, [token, selectedLeadId, isAdmin, user]); // user is added to dependency array


  // --- FINAL CORRECTED useMemo ---
  const canViewSharePercent = useMemo(() => {
    if (!lead || !leadIsShared || !Array.isArray(lead.sharedWith)) {
      return false;
    }
  
    if (isAdmin) {
      return true;
    }
  
    // Check if the current user is either the original owner (memberId) or the person it's shared with (sharedMemberId)
    return lead.sharedWith.some(share => 
      String(share.ShareGp?.memberId) === String(user?.id) ||
      String(share.ShareGp?.sharedMemberId) === String(user?.id)
    );
  }, [lead, leadIsShared, isAdmin, user]);


  return (
    <>
      <style>{noSpinnersCSS}</style>
      <div className="flex min-h-screen z-10">
        <Sidebar />
        <div className="flex-1 overflow-y-auto h-screen">
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-midnight-900 dark:text-ivory-200">Create Quote</h1>
                <p className="text-gray-600 dark:text-midnight-400">Generate a new quote for a customer.</p>
              </div>
            </div>

            <form onSubmit={save} className="space-y-6 bg-cloud-50/40 dark:bg-midnight-900/40 backdrop-blur-xl border border-cloud-300/40 dark:border-midnight-700/40 rounded-2xl p-8 shadow-xl">
              {/* Top Row: Lead, Dates, Salesman */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Lead Number</label>
                  <input type="text" readOnly value={leadNumber} onClick={() => setOpenLeadModal(true)} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 cursor-pointer transition"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Quote Date</label>
                  <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm"/>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Validity Until</label>
                  <input type="date" value={validityUntil} min={today} onChange={(e) => setValidityUntil(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm"/>
                </div>
                <div>
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Salesman</label>
                {isAdmin ? (
                  <select value={salesmanId} className="w-full h-11 px-4 rounded-xl border ..." onChange={(e) => setSalesmanId(e.target.value)} required>
                    <option value="" disabled>Select salesman</option>
                    {salesmen.map((s) => (<option key={s.id} value={s.id} disabled={s.isBlocked}>{s.name}{s.isBlocked ? ' (Blocked)' : ''}</option>))}
                  </select>
                ) : (
                  <input value={user?.name || ''} disabled className="w-full h-11 px-4 rounded-xl border bg-cloud-100/60 dark:bg-midnight-800/60"/>
                )}
                </div>
              </div>

              {/* Customer and Contact Details */}
              <div className="border-t border-cloud-300/40 dark:border-midnight-700/40 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Customer Name</label>
                    <input type="text" className="w-full h-11 px-4 rounded-xl border ..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Contact Person</label>
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
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Phone</label>
                    <input type="text" className="w-full h-11 px-4 rounded-xl border ..." value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Email</label>
                    <input type="email" className="w-full h-11 px-4 rounded-xl border ..." value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Contact Designation</label>
                    <input type="text" className="w-full h-11 px-4 rounded-xl border ..." value={contactDesignation} onChange={(e) => setContactDesignation(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Address</label>
                    <input type="text" className="w-full h-11 px-4 rounded-xl border ..." value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  
                  {/* Currency Dropdown */}
                  <div className="mt-6 sm:w-40">
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Currency</label>
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
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                      Payment Terms
                    </label>
                    <textarea
                      rows={5}
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm p-3 resize-none"
                      placeholder="e.g., 50% advance, 50% on delivery..."
                    />
                  </div>
                  {/* Share Percentage Input (Conditional) */}
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

                  {/* Description Textarea */}
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Description</label>
                    <textarea rows={3} className="w-full px-4 py-3 rounded-xl border ..." value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto mt-6">
                <table className="w-full border border-cloud-300/40 dark:border-midnight-700/40 bg-white/80 dark:bg-midnight-800/60 shadow-md rounded-xl">
                  <thead>
                    <tr className="text-sm font-semibold text-midnight-900 dark:text-ivory-200 bg-cloud-100/60 dark:bg-midnight-700/40">
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
                  <tbody className="divide-y divide-cloud-300/30 dark:divide-midnight-700/30">
                    {items.map((item, idx) => {
                      const unitPrice = item.unitCost * (1 + item.marginPercent / 100);
                      const totalCost = item.unitCost * item.quantity;
                      const totalPrice = unitPrice * item.quantity;

                      return (
                        <tr key={idx} className="text-sm text-midnight-800 dark:text-ivory-200 hover:bg-cloud-50/60 dark:hover:bg-midnight-700/40 transition-colors">
                          <td className="px-4 py-2">{item.slNo}</td>
                          <td><input value={item.product} onChange={(e) => handleItemChange(idx, { product: e.target.value })} className="input input-sm input-bordered w-full" /></td>
                          <td><input value={item.description} onChange={(e) => handleItemChange(idx, { description: e.target.value })} className="input input-sm input-bordered w-full" /></td>
                          <td><input type="number" min="0" value={item.quantity} onChange={(e) => handleItemChange(idx, { quantity: Number(e.target.value) })} className="input input-sm input-bordered w-full text-right" /></td>
                          <td><input type="number" min="0" value={item.unitCost} onChange={(e) => handleItemChange(idx, { unitCost: Number(e.target.value) })} className="input input-sm input-bordered w-full text-right" /></td>
                          <td className="px-4 py-2 text-right bg-cloud-50/40 dark:bg-midnight-800/30">{totalCost.toFixed(2)}</td>
                          <td><input type="number" min="0" value={item.marginPercent} onChange={(e) => handleItemChange(idx, { marginPercent: Number(e.target.value) })} className="input input-sm input-bordered w-full text-right" /></td>
                          <td className="px-4 py-2 text-right font-medium bg-cloud-50/60 dark:bg-midnight-700/20">{unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-bold bg-cloud-100/60 dark:bg-midnight-700/40">{totalPrice.toFixed(2)}</td>
                          <td><input type="number" min="0" value={item.vatPercent} onChange={(e) => handleItemChange(idx, { vatPercent: Number(e.target.value) })} className="input input-sm input-bordered w-full text-right" /></td>
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

              {/* Terms and Conditions */}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Terms and Conditions</label>
                <textarea rows={5} value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} className="w-full rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm p-3 resize-none" placeholder="Enter terms and conditions..."/>
              </div>

              {/* Discount Section */}
              <div className="flex flex-col sm:flex-row gap-6 mt-8 w-full">
                <div className="flex-1 p-4 rounded-xl border ...">
                  <label className="block mb-2 text-sm font-semibold ...">Discount</label>
                  <div className="flex items-center gap-3">
                    <select className="select select-bordered w-40" value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "PERCENT" | "AMOUNT")}>
                      <option value="PERCENT">Percent (%)</option>
                      <option value="AMOUNT">Amount</option>
                    </select>
                    <input type="number" min="0" className="input input-bordered ... flex-1" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))}/>
                  </div>
                  {discountMode === "AMOUNT" && totals.subtotal > 0 && <p className="text-xs text-gray-500 mt-2">Approximate: {((discountValue / totals.subtotal) * 100).toFixed(2)}%</p>}
                </div>
              </div>
              
              {/* Totals Summary */}
              {totals && (
                <div className="mt-6 p-5 rounded-xl border ... space-y-2">
                  <p className="flex justify-between"><span className="font-medium">Subtotal:</span> {totals.subtotal?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-red-600"><span className="font-medium">Business Cost:</span> {totals.businessTotalCost?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between"><span className="font-medium">Discount:</span> {totals.discountAmount?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between"><span className="font-medium">VAT:</span> {totals.totalVat?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-base font-semibold text-sky-600 dark:text-sky-400"><span>Grand Total:</span> {totals.grandTotal?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-green-700 dark:text-green-400"><span className="font-medium">Gross Profit:</span> {totals.grossProfit?.toFixed(2) ?? '0.00'}</p>
                  <p className="flex justify-between text-green-700 dark:text-green-400"><span className="font-medium">Profit %:</span> {totals.profitPercent != null ? totals.profitPercent.toFixed(2) : '0.00'}%</p>
                  {leadIsShared && totals.sharedProfit != null && totals.sharedProfit > 0 && (
                    <p className="flex justify-between text-yellow-600 dark:text-yellow-400"><span className="font-medium">Shared Profit:</span> {totals.sharedProfit.toFixed(2)}</p>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-6 border-t ... pt-4">
                <Button type="submit" disabled={saving || !!lastSavedQuote}>{saving ? "Saving..." : "Save Quote"}</Button>
                {lastSavedQuote && (
                  <>
                    <Button type="button" variant="secondary" disabled={previewLoading} onClick={showPreview}>{previewLoading ? "Loading..." : "Preview"}</Button>
                    <Button type="button" variant="secondary" disabled={!isAdmin && lastSavedQuote.isApproved === false} onClick={downloadPdf} title={!isAdmin && lastSavedQuote.isApproved === false ? "Waiting for admin approval" : "Download PDF"}>Download PDF</Button>
                  </>
                )}
                <Button type="button" variant="secondary" onClick={() => navigate(selectedLeadId ? `/leads/${selectedLeadId}` : "/leads")} disabled={saving}>Cancel</Button>
              </div>

              {/* Last Saved Quote Info */}
              {lastSavedQuote && ( <div className="mt-4 p-4 ... text-center">
                Quote #{lastSavedQuote.number} saved successfully.
                {lastSavedQuote.isApproved === false && " It is now pending admin approval."}
              </div> )}
            </form>

            <SelectLeadModal open={openLeadModal} onClose={() => setOpenLeadModal(false)} onSelect={(lead) => { setSelectedLeadId(lead.id); setLeadNumber(lead.uniqueNumber || ""); setOpenLeadModal(false); }} />
            <PreviewModal open={preview.open} onClose={() => setPreview({ open: false, html: undefined })} html={preview.html} title="Quote Preview" />
          </main>
        </div>
      </div>
    </>
  );
};


export default CreateQuote;
