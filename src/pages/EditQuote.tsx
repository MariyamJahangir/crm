import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';
import { quotesService } from '../services/quotesService';
import { customerService } from '../services/customerService';
import { toast } from 'react-hot-toast';
import { teamService, TeamUser } from '../services/teamService';
import PreviewModal from '../components/PreviewModal';

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

// --- Helper for formatting dates ---
const formatDateForInput = (dateString: string | Date): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().slice(0, 10);
  } catch (e) {
    return '';
  }
};

// CSS to hide number input spinners
const noSpinnersCSS = `
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type='number'] { -moz-appearance: textfield; }
`;

const EditQuote: React.FC = () => {
  const { id: quoteIdToEdit } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';

  // --- State Declarations ---
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [items, setItems] = useState<ItemState[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadNumber, setLeadNumber] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string; designation?: string; mobile?: string; email?: string }[]>([]);
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [contactPerson, setContactPerson] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [email, setEmail] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [validityUntil, setValidityUntil] = useState('');
  const [discountMode, setDiscountMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [leadIsShared, setLeadIsShared] = useState(false);
  const [sharePercent, setSharePercent] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // --- Data Fetching ---
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

  useEffect(() => {
    if (!quoteIdToEdit || !token) return;
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const { quote } = await quotesService.getOneById(quoteIdToEdit, token);
        console.log(quote);
        
        setSelectedLeadId(quote.leadId);
        setCustomerName(quote.customerName || '');
        setContactPerson(quote.contactPerson || '');
        setContactDesignation(quote.contactDesignation || '');
        setPhone(quote.phone || '');
        setEmail(quote.email || '');
        setAddress(quote.address || '');
        setDescription(quote.description || '');
        setTermsAndConditions(quote.termsAndConditions || '');
        setPaymentTerms(quote.paymentTerms || '');
        setCurrency(quote.currency || 'USD');
        setDiscountMode(quote.discountMode || 'PERCENT');
        setDiscountValue(Number(quote.discountValue) || 0);
        setQuoteDate(formatDateForInput(quote.quoteDate));
        setValidityUntil(formatDateForInput(quote.validityUntil));
        setSalesmanId(quote.salesmanId);
        setLeadIsShared(quote.isShared);
        if (quote.isShared && quote.shares?.length > 0) {
          setSharePercent(Number(quote.shares[0].profitPercentage) || 0);
        }
        if (quote.items?.length > 0) {
          setItems(quote.items.map((item: any, index: number) => ({
            slNo: index + 1, product: item.product, description: item.description,
            quantity: Number(item.quantity), unitCost: Number(item.unitCost),
            marginPercent: Number(item.marginPercent), vatPercent: Number(item.vatPercent),
          })));
        }

        const { lead } = await leadsService.getOne(quote.leadId, token);
        setLeadNumber(lead.uniqueNumber || '');

        if (lead.customer?.id) {
          const { contacts: customerContacts } = await customerService.getContacts(lead.customer.id, token);
          setContacts(customerContacts || []);
          const selectedContact = customerContacts?.find(c => c.name === quote.contactPerson);
          if (selectedContact) {
            setContactId(selectedContact.id);
          }
        }
      } catch (error) {
        toast.error("Failed to load quote data for editing.");
        navigate('/quote');
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [quoteIdToEdit, token, navigate]);

  // --- Calculations ---
  const totals = useMemo(() => {
    let subtotal = 0, businessTotalCost = 0, totalVat = 0;
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
    return { subtotal, businessTotalCost, totalVat, discountAmount, netAfterDiscount, grandTotal, grossProfit, profitPercent };
  }, [items, discountMode, discountValue]);

  // --- Helper Functions ---
  const addRow = () => setItems(prev => [...prev, { slNo: prev.length + 1, product: '', description: '', quantity: 1, unitCost: 0, marginPercent: 0, vatPercent: 5 }]);
  const removeRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx).map((it, idx2) => ({ ...it, slNo: idx2 + 1 })));
  const handleItemChange = (idx: number, patch: Partial<ItemState>) => setItems(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  const autofillContactFields = (contact: { id: string; name: string; designation?: string; mobile?: string; email?: string }) => {
    setContactId(contact.id);
    setContactPerson(contact.name);
    setContactDesignation(contact.designation || '');
    setPhone(contact.mobile || '');
    setEmail(contact.email || '');
  };

  const buildPreviewPayload = () => {
    return {
      quoteDate: quoteDate || new Date().toISOString(),
      validityUntil: validityUntil,
      salesmanId,
      customerName,
      contactPerson,
      contactDesignation,
      phone,
      email,
      address,
      description,
      currency,
      paymentTerms,
      termsAndConditions,
      discountMode,
      discountValue,
      sharePercent: leadIsShared ? sharePercent : 0,
      items: items.map(it => ({ ...it })),
      subtotal: totals.subtotal,
      grandTotal: totals.grandTotal,
      vatAmount: totals.totalVat,
      discountAmount: totals.discountAmount,
      grossProfit: totals.grossProfit,
    };
  };

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
  
  // --- Save Function ---
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteIdToEdit) { toast.error("Quote ID is missing."); return; }
    if (!customerName.trim()) { toast.error('Customer Name is required.'); return; }
    if (items.some(it => !it.product.trim() || it.quantity <= 0)) {
      toast.error('Each item must have a product name and quantity > 0.');
      return;
    }
    setSaving(true);
    const payload = buildPreviewPayload(); // Reuse the same payload logic

    try {
      await quotesService.update(quoteIdToEdit, payload, token!);
      toast.success("Quote updated successfully!");
      navigate(selectedLeadId ? `/leads/${selectedLeadId}` : '/quote');
    } catch (err: any) {
      const errorMessage = err?.data?.errors?.[0]?.msg || err?.data?.message || 'Failed to update quote.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading Quote...</p></div>;
  }
  
  return (
     <>
      <style>{noSpinnersCSS}</style>
      <PreviewModal isOpen={preview.open} onClose={() => setPreview({ open: false, html: undefined })} htmlContent={preview.html} />
      <div className="flex min-h-screen z-10">
        <Sidebar />
        <div className="flex-1 overflow-y-auto h-screen">
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
              <div >
                <h1 className="text-2xl font-extrabold text-midnight-900 dark:text-ivory-200">Edit Quote</h1>
                <p className="text-gray-600 dark:text-midnight-400">Modify the details of the existing quote.</p>
              </div>
            </div>


            <form onSubmit={save} className="space-y-6 bg-cloud-50/40 dark:bg-midnight-900/40 backdrop-blur-xl border border-cloud-300/40 dark:border-midnight-700/40 rounded-2xl p-8 shadow-xl">
              {/* Header section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Lead Number</label>
                  <input type="text" readOnly value={leadNumber} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 bg-white/70 text-midnight-900 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 cursor-not-allowed transition" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Quote Date</label>
                  <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Validity Until</label>
                  <input type="date" value={validityUntil} min={today} onChange={(e) => setValidityUntil(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Salesman</label>
                  {isAdmin ? (
                    <select value={salesmanId} className="w-full h-11 px-4 rounded-xl border" onChange={(e) => setSalesmanId(e.target.value)} required>
                      <option value="" disabled>Select salesman</option>
                      {salesmen.map((s) => (<option key={s.id} value={s.id} disabled={s.isBlocked}>{s.name}{s.isBlocked ? ' (Blocked)' : ''}</option>))}
                    </select>
                  ) : (
                    <input value={salesmen.find(s => s.id === salesmanId)?.name || ''} disabled className="w-full h-11 px-4 rounded-xl border bg-cloud-100/60 dark:bg-midnight-800/60" />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm" required>
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

                {leadIsShared && (
                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Share %</label>
                    <input type="number" min={0} max={100} value={sharePercent} onChange={(e) => setSharePercent(Number(e.target.value))} className="w-full h-11 px-4 rounded-xl border ..." />
                  </div>
                )}


              </div>

              {/* Customer and Contact Details */}
              <div className="border-t border-cloud-300/40 dark:border-midnight-700/40 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Customer Name</label>
                    <input type="text" className="w-full h-11 px-4 rounded-xl border ...r" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Contact Person</label>
                    <select className="w-full h-11 px-4 rounded-xl border ..." value={contactId ?? ""} onChange={(e) => { const c = contacts.find(c => c.id === e.target.value); if (c) autofillContactFields(c); }}>
                      <option value="" disabled>Select Contact</option>
                      {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
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





                </div>
              </div>

              <div >
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Description</label>
                <textarea rows={3} className="w-full px-4 py-3 rounded-xl border" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-cloud-400/30 rounded-xl shadow-sm">
                <table className="min-w-full border-collapse rounded-xl overflow-hidden shadow-sm text-sm">
                  <thead className='bg-white/60 dark:bg-midnight-800/50 backdrop-blur-sm border border-cloud-500/20'>
                    <tr className="text-[13px] font-semibold text-midnight-900 uppercase tracking-wide">
                      <th className="px-3 py-3 text-left w-[2%]">#</th>
                      <th className="px-3 py-3 text-left w-[16%]">Product</th>
                      <th className="px-3 py-3 text-left w-[20%]">Description</th>
                      <th className="px-3 py-3 text-right w-[8%]">Qty</th>
                      <th className="px-3 py-3 text-right w-[10%]">Unit Cost</th>
                      <th className="px-3 py-3 text-right w-[10%]">Total Cost</th>
                      <th className="px-3 py-3 text-right w-[8%]">Margin %</th>
                      <th className="px-3 py-3 text-right w-[10%]">Unit Price</th>
                      <th className="px-3 py-3 text-right w-[10%]">Total Price</th>
                      <th className="px-3 py-3 text-right w-[8%]">VAT %</th>
                      <th className="px-2 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const unitPrice = item.unitCost * (1 + item.marginPercent / 100);
                      const totalCost = item.unitCost * item.quantity;
                      const totalPrice = unitPrice * item.quantity;
                      return (
                        <tr key={idx} className="hover:bg-white/70 transition-all duration-150 text-[13px] text-midnight-800">
                          <td className="px-3 py-2 text-center font-medium">{item.slNo}</td>
                          <td className="px-3 py-2"><input value={item.product} onChange={(e) => handleItemChange(idx, { product: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-cloud-300/50 bg-white/70 focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 outline-none transition" /></td>
                          <td className="px-3 py-2"><input value={item.description} onChange={(e) => handleItemChange(idx, { description: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-cloud-300/50 bg-white/70 focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 outline-none transition" /></td>
                          <td className="px-3 py-2 text-right"><input type="number" min="0" value={item.quantity} onChange={(e) => handleItemChange(idx, { quantity: Number(e.target.value) })} className="w-full px-2 py-1.5 text-right rounded-lg border border-cloud-300/50 bg-white/70 focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 outline-none transition" /></td>
                          <td className="px-3 py-2 text-right"><input type="number" min="0" value={item.unitCost} onChange={(e) => handleItemChange(idx, { unitCost: Number(e.target.value) })} className="w-full px-2 py-1.5 text-right rounded-lg border border-cloud-300/50 bg-white/70 focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 outline-none transition" /></td>
                          <td className="px-4 py-2 text-right font-medium text-midnight-800 bg-white/60 rounded-md">{totalCost.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right"><input type="number" min="0" value={item.marginPercent} onChange={(e) => handleItemChange(idx, { marginPercent: Number(e.target.value) })} className="w-full px-2 py-1.5 text-right rounded-lg border border-cloud-300/50 bg-white/70 focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 outline-none transition" /></td>
                          <td className="px-3 py-2 text-right font-medium bg-white/60">{unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-bold bg-cloud-100/60">{totalPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right"><input type="number" min="0" value={item.vatPercent} onChange={(e) => handleItemChange(idx, { vatPercent: Number(e.target.value) })} className="w-full px-2 py-1.5 text-right rounded-lg border border-cloud-300/50 bg-white/70 focus:border-sky-400 focus:ring-1 focus:ring-sky-300/40 outline-none transition" /></td>
                          <td className="px-2 py-2 text-center"><Button variant="icon" size="sm" onClick={() => removeRow(idx)}>Remove</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>


              <div className="flex justify-between items-center mt-4 px-4 pb-4">
                <div className="pt-5">
                  <Button size="sm" className="rounded-lg bg-sky-500/80 text-white hover:bg-sky-600 shadow-md transition-all" onClick={addRow}>Add Item</Button>
                </div>

                {/* Discount Section */}

                <div className="space-y-2 w-[30%]">
                  <label className="block text-sm font-semibold text-midnight-800/90">Discount</label>
                  <div className="flex items-center gap-3  rounded-xl ">
                    <select className="w-1/2 h-10 rounded-lg px-2 
                            bg-white/70 border border-cloud-400/50 
                            text-sm text-midnight-700 
                            focus:ring-2 focus:ring-sky-300/40 focus:border-sky-400
                            outline-none transition-all" value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "PERCENT" | "AMOUNT")}>
                      <option value="PERCENT">Percent (%)</option><option value="AMOUNT">Amount</option>
                    </select>
                    <input type="number" min="0" className="flex-1 h-10 rounded-lg px-3
                          bg-white/70 border border-cloud-400/50 
                          text-sm text-midnight-700 
                          focus:ring-2 focus:ring-sky-300/40 focus:border-sky-400
                          outline-none transition-all" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                  </div>
                  {discountMode === "AMOUNT" && totals.subtotal > 0 && <p className="text-xs text-gray-500/80 italic">Approx: {((discountValue / totals.subtotal) * 100).toFixed(2)}%</p>}
                </div>


              </div>


              <div className="border-t border-cloud-300/40 dark:border-midnight-700/40 pt-6">
                <div className="grid grid-cols-2 gap-6">

                  {/* Payment Terms and T&C */}
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Payment Terms</label>
                      <textarea rows={4} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm p-3 resize-none" placeholder="e.g., 50% advance..." />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">Terms and Conditions</label>
                      <textarea rows={5} value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} className="w-full rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 bg-white/70 dark:bg-midnight-800/60 text-midnight-900 dark:text-ivory-100 shadow-sm p-3 resize-none" placeholder="Enter terms and conditions..." />
                    </div>
                  </div>



                  {/* Totals Summary */}
                  <div className="mt-5 p-6 rounded-2xl bg-cloud-100/50 dark:bg-midnight-800/50 
                        backdrop-blur-md border border-cloud-300/40 dark:border-midnight-600/40 
                        shadow-sm   
                        space-y-3">
                    <p className="flex justify-between"><span className="font-medium">Subtotal:</span> {totals.subtotal?.toFixed(2) ?? '0.00'}</p>
                    <p className="flex justify-between text-red-600"><span className="font-medium">Business Cost:</span> {totals.businessTotalCost?.toFixed(2) ?? '0.00'}</p>
                    <p className="flex justify-between"><span className="font-medium">Discount:</span> -{totals.discountAmount?.toFixed(2) ?? '0.00'}</p>
                    <p className="flex justify-between"><span className="font-medium">VAT:</span> {totals.totalVat?.toFixed(2) ?? '0.00'}</p>
                    <p className="flex justify-between text-base font-semibold text-sky-600"><span>Grand Total:</span> {totals.grandTotal?.toFixed(2) ?? '0.00'}</p>
                    <p className="flex justify-between text-green-700"><span className="font-medium">Gross Profit:</span> {totals.grossProfit?.toFixed(2) ?? '0.00'}</p>
                    <p className="flex justify-between text-green-700"><span className="font-medium">Profit %:</span> {totals.profitPercent?.toFixed(2) ?? '0.00'}%</p>
                  </div>


                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end flex-wrap gap-3 mt-6 border-t pt-4">
                {/* <Button type="button" variant="outline" onClick={handlePreview} disabled={previewLoading || downloading}>
                      {previewLoading ? "Generating..." : "Preview"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDownload} disabled={downloading || previewLoading}>
                      {downloading ? "Downloading..." : "Download PDF"}
                  </Button> */}
                <Button type="submit" disabled={saving || previewLoading || downloading}>
                  {saving ? "Saving Changes..." : "Save Changes"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate(selectedLeadId ? `/leads/${selectedLeadId}` : "/quotes")} disabled={saving}>
                  Cancel
                </Button>
              </div>
              
            </form>
          </main>
        </div>
      </div>
    </>
  );
};

export default EditQuote;
