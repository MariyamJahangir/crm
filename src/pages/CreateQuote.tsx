import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import SelectLeadModal from '../components/SelectLeadModal';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';
import { quotesService, QuoteItem as QItem } from '../services/quotesService';
import { teamService, TeamUser } from '../services/teamService';
import { customerService } from '../services/customerService';
import PreviewModal from '../components/PreviewModal';
type SavedQuote = {
  id: string;
  number: string;
  isApproved?: boolean;
};

const CreateQuote: React.FC = () => {
  const { id: routeLeadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.type === 'ADMIN';
  const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(routeLeadId || null);
  const [leadNumber, setLeadNumber] = useState('');
  const [openLeadModal, setOpenLeadModal] = useState(false);
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [salesmanId, setSalesmanId] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string; mobile?: string; email?: string }[]>([]);
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validityUntil, setValidityUntil] = useState('');
  const [discountMode, setDiscountMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState(0);
  const [vatPercent, setVatPercent] = useState(0);
  const [items, setItems] = useState<(QItem & { lineDiscountMode?: 'PERCENT' | 'AMOUNT' })[]>([
    {
      slNo: 1, product: '', description: '', unit: '', quantity: 1, itemCost: 0,
      itemRate: 0, lineDiscountPercent: 0, lineDiscountAmount: 0, lineDiscountMode: 'PERCENT',
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedQuote, setLastSavedQuote] = useState<SavedQuote | null>(null);

  const totals = useMemo(() => {
    let subtotal = 0;
    let cost = 0;
    for (const item of items) {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.itemRate || 0);
      const c = Number(item.itemCost || 0);
      const gross = qty * rate;
      let ldAmt = 0;
      if (item.lineDiscountMode === 'AMOUNT') {
        ldAmt = Number(item.lineDiscountAmount || 0);
      } else {
        ldAmt = gross * (Number(item.lineDiscountPercent || 0) / 100);
      }
      ldAmt = Math.min(ldAmt, gross);
      subtotal += gross - ldAmt;
      cost += qty * c;
    }
    const overallDiscount = discountMode === 'PERCENT' ? (subtotal * discountValue) / 100 : Math.min(discountValue, subtotal);
    const net = subtotal - overallDiscount;
    const vatAmt = net > 0 ? net * (vatPercent / 100) : 0;
    const grandTotal = net + vatAmt;
    const grossProfit = net - cost;
    const profitPercent = net > 0 ? (grossProfit / net) * 100 : 0;
    return { subtotal, cost, overallDiscount, net, vatAmt, grandTotal, grossProfit, profitPercent };
  }, [items, discountMode, discountValue, vatPercent]);

  const addRow = () => {
    setItems(prev => [
      ...prev,
      {
        slNo: prev.length + 1, product: '', description: '', unit: '', quantity: 1, itemCost: 0,
        itemRate: 0, lineDiscountPercent: 0, lineDiscountAmount: 0, lineDiscountMode: 'PERCENT',
      },
    ]);
  };

  const showPreview = async () => {
    if (!lastSavedQuote || !token || !selectedLeadId) return;
    setPreviewLoading(true);
    setPreview({ open: true, html: '<div>Loading preview...</div>' });
    try {
      const res = await quotesService.previewHtml(selectedLeadId, lastSavedQuote.id, token);
      if (res.success) {
        setPreview({ open: true, html: res.html });
      } else {
        throw new Error('Failed to load preview content.');
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to load preview.';
      setPreview({ open: true, html: `<div style="color:red;padding:20px;">${errorMessage}</div>` });
    } finally {
      setPreviewLoading(false);
    }
  };

  const removeRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, idx2) => ({ ...it, slNo: idx2 + 1 })));
  };

  const updateItem = (idx: number, patch: Partial<QItem & { lineDiscountMode?: 'PERCENT' | 'AMOUNT' }>) => {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const team = await teamService.list(token);
        setSalesmen(team.users);
        const me = team.users.find(u => String(u.id) === String(user?.id));
        setSalesmanId(me?.id || team.users[0]?.id || '');
      } catch { setError('Failed to load team data.'); }
    })();
  }, [token, user]);

  useEffect(() => {
    if (routeLeadId) setSelectedLeadId(routeLeadId);
  }, [routeLeadId]);

  const onSelectContact = (selectedContactId: string) => {
    const contact = contacts.find(c => c.id === selectedContactId);
    if (contact) {
      setContactId(contact.id);
      setContactPerson(contact.name);
      setPhone(contact.mobile || '');
      setEmail(contact.email || '');
    }
  };
  useEffect(() => {
    if (!token || !selectedLeadId) return;
    (async () => {
      setError(null);
      try {
        const leadRes = await leadsService.getOne(selectedLeadId, token);
        const { lead } = leadRes;
        setLeadNumber(lead.uniqueNumber || '');
        setCustomerId(lead.customerId || null);
        setCustomerName(lead.division || '');

        if (lead.customerId) {
          const [contactsResp, custResp] = await Promise.all([
            customerService.getContacts(lead.customerId, token),
            customerService.getOne(lead.customerId, token),
          ]);
          setContacts(contactsResp.contacts || []);
          setAddress(custResp.customer.address || '');
          const preferredContact = contactsResp.contacts.find(c => c.name === lead.contactPerson) || contactsResp.contacts[0];
          if (preferredContact) {
            onSelectContact(preferredContact.id);
          } else {
            setContactId(undefined);
            setContactPerson('');
            setPhone('');
            setEmail('');
          }
        } else {
          setContacts([]);
          setContactId(undefined);
          setAddress('');
        }
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load lead details');
      }
    })();
  }, [token, selectedLeadId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedLeadId) {
      setError('Please select a lead before saving the quote.');
      return;
    }
    if (!customerName.trim()) {
      setError('Customer Name is required.');
      return;
    }
    if (items.some(it => !it.product.trim() || it.quantity <= 0)) {
      setError('Each item must have a product name and quantity greater than 0.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        quoteDate: quoteDate ? new Date(quoteDate).toISOString() : undefined,
        validityUntil: validityUntil ? new Date(validityUntil).toISOString() : undefined,
        salesmanId, customerId, customerName, contactPerson: contactPerson || undefined,
        phone: phone || undefined, email: email || undefined, address: address || undefined,
        description: description || undefined, discountMode, discountValue, vatPercent,
        items: items.map(it => ({
          slNo: it.slNo, product: it.product, description: it.description || undefined,
          unit: it.unit || undefined, quantity: Number(it.quantity || 0),
          itemCost: Number(it.itemCost || 0), itemRate: Number(it.itemRate || 0),
          lineDiscountPercent: it.lineDiscountMode === 'PERCENT' ? Number(it.lineDiscountPercent || 0) || undefined : undefined,
          lineDiscountAmount: it.lineDiscountMode === 'AMOUNT' ? Number(it.lineDiscountAmount || 0) || undefined : undefined,
        })),
      };
      const res = await quotesService.create(selectedLeadId, payload, token!);
      setLastSavedQuote({ id: res.quoteId, number: res.quoteNumber, isApproved: res.isApproved });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (!token || !selectedLeadId || !lastSavedQuote) return;
    // Approval check before attempting download
    if (!isAdmin && lastSavedQuote.isApproved === false) {
      setError('This quote requires admin approval before it can be downloaded.');
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
      setError(e?.data?.message || 'Failed to download PDF');
    }
  };

  return (
    <div className="flex min-h-screen bg-midnight-800/50 z-10 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 overflow-y-auto h-screen">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-midnight-900 dark:text-ivory-200">
                Create Quote
              </h1>
              <p className="text-gray-600 dark:text-midnight-400">
                Generate a new quote for a customer.
              </p>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={save}
            className="space-y-6 bg-cloud-50/40 dark:bg-midnight-900/40 
             backdrop-blur-xl border border-cloud-300/40 
             dark:border-midnight-700/40 rounded-2xl p-8 shadow-xl"
          >
            {/* Lead Number and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                  Lead Number
                </label>
                <input
                  type="text"
                  readOnly
                  value={leadNumber}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                   bg-white/70 dark:bg-midnight-800/60 
                   text-midnight-900 dark:text-ivory-100 
                   shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 cursor-pointer transition"
                  onClick={() => setOpenLeadModal(true)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                  Quote Date
                </label>
                <input
                  type="date"
                  value={quoteDate}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                   bg-white/70 dark:bg-midnight-800/60 
                   text-midnight-900 dark:text-ivory-100 
                   shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                  Validity Until
                </label>
                <input
                  type="date"
                  value={validityUntil}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                   bg-white/70 dark:bg-midnight-800/60 
                   text-midnight-900 dark:text-ivory-100 
                   shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                  onChange={(e) => setValidityUntil(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                  Salesman
                </label>
                <select
                  value={salesmanId}
                  className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                   bg-white/70 dark:bg-midnight-800/60 
                   text-midnight-900 dark:text-ivory-100 
                   shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                  onChange={(e) => setSalesmanId(e.target.value)}
                >
                  {salesmen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Customer and Contact */}
            <div className="border-t border-cloud-300/40 dark:border-midnight-700/40 pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                     bg-white/70 dark:bg-midnight-800/60 
                     text-midnight-900 dark:text-ivory-100 
                     shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                    Contact Person
                  </label>
                  <select
                    className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                     bg-white/70 dark:bg-midnight-800/60 
                     text-midnight-900 dark:text-ivory-100 
                     shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                    value={contactId ?? ""}
                    onChange={(e) => onSelectContact(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Contact
                    </option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                    Phone
                  </label>
                  <input
                    type="text"
                    className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                     bg-white/70 dark:bg-midnight-800/60 
                     text-midnight-900 dark:text-ivory-100 
                     shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                     bg-white/70 dark:bg-midnight-800/60 
                     text-midnight-900 dark:text-ivory-100 
                     shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    className="w-full h-11 px-4 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                     bg-white/70 dark:bg-midnight-800/60 
                     text-midnight-900 dark:text-ivory-100 
                     shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-cloud-300/50 dark:border-midnight-600/50 
                     bg-white/70 dark:bg-midnight-800/60 
                     text-midnight-900 dark:text-ivory-100 
                     shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-300/50 transition"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto mt-6">
              <table
                className="w-full border border-cloud-300/40 dark:border-midnight-700/40 
               bg-white/80 dark:bg-midnight-800/60 shadow-md rounded-xl"
              >
                <thead>
                  <tr className="text-sm font-semibold text-midnight-900 dark:text-ivory-200 bg-cloud-100/60 dark:bg-midnight-700/40">
                    <th className="px-4 py-2 text-left">Sl</th>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-left">Unit</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-left">Discount Mode</th>
                    <th className="px-4 py-2 text-right">Discount</th>
                    <th className="px-4 py-2 text-right">Line Total</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cloud-300/30 dark:divide-midnight-700/30">
                  {items.map((item, idx) => {
                    const qty = Number(item.quantity);
                    const rate = Number(item.itemRate);
                    const gross = qty * rate;
                    const discountAmount =
                      item.lineDiscountMode === "AMOUNT"
                        ? Number(item.lineDiscountAmount) || 0
                        : gross * ((Number(item.lineDiscountPercent) || 0) / 100);
                    const lineTotal = Math.max(0, gross - discountAmount);

                    return (
                      <tr
                        key={idx}
                        className="text-sm text-midnight-800 dark:text-ivory-200 hover:bg-cloud-50/60 dark:hover:bg-midnight-700/40 transition-colors"
                      >
                        <td className="px-4 py-2">{item.slNo}</td>
                        <td className="px-4 py-2">
                          <input
                            className="input input-sm input-bordered w-full"
                            value={item.product}
                            onChange={(e) => updateItem(idx, { product: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="input input-sm input-bordered w-full"
                            value={item.description}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="input input-sm input-bordered w-full"
                            value={item.unit}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className="input input-sm input-bordered w-full text-right"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, { quantity: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input input-sm input-bordered w-full text-right"
                            value={item.itemCost}
                            onChange={(e) =>
                              updateItem(idx, { itemCost: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input input-sm input-bordered w-full text-right"
                            value={item.itemRate}
                            onChange={(e) =>
                              updateItem(idx, { itemRate: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="select select-sm select-bordered w-full"
                            value={item.lineDiscountMode}
                            onChange={(e) =>
                              updateItem(idx, {
                                lineDiscountMode: e.target.value as "PERCENT" | "AMOUNT",
                              })
                            }
                          >
                            <option value="PERCENT">Percent</option>
                            <option value="AMOUNT">Amount</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {item.lineDiscountMode === "AMOUNT" ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input input-sm input-bordered w-full text-right"
                              value={item.lineDiscountAmount}
                              onChange={(e) =>
                                updateItem(idx, {
                                  lineDiscountAmount: Number(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max="100"
                              className="input input-sm input-bordered w-full text-right"
                              value={item.lineDiscountPercent}
                              onChange={(e) =>
                                updateItem(idx, {
                                  lineDiscountPercent: Number(e.target.value),
                                })
                              }
                            />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {lineTotal.toFixed(2)}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeRow(idx)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-3">
                <Button size="sm" onClick={addRow}>
                  Add Item
                </Button>
              </div>
            </div>


            {/* Discount and VAT */}
            <div className="flex flex-col sm:flex-row gap-6 mt-8 w-full">
              {/* Discount Section */}
              <div className="flex-1 p-4 rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 bg-white/70 dark:bg-midnight-800/60 shadow-sm">
                <label className="block mb-2 text-sm font-semibold text-midnight-700 dark:text-ivory-300">
                  Discount
                </label>
                <div className="flex items-center gap-3">
                  <select
                    className="select select-bordered w-40"
                    value={discountMode}
                    onChange={(e) =>
                      syncDiscountMode(e.target.value as "PERCENT" | "AMOUNT", discountValue)
                    }
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="AMOUNT">Amount</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input input-bordered flex-1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                </div>
                {discountMode === "AMOUNT" && (
                  <p className="text-xs text-gray-500 mt-2">
                    Approximate: {(discountValue / totals.subtotal) * 100 || 0}%
                  </p>
                )}
              </div>

              {/* VAT Section */}
              <div className="flex-1 p-4 rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 bg-white/70 dark:bg-midnight-800/60 shadow-sm">
                <label className="block mb-2 text-sm font-semibold text-midnight-700 dark:text-ivory-300">
                  VAT (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(Number(e.target.value))}
                />
              </div>
            </div>


{/* Totals */}
<div className="mt-6 p-5 rounded-xl border border-cloud-300/40 dark:border-midnight-700/40 
                bg-white/70 dark:bg-midnight-800/60 backdrop-blur-sm shadow-sm 
                text-sm text-midnight-800 dark:text-ivory-200 space-y-2">
  <p className="flex justify-between">
    <span className="font-medium">Subtotal:</span> {totals.subtotal.toFixed(2)}
  </p>
  <p className="flex justify-between">
    <span className="font-medium">Total Cost:</span> {totals.cost.toFixed(2)}
  </p>
  <p className="flex justify-between">
    <span className="font-medium">Discount:</span> {totals.overallDiscount.toFixed(2)}
  </p>
  <p className="flex justify-between">
    <span className="font-medium">VAT:</span> {totals.vatAmt.toFixed(2)}
  </p>
  <p className="flex justify-between text-base font-semibold text-sky-600 dark:text-sky-400">
    <span>Grand Total:</span> {totals.grandTotal.toFixed(2)}
  </p>
  <p className="flex justify-between">
    <span className="font-medium">Gross Profit:</span> {totals.grossProfit.toFixed(2)}
  </p>
  <p className="flex justify-between">
    <span className="font-medium">Profit %:</span> {totals.profitPercent.toFixed(2)}
  </p>
</div>


            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 border-t border-cloud-300/30 dark:border-midnight-700/30 pt-4">
              <Button type="submit" disabled={saving || !!lastSavedQuote}>
                {saving ? "Saving..." : "Save Quote"}
              </Button>
              {lastSavedQuote && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={previewLoading}
                    onClick={showPreview}
                  >
                    {previewLoading ? "Loading Preview..." : "Preview"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!lastSavedQuote.isApproved && !isAdmin}
                    onClick={downloadPdf}
                    title={
                      !lastSavedQuote.isApproved && !isAdmin
                        ? "Waiting for admin approval"
                        : "Download as PDF"
                    }
                  >
                    Download PDF
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigate(selectedLeadId ? `/leads/${selectedLeadId}` : "/leads")
                }
                disabled={saving}
              >
                Cancel
              </Button>
            </div>

            {/* Error / Success */}
            {error && <p className="text-red-600 mt-2 text-center">{error}</p>}
            {lastSavedQuote && (
              <div className="mt-4 p-4 border rounded-lg bg-green-50 dark:bg-green-900/40 
                            text-green-800 dark:text-green-200 text-center">
                Quote #{lastSavedQuote.number} saved successfully.
                {lastSavedQuote.isApproved === false &&
                  " It is now pending admin approval."}
              </div>
            )}
          </form>

          {/* Modals */}
          <SelectLeadModal
            open={openLeadModal}
            onClose={() => setOpenLeadModal(false)}
            onSelect={(lead) => {
              setSelectedLeadId(lead.id);
              setLeadNumber(lead.uniqueNumber || "");
              setOpenLeadModal(false);
            }}
          />
          <PreviewModal
            open={preview.open}
            onClose={() => setPreview({ open: false, html: undefined })}
            html={preview.html}
            title="Quote Preview"
          />
        </main>
      </div>
    </div>
  );


};

export default CreateQuote;