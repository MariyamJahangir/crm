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
        setContactPerson(lead.contactPerson || '');
        setPhone(lead.mobile || '');
        setEmail(lead.email || '');

        if (lead.customerId) {
          const [contactsResp, custResp] = await Promise.all([
            customerService.getContacts(lead.customerId, token),
            customerService.getOne(lead.customerId, token),
          ]);
          setContacts(contactsResp.contacts || []);
          setAddress(custResp.customer.address || '');
          const preferredContact = contactsResp.contacts.find(c => c.name === lead.contactPerson);
          const contactToSet = preferredContact || contactsResp.contacts[0];
          if (contactToSet) {
            setContactId(contactToSet.id);
            setContactPerson(contactToSet.name);
            setPhone(contactToSet.mobile || '');
            setEmail(contactToSet.email || '');
          } else {
            setContactId(undefined);
          }
        } else {
          setContacts([]);
          setContactId(undefined);
          setAddress('');
        }
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load lead');
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
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold mb-6">Create Quote</h1>
          <form onSubmit={save} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
           
            {/* Lead Number and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lead Number</label>
                <input
                  type="text"
                  readOnly
                  value={leadNumber}
                  className="input input-bordered w-full cursor-pointer"
                  onClick={() => setOpenLeadModal(true)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quote Date</label>
                <input
                  type="date"
                  value={quoteDate}
                  className="input input-bordered w-full"
                  onChange={e => setQuoteDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Validity Until</label>
                <input
                  type="date"
                  value={validityUntil}
                  className="input input-bordered w-full"
                  onChange={e => setValidityUntil(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Salesman</label>
                <select
                  value={salesmanId}
                  className="select select-bordered w-full"
                  onChange={e => setSalesmanId(e.target.value)}
                >
                  {salesmen.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Customer and Contact */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <select
                    className="select select-bordered w-full"
                    value={contactId ?? ''}
                    onChange={e => onSelectContact(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Contact
                    </option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    className="input input-bordered w-full"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="table table-compact w-full mt-4">
                <thead>
                  <tr>
                    <th>Sl</th>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Rate</th>
                    <th>Discount Mode</th>
                    <th>Discount</th>
                    <th>Line Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const qty = Number(item.quantity);
                    const rate = Number(item.itemRate);
                    const gross = qty * rate;
                    const discountAmount =
                      item.lineDiscountMode === 'AMOUNT'
                        ? Number(item.lineDiscountAmount) || 0
                        : gross * ((Number(item.lineDiscountPercent) || 0) / 100);
                    const lineTotal = Math.max(0, gross - discountAmount);
                    return (
                      <tr key={idx}>
                        <td>{item.slNo}</td>
                        <td>
                          <input
                            className="input input-bordered w-full"
                            value={item.product}
                            onChange={e => updateItem(idx, { product: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input input-bordered w-full"
                            value={item.description}
                            onChange={e => updateItem(idx, { description: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="input input-bordered w-full"
                            value={item.unit}
                            onChange={e => updateItem(idx, { unit: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className="input input-bordered w-full"
                            value={item.quantity}
                            onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input input-bordered w-full"
                            value={item.itemCost}
                            onChange={e => updateItem(idx, { itemCost: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input input-bordered w-full"
                            value={item.itemRate}
                            onChange={e => updateItem(idx, { itemRate: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <select
                            className="select select-bordered w-full"
                            value={item.lineDiscountMode}
                            onChange={e => updateItem(idx, { lineDiscountMode: e.target.value as 'PERCENT' | 'AMOUNT' })}
                          >
                            <option value="PERCENT">Percent</option>
                            <option value="AMOUNT">Amount</option>
                          </select>
                        </td>
                        <td>
                          {item.lineDiscountMode === 'AMOUNT' ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="input input-bordered w-full"
                              value={item.lineDiscountAmount}
                              onChange={e => updateItem(idx, { lineDiscountAmount: Number(e.target.value) })}
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              max="100"
                              className="input input-bordered w-full"
                              value={item.lineDiscountPercent}
                              onChange={e => updateItem(idx, { lineDiscountPercent: Number(e.target.value) })}
                            />
                          )}
                        </td>
                        <td>{lineTotal.toFixed(2)}</td>
                        <td>
                          <Button variant="danger" size="sm" onClick={() => removeRow(idx)}>
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Button size="sm" onClick={addRow} className="mt-2">
                Add Item
              </Button>
            </div>

            {/* Discount and VAT */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div>
                <label className="block mb-1 font-medium">Discount</label>
                <div className="flex space-x-2">
                  <select
                    className="select select-bordered"
                    value={discountMode}
                    onChange={e => syncDiscountMode(e.target.value as 'PERCENT' | 'AMOUNT', discountValue)}
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="AMOUNT">Amount</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input input-bordered w-full"
                    value={discountValue}
                    onChange={e => setDiscountValue(Number(e.target.value))}
                  />
                </div>
                {discountMode === 'AMOUNT' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Approximate: {(discountValue / totals.subtotal) * 100 || 0}%
                  </p>
                )}
              </div>
              <div>
                <label className="block mb-1 font-medium">VAT (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={vatPercent}
                  onChange={e => setVatPercent(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="mt-4 p-4 border rounded bg-gray-50 space-y-1 text-sm">
              <p>Subtotal: {totals.subtotal.toFixed(2)}</p>
              <p>Total Cost: {totals.cost.toFixed(2)}</p>
              <p>Discount: {totals.overallDiscount.toFixed(2)}</p>
              <p>VAT: {totals.vatAmt.toFixed(2)}</p>
              <p>Grand Total: {totals.grandTotal.toFixed(2)}</p>
              <p>Gross Profit: {totals.grossProfit.toFixed(2)}</p>
              <p>Profit %: {totals.profitPercent.toFixed(2)}</p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 border-t pt-4">
              <Button type="submit" disabled={saving || !!lastSavedQuote}>
                {saving ? 'Saving...' : 'Save Quote'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!lastSavedQuote || (!lastSavedQuote.isApproved && !isAdmin)}
                onClick={downloadPdf}
                title={!lastSavedQuote ? 'Save the quote first' : (!lastSavedQuote.isApproved && !isAdmin ? 'Waiting for admin approval' : 'Download as PDF')}
              >
                Download PDF
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate(selectedLeadId ? `/leads/${selectedLeadId}` : '/leads')} disabled={saving}>
                Cancel
              </Button>
            </div>

            {error && <p className="text-red-600 mt-2 text-center">{error}</p>}
            {lastSavedQuote && (
                <div className="mt-4 p-4 border rounded bg-green-50 text-green-800 text-center">
                    Quote #{lastSavedQuote.number} saved successfully. 
                    {lastSavedQuote.isApproved === false && ' It is now pending admin approval.'}
                </div>
            )}
          </form>
          <SelectLeadModal
            open={openLeadModal}
            onClose={() => setOpenLeadModal(false)}
            onSelect={lead => {
              setSelectedLeadId(lead.id);
              setLeadNumber(lead.uniqueNumber || '');
              setOpenLeadModal(false);
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default CreateQuote;