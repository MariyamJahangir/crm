import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService, DashboardData } from '../services/dashboardService';
import { layoutService } from '../services/layoutService'; // Service to save/load layouts
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler, ScriptableContext } from 'chart.js';
import Sidebar from '../components/Sidebar';
import { FileText, Briefcase, Users, CheckCircle, Target, RefreshCw, AlertTriangle } from 'lucide-react';
import SetTargetModal from '../components/SetTargetModal';
import TargetAchievementSlider from '../components/TargetAchievementSlider';
import MemberTargetGauge from '../components/MemberTargetGauge';

// RGL Imports
import { Responsive, WidthProvider } from 'react-grid-layout';
import '/node_modules/react-grid-layout/css/styles.css';
import '/node_modules/react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);


// Debounce function to prevent excessive API calls while dragging/resizing
function debounce(fn: Function, ms: number) {
    let timer: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, ms);
    };
}


const Loader: React.FC = () => <div className="flex h-screen w-full items-center justify-center"><div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-600"></div></div>;


const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-4 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 w-full h-full flex flex-col overflow-hidden">
        <h3 className="text-lg font-bold text-gray-800 mb-2 cursor-move truncate">{title}</h3>
        <div className="flex-grow relative w-full h-full">{children}</div>
    </div>
);


const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col justify-center items-center text-center h-full">
        <div className={`p-3 rounded-full ${color} bg-opacity-10 mb-2`}>{icon}</div>
        <div>
            <p className="text-xl md:text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs md:text-sm font-medium text-gray-500">{title}</p>
        </div>
    </div>
);


const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center text-center p-10 bg-red-50 border-2 border-dashed border-red-200 rounded-2xl">
        <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-red-800">Oops! Something went wrong.</h3>
        <p className="text-red-600 mt-2">{message}</p>
    </div>
);


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

    // Create a debounced version of the save function.
    const debouncedSaveLayout = useRef(
        debounce((token: string, layoutsToSave: any) => {
            if (token) {
                console.log("Saving layout to backend...");
                layoutService.saveLayout(token, layoutsToSave);
            }
        }, 1500) // 1.5-second delay
    ).current;

    const fetchData = useCallback((isManualRefresh = false) => {
        if (!token) return;
        if (isManualRefresh) setIsRefreshing(true);
        setError(null);

        dashboardService.getData(token)
            .then(res => res.success && res.data ? setDashboardData(res.data) : setError(res.message || 'Failed to fetch dashboard data.'))
            .catch(err => setError(err.message || 'An unexpected network error occurred.'))
            .finally(() => { setIsLoading(false); });
    }, [token]);

    // Initial data fetch
    useEffect(() => {
        fetchData();
        const intervalId = setInterval(() => fetchData(), 300000);
        return () => clearInterval(intervalId);
    }, [fetchData]);

    // Effect to load layout once user data is available
    useEffect(() => {
        if (!dashboardData || !token || !user) {
            setIsLoading(true);
            return;
        }

        setIsLoading(false);
        const { isAdmin } = dashboardData;
        const lsKey = `dashboard-layout-${user.id}`;

        // Define the default layouts for each role
        const baseItems = [
            { i: 'pipeline', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 6 },
            { i: 'queries', x: 8, y: 8, w: 2, h: 4, minW: 2, minH: 3 },
            { i: 'progress', x: 10, y: 8, w: 2, h: 4, minW: 2, minH: 3 },
            // { i: 'clients', x: 8, y: 12, w: 2, h: 4, minW: 2, minH: 3 },
            { i: 'completed', x: 8, y: 12, w: 2, h: 4, minW: 2, minH: 3 },
        ];
        
        const defaultLayouts = {
            admin: { lg: [...baseItems, { i: 'admin-team-sales', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 6 }, { i: 'admin-monthly-sales', x: 0, y: 8, w: 8, h: 8, minW: 4, minH: 6 }] },
            member: { lg: [...baseItems, { i: 'member-daily-sales', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 6 }, { i: 'member-monthly-sales', x: 0, y: 8, w: 8, h: 8, minW: 4, minH: 6 }] }
        };

        // 1. Try to load layout from backend
        layoutService.getLayout(token).then(res => {
            if (res.success && res.layout && Object.keys(res.layout).length > 0) {
                console.log("Layout loaded from backend.");
                setLayouts(res.layout);
                localStorage.setItem(lsKey, JSON.stringify(res.layout)); // Sync to LS
            } else {
                // 2. If no backend layout, try localStorage
                const lsLayout = localStorage.getItem(lsKey);
                if (lsLayout) {
                    console.log("Layout loaded from localStorage.");
                    setLayouts(JSON.parse(lsLayout));
                } else {
                    // 3. If nothing, use the appropriate default layout
                    console.log("No saved layout found. Using default.");
                    setLayouts(isAdmin ? defaultLayouts.admin : defaultLayouts.member);
                }
            }
            setIsLayoutInitialized(true); // Mark layout as ready
        });

    }, [dashboardData, token, user]);

    const handleEditTarget = (member: any) => {
        setEditingTarget(member);
        setTargetModalOpen(true);
    };

    const onLayoutChange = (layout: any, newLayouts: any) => {
        if (!isLayoutInitialized) return; // Don't save during initial render

        setLayouts(newLayouts); // Update state for immediate UI response
        localStorage.setItem(`dashboard-layout-${user?.id}`, JSON.stringify(newLayouts)); // Save to LS
        debouncedSaveLayout(token!, newLayouts); // Save to backend
    };
    
    const commonChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { font: { weight: 'bold' as const, size: 12 }, boxWidth: 20, padding: 15 },
            },
            tooltip: {
                backgroundColor: '#111827',
                titleFont: { size: 14, weight: 'bold' as const },
                bodyFont: { size: 12 },
                padding: 12, cornerRadius: 8, boxPadding: 4,
            },
        },
        scales: {
            y: {
                ticks: { color: '#4b5563', callback: (value: any) => typeof value === 'number' && value >= 1000 ? `${value / 1000}k` : `${value}`},
                grid: { color: '#e5e7eb' },
            },
            x: { ticks: { color: '#4b5563' }, grid: { display: false } },
        },
    }), []);
    
    const teamSalesTrendChart = useMemo(() => {
        if (!dashboardData?.teamSalesTrend) return { labels: [], datasets: [] };
        return {
            labels: dashboardData.teamSalesTrend.labels,
            datasets: dashboardData.teamSalesTrend.datasets.map((ds, i) => ({
                ...ds, fill: false, tension: 0.4,
                borderColor: `hsl(${200 + i * 45}, 70%, 50%)`,
                pointRadius: 2,
            }))
        };
    }, [dashboardData]);

    const adminMonthlySalesChart = useMemo(() => {
        if (!dashboardData?.monthlySales) return { labels: [], datasets: [] };
        return {
            labels: dashboardData.monthlySales.labels,
            datasets: [{ label: 'Total Sales', data: dashboardData.monthlySales.values, backgroundColor: 'hsla(210, 80%, 60%, 0.7)', borderRadius: 5 }]
        };
    }, [dashboardData]);

    const memberDailySalesChart = useMemo(() => {
        if (!dashboardData?.memberDailySales) return { labels: [], datasets: [] };
        return {
            labels: dashboardData.memberDailySales.labels,
            datasets: [{
                label: 'Your Sales', data: dashboardData.memberDailySales.values,
                fill: 'start', tension: 0.4,
                borderColor: 'rgba(37, 99, 235, 1)', pointBackgroundColor: 'rgba(37, 99, 235, 1)', pointBorderColor: '#fff',
                pointHoverRadius: 7, pointHoverBorderWidth: 2,
                backgroundColor: (ctx: ScriptableContext<"line">) => {
                    if (!ctx.chart.chartArea) return 'rgba(37, 99, 235, 0.1)';
                    const gradient = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.bottom, 0, ctx.chart.chartArea.top);
                    gradient.addColorStop(0, 'rgba(37, 99, 235, 0)');
                    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.4)');
                    return gradient;
                },
            }]
        };
    }, [dashboardData]);
    
    const memberMonthlySalesChart = useMemo(() => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const labels = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            labels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
        }
        
        const values = Array(6).fill(0);
        if (dashboardData?.memberMonthlySales) {
            const salesMap = new Map(dashboardData.memberMonthlySales.map(d => [`${d.year}-${d.month}`, parseFloat(d.totalSales)]));
            labels.forEach((label, index) => {
                const [monthStr, yearStr] = label.split(' ');
                const monthIndex = monthNames.indexOf(monthStr) + 1;
                values[index] = salesMap.get(`${yearStr}-${monthIndex}`) || 0;
            });
        }

        return {
            labels,
            datasets: [{ 
                label: 'Your Monthly Sales', 
                data: values, 
                backgroundColor: (ctx: ScriptableContext<"bar">) => {
                    if (!ctx.chart.chartArea) return 'rgba(22, 163, 74, 0.6)';
                    const gradient = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.bottom, 0, ctx.chart.chartArea.top);
                    gradient.addColorStop(0, 'rgba(22, 163, 74, 0.7)');
                    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.7)');
                    return gradient;
                },
                borderColor: 'rgba(21, 128, 61, 1)',
                borderWidth: 2, borderRadius: 8, borderSkipped: false,
            }]
        };
    }, [dashboardData]);

    const doughnutChartData = useMemo(() => {
        if (!dashboardData) return { labels: [], datasets: [] };
        return {
            labels: dashboardData.leadPipeline.labels,
            datasets: [{ data: dashboardData.leadPipeline.values, backgroundColor: ['#4F46E5', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'], borderColor: '#fff', borderWidth: 4, hoverOffset: 15 }],
        };
    }, [dashboardData]);

    if (isLoading || !dashboardData || !isLayoutInitialized) {
        return <div className="flex bg-gray-50 min-h-screen"><Sidebar /><Loader /></div>;
    }
    
    if (error) {
        return <div className="flex bg-gray-50 min-h-screen"><Sidebar /><main className="flex-1 p-8"><ErrorMessage message={error} /></main></div>;
    }

    const { isAdmin, overallStats, memberTargetAchievements } = dashboardData;
    
    const dashboardItems = {
        'pipeline': (
            <ChartCard title="Lead Pipeline by Stage">
                <Doughnut key="common-pipeline-chart" data={doughnutChartData} options={{...commonChartOptions, cutout: '70%', plugins: {...commonChartOptions.plugins, legend: { position: 'right' }}}}/>
            </ChartCard>
        ),
        'queries': <StatCard title="Total Leads" value={overallStats.queries} icon={<FileText size={20}/>} color="text-blue-500" />,
        'progress': <StatCard title="In Progress" value={overallStats.inProgress} icon={<Briefcase size={20}/>} color="text-amber-500" />,
        // 'clients': <StatCard title="Active Clients" value={overallStats.clients} icon={<Users size={20}/>} color="text-green-500" />,
        'completed': <StatCard title="Deals Completed" value={overallStats.completed} icon={<CheckCircle size={20}/>} color="text-violet-500" />,
        'admin-team-sales': (
            <ChartCard title="Team Daily Sales (Last 30 Days)">
                <Line key="admin-team-sales-chart" data={teamSalesTrendChart} options={commonChartOptions} />
            </ChartCard>
        ),
        'admin-monthly-sales': (
            <ChartCard title="Monthly Sales (Last 6 Months)">
                <Bar key="admin-monthly-sales-chart" data={adminMonthlySalesChart} options={commonChartOptions} />
            </ChartCard>
        ),
        'member-daily-sales': (
            <ChartCard title="Your Daily Sales (This Month)">
                <Line key="member-daily-sales-chart" data={memberDailySalesChart} options={commonChartOptions} />
            </ChartCard>
        ),
        'member-monthly-sales': (
            <ChartCard title="Your Monthly Sales (Last 6 Months)">
                <Bar key="member-monthly-sales-chart" data={memberMonthlySalesChart} options={commonChartOptions} />
            </ChartCard>
        ),
    };

    const currentLayoutForRender = layouts.lg || [];

    return (
        <>
            <SetTargetModal isOpen={isTargetModalOpen} onClose={() => { setTargetModalOpen(false); setEditingTarget(null); fetchData(true); }} token={token} editTarget={editingTarget} />
            <div className="flex font-sans">
                <Sidebar />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-screen">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                            <p className="mt-1 text-gray-500">Welcome back, {user?.name || 'User'}. Here's your performance overview.</p>
                        </div>
                        <div className="flex items-center gap-2 mt-4 sm:mt-0">
                            {isAdmin && <button onClick={() => setTargetModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all hover:scale-105 active:scale-100"><span>Set Target</span></button>}
                            <button onClick={() => fetchData(true)} className="p-2 sm:px-4 sm:py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-all hover:scale-105 active:scale-100 flex items-center">
                                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline ml-2">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                            </button>
                        </div>
                    </header>
                    <div className={`transition-opacity duration-500 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}>
                        <div className="mb-8">
                            {isAdmin ? (
                                <TargetAchievementSlider data={memberTargetAchievements} onEdit={handleEditTarget} />
                            ) : (
                                <div className="max-w-sm mx-auto">
                                    {memberTargetAchievements.length > 0 ? <MemberTargetGauge {...memberTargetAchievements[0]} /> : <p className="text-center text-gray-500">Your target is not set.</p>}
                                </div>
                            )}
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
        </>
    );
};

export default Dashboard;

