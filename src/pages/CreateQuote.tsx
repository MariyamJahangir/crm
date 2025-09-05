// pages/CreateQuote.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { leadsService } from '../services/leadsService';
import { quotesService, QuoteItem as QItem } from '../services/quotesService';
import { teamService, TeamUser } from '../services/teamService';
import { customerService } from '../services/customerService';
import SelectLeadModal from '../components/SelectLeadModal';

const CreateQuote: React.FC = () => {
  const { id: routeLeadId } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Lead selection and details
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(routeLeadId || null);
  const [leadInfo, setLeadInfo] = useState<any>(null);
  const [leadNumber, setLeadNumber] = useState<string>('');
  const [openLeadModal, setOpenLeadModal] = useState<boolean>(false);
const [preview, setPreview] = useState<{ open: boolean; html?: string }>({ open: false });

  // Team / salesman
  const [salesmen, setSalesmen] = useState<TeamUser[]>([]);
  const [salesmanId, setSalesmanId] = useState<string>('');

  // Customer + contact snapshot
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [contacts, setContacts] = useState<{ id: string; name: string; mobile?: string; email?: string }[]>([]);
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Quote meta
  const [quoteDate, setQuoteDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [validityUntil, setValidityUntil] = useState<string>('');

  // Overall discount (compact toggle)
  const [discountMode, setDiscountMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [vatPercent, setVatPercent] = useState<number>(0);

  // Items with compact discount UI (percent/amount per line)
  const [items, setItems] = useState<(QItem & { lineDiscountMode?: 'PERCENT' | 'AMOUNT' })[]>([
    { slNo: 1, product: '', description: '', unit: '', quantity: 1, itemCost: 0, itemRate: 0, lineDiscountPercent: 0, lineDiscountAmount: 0, lineDiscountMode: 'PERCENT' },
  ]);

  // Save / errors / PDF
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedQuote, setLastSavedQuote] = useState<{ id: string; number: string } | null>(null);

  // Optional VAT default via URL
  useEffect(() => {
    const vat = searchParams.get('vat');
    if (vat) {
      const v = Number(vat);
      if (!Number.isNaN(v) && v >= 0) setVatPercent(v);
    }
  }, [searchParams]);

  // Load team for salesman dropdown
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const team = await teamService.list(token);
        setSalesmen(team.users);
        const me = team.users.find((u) => String(u.id) === String(user?.id));
        setSalesmanId(me?.id || team.users[0]?.id || '');
      } catch {
        // ignore
      }
    })();
  }, [token, user?.id]);

  // If navigated with a lead id (route), initialize selection
  useEffect(() => {
    if (routeLeadId) setSelectedLeadId(routeLeadId);
  }, [routeLeadId]);

  // Load selected lead details, address, and contacts
  useEffect(() => {
    if (!token || !selectedLeadId) return;
    (async () => {
      setError(null);
      try {
        const leadRes = await leadsService.getOne(selectedLeadId, token);
        setLeadInfo(leadRes.lead);
        setLeadNumber(leadRes.lead.uniqueNumber || '');

        // Pre-fill snapshot from lead
        setCustomerId(leadRes.lead.customerId || null);
        setCustomerName(leadRes.lead.division || '');
        setContactPerson(leadRes.lead.contactPerson || '');
        setPhone(leadRes.lead.mobile || '');
        setEmail(leadRes.lead.email || '');

        // Address via customer
        setAddress('');
        if (leadRes.lead.customerId) {
          try {
            const cust = await customerService.getOne(leadRes.lead.customerId, token);
            setAddress(cust.customer.address || '');
          } catch {
            // ignore
          }
        }

        // Contacts for dropdown
        if (leadRes.lead.customerId) {
          try {
            const resp = await customerService.getContacts(leadRes.lead.customerId, token);
            const list = resp.contacts || [];
            setContacts(list);
            if (list.length > 0) {
              const match = list.find((c) => (c.name || '') === (leadRes.lead.contactPerson || ''));
              const first = match || list[0];
              setContactId(first.id);
              setContactPerson(first.name || '');
              setPhone(first.mobile || '');
              setEmail(first.email || '');
            } else {
              setContactId(undefined);
            }
          } catch {
            setContacts([]);
            setContactId(undefined);
          }
        } else {
          setContacts([]);
          setContactId(undefined);
        }
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load lead');
      }
    })();
  }, [token, selectedLeadId]);

  // Totals preview with dual-mode discounts
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalCost = 0;
    items.forEach((it) => {
      const qty = Number(it.quantity || 0);
      const rate = Number(it.itemRate || 0);
      const cost = Number(it.itemCost || 0);
      const grossBefore = qty * rate;

      // Respect per-line discount mode
      let ldAmt = 0;
      if (it.lineDiscountMode === 'AMOUNT') {
        ldAmt = Number(it.lineDiscountAmount || 0);
      } else {
        ldAmt = (grossBefore * Number(it.lineDiscountPercent || 0)) / 100;
      }
      ldAmt = Math.min(ldAmt, grossBefore);

      const lineGross = Math.max(0, grossBefore - ldAmt);
      const lineCostTotal = qty * cost;
      subtotal += lineGross;
      totalCost += lineCostTotal;
    });

    // Overall discount
    const overallDiscAmt = discountMode === 'PERCENT' ? (subtotal * discountValue) / 100 : Math.min(discountValue, subtotal);
    const netAfterDiscount = subtotal - overallDiscAmt;
    const vatAmount = (netAfterDiscount * vatPercent) / 100;
    const grandTotal = netAfterDiscount + vatAmount;
    const grossProfit = netAfterDiscount - totalCost;
    const profitPercent = netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0;
    return { subtotal, totalCost, overallDiscAmt, netAfterDiscount, vatAmount, grandTotal, grossProfit, profitPercent };
  }, [items, discountMode, discountValue, vatPercent]);

  // Item helpers
  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { slNo: prev.length + 1, product: '', description: '', unit: '', quantity: 1, itemCost: 0, itemRate: 0, lineDiscountPercent: 0, lineDiscountAmount: 0, lineDiscountMode: 'PERCENT' },
    ]);
  };
  const removeRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i2) => ({ ...it, slNo: i2 + 1 })));
  };
  const updateItem = (idx: number, patch: Partial<QItem & { lineDiscountMode?: 'PERCENT' | 'AMOUNT' }>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  // Overall discount mode
  const syncDiscountMode = (mode: 'PERCENT' | 'AMOUNT', value: number) => {
    setDiscountMode(mode);
    setDiscountValue(Number(value) || 0);
  };

  // Contact select
  const onSelectContact = (val: string) => {
    const v = val || '';
    setContactId(v || undefined);
    const found = contacts.find((c) => c.id === v);
    if (found) {
      setContactPerson(found.name || '');
      setPhone(found.mobile || '');
      setEmail(found.email || '');
    }
  };

  // Save
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !token) {
      setError('Please select a lead before saving the quote.');
      return;
    }
    if (!customerName.trim()) {
      setError('Party / Company is required.');
      return;
    }
    if (!items.length || items.some((it) => !it.product.trim() || Number(it.quantity) <= 0)) {
      setError('Each item must have product name and quantity > 0.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const out = await quotesService.create(
        selectedLeadId,
        {
          quoteDate: quoteDate ? new Date(quoteDate).toISOString() : undefined,
          validityUntil: validityUntil ? new Date(validityUntil).toISOString() : undefined,
          salesmanId,
          customerId,
          customerName,
          contactPerson: contactPerson || undefined,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          description: description || undefined,
          discountMode,
          discountValue,
          vatPercent,
          items: items.map((it) => {
            const qty = Number(it.quantity || 0);
            const rate = Number(it.itemRate || 0);
            const grossBefore = qty * rate;
            // Convert UI mode to server fields
            const lineDiscountPercent =
              it.lineDiscountMode === 'PERCENT'
                ? Number(it.lineDiscountPercent || 0) || undefined
                : grossBefore > 0
                ? Math.min(100, ((Number(it.lineDiscountAmount || 0) / grossBefore) * 100)) || undefined
                : undefined;
            const lineDiscountAmount = it.lineDiscountMode === 'AMOUNT' ? Number(it.lineDiscountAmount || 0) || undefined : undefined;

            return {
              slNo: it.slNo,
              product: it.product,
              description: it.description || undefined,
              unit: it.unit || undefined,
              quantity: qty,
              itemCost: Number(it.itemCost || 0),
              itemRate: Number(it.itemRate || 0),
              lineDiscountPercent,
              lineDiscountAmount,
            };
          }),
        },
        token
      );
      setLastSavedQuote({ id: out.quoteId, number: out.quoteNumber });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  // PDF download
  const downloadPdf = async () => {
    if (!token || !selectedLeadId || !lastSavedQuote) return;
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
    } catch {
      setError('Failed to download PDF');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">New Quote</h1>
              <p className="text-gray-600">{leadInfo ? <>Lead #{leadInfo.uniqueNumber} • {leadInfo.division}</> : 'Select a lead to prefill details'}</p>
            </div>
            <div className="flex gap-2">
              {lastSavedQuote && (
  <>
    <Button type="button" variant="secondary" onClick={async () => {
      if (!selectedLeadId) return;
      const html = await quotesService.previewHtml(selectedLeadId, lastSavedQuote.id, token);
      setPreview({ open: true, html });
    }}>
      Preview
    </Button>
    <Button type="button" onClick={downloadPdf}>Download PDF</Button>
  </>
)}

            </div>
          </div>

          <form onSubmit={save} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

            {/* Lead and quote meta */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lead #</label>
                <input
                  value={leadNumber}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100 cursor-pointer"
                  placeholder="Click to select lead"
                  onClick={() => setOpenLeadModal(true)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quote Date</label>
                <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Validity Until</label>
                <input type="date" value={validityUntil} onChange={(e) => setValidityUntil(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Salesman</label>
                <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} className="w-full border rounded px-3 py-2 bg-white">
                  {salesmen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Party + contact */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Party / Company</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Select Contact</label>
                  <select
                    value={contactId || ''}
                    onChange={(e) => onSelectContact(e.target.value)}
                    className="w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {contacts.length === 0 && <option value="">No contacts</option>}
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.mobile ? `(${c.mobile})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">Change contact here or override details below.</div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" />
                </div>
              </div>
            </div>

            {/* Items with minimal discount UI (line-level) */}
            <div>
              <div className="flex items-end justify-between mb-2">
                <div className="text-sm font-medium">Items</div>
                <Button type="button" onClick={addRow}>
                  + Add Item
                </Button>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[1150px] grid grid-cols-12 gap-2 text-sm font-medium bg-gray-50 border-b px-2 py-2">
                  <div>Sl</div>
                  <div className="col-span-2">Product</div>
                  <div className="col-span-2">Description</div>
                  <div>Unit</div>
                  <div>Qty</div>
                  <div>Cost</div>
                  <div>Rate</div>
                  <div>Disc</div>
                  <div>Value</div>
                  <div>Line Total</div>
                  <div></div>
                </div>
                {items.map((it, idx) => {
                  const qty = Number(it.quantity || 0);
                  const grossBefore = qty * Number(it.itemRate || 0);
                  const discAmt =
                    (it.lineDiscountMode || 'PERCENT') === 'AMOUNT'
                      ? Number(it.lineDiscountAmount || 0)
                      : (grossBefore * Number(it.lineDiscountPercent || 0)) / 100;
                  const lineTotal = Math.max(0, grossBefore - Math.min(discAmt, grossBefore));
                  return (
                    <div key={idx} className="min-w-[1150px] grid grid-cols-12 gap-2 items-center border-b px-2 py-2 text-sm">
                      <div>{it.slNo}</div>
                      <div className="col-span-2">
                        <input className="w-full border rounded px-2 py-1" value={it.product} onChange={(e) => updateItem(idx, { product: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <input className="w-full border rounded px-2 py-1" value={it.description || ''} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                      </div>
                      <div>
                        <input className="w-full border rounded px-2 py-1" value={it.unit || ''} onChange={(e) => updateItem(idx, { unit: e.target.value })} />
                      </div>
                      <div>
                        <input type="number" step="0.001" className="w-full border rounded px-2 py-1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                      </div>
                      <div>
                        <input type="number" step="0.01" className="w-full border rounded px-2 py-1" value={it.itemCost} onChange={(e) => updateItem(idx, { itemCost: Number(e.target.value) })} />
                      </div>
                      <div>
                        <input type="number" step="0.01" className="w-full border rounded px-2 py-1" value={it.itemRate} onChange={(e) => updateItem(idx, { itemRate: Number(e.target.value) })} />
                      </div>
                      {/* Minimal discount: mode + single value field */}
                      <div>
                        <select
                          className="w-full border rounded px-2 py-1 bg-white"
                          value={it.lineDiscountMode || 'PERCENT'}
                          onChange={(e) => {
                            const mode = e.target.value as 'PERCENT' | 'AMOUNT';
                            // Reset opposite field for clarity
                            updateItem(idx, {
                              lineDiscountMode: mode,
                              lineDiscountPercent: mode === 'PERCENT' ? (it.lineDiscountPercent || 0) : 0,
                              lineDiscountAmount: mode === 'AMOUNT' ? (it.lineDiscountAmount || 0) : 0,
                            });
                          }}
                        >
                          <option value="PERCENT">%</option>
                          <option value="AMOUNT">Amt</option>
                        </select>
                      </div>
                      <div>
                        {((it.lineDiscountMode || 'PERCENT') === 'AMOUNT') ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-full border rounded px-2 py-1"
                            value={it.lineDiscountAmount || 0}
                            onChange={(e) => updateItem(idx, { lineDiscountAmount: Number(e.target.value), lineDiscountPercent: 0 })}
                            placeholder="Amount"
                          />
                        ) : (
                          <input
                            type="number"
                            step="0.001"
                            className="w-full border rounded px-2 py-1"
                            value={it.lineDiscountPercent || 0}
                            onChange={(e) => updateItem(idx, { lineDiscountPercent: Number(e.target.value), lineDiscountAmount: 0 })}
                            placeholder="%"
                          />
                        )}
                      </div>
                      <div className="font-medium">{lineTotal.toFixed(2)}</div>
                      <div>
                        <Button type="button" variant="danger" onClick={() => removeRow(idx)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Minimal overall discount */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Discount</label>
                <div className="flex gap-2">
                  <select value={discountMode} onChange={(e) => syncDiscountMode(e.target.value as any, discountValue)} className="border rounded px-2 py-2 bg-white">
                    <option value="PERCENT">%</option>
                    <option value="AMOUNT">Amt</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    className="w-full border rounded px-3 py-2"
                    placeholder={discountMode === 'PERCENT' ? '%' : 'Amount'}
                  />
                </div>
                {discountMode === 'AMOUNT' && (
                  <div className="text-xs text-gray-500 mt-1">≈ {(totals.subtotal ? (discountValue / totals.subtotal) * 100 : 0).toFixed(2)}%</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">VAT %</label>
                <input type="number" step="0.01" value={vatPercent} onChange={(e) => setVatPercent(Number(e.target.value) || 0)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>

            {/* Summary */}
            <div className="border rounded p-4 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div><span className="text-gray-600">Subtotal:</span> {totals.subtotal.toFixed(2)}</div>
                <div><span className="text-gray-600">Total Cost:</span> {totals.totalCost.toFixed(2)}</div>
                <div>
                  <span className="text-gray-600">Discount:</span> {totals.overallDiscAmt.toFixed(2)} {discountMode === 'PERCENT' ? `(${discountValue.toFixed(2)}%)` : ''}
                </div>
                <div><span className="text-gray-600">VAT:</span> {totals.vatAmount.toFixed(2)} ({vatPercent.toFixed(2)}%)</div>
                <div><span className="text-gray-600">GP:</span> {totals.grossProfit.toFixed(2)}</div>
                <div><span className="text-gray-600">Profit %:</span> {totals.profitPercent.toFixed(2)}%</div>
                <div className="sm:col-span-3 text-lg font-semibold text-gray-900">Grand Total: {totals.grandTotal.toFixed(2)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => navigate(selectedLeadId ? `/leads/${selectedLeadId}` : '/leads')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Quote'}</Button>
            </div>
          </form>
        </main>
      </div>

      {/* Select Lead Modal opens by clicking Lead # field */}
      <SelectLeadModal
        open={openLeadModal}
        onClose={() => setOpenLeadModal(false)}
        onSelect={async (leadRow) => {
          try {
            if (!leadRow?.id) return;
            setSelectedLeadId(leadRow.id);
            setLeadNumber(leadRow.uniqueNumber || '');

            // Snapshot
            setCustomerId(leadRow.customerId || null);
            setCustomerName(leadRow.companyName || '');
            setContactPerson(leadRow.contactPerson || '');
            setPhone(leadRow.mobile || '');
            setEmail(leadRow.email || '');

            // Contacts + address
            if (leadRow.customerId && token) {
              try {
                const [contactsRes, custRes] = await Promise.all([
                  customerService.getContacts(leadRow.customerId, token),
                  customerService.getOne(leadRow.customerId, token),
                ]);
                const list = contactsRes.contacts || [];
                setContacts(list);
                setAddress(custRes.customer.address || '');
                if (list.length > 0) {
                  const prefer = list.find((c) => (c.name || '') === (leadRow.contactPerson || ''));
                  const first = prefer || list[0];
                  setContactId(first.id);
                  setContactPerson(first.name || '');
                  setPhone(first.mobile || '');
                  setEmail(first.email || '');
                } else {
                  setContactId(undefined);
                }
              } catch {
                setContacts([]);
                setContactId(undefined);
                setAddress('');
              }
            } else {
              setContacts([]);
              setContactId(undefined);
              setAddress('');
            }

            // Header display (optional refresh)
            if (token) {
              try {
                const lr = await leadsService.getOne(leadRow.id, token);
                setLeadInfo(lr.lead);
              } catch {
                setLeadInfo({ uniqueNumber: leadRow.uniqueNumber, division: leadRow.companyName });
              }
            }
          } catch {
            // swallow selection errors
          } finally {
            setOpenLeadModal(false);
          }
        }}
      />
      {preview.open && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw]">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <div className="font-semibold">Quote Preview</div>
        <button onClick={() => setPreview({ open: false })} className="text-gray-500 hover:text-gray-700" aria-label="Close">×</button>
      </div>
      <div className="p-0 flex justify-center">
        <iframe title="Quote Preview" style={{ width: 794, height: 1123, border: 'none', background: '#fff' }} srcDoc={preview.html || ''} />
      </div>
      <div className="px-4 py-2 border-t flex justify-end">
        <Button variant="secondary" onClick={() => setPreview({ open: false })}>Close</Button>
      </div>
    </div>
  </div>
)}

    </div>
  );
  
};

export default CreateQuote;
