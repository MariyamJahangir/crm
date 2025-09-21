import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { contactsService, ContactRow } from '../services/contactsService';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import FormattedDateTime from '../components/FormattedDateTime';
import EditContactModal from '../components/EditContactModal'; // <-- 1. Import the modal

// Helper component remains the same
const DetailItem: React.FC<{ label: string; value: React.ReactNode | undefined | null }> = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="py-2 border-b border-cloud-200 dark:border-midnight-700">
      <span className="font-medium text-midnight-500 dark:text-ivory-400 block sm:inline-block sm:w-1/3">{label}:</span>
      <span className="text-midnight-800 dark:text-ivory-200 block sm:inline-block">{value}</span>
    </div>
  );
};

const CustomerContactDetail: React.FC = () => {
  const { customerId, contactId } = useParams<{ customerId?: string; contactId: string }>();
  const { token, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [contact, setContact] = useState<ContactRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  // --- 2. State to manage the edit modal ---
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const loadContact = async () => {
    if (!contactId || !token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await contactsService.getOne(contactId, token);
      
      setContact(res.contact);
    } catch (e: any) {
      setErr(e?.data?.message || 'Failed to load contact details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContact();
  }, [contactId, token]);

  // Handler for when the modal reports a successful edit
  const handleEditSuccess = () => {
    setEditModalOpen(false);
    loadContact(); // Reload the contact details to show the updated information
  };
  
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

  if (!contact) {
    return null;
  }
  
  const parentCustomerId = customerId || contact.Customer?.id;

  return (
    <>
      <div className="flex min-h-screen z-10 transition-colors duration-300">
        <Sidebar />
        <main className="flex-1 overflow-y-auto h-screen">
          <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
              <div>
                <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100 drop-shadow-lg">
                  {contact.name}
                </h1>
                {parentCustomerId && (
                  <p className="text-midnight-800 dark:text-ivory-400 text-sm mt-1">
                    Contact at <Link to={`/customers/${parentCustomerId}`} className="text-sky-500 hover:underline">{contact.Customer?.companyName}</Link>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
               
                {/* --- 3. Button now opens the modal --- */}
                <Button
                  variant="secondary"
                  onClick={() => setEditModalOpen(true)}
                >
                  Edit Contact
                </Button>
              </div>
            </div>

            {/* Contact Details Card */}
            <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-midnight-700 dark:text-ivory-200 mb-4">
                Contact Information
              </h2>
              <div className="space-y-1 text-sm">
                <DetailItem label="Full Name" value={contact.name} />
                <DetailItem label="Designation" value={contact.designation} />
                <DetailItem label="Department" value={contact.department} />
                <DetailItem label="Email Address" value={contact.email} />
                <DetailItem label="Mobile" value={contact.mobile} />
                <DetailItem label="Fax" value={contact.fax} />
                <DetailItem 
                  label="Social Profile" 
                  value={contact.social ? 
                    <a href={contact.social} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
                      View Profile
                    </a> : null
                  }
                />
                <DetailItem label="Created On" value={contact.createdAt ? <FormattedDateTime isoString={contact.createdAt} /> : null} />
                <DetailItem label="Last Updated" value={contact.updatedAt ? <FormattedDateTime isoString={contact.updatedAt} /> : null} />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* --- 4. Render the modal --- */}
      <EditContactModal 
        open={isEditModalOpen}
        contactId={contactId}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};

export default CustomerContactDetail;
