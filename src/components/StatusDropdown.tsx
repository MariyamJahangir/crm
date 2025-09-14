import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { invoiceService, Invoice } from '../services/invoiceService';


interface StatusDropdownProps {
  invoice: Invoice;
  onStatusChange: (updatedInvoice: Invoice) => void;
}

const statusOptions: Invoice['status'][] = ['Draft', 'Sent', 'Paid', 'Cancelled', 'Overdue'];

const StatusDropdown: React.FC<StatusDropdownProps> = ({ invoice, onStatusChange }) => {
  const { token } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (newStatus: Invoice['status']) => {
    if (!token || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await invoiceService.updateStatus(invoice.id, newStatus, token);
      if (res.success) {
        onStatusChange(res.invoice);
      } else {
        alert(res.message); // Or use a more elegant notification system
      }
    } catch (err) {
      alert('Failed to update status.');
    } finally {
      setIsUpdating(false);
    }
  };
  const statusStyles: { [key in Invoice['status']]: string } = {
  Paid: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-100 text-gray-800',
  Sent: 'bg-blue-100 text-blue-800',
  Draft: 'bg-yellow-100 text-yellow-800',
  Overdue: 'bg-red-100 text-red-800',
};

  // Do not allow changes if invoice is Paid or Cancelled
  if (invoice.status === 'Paid' || invoice.status === 'Cancelled') {
    return (
     <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusStyles[invoice.status]}`}>
  {invoice.status}
</span>

    );
  }

  return (
    <select
      value={invoice.status}
      onChange={(e) => handleUpdate(e.target.value as Invoice['status'])}
      disabled={isUpdating}
      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
    >
      {statusOptions.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
};
export default StatusDropdown