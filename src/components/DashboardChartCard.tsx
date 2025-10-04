import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService } from '../services/dashboardService';
import { Doughnut } from 'react-chartjs-2';
import { Loader2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';

const chartColors = ['#4F46E5', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];
const formatUSD = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

const timePeriods = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'this_quarter', label: 'This Quarter' },
    { key: 'last_quarter', label: 'Last Quarter' },
];

const DashboardChartCard = ({ title, apiEndpoint, chartType, dataKey = 'data' }) => {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('this_month');
    const [isMenuOpen, setMenuOpen] = useState(false);

    const fetchData = useCallback(() => {
        if (!token) return;
        setLoading(true);
        setError(null);
        dashboardService.getChartData(token, apiEndpoint, period)
            .then(res => {
                if (res.success) {
                    setData(res[dataKey]); // Use dataKey to access the correct property
                } else {
                    setError(res.message || 'Failed to fetch chart data.');
                }
            })
            .catch(err => setError(err.message || 'An error occurred.'))
            .finally(() => setLoading(false));
    }, [token, apiEndpoint, period, dataKey]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const chartData = useMemo(() => {
        const baseData = { labels: [], datasets: [{ data: [], backgroundColor: chartColors, borderColor: '#fff', borderWidth: 4, hoverOffset: 15 }] };
        if (!data || !data.labels) return baseData;

        baseData.labels = data.labels;
        const options = { plugins: { tooltip: { callbacks: {}, bodySpacing: 5, padding: 10, multiKeyBackground: '#0000' } } };

        switch (chartType) {
            case 'sales':
                baseData.datasets[0].data = data.details.map(d => d.totalSales);
                options.plugins.tooltip.callbacks.label = c => { const d = data.details[c.dataIndex]; if (!d) return ''; const p = d.totalSales > 0 ? (d.sharedSales / d.totalSales * 100).toFixed(0) : 0; return [`Total: ${formatUSD(d.totalSales)}`, `  Individual: ${formatUSD(d.individualSales)} (${d.individualDeals} deals)`, `  Shared: ${formatUSD(d.sharedSales)} (${d.sharedDeals} deals, ${p}%)`]; };
                break;
            case 'leads':
                baseData.datasets[0].data = data.details.map(d => d.individual + d.shared);
                options.plugins.tooltip.callbacks.label = c => { const d = data.details[c.dataIndex]; if (!d) return ''; return [`Total: ${formatNumber(d.individual + d.shared)}`, `  Individual: ${formatNumber(d.individual)}`, `  Shared: ${formatNumber(d.shared)}`]; };
                break;
            case 'quotes':
                baseData.datasets[0].data = data.details.map(d => d.total);
                options.plugins.tooltip.callbacks.label = c => { const d = data.details[c.dataIndex]; if (!d) return ''; const statuses = Object.entries(d.statuses).sort((a,b) => b[1] - a[1]).map(([s, count]) => `  - ${s}: ${formatNumber(count)}`); return [`Total Quotes: ${formatNumber(d.total)}`, ...statuses]; };
                break;
            case 'stage':
            case 'forecast':
                baseData.datasets[0].data = data.details.map(d => d.count);
                options.plugins.tooltip.callbacks.label = c => { const d = data.details[c.dataIndex]; if (!d) return ''; const members = Object.entries(d.members).sort((a,b) => b[1] - a[1]).map(([name, count]) => `  - ${name}: ${formatNumber(count)}`); return [`Total: ${formatNumber(d.count)} (${formatUSD(d.valuation)})`, ...members]; };
                break;
            default: break;
        }
        baseData.options = options;
        return baseData;
    }, [data, chartType]);

    const totalValue = useMemo(() => {
        if (!data?.details) return { main: 0, label: 'Total' };
        switch (chartType) {
            case 'sales': return { main: data.details.reduce((s, d) => s + d.totalSales, 0), label: 'Total Sales', format: formatUSD };
            case 'leads': return { main: data.details.reduce((s, d) => s + d.individual + d.shared, 0), label: 'Total Leads', format: formatNumber };
            case 'quotes': return { main: data.details.reduce((s, d) => s + d.total, 0), label: 'Total Quotes', format: formatNumber };
            case 'stage':
            case 'forecast': return { main: data.details.reduce((s, d) => s + d.valuation, 0), label: 'Total Valuation', format: formatUSD };
            default: return { main: 0, label: 'Total', format: formatNumber };
        }
    }, [data, chartType]);

    const chartOptions = { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: chartData.options?.plugins?.tooltip } };

    const renderBody = () => {
        if (loading) return <div className="flex-grow flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-indigo-500" /></div>;
        if (error) return <div className="flex-grow flex flex-col items-center justify-center text-red-600"><AlertCircle className="h-10 w-10 mb-2" /><p className="text-sm font-medium">{error}</p></div>;
        if (!data || data.labels.length === 0) return <div className="flex-grow flex items-center justify-center"><p className="text-gray-500">No data for this period.</p></div>;

        return (
            <>
                <div className="flex-grow relative w-full h-full">
                    <Doughnut data={chartData} options={chartOptions} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-3xl font-extrabold text-gray-900">{totalValue.format(totalValue.main)}</span>
                        <span className="text-sm font-medium text-gray-500">{totalValue.label}</span>
                    </div>
                </div>
                <div className="text-center text-xs text-gray-500 pt-2 px-2 overflow-hidden max-h-16">
                    {chartData.labels.join(' · ')}
                </div>
            </>
        );
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col h-[450px]">
            <header className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-gray-800 truncate">{title}</h3>
                <div className="relative">
                    <button onClick={() => setMenuOpen(!isMenuOpen)} className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 p-2 rounded-md">
                        <CalendarIcon size={16} />
                        {timePeriods.find(p => p.key === period)?.label}
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl z-10" onMouseLeave={() => setMenuOpen(false)}>
                            {timePeriods.map(p => (
                                <a key={p.key} href="#!" onClick={(e) => { e.preventDefault(); setPeriod(p.key); setMenuOpen(false); }} className={`block px-4 py-2 text-sm text-left ${period === p.key ? 'bg-indigo-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{p.label}</a>
                            ))}
                        </div>
                    )}
                </div>
            </header>
            {renderBody()}
        </div>
    );
};

export default DashboardChartCard;