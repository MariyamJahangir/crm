import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendorService, Vendor, VendorContact } from '../services/vendorService';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import Button from '../components/Button';
import DataTable from '../components/DataTable';
import FormattedDateTime from '../components/FormattedDateTime';
import { Pencil } from 'lucide-react';

// Reusable DetailItem component for consistent display
const DetailItem: React.FC<{ label: string; value: React.ReactNode | undefined | null }> = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="py-2 border-b border-cloud-200/70 dark:border-midnight-700/70">
      <span className="font-medium text-midnight-500 dark:text-ivory-400 block sm:inline-block sm:w-48">{label}:</span>
      <span className="text-midnight-800 dark:text-ivory-200 block sm:inline-block">{value}</span>
    </div>
  );
};

const VendorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, isLoading: authLoading } = useAuth();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) return;

    const loadVendor = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await vendorService.getById(token, id);
        setVendor(res.vendor);
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load vendor details.');
      } finally {
        setLoading(false);
      }
    };
    loadVendor();
  }, [id, token]);

  const contactColumns = useMemo(() => [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'designation', header: 'Designation', sortable: true },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
  ], []);

  if (authLoading || loading) {
    return <div className="p-8 text-center">Loading vendor details...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (!vendor) {
    return <div className="p-8 text-center">Vendor not found.</div>;
  }

  return (
    <div className="flex min-h-screen z-10 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-3xl font-bold text-midnight-900 dark:text-ivory-100 drop-shadow-lg">
                {vendor.vendorName}
              </h1>
              
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate(`/vendors/${id}/edit`)}
              >
               
                Edit Vendor
              </Button>
            </div>
          </div>

          {/* Tab-like sections for details */}
          <div className="space-y-8">
            {/* Basic & Business Info */}
            <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-midnight-700 dark:text-ivory-200 mb-4">Vendor Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 text-sm">
                <div>
                  <DetailItem label="Vendor Name" value={vendor.vendorName} />
                  <DetailItem label="Status" value={vendor.status} />
                  <DetailItem label="Email" value={vendor.email} />
                  <DetailItem label="Phone" value={vendor.phone} />
                  <DetailItem label="Website" value={vendor.website ? <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">{vendor.website}</a> : null} />
                  <DetailItem label="Address" value={`${vendor.address}, ${vendor.city}, ${vendor.state}, ${vendor.country} - ${vendor.zipCode}`} />
                </div>
                <div>
                  <DetailItem label="Industry" value={vendor.industry} />
                  <DetailItem label="Category" value={vendor.category} />
                  <DetailItem label="GST No." value={vendor.gstNo} />
                  <DetailItem label="PAN No." value={vendor.panNo} />
                  <DetailItem label="Assigned To" value={vendor.assignedMember?.name} />
                  <DetailItem label="Created On" value={<FormattedDateTime isoString={vendor.createdAt} />} />
                </div>
              </div>
            </div>

          

            {/* Contacts Table */}
            <div>
              <h2 className="text-xl font-semibold text-midnight-800 dark:text-ivory-200 mb-4">
                Vendor Contacts
              </h2>
              {vendor.contacts && vendor.contacts.length > 0 ? (
                <DataTable
                  rows={vendor.contacts}
                  columns={contactColumns}
                  initialSort={{ key: 'name', dir: 'ASC' }}
                  searchPlaceholder="Search contacts..."
                  filterKeys={['name', 'designation', 'email', 'phone']}
                  defaultPageSize={5}
                  pageSizeOptions={[5, 10]}
                />
              ) : (
                <div className="text-center p-6 bg-cloud-100 dark:bg-midnight-800 rounded-lg">
                  <p className="text-sm text-midnight-500 dark:text-ivory-500">No contacts have been added for this vendor.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VendorDetailPage;
