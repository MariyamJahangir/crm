import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService, DashboardData } from '../services/dashboardService';
import { layoutService } from '../services/layoutService';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ChartData, ChartOptions, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import Sidebar from '../components/Sidebar';
import { FileText, Briefcase, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import SetTargetModal from '../components/SetTargetModal';
import TargetAchievementSlider from '../components/TargetAchievementSlider';
import MemberTargetGauge from '../components/MemberTargetGauge';

// RGL Imports
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

// --- HELPER HOOK & RESPONSIVE COMPONENTS ---
const useResponsiveSizing = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('lg');
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const newWidth = entry.contentRect.width;
        setWidth(newWidth);
        if (newWidth < 300) setSize('sm');
        else if (newWidth < 500) setSize('md');
        else setSize('lg');
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, size, width };
};

const ResponsiveChart: React.FC<{ title: string; type: 'line' | 'bar' | 'doughnut'; data: ChartData<any>; }> = ({ title, type, data }) => {
    const { ref, size, width } = useResponsiveSizing();
    const titleSizeClass = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' }[size];
    const chartOptions = useMemo<ChartOptions<any>>(() => {
        const isSmall = width < 400; const legendFontSize = isSmall ? 10 : 12; const tickFontSize = isSmall ? 9 : 11;
        const baseOptions: ChartOptions<any> = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: type === 'doughnut' ? 'right' : 'top', labels: { font: { size: legendFontSize, weight: 'bold' }, boxWidth: isSmall ? 10 : 20, padding: isSmall ? 8 : 15, }, }, tooltip: { backgroundColor: '#111827', titleFont: { size: 14, weight: 'bold' }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 8, }, },
            scales: type === 'doughnut' ? {} : { y: { ticks: { color: '#a8a8a8ff', font: { size: tickFontSize } }, grid: { color: '#e5e7eb' }, }, x: { ticks: { color: '#8d8d8dff', font: { size: tickFontSize } }, grid: { display: false }, }, },
        };
        if (type === 'doughnut') { baseOptions.cutout = '70%'; }
        return baseOptions;
    }, [width, type]);
    const renderChart = () => { switch (type) { case 'line': return <Line data={data} options={chartOptions} />; case 'bar': return <Bar data={data} options={chartOptions} />; case 'doughnut': return <Doughnut data={data} options={chartOptions} />; default: return null; } };
    return (<div ref={ref} className="bg-white p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 w-full h-full flex flex-col overflow-hidden"><h3 className={`${titleSizeClass} font-bold text-gray-800 mb-2 cursor-move truncate`}>{title}</h3><div className="flex-grow relative w-full h-full">{renderChart()}</div></div>);
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => {
    const { ref, size } = useResponsiveSizing();
    const valueSizeClass = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }[size];
    const titleSizeClass = { sm: 'text-xs', md: 'text-sm', lg: 'text-sm' }[size];
    const iconContainerClass = { sm: 'p-2 mb-1', md: 'p-3 mb-2', lg: 'p-3 mb-2' }[size];

    return (
        <div ref={ref} className="bg-white rounded-2xl shadow-lg p-4 flex flex-col justify-center items-center text-center h-full">
            <div className={`rounded-full ${color} bg-opacity-10 ${iconContainerClass}`}>{icon}</div>
            <div>
                <p className={`${valueSizeClass} font-bold text-gray-800`}>{value}</p>
                <p className={`${titleSizeClass} font-medium text-gray-500 cursor-move`}>{title}</p>
            </div>
        </div>
    );
};

// --- UTILITY COMPONENTS ---
const Loader: React.FC = () => <div className="flex h-screen w-full items-center justify-center"><div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-600"></div></div>;
const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (<div className="flex flex-col items-center justify-center text-center p-10 bg-red-50 border-2 border-dashed border-red-200 rounded-2xl"><AlertTriangle className="w-16 h-16 text-red-400 mb-4" /><h3 className="text-xl font-bold text-red-800">Oops! Something went wrong.</h3><p className="text-red-600 mt-2">{message}</p></div>);
function debounce(fn: Function, ms: number) { let timer: NodeJS.Timeout; return (...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => { fn.apply(this, args); }, ms); }; }


// --- MAIN DASHBOARD COMPONENT ---
const Dashboard: React.FC = () => {
    const { user, token } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTargetModalOpen, setTargetModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState<any>(null);
    const [layouts, setLayouts] = useState<any>({});
    const [isLayoutInitialized, setIsLayoutInitialized] = useState(false);

    const debouncedSaveLayout = useRef(debounce((token: string, layoutsToSave: any) => { if (token) { layoutService.saveLayout(token, layoutsToSave); } }, 1500)).current;
    
    const fetchData = useCallback((isManualRefresh = false) => {
        if (!token) return;
        if (isManualRefresh) setIsRefreshing(true); else setIsLoading(true);
        setError(null);
        dashboardService.getData(token).then(res => { if (res.success && res.data) { setDashboardData(res.data); } else { setError(res.message || 'Failed to fetch dashboard data.'); } }).catch(err => setError(err.message || 'An unexpected network error occurred.')).finally(() => { setIsLoading(false); if (isManualRefresh) setIsRefreshing(false); });
    }, [token]);

    useEffect(() => { fetchData(); const intervalId = setInterval(() => fetchData(), 300000); return () => clearInterval(intervalId); }, [fetchData]);

    useEffect(() => {
        if (!dashboardData || !token || !user) return;
        const { isAdmin } = dashboardData;
        const lsKey = `dashboard-layout-${user.id}`;
        const baseItems = [{ i: 'pipeline', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 6 }, { i: 'queries', x: 8, y: 8, w: 2, h: 4, minW: 2, minH: 3 }, { i: 'progress', x: 10, y: 8, w: 2, h: 4, minW: 2, minH: 3 }, { i: 'completed', x: 10, y: 12, w: 2, h: 4, minW: 2, minH: 3 }];
        const defaultLayouts = { admin: { lg: [...baseItems, { i: 'admin-team-sales', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 6 }, { i: 'admin-monthly-sales', x: 0, y: 8, w: 8, h: 8, minW: 4, minH: 6 }] }, member: { lg: [...baseItems, { i: 'member-daily-sales', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 6 }, { i: 'member-monthly-sales', x: 0, y: 8, w: 8, h: 8, minW: 4, minH: 6 }] } };
        
        layoutService.getLayout(token).then(res => {
            if (res.success && res.layout && Object.keys(res.layout).length > 0) { setLayouts(res.layout); localStorage.setItem(lsKey, JSON.stringify(res.layout)); }
            else { const lsLayout = localStorage.getItem(lsKey); if (lsLayout) { setLayouts(JSON.parse(lsLayout)); } else { setLayouts(isAdmin ? defaultLayouts.admin : defaultLayouts.member); } }
            setIsLayoutInitialized(true);
        });
    }, [dashboardData, token, user]);
    
    const handleEditTarget = (member: any) => { setEditingTarget(member); setTargetModalOpen(true); };
    const onLayoutChange = (_: any, newLayouts: any) => { if (!isLayoutInitialized) return; setLayouts(newLayouts); localStorage.setItem(`dashboard-layout-${user?.id}`, JSON.stringify(newLayouts)); debouncedSaveLayout(token!, newLayouts); };
    
    const teamSalesTrendData = useMemo(() => { if (!dashboardData?.teamSalesTrend) return { labels: [], datasets: [] }; return { labels: dashboardData.teamSalesTrend.labels, datasets: dashboardData.teamSalesTrend.datasets.map((ds, i) => ({ ...ds, fill: false, tension: 0.4, borderColor: `hsl(${200 + i * 45}, 70%, 50%)`, pointRadius: 2 })) }; }, [dashboardData]);
    const adminMonthlySalesData = useMemo(() => { if (!dashboardData?.monthlySales) return { labels: [], datasets: [] }; return { labels: dashboardData.monthlySales.labels, datasets: [{ label: 'Total Sales', data: dashboardData.monthlySales.values, backgroundColor: 'hsla(210, 80%, 60%, 0.7)', borderRadius: 5 }] }; }, [dashboardData]);
    const memberDailySalesData = useMemo(() => { if (!dashboardData?.memberDailySales) return { labels: [], datasets: [] }; return { labels: dashboardData.memberDailySales.labels, datasets: [{ label: 'Your Sales', data: dashboardData.memberDailySales.values, fill: 'start', tension: 0.4, borderColor: 'rgba(37, 99, 235, 1)' }] }; }, [dashboardData]);
    const memberMonthlySalesData = useMemo(() => { if (!dashboardData?.memberMonthlySales) return { labels: [], datasets: [] }; return { labels: dashboardData.memberMonthlySales.labels, datasets: [{ label: 'Your Monthly Sales', data: dashboardData.memberMonthlySales.values, backgroundColor: 'rgba(22, 163, 74, 0.7)', borderColor: 'rgba(21, 128, 61, 1)', borderWidth: 2, borderRadius: 8 }] }; }, [dashboardData]);
    const doughnutChartData = useMemo(() => { if (!dashboardData) return { labels: [], datasets: [] }; return { labels: dashboardData.leadPipeline.labels, datasets: [{ data: dashboardData.leadPipeline.values, backgroundColor: ['#4F46E5', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'], borderColor: '#fff', borderWidth: 4, hoverOffset: 15 }], }; }, [dashboardData]);

    if (isLoading || !dashboardData || !isLayoutInitialized) { return <div className="flex bg-gray-50 min-h-screen"><Sidebar /><Loader /></div>; }
    if (error) { return <div className="flex bg-gray-50 min-h-screen"><Sidebar /><main className="flex-1 p-8"><ErrorMessage message={error} /></main></div>; }

    const { isAdmin, overallStats, memberTargetAchievements } = dashboardData;
    
    const dashboardItems = {
        'pipeline': <ResponsiveChart title="Lead Pipeline by Stage" type="doughnut" data={doughnutChartData} />,
        'queries': <StatCard title="Total Leads" value={overallStats.queries} icon={<FileText size={20}/>} color="text-blue-500" />,
        'progress': <StatCard title="In Progress" value={overallStats.inProgress} icon={<Briefcase size={20}/>} color="text-amber-500" />,
        'completed': <StatCard title="Deals Completed" value={overallStats.completed} icon={<CheckCircle size={20}/>} color="text-violet-500" />,
        'admin-team-sales': <ResponsiveChart title="Team Daily Sales (Last 30 Days)" type="line" data={teamSalesTrendData} />,
        'admin-monthly-sales': <ResponsiveChart title="Monthly Sales (Last 6 Months)" type="bar" data={adminMonthlySalesData} />,
        'member-daily-sales': <ResponsiveChart title="Your Daily Sales (This Month)" type="line" data={memberDailySalesData} />,
        'member-monthly-sales': <ResponsiveChart title="Your Monthly Sales (Last 6 Months)" type="bar" data={memberMonthlySalesData} />,
    };
    const currentLayoutForRender = layouts.lg || [];

    return (
        <div className="flex min-h-screen bg-gray-50">
            <SetTargetModal isOpen={isTargetModalOpen} onClose={() => { setTargetModalOpen(false); setEditingTarget(null); fetchData(true); }} token={token} editTarget={editingTarget} />
            <Sidebar />
            <div className="font-sans flex-1 overflow-y-auto h-screen">
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                            <p className="mt-1 text-gray-500">Welcome back, {user?.name || 'User'}. Here's your performance overview.</p>
                        </div>
                        <div className="flex items-center gap-2 mt-4 sm:mt-0">
                            {isAdmin && <button onClick={() => setTargetModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Set Target</button>}
                            <button onClick={() => fetchData(true)} className="p-2 sm:px-4 sm:py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-100 flex items-center">
                                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline ml-2">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                            </button>
                        </div>
                    </header>
                    <div className={`transition-opacity duration-500 ${isRefreshing ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                        <div className="mb-8">
                            {isAdmin ? (<TargetAchievementSlider data={memberTargetAchievements} onEdit={handleEditTarget} />) : (<div className="max-w-sm mx-auto">{memberTargetAchievements.length > 0 ? <MemberTargetGauge {...memberTargetAchievements[0]} /> : <p className="text-center text-gray-500">Your target is not set.</p>}</div>)}
                        </div>

                        <ResponsiveGridLayout
                            className="layout"
                            layouts={layouts}
                            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                            rowHeight={30}
                            compactType="vertical"
                            onLayoutChange={onLayoutChange}
                            draggableHandle=".cursor-move"
                        >
                            {currentLayoutForRender.map((item: any) => (
                                <div key={item.i}>
                                    {dashboardItems[item.i as keyof typeof dashboardItems]}
                                </div>
                            ))}
                        </ResponsiveGridLayout>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;