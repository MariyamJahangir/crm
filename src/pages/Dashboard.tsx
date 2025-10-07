import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService } from '../services/dashboardService';
import { Doughnut, getElementAtEvent } from 'react-chartjs-2';
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import Sidebar from '../components/Sidebar';
import SetTargetModal from '../components/SetTargetModal';
import TargetAchievementSlider from '../components/TargetAchievementSlider';
import MemberTargetGauge from '../components/MemberTargetGauge';
import { Loader2, AlertTriangle, Target } from 'lucide-react';
import { useRef } from 'react';


ChartJS.register(Title, Tooltip, Legend, ArcElement);


// --- Helper Components ---
const Loader = () => <div className="flex h-screen w-full items-center justify-center"><div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-600"></div></div>;
const ErrorMessage = ({ message }) => (<div className="col-span-full flex flex-col items-center justify-center text-center p-10 bg-red-50 border-2 border-dashed border-red-200 rounded-2xl"><AlertTriangle className="w-16 h-16 text-red-400 mb-4" /><h3 className="text-xl font-bold text-red-800">Oops!</h3><p className="text-red-600 mt-2">{message}</p></div>);


// This component is now interactive
const PieChartCard = ({ title, chartData, centerTextLabel, centerTextValue, onSliceClick }) => {
    const chartRef = useRef();


    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        layout: {
            padding: {
                top: 20,
                bottom: 20,
                left: 20,
                right: 20,
            },
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    boxWidth: 12,
                    font: {
                        weight: 'bold'
                    }
                }
            },
            tooltip: {
                ...chartData.options?.plugins?.tooltip,
                bodySpacing: 6,
                padding: 10,
                multiKeyBackground: '#0000',
                cornerRadius: 8,
                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                titleColor: '#fff',
                bodyColor: '#e2e8f0',
            }
        },
    };


    const handleClick = (event) => {
        const element = getElementAtEvent(chartRef.current, event);
        if (element.length > 0) {
            const dataIndex = element[0].index;
            const label = chartData.labels[dataIndex];
            const value = chartData.datasets[0].data[dataIndex];
            onSliceClick({ label, value });
        } else {
            // If clicking outside a slice, reset
            onSliceClick(null);
        }
    };

    return (
        <div className="bg-cloud-50/60 backdrop-blur-lg p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col h-[450px]">
            <h3 className="text-lg font-bold text-gray-800 mb-2 text-center truncate">{title}</h3>

            <div className="relative flex-grow w-full h-full">
                {chartData && chartData.datasets[0].data.length > 0 ? (
                    <>

                        <Doughnut ref={chartRef} data={chartData} options={options} onClick={handleClick} />

                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span className="text-3xl font-extrabold text-midnight-900">{centerTextValue}</span>
                            <span className="text-sm font-medium text-midnight-500">{centerTextLabel}</span>
                        </div>
                    </>
                ) : (<div className="absolute inset-0 flex items-center justify-center"><p className="text-gray-500">No data for this period.</p></div>)}

            </div>
        </div>
    );


};


// --- Main Dashboard Component ---
const Dashboard = () => {
    const { user, token } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('all_time'); // Default to all_time
    const [isTargetModalOpen, setTargetModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null);


    // --- NEW: State to hold the selected slice info for each chart ---
    const [selectedLeadInfo, setSelectedLeadInfo] = useState(null);
    const [selectedQuoteInfo, setSelectedQuoteInfo] = useState(null);
    const [selectedSalesInfo, setSelectedSalesInfo] = useState(null);



    const fetchData = useCallback((currentPeriod) => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        // Reset selections when fetching new data
        setSelectedLeadInfo(null);
        setSelectedQuoteInfo(null);
        setSelectedSalesInfo(null);
        dashboardService.getData(token, currentPeriod)
            .then(res => {
                if (res.success && res.data) {
                    setDashboardData(res.data);
                } else {
                    setError(res.message || 'Failed to fetch data.');
                }
            })
            .catch(err => setError(err.message || 'An unexpected error occurred.'))
            .finally(() => setIsLoading(false));
    }, [token]);


    useEffect(() => {
        fetchData(period);
    }, [fetchData, period]);

    const handleEditTarget = (member) => {
        setEditingTarget(member);
        setTargetModalOpen(true);
    };


    const formatUSD = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

    const chartColors = [
        "#415178", // Indigo Blue
        "#EE5E5F", // Coral Red
        "#A5599E", // Deep Purple Rose
        "#54B4AF", // Teal Green
        "#EBD332", // Vibrant Yellow

        // new ones below 👇
        "#F48C06", // Warm Orange
        "#6A4C93", // Royal Violet
        "#0096C7", // Strong Aqua Blue
        "#16A34A", // Fresh Green
        "#D7263D", // Crimson Red
        "#845EC2", // Purple Blue
        "#FF6F61", // Bright Coral
        "#2C6975", // Ocean Teal
        "#FFC75F", // Soft Gold
        "#0081CF"  // Clear Sky Blue
    ];
    const baseChartData = (labels, values) => ({
        labels,
        datasets: [{ data: values, backgroundColor: chartColors, borderColor: '#a2a8b0ac', borderWidth: 2, hoverOffset: 15 }]
    });


    // --- Memoized Chart Data with DETAILED TOOLTIPS ---
    const salesBySalesmanChart = useMemo(() => {
        if (!dashboardData?.salesBySalesman) return baseChartData([], []);
        const { labels, details } = dashboardData.salesBySalesman;
        const data = baseChartData(labels, details.map(d => d.totalSales));
        data.options = { plugins: { tooltip: { callbacks: { label: (c) => { const d = details[c.dataIndex]; if (!d) return ''; const p = d.totalSales > 0 ? (d.sharedSales / d.totalSales * 100).toFixed(0) : 0; return [`Total: ${formatUSD(d.totalSales)}`, `  Individual: ${formatUSD(d.individualSales)} (${d.individualDeals} deals)`, `  Shared: ${formatUSD(d.sharedSales)} (${d.sharedDeals} deals, ${p}%)`]; } } } } };
        return data;
    }, [dashboardData]);


    const leadsBySalesmanChart = useMemo(() => {
        if (!dashboardData?.leadsBySalesman) return baseChartData([], []);
        const { labels, details } = dashboardData.leadsBySalesman;
        const data = baseChartData(labels, details.map(d => d.individual + d.shared));
        data.options = { plugins: { tooltip: { callbacks: { label: (c) => { const d = details[c.dataIndex]; if (!d) return ''; return [`Total: ${formatNumber(d.individual + d.shared)}`, `  Individual: ${formatNumber(d.individual)}`, `  Shared: ${formatNumber(d.shared)}`]; } } } } };
        return data;
    }, [dashboardData]);


    const quotesBySalesmanChart = useMemo(() => {
        if (!dashboardData?.quotesBySalesman) return baseChartData([], []);
        const { labels, details } = dashboardData.quotesBySalesman;
        const data = baseChartData(labels, details.map(d => d.total));
        data.options = { plugins: { tooltip: { callbacks: { label: (c) => { const d = details[c.dataIndex]; if (!d) return ''; const statuses = Object.entries(d.statuses).sort((a, b) => b[1] - a[1]).map(([status, count]) => `  - ${status}: ${formatNumber(count)}`); return [`Total Quotes: ${formatNumber(d.total)}`, ...statuses]; } } } } };
        return data;
    }, [dashboardData]);

    const leadsByStageChart = useMemo(() => {
        if (!dashboardData?.leadsByStage) return baseChartData([], []);
        const { labels, details } = dashboardData.leadsByStage;
        const data = baseChartData(labels, details.map(d => d.count));
        data.options = { plugins: { tooltip: { callbacks: { label: (c) => { const d = details[c.dataIndex]; if (!d) return ''; const members = Object.entries(d.members).sort((a, b) => b[1] - a[1]).map(([name, count]) => `  - ${name}: ${formatNumber(count)}`); return [`Total: ${formatNumber(d.count)} (${formatUSD(d.valuation)})`, ...members]; } } } } };
        return data;
    }, [dashboardData]);


    const leadsByForecastChart = useMemo(() => {
        if (!dashboardData?.leadsByForecast) return baseChartData([], []);
        const { labels, details } = dashboardData.leadsByForecast;
        const data = baseChartData(labels, details.map(d => d.count));
        data.options = { plugins: { tooltip: { callbacks: { label: (c) => { const d = details[c.dataIndex]; if (!d) return ''; const members = Object.entries(d.members).sort((a, b) => b[1] - a[1]).map(([name, count]) => `  - ${name}: ${formatNumber(count)}`); return [`Total: ${formatNumber(d.count)} (${formatUSD(d.valuation)})`, ...members]; } } } } };
        return data;
    }, [dashboardData]);


    // --- Total Value Calculations ---
    const totalSales = useMemo(() => dashboardData?.salesBySalesman.details.reduce((s, d) => s + d.totalSales, 0) || 0, [dashboardData]);
    const totalLeads = useMemo(() => dashboardData?.leadsBySalesman.details.reduce((s, d) => s + d.individual + d.shared, 0) || 0, [dashboardData]);
    const totalQuotes = useMemo(() => dashboardData?.quotesBySalesman.details.reduce((s, d) => s + d.total, 0) || 0, [dashboardData]);
    const totalStageValuation = useMemo(() => dashboardData?.leadsByStage.details.reduce((s, d) => s + d.valuation, 0) || 0, [dashboardData]);
    const totalForecastValuation = useMemo(() => dashboardData?.leadsByForecast.details.reduce((s, d) => s + d.valuation, 0) || 0, [dashboardData]);

    const renderContent = () => {
        if (isLoading) return <Loader />;
        if (error) return <ErrorMessage message={error} />;
        if (!dashboardData) return <ErrorMessage message="No data could be loaded." />;


        const { isAdmin, memberTargetAchievements } = dashboardData;
        return (
            <>
                <div className="mb-8 py-6 rounded-2xl ">
                    {/* <h2 className="text-xl font-bold text-gray-800 mb-4">This Month's Target Achievement</h2> */}
                    {isAdmin ? (<TargetAchievementSlider data={memberTargetAchievements} onEdit={handleEditTarget} />) : (<div className="max-w-md mx-auto">{memberTargetAchievements.length > 0 ? <MemberTargetGauge {...memberTargetAchievements[0]} /> : <p className="text-center text-midnight-500">Your target is not set for this month.</p>}</div>)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">



                    <PieChartCard
                        title="Sales by Salesman (USD)"
                        chartData={salesBySalesmanChart}
                        centerTextValue={selectedSalesInfo ? formatUSD(selectedSalesInfo.value) : formatUSD(totalSales)}
                        centerTextLabel={selectedSalesInfo ? selectedSalesInfo.label : "Total Sales"}
                        onSliceClick={setSelectedSalesInfo}
                    />

                    <PieChartCard
                        title="Leads by Salesman"
                        chartData={leadsBySalesmanChart}
                        centerTextValue={selectedLeadInfo ? formatNumber(selectedLeadInfo.value) : formatNumber(totalLeads)}
                        centerTextLabel={selectedLeadInfo ? selectedLeadInfo.label : "Total Leads"}
                        onSliceClick={setSelectedLeadInfo}
                    />
                    <PieChartCard
                        title="Quotes by Salesman"
                        chartData={quotesBySalesmanChart}
                        centerTextValue={selectedQuoteInfo ? formatNumber(selectedQuoteInfo.value) : formatNumber(totalQuotes)}
                        centerTextLabel={selectedQuoteInfo ? selectedQuoteInfo.label : "Total Quotes"}
                        onSliceClick={setSelectedQuoteInfo}
                    />
                    <PieChartCard
                        title="Leads by Stage (USD)"
                        chartData={leadsByStageChart}
                        centerTextValue={formatUSD(totalStageValuation)}
                        centerTextLabel="Total Valuation"
                        onSliceClick={() => { }} // This chart is not interactive per-slice
                    />
                    <PieChartCard
                        title="Leads by Forecast (USD)"
                        chartData={leadsByForecastChart}
                        centerTextValue={formatUSD(totalForecastValuation)}
                        centerTextLabel="Total Forecast"
                        onSliceClick={() => { }} // This chart is not interactive per-slice
                    />
                </div>
            </>
        );
    };


    const FilterButton = ({ value, label }) => (<button onClick={() => setPeriod(value)} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${period === value ? 'bg-sky-500 text-white shadow-md' : 'bg-cloud-50 text-midnight-700 hover:bg-gray-100'}`}>{label}</button>);


    return (
        <div className="flex min-h-screen">
            <SetTargetModal isOpen={isTargetModalOpen} onClose={() => { setTargetModalOpen(false); setEditingTarget(null); fetchData(period); }} token={token} editTarget={editingTarget} />
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Sales Dashboard</h1>
                            <p className="mt-1 text-gray-600">Welcome back, {user?.name || 'User'}.</p>
                        </div>
                        <div className="flex items-center gap-4 mt-4 sm:mt-0">
                            {dashboardData?.isAdmin && <button onClick={() => setTargetModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600"><Target size={16} /> Set Target</button>}
                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-md border">
                                <FilterButton value="this_month" label="This Month" />
                                <FilterButton value="last_month" label="Last Month" />
                                <FilterButton value="this_quarter" label="This Quarter" />
                                <FilterButton value="all_time" label="All Time" />
                            </div>
                        </div>
                    </header>
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};


export default Dashboard;
