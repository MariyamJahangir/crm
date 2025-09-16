// src/pages/SalesReport.tsx
import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { reportsService, MemberSalesReport } from '../services/reportsService';
import Sparkline from '../components/Sparkline';
import { ChevronDown, ChevronUp } from 'lucide-react';

type SortKey = keyof Omit<MemberSalesReport, 'memberId' | 'conversionRateHistory'>;
type SortDir = 'asc' | 'desc';

const SalesReportPage: React.FC = () => {
  const { token } = useAuth();
  const [reportData, setReportData] = useState<MemberSalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('dealsTotalValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (!token) return;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await reportsService.getSalesByMember(token);
        setReportData(res.report);
      } catch (e: any) {
        setError(e?.data?.message || 'Failed to load sales report.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [token]);

  const sortedData = useMemo(() => {
    return [...reportData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reportData, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };
  
  const renderSortArrow = (key: SortKey) => (
    sortKey === key ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null
  );

  const tableHeaders: { key: SortKey; label: string }[] = [
      { key: 'memberName', label: 'Member Name' },
      { key: 'dealsWon', label: 'Deals Won' },
      { key: 'dealsTotalValue', label: 'Deals Total Value' },
      { key: 'dealsAverageValue', label: 'Deals Average Value' },
  ];

  return (
    <div className="bg-[#f0f2f5] min-h-screen font-sans">
      <Sidebar />
      <main style={{ marginLeft: '96px' }} className="p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Sales Report</h1>
          <p className="text-gray-600 mt-1">An overview of sales performance by team member.</p>
        </header>

        {loading && <div className="text-center p-10">Loading Report...</div>}
        {error && <div className="text-center p-10 text-red-500">{error}</div>}

        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b">
                  <tr>
                    {tableHeaders.map(({ key, label }) => (
                       <th key={key} scope="col" className="px-6 py-4 font-semibold cursor-pointer" onClick={() => handleSort(key)}>
                         <div className="flex items-center gap-1">
                           {label} {renderSortArrow(key)}
                         </div>
                       </th>
                    ))}
                    <th scope="col" className="px-6 py-4 font-semibold">
                      Conversion Rate (Last 6 Months)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedData.map((row) => (
                    <tr key={row.memberId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.memberName}</td>
                      <td className="px-6 py-4 text-gray-700">{row.dealsWon}</td>
                      <td className="px-6 py-4 text-gray-700">${row.dealsTotalValue.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-700">${row.dealsAverageValue.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <Sparkline data={row.conversionRateHistory} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SalesReportPage;
