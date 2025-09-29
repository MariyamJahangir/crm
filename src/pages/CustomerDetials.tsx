import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customerService, Customer, CustomerContact } from '../services/customerService';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import { Paperclip } from 'lucide-react';
// Helper to render a detail item, avoids showing empty values
const DetailItem: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <span className="font-medium text-midnight-500 dark:text-ivory-400">{label}:</span>{' '}
      <span>{value}</span>
    </div>
  );
};

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) return;

    const loadCustomer = async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await customerService.getOne(id, token);
        console.log(res.customer)
        setCustomer(res.customer);
      } catch (e: any) {
        setErr(e?.data?.message || 'Failed to load customer details.');
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [id, token]);

  // Define columns for the contacts DataTable
  const contactColumns = [
    { 
      key: 'name', 
      header: 'Name', 
      sortable: true,
      render: (contact: CustomerContact) => (
        <Link 
          to={`/customers/${id}/contacts/${contact.id}`} 
          className="text-sky-600 hover:underline font-medium"
        >
          {contact.name}
        </Link>
      )
    },
    { key: 'designation', header: 'Designation', sortable: true },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'mobile', header: 'Mobile' },
    { key: 'email', header: 'Email' },
    { 
      key: 'social', 
      header: 'Social', 
      render: (contact: CustomerContact) => 
        contact.social ? (
          <a href={contact.social} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
            View Profile
          </a>
        ) : (
          '-'
        ),
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 bg-red-100 p-4 rounded-lg">{err}</div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div className="flex min-h-screen z-10 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100 drop-shadow-lg">
                {customer.companyName}
              </h1>
              <p className="text-midnight-800 dark:text-ivory-400 text-sm mt-1">
                Customer Details
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex items-center px-5 py-2 rounded-xl"
                onClick={() => navigate(`/customers/${customer.id}/edit`)}
              >
                Edit Customer
              </Button>
            </div>
          </div>

          {/* Customer Details Card */}
          <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-5 shadow-lg mb-6">
            <h2 className="text-base font-semibold text-midnight-700 dark:text-ivory-200 mb-3">
              Customer Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-midnight-700 dark:text-ivory-200">
              <DetailItem label="Company" value={customer.companyName} />
              <DetailItem label="Email" value={customer.email} />
              <DetailItem label="Contact Number" value={customer.contactNumber} />
              <DetailItem label="VAT Number" value={customer.vatNo} />
              <DetailItem label="Industry" value={customer.industry} />
              <DetailItem label="Category" value={customer.category} />
              <DetailItem label="Assigned Salesman" value={customer.salesman?.name} />
              <DetailItem label="Website" value={customer.website} />
               <DetailItem label="Country" value={customer.country} />
                <DetailItem label="Company Size" value={customer.sizeOfCompany} />
                <DetailItem label="Status" value={customer.status} />
                <DetailItem label="Note" value={customer.note} />
              <div className="sm:col-span-2 lg:col-span-3">
                <DetailItem label="Address" value={customer.address} />
              </div>
            <div className="mt-6 bg-cloud-50/30 ... p-5 ...">
            <h2 className="text-base font-semibold text-midnight-700 flex items-center gap-2 mb-3">
                <Paperclip size={18} />
                Attachments
            </h2>
            <ul className="space-y-2">
                {customer.attachments && customer.attachments.length > 0 ? (
                    customer.attachments.map(file => (
                        <li key={file.id}>
                            <a 
                                href={file.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sky-600 hover:underline"
                            >
                                {file.name}
                            </a>
                            <span className="text-xs text-gray-500 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                        </li>
                    ))
                ) : (
                    <p className="text-sm text-gray-500 italic">No attachments found.</p>
                )}
            </ul>
        </div>
            </div>
          </div>

          {/* Contact Persons Table */}
          <div>
            <h2 className="text-xl font-semibold text-midnight-800 dark:text-ivory-200 mb-4">
              Contact Persons
            </h2>
            {customer.contacts && customer.contacts.length > 0 ? (
              <DataTable
                rows={customer.contacts}
                columns={contactColumns}
                initialSort={{ key: 'name', dir: 'ASC' }}
                searchPlaceholder="Search contacts..."
                filterKeys={['name', 'designation', 'department', 'email', 'mobile']}
                defaultPageSize={5}
                pageSizeOptions={[5, 10, 20]}
              />
            ) : (
                <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-5 shadow-lg text-center">
                    <p className="text-sm text-midnight-500 dark:text-ivory-500 italic">No contact persons have been added for this customer yet.</p>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerDetail;
