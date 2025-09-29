
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

// --- Component & Service Imports ---
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import SelectContactModal from '../components/SelectContactModal';
import { useAuth } from '../contexts/AuthContext';
import { invoiceService, ManualInvoicePayload } from '../services/invoiceService';
import { contactsService, Contact, Company } from '../services/contactsService';
import { teamService, TeamUser } from '../services/teamService'; // CORRECTED to use teamService
import { toast } from 'react-hot-toast';
// --- Main Create Invoice Page Component ---
const CreateInvoicePage: React.FC = () => {
    // --- Hooks and State ---
    const { token, user } = useAuth(); // Use the authenticated user object
    const navigate = useNavigate();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
    const [members, setMembers] = useState<TeamUser[]>([]);
    
    // Form Fields
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
    const [items, setItems] = useState([{ product: '', description: '', quantity: 1, itemRate: 0 }]);

    // --- Side Effects ---
    // Fetch team members if the user is an ADMIN
    useEffect(() => {
        if (user?.type === 'ADMIN' && token) {
            teamService.list(token).then(res => {
                // The API returns the list under the 'users' key
                if (res.success) setMembers(res.users);
            }).catch(console.error);
        } else if (user) {
            setSalesmanId(user.id); // Auto-assign if not admin
        }
    }, [user, token]);

    // Fetch contacts when a company is selected
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

    const addItem = () => setItems([...items, { product: '', description: '', quantity: 1, itemRate: 0 }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const { subtotal, totalTax, grandTotal } = useMemo(() => {
        const calculatedSubtotal = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.itemRate)), 0);
        const tax = calculatedSubtotal * 0.05;
        const grand = calculatedSubtotal - Number(discountAmount) + tax;
        return { subtotal: calculatedSubtotal, totalTax: tax, grandTotal: grand };
    }, [items, discountAmount]);

    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
         // 1. Company and Salesman Validation
    if (!token) {
        toast.error("Authentication error. Please log in again.");
        return;
    }
    if (!selectedCompany) {
        toast.error("A company must be selected for the invoice.");
        return;
    }
    if (!salesmanId) {
        toast.error("A salesman must be assigned to the invoice.");
        return;
    }

    // 2. Contact Information Validation
    if (!contactPersonId) {
        toast.error("Please select a contact person.");
        return;
    }
    if (!phone.trim()) {
        toast.error("Contact phone number is required.");
        return;
    }
    // Validate phone format (optional +, 7-15 digits)
    if (!/^\+?[0-9]{7,15}$/.test(phone.trim())) {
        toast.error("Please enter a valid phone number.");
        return;
    }

    // 3. Date Validation
    if (!invoiceDate || !dueDate) {
        toast.error("Both Invoice Date and Due Date are required.");
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

    // 4. Invoice Items Validation
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
                    customerName, address,
                    customerType:validCustomerType,
                    invoiceDate, dueDate,
                    salesmanId,
                    items: items.map((item, index) => ({
                        slNo: index + 1,
                        product: item.product,
                        description: item.description,
                        quantity: Number(item.quantity),
                        itemRate: Number(item.itemRate),
                    })),
                    notes,
                    discountAmount: Number(discountAmount),
                    vatAmount: totalTax,
                }
            };

            const response = await invoiceService.create(payload, token);
            toast.success('Invoice created succesfully')
            if (!response.success) throw new Error(response.message || "Failed to save invoice.");
            
            navigate('/invoices');
        } catch (err: any) {
            toast.error(err.message || "An unknown error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

   return (
  <div className="flex min-h-screen  z-10 transition-colors duration-300">
    <Sidebar />

    <div className="flex-1 overflow-y-auto h-screen">
      <main className="max-w-7xl mx-auto py-8 px-6">
        <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100 mb-6">
          Create New Invoice
        </h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white/30 dark:bg-midnight-900/40 backdrop-blur-xl border border-white/20 dark:border-midnight-700/30 
                     p-8 rounded-xl shadow-2xl space-y-8"
        >
          

          {/* Bill To & Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div>
              <label className="block text-sm font-bold text-midnight-700 dark:text-ivory-200 mb-2">
                Bill To
              </label>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Company Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                             shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                 
                />
                <textarea
                  placeholder="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-white/30 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                             shadow-sm focus:border-sky-400 focus:ring focus:ring-sky-300/50 text-sm transition"
                />
                <Button type="button" 
                className="bg-sky-500/80 backdrop-blur-md text-ivory-50 hover:bg-sky-600/90 shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 focus:ring-4 focus:ring-sky-300/50 dark:focus:ring-sky-700/60 rounded-xl"
                onClick={() => setIsModalOpen(true)}>
                  {selectedCompany ? "Change Company" : "Select Company"}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-midnight-700 dark:text-ivory-200 mb-2">
                Contact & Details
              </label>
              <div className="space-y-4">
                <select
                  value={contactPersonId}
                  onChange={(e) => handleContactPersonChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-2xl border border-gray-300 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
                             shadow-sm text-sm transition disabled:opacity-50"
                  disabled={companyContacts.length === 0}
                >
                  <option value="">-- Select Contact --</option>
                  {companyContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="email"
                  placeholder="Contact Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-2xl border border-gray-300 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm 
                             text-sm transition"
                />
                <input
                  type="tel"
                  placeholder="Contact Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-2xl border border-gray-300 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm 
                             text-sm transition"
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-2xl border border-gray-300 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm 
                             text-sm transition"
                />

{user?.type === "ADMIN" ? (
  <select
    value={salesmanId}
    onChange={(e) => setSalesmanId(e.target.value)}
    className="w-full h-10 px-3 rounded-2xl border border-white/30 dark:border-midnight-700/30 
               bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 
               shadow-sm text-sm transition"
  >
    <option value="">-- Assign Salesman --</option>
    {members.map((member) => (
      <option
        key={member.id}
        value={member.id}
        // Disable the option if the member is blocked
        disabled={member.isBlocked}
        // Apply a different style for disabled/blocked members
        style={{
          color: member.isBlocked ? '#999' : 'inherit',
          cursor: member.isBlocked ? 'not-allowed' : 'pointer',
        }}
      >
        {member.name} {member.isBlocked ? '(Blocked)' : ''}
      </option>
    ))}
  </select>
) : (
  <div className="p-2 bg-white/40 dark:bg-midnight-800/50 rounded-2xl text-sm text-midnight-700 dark:text-ivory-200">
    Salesman:{" "}
    <span className="font-semibold">{user?.name || "..."}</span>
  </div>
)}


              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/20 dark:divide-midnight-700/30 text-sm">
              <thead className="bg-white/40 dark:bg-midnight-800/50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-midnight-700 dark:text-ivory-200 w-2/5">
                    Product / Service
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-midnight-700 dark:text-ivory-200 w-2/5">
                    Description
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-midnight-700 dark:text-ivory-200">
                    Qty
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-midnight-700 dark:text-ivory-200">
                    Rate
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-midnight-700 dark:text-ivory-200">
                    Total
                  </th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 dark:divide-midnight-700/30">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={item.product}
                        onChange={(e) =>
                          handleItemChange(index, "product", e.target.value)
                        }
                        className="w-full h-9 px-2 rounded-lg border border-gray-300 dark:border-midnight-700/30 
                                   bg-white/40 dark:bg-midnight-800/50 text-sm text-midnight-800 dark:text-ivory-100"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        className="w-full h-9 px-2 rounded-lg border border-gray-300 dark:border-midnight-700/30 
                                   bg-white/40 dark:bg-midnight-800/50 text-sm text-midnight-800 dark:text-ivory-100"
                      />
                    </td>
                    <td className="px-3 py-4">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "quantity",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-20 h-9 px-2 text-right rounded-lg border border-gray-300 dark:border-midnight-700/30 
                                   bg-white/40 dark:bg-midnight-800/50 text-sm text-midnight-800 dark:text-ivory-100"
                      />
                    </td>
                    <td className="px-3 py-4">
                      <input
                        type="number"
                        value={item.itemRate}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "itemRate",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-24 h-9 px-2 text-right rounded-lg border border-gray-300 dark:border-midnight-700/30 
                                   bg-white/40 dark:bg-midnight-800/50 text-sm text-midnight-800 dark:text-ivory-100"
                      />
                    </td>
                    <td className="px-3 py-4 text-right text-midnight-700 dark:text-ivory-200">
                      ${(item.quantity * item.itemRate).toFixed(2)}
                    </td>
                    <td className="py-4 text-right">
                      <Button
                        type="button"
                        variant="icon"
                        onClick={() => removeItem(index)}
                      >
                        <X size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="secondary" onClick={addItem}>
            Add Item
          </Button>

          {/* Notes & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/20 dark:border-midnight-700/30">
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-midnight-700 dark:text-ivory-200 mb-2"
              >
                Notes / Terms
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-2xl border border-gray-300 dark:border-midnight-700/30 
                           bg-white/40 dark:bg-midnight-800/50 text-midnight-800 dark:text-ivory-100 shadow-sm 
                           text-sm transition"
              />
            </div>
            <div className="space-y-3 text-midnight-700 dark:text-ivory-200">
              <div className="flex justify-between items-center">
                <span>Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <label htmlFor="discountAmount">Discount:</label>
                <input
                  type="number"
                  id="discountAmount"
                  value={discountAmount}
                  onChange={(e) =>
                    setDiscountAmount(parseFloat(e.target.value) || 0)
                  }
                  className="w-28 h-9 px-2 text-right rounded-lg border border-gray-300 dark:border-midnight-700/30 
                             bg-white/40 dark:bg-midnight-800/50 text-sm text-midnight-800 dark:text-ivory-100"
                />
              </div>
              <div className="flex justify-between items-center">
                <span>VAT / Tax (5%):</span>
                <span className="font-medium">${totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/20 dark:border-midnight-700/30">
                <span className="text-xl font-bold">Grand Total:</span>
                <span className="text-xl font-bold">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-4 pt-6 border-t border-white/20 dark:border-midnight-700/30">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/invoices")}
              className="px-5 py-2 rounded-2xl bg-cloud-100/60 dark:bg-midnight-700/60 
                         border border-cloud-300/40 dark:border-midnight-600/40 
                         text-midnight-700 dark:text-ivory-200 
                         hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 shadow-md transition"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !selectedCompany}
              className="px-5 py-2 rounded-2xl bg-sky-500/90 hover:bg-sky-600 text-white shadow-lg transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Create & Save Invoice"}
            </Button>
          </div>
        </form>
      </main>
    </div>

    <SelectContactModal
      open={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSelect={handleCompanySelect}
    />
  </div>
);

};

export default CreateInvoicePage;
