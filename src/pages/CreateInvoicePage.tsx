// src/pages/CreateInvoicePage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

// --- Component & Service Imports ---
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import SelectContactModal from '../components/SelectContactModal';
import { useAuth } from '../contexts/AuthContext';
import { invoiceService, ManualInvoicePayload } from '../services/invoiceService';
import { quotesService } from '../services/quotesService';
import { contactsService, Contact, Company } from '../services/contactsService';
import { teamService, TeamUser } from '../services/teamService';
import { toast } from 'react-hot-toast';
import CustomSelect from '../components/CustomSelect';
const CreateInvoicePage: React.FC = () => {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
    const [members, setMembers] = useState<TeamUser[]>([]);

    // --- Form Fields for an INVOICE ---
    const [customerName, setCustomerName] = useState('');
    const [address, setAddress] = useState('');
    const [contactPersonId, setContactPersonId] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [salesmanId, setSalesmanId] = useState('');

    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [currency, setCurrency] = useState('USD');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [items, setItems] = useState([{ product: '', description: '', quantity: 1, itemRate: 0, taxPercent: 5 }]);
    const [quoteId, setQuoteId] = useState<string | undefined>(undefined);

    // --- Side Effects ---
    useEffect(() => {
        if (user?.type === 'ADMIN' && token) {
            teamService.list(token).then(res => {
                if (res.success) setMembers(res.users);
            }).catch(console.error);
        } else if (user) {
            setSalesmanId(user.id);
        }
    }, [user, token]);

    useEffect(() => {
        if (!selectedCompany || !token) return;
        contactsService.getContactsForCompany(token, selectedCompany.id)
            .then(res => {
                if (res.success) {
                    const sortedContacts = res.contacts.sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));
                    setCompanyContacts(sortedContacts);
                    if (sortedContacts.length > 0) {
                        handleContactPersonChange(sortedContacts[0].id, sortedContacts);
                    }
                }
            })
            .catch(err => toast.error(err.message || 'Failed to fetch contacts.'));
    }, [selectedCompany, token]);

    useEffect(() => {
        const id = location.state?.quoteId;
        if (!id || !token) return;

        setQuoteId(id);

        toast.promise(
            quotesService.getOne(id, token).then(res => {
                if (!res.success || !res.quote) throw new Error(res.message || 'Failed to load quote data.');
                const quote = res.quote;

                setSelectedCompany(quote.customer);
                setCustomerName(quote.customer.companyName);
                setAddress(quote.customer.address || '');
                setCurrency(quote.currency || 'USD');
                setPaymentTerms(quote.paymentTerms || '');
                setDiscountAmount(quote.discountAmount || 0);
                setNotes(quote.notes || '');
                setItems(quote.items.map(item => ({
                    product: item.product,
                    description: item.description,
                    quantity: item.quantity,
                    itemRate: item.itemRate,
                    taxPercent: item.taxPercent || 5,
                })));
            }), {
            loading: 'Loading data from quote...',
            success: 'Data loaded! Review and create the invoice.',
            error: (err) => err.message || 'Failed to load quote data.',
        }
        );
    }, [location.state, token]);

    // --- Event Handlers ---
    const handleCompanySelect = (company: Company) => {
        setCompanyContacts([]);
        setContactPersonId('');
        setEmail('');
        setPhone('');
        setAddress('');
        setSelectedCompany(company);
        setCustomerName(company.companyName);
        setIsModalOpen(false);
    };

    const handleContactPersonChange = (id: string, contacts: Contact[] = companyContacts) => {
        const contact = contacts.find(c => c.id === id);
        if (contact) {
            setContactPersonId(contact.id);
            setAddress(contact.address || '');
            setEmail(contact.email || '');
            setPhone(contact.phone || '');
        }
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { product: '', description: '', quantity: 1, itemRate: 0, taxPercent: 5 }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    // --- Calculations ---
    const { subtotal, vatAmount, grandTotal } = useMemo(() => {
        let calculatedSubtotal = 0;
        let calculatedVatAmount = 0;
        items.forEach(item => {
            const lineTotal = Number(item.quantity) * Number(item.itemRate);
            calculatedSubtotal += lineTotal;
            calculatedVatAmount += lineTotal * (Number(item.taxPercent) / 100);
        });
        const grand = calculatedSubtotal - Number(discountAmount) + calculatedVatAmount;
        return { subtotal: calculatedSubtotal, vatAmount: calculatedVatAmount, grandTotal: grand };
    }, [items, discountAmount]);

    // --- Form Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // --- Comprehensive Validation ---
        if (!token) {
            toast.error("Authentication error. Please log in again.");
            return;
        }
        if (!selectedCompany) {
            toast.error("A customer must be selected.");
            return;
        }
        if (!salesmanId) {
            toast.error("A salesman must be assigned.");
            return;
        }
        if (!contactPersonId) {
            toast.error("Please select a contact person.");
            return;
        }
        if (!dueDate) {
            toast.error("A due date is required.");
            return;
        }
        const today = new Date();
        const dDate = new Date(dueDate);
        today.setHours(0, 0, 0, 0);
        dDate.setHours(0, 0, 0, 0);
        if (dDate < today) {
            toast.error("The due date cannot be in the past.");
            return;
        }
        if (items.length === 0 || items.every(it => !it.product.trim())) {
            toast.error("The invoice must contain at least one valid item.");
            return;
        }
        for (const item of items) {
            if (!item.product.trim()) {
                toast.error("Every item must have a product name.");
                return;
            }
            if (Number(item.quantity) <= 0) {
                toast.error(`Quantity for "${item.product}" must be greater than zero.`);
                return;
            }
            if (Number(item.itemRate) <= 0) {
                toast.error(`Rate for "${item.product}" must be greater than zero.`);
                return;
            }
        }

        setSubmitting(true);

        try {
            const validCustomerType = selectedCompany.entityType === 'Vendor' ? 'Vendor' : 'Customer';

            const payload: { manualData: ManualInvoicePayload } = {
                manualData: {
                    customerId: selectedCompany.id,
                    customerName,
                    address,
                    customerType: validCustomerType,
                    invoiceDate,
                    dueDate,
                    salesmanId,
                    items: items.map((item) => ({
                        product: item.product,
                        description: item.description,
                        quantity: Number(item.quantity),
                        itemRate: Number(item.itemRate),
                        taxPercent: Number(item.taxPercent), // Ensure tax is included per item
                    })),
                    notes,
                    quoteId,
                    discountAmount: Number(discountAmount),
                    vatAmount,
                    currency,
                    paymentTerms,
                }
            };

            const response = await invoiceService.create(payload, token);

            if (!response.success) {
                const errorMsg = response.errors?.[0]?.msg || response.message || 'Failed to save invoice.';
                throw new Error(errorMsg);
            }

            toast.success('Invoice created successfully!');
            navigate('/invoices');

        } catch (err: any) {
            toast.error(err.message || 'An unknown error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    // --- JSX Return ---
    return (
        <div className="flex min-h-screen z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-7xl mx-auto py-8 px-8">
                    <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100 mb-6">
                        Create New Invoice
                    </h1>

                    <form onSubmit={handleSubmit} className="bg-white/30 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30 p-8 rounded-xl shadow-2xl space-y-8">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                            {/* Column 1: Bill To */}
                            <div>
                                <label className="block text-sm font-bold text-midnight-700 dark:text-ivory-200 mb-2">Bill To</label>
                                <div className="space-y-3">
                                    <input type="text" placeholder="Company Name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition" />
                                    <textarea placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition" />
                                    <Button type="button" className="bg-sky-500/80 backdrop-blur-md text-ivory-50 hover:bg-sky-600/90 shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 focus:ring-4 focus:ring-sky-300/50 dark:focus:ring-sky-700/60 rounded-xl" onClick={() => setIsModalOpen(true)}>{selectedCompany ? 'Change Company' : 'Select Company'}</Button>
                                </div>
                            </div>

                            {/* Column 2: Contact & Details */}
                            <div>
                                <label className="block text-sm font-bold text-midnight-700 dark:text-ivory-200 mb-2">Contact & Details</label>
                                <div className="space-y-4">
                                    <select value={contactPersonId} onChange={e => handleContactPersonChange(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm text-sm transition disabled:opacity-70" disabled={companyContacts.length === 0}>
                                        <option value="">-- Select Contact --</option>
                                        {companyContacts.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                    </select>
                                    <input type="email" placeholder="Contact Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm text-sm transition" />
                                    <input type="tel" placeholder="Contact Phone" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-12 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm text-sm transition" />
                                </div>
                            </div>

                            {/* Column 3: Invoice Settings */}
                            <div className='col-span-2'>
                                <label className="block text-sm font-bold text-midnight-700 dark:text-ivory-200 mb-2">Invoice Settings</label>

                                <div className="grid grid-cols-3 gap-4 py-2">
                                    <div className='items-center'>
                                        <label htmlFor="invoiceDate" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Invoice Date</label>
                                        <input id="invoiceDate" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition" />
                                    </div>
                                    <div className='items-center'>
                                        <label htmlFor="dueDate" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Due Date</label>
                                        <input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition" />
                                    </div>
                                    {user?.type === "ADMIN" ? (
                                        // <select value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm text-sm transition">
                                        //     <option value="">-- Assign Salesman --</option>
                                        //     {members.map((member) => (
                                        //         <option key={member.id} value={member.id} disabled={member.isBlocked} style={{ color: member.isBlocked ? '#999' : 'inherit' }}>
                                        //             {member.name} {member.isBlocked ? '(Blocked)' : ''}
                                        //         </option>
                                        //     ))}
                                        // </select>

                                        <CustomSelect
                                            label="Assign Salesman"
                                            options={members.map((member) => ({
                                                value: member.id,
                                                label: `${member.name}${member.isBlocked ? ' (Blocked)' : ''}`,
                                                isDisabled: member.isBlocked,
                                            }))}
                                            value={salesmanId}
                                            onChange={(value) => setSalesmanId(value)}
                                            placeholder="-- Assign Salesman --"
                                        />

                                    ) : (
                                        <div className="p-2 bg-white/40 dark:bg-midnight-800/50 rounded-2xl text-sm text-midnight-700 dark:text-ivory-200">
                                            Salesman: <span className="font-semibold">{user?.name || "..."}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-2">
                                    <div>
                                        <label
                                            htmlFor="currency"
                                            className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2"
                                        >
                                            Currency
                                        </label>
                                        <select
                                            id="currency"
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                                        >
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
                                        <label htmlFor="paymentTerms" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Payment Terms</label>
                                        <input id="paymentTerms" type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-cloud-500/30 rounded-lg shadow-sm">
                            <table className="min-w-full border-collapse rounded-xl overflow-hidden shadow-sm text-sm">
                                <thead className="bg-white/60 dark:bg-midnight-800/50 backdrop-blur-sm border border-cloud-500/20">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-midnight-700 dark:text-ivory-200 w-[20%]">Product / Service</th>
                                        <th className="px-4 py-3 text-left font-semibold text-midnight-700 dark:text-ivory-200 w-[30%]">Description</th>
                                        <th className="px-3 py-3 text-center font-semibold text-midnight-700 dark:text-ivory-200 w-[10%]">Qty</th>
                                        <th className="px-3 py-3 text-center font-semibold text-midnight-700 dark:text-ivory-200 w-[10%]">Rate</th>
                                        <th className="px-3 py-3 text-center font-semibold text-midnight-700 dark:text-ivory-200 w-[10%]">Tax %</th>
                                        <th className="px-4 py-3 text-right font-semibold text-midnight-700 dark:text-ivory-200 w-[15%]">Total (incl. Tax)</th>
                                        <th className="px-2 py-3 text-center w-[5%]"></th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-cloud-500/20 dark:divide-midnight-700/30 bg-white/30 dark:bg-midnight-900/30">
                                    {items.map((item, index) => (
                                        <tr key={index} className="hover:bg-cloud-100/30 dark:hover:bg-midnight-800/50 transition-colors">
                                            <td className="px-4 py-2 align-middle">
                                                <input
                                                    type="text"
                                                    value={item.product}
                                                    onChange={e => handleItemChange(index, 'product', e.target.value)}
                                                    className="w-full h-9 px-2 rounded-lg bg-white/60 dark:bg-midnight-800/60 border border-cloud-500/30 dark:border-midnight-700/40 shadow-sm focus:ring-2 focus:ring-sky-300/50 outline-none"
                                                />
                                            </td>

                                            <td className="px-4 py-2 align-middle">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                                                    className="w-full h-9 px-2 rounded-lg bg-white/60 dark:bg-midnight-800/60 border border-cloud-500/30 dark:border-midnight-700/40 shadow-sm focus:ring-2 focus:ring-sky-300/50 outline-none"
                                                />
                                            </td>

                                            <td className="px-3 py-2 text-center align-middle">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                                    className="w-16 h-9 text-center rounded-lg bg-white/60 dark:bg-midnight-800/60 border border-cloud-500/30 dark:border-midnight-700/40 shadow-sm focus:ring-2 focus:ring-sky-300/50 outline-none"
                                                />
                                            </td>

                                            <td className="px-3 py-2 text-center align-middle">
                                                <input
                                                    type="number"
                                                    value={item.itemRate}
                                                    onChange={e => handleItemChange(index, 'itemRate', parseFloat(e.target.value))}
                                                    className="w-20 h-9 text-center rounded-lg bg-white/60 dark:bg-midnight-800/60 border border-cloud-500/30 dark:border-midnight-700/40 shadow-sm focus:ring-2 focus:ring-sky-300/50 outline-none"
                                                />
                                            </td>

                                            <td className="px-3 py-2 text-center align-middle">
                                                <input
                                                    type="number"
                                                    value={item.taxPercent}
                                                    onChange={e => handleItemChange(index, 'taxPercent', parseFloat(e.target.value))}
                                                    className="w-16 h-9 text-center rounded-lg bg-white/60 dark:bg-midnight-800/60 border border-cloud-500/30 dark:border-midnight-700/40 shadow-sm focus:ring-2 focus:ring-sky-300/50 outline-none"
                                                />
                                            </td>

                                            <td className="px-3 py-2 text-right font-semibold text-midnight-700 dark:text-ivory-200 align-middle">
                                                <div className='border border-cloud-500/30 px-3 py-2 rounded-lg shadow-sm'>
                                                {(item.quantity * item.itemRate * (1 + item.taxPercent / 100)).toFixed(2)}
                                                </div>
                                            </td>

                                            <td className="px-2 py-2 text-center align-middle">
                                                <Button
                                                    type="button"
                                                    variant="icon"
                                                    onClick={() => removeItem(index)}
                                                    className="text-red-500 hover:text-red-700 transition"
                                                >
                                                    <X size={18} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                        </div>

                        <Button type="button" variant="secondary" onClick={addItem}>Add Item</Button>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/20 dark:border-midnight-700/30">
                            <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2">Notes / Terms</label>
                                <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-2xl border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm text-sm transition" />
                            </div>
                            <div className="space-y-3 text-midnight-700 dark:text-ivory-200">
                                <div className="flex justify-between items-center"><span>Subtotal:</span><span className="font-medium">{currency} {subtotal.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center">
                                    <label htmlFor="discountAmount">Discount:</label>
                                    <input id="discountAmount" type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} className="w-28 h-9 px-2 text-right rounded-lg border border-gray-300 dark:border-midnight-700/30 bg-white/40 dark:bg-midnight-800/50 text-sm text-midnight-800 dark:text-ivory-100" />
                                </div>
                                <div className="flex justify-between items-center"><span>Total Tax (VAT):</span><span className="font-medium">{currency} {vatAmount.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center pt-3 border-t border-white/20 dark:border-midnight-700/30"><span className="text-xl font-bold">Grand Total:</span><span className="text-xl font-bold">{currency} {grandTotal.toFixed(2)}</span></div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-6 border-t border-white/20 dark:border-midnight-700/30">
                            <Button type="button" variant="secondary" onClick={() => navigate('/invoices')} className="px-5 py-2 rounded-2xl bg-cloud-100/60 dark:bg-midnight-700/60 border border-cloud-300/40 dark:border-midnight-600/40 text-midnight-700 dark:text-ivory-200 hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 shadow-md transition">Cancel</Button>
                            <Button type="submit" disabled={submitting || !selectedCompany} className="px-5 py-2 rounded-2xl bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition disabled:opacity-50">
                                {submitting ? 'Saving...' : 'Create & Save Invoice'}
                            </Button>
                        </div>
                    </form>
                </main>
            </div>
            <SelectContactModal open={isModalOpen} onClose={() => setIsModalOpen(false)} onSelect={handleCompanySelect} />
        </div>
    );
};

export default CreateInvoicePage;
