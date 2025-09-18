import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService, DashboardData, AdminChartData, MixedChartData } from '../services/dashboardService';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler, ScriptableContext } from 'chart.js';
import Sidebar from '../components/Sidebar';
import { FileText, Briefcase, Users, CheckCircle, Target, RefreshCw } from 'lucide-react';
import SetTargetModal from '../components/SetTargetModal';
import TargetAchievementSlider from '../components/TargetAchievementSlider'; // NEW
import MemberTargetGauge from '../components/MemberTargetGauge'; // NEW

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

// --- Professional UI Components ---
const Loader: React.FC = () => <div className="flex h-screen w-full items-center justify-center"><div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-indigo-500"></div></div>;
const ChartCard: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 ${className}`}>
        <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
        <div className="h-80">{children}</div>
    </div>
);
const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white rounded-2xl shadow-lg p-5 flex items-center space-x-4 transition-transform duration-300 hover:-translate-y-1.5">
        <div className={`p-4 rounded-full text-white ${color}`}>{icon}</div>
        <div>
            <p className="text-3xl font-extrabold text-gray-800">{value}</p>
            <p className="text-sm font-medium text-gray-500">{title}</p>
        </div>
    </div>
);


const Dashboard: React.FC = () => {
    const { user, token } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTargetModalOpen, setTargetModalOpen] = useState(false);

    const fetchData = () => {
        if (!token) return;
        setIsLoading(true);
        dashboardService.getData(token).then(res => {
            if (res.success && res.data) setDashboardData(res.data);
        }).finally(() => setIsLoading(false));
    };

    useEffect(fetchData, [token]);
    
    // Gradient creation utility for charts
    const createGradient = (ctx: ScriptableContext<"line">, baseColor: string) => {
        const chart = ctx.chart;
        const { ctx: chartCtx, chartArea } = chart;
        if (!chartArea) return 'rgba(0,0,0,0)';
        const gradient = chartCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, `${baseColor}, 0)`);
        gradient.addColorStop(1, `${baseColor}, 0.5)`);
        return gradient;
    };
    
    const salesComparisonChartData = useMemo(() => {
        if (!dashboardData) return { labels: [], datasets: [] };
        const { isAdmin, totalSalesComparison } = dashboardData;
        
        const datasets = isAdmin
            ? (totalSalesComparison as AdminChartData).datasets.map((ds, i) => {
                const baseColor = `rgba(${70 + i * 50}, ${100 + i * 20}, 255`;
                return {
                    ...ds, fill: 'start', tension: 0.4, pointRadius: 5, pointHoverRadius: 8,
                    borderColor: `${baseColor}, 1)`,
                    backgroundColor: (ctx: ScriptableContext<"line">) => createGradient(ctx, baseColor),
                    pointBackgroundColor: `${baseColor}, 1)`,
                }
            })
            : [{
                label: 'Total Sales', data: (totalSalesComparison as any).values, fill: 'start', tension: 0.4,
                borderColor: 'rgba(79, 70, 229, 1)',
                backgroundColor: (ctx: ScriptableContext<"line">) => createGradient(ctx, 'rgba(79, 70, 229'),
                pointBackgroundColor: 'rgba(79, 70, 229, 1)',
                pointRadius: 5, pointHoverRadius: 8,
            }];

        return { labels: totalSalesComparison.labels, datasets };
    }, [dashboardData]);

    const revenueChartData = useMemo(() => {
        if (!dashboardData) return { labels: [], datasets: [] };
        return dashboardData.revenueLastSixMonths as MixedChartData;
    }, [dashboardData]);


    if (isLoading) return <div className="flex bg-gray-50"><Sidebar /><Loader /></div>;
    if (!dashboardData) return <div className="flex bg-gray-50"><Sidebar /><p className="m-auto font-bold text-xl text-gray-500">No data found or failed to load.</p></div>;

    const { isAdmin, overallStats, leadPipeline, memberTargetAchievements } = dashboardData;
    
    const doughnutChartData = {
        labels: leadPipeline.labels,
        datasets: [{
            data: leadPipeline.values,
            backgroundColor: ['#4F46E5', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'],
            borderColor: '#fff', borderWidth: 4, hoverOffset: 15,
        }]
    };

    return (
        <>
            <SetTargetModal isOpen={isTargetModalOpen} onClose={() => { setTargetModalOpen(false); fetchData(); }} token={token} />
            <div className="flex min-h-screen bg-gray-100 font-sans">
                <Sidebar />
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                            <p className="mt-1 text-gray-500">Welcome back, {user?.name || 'User'}. Here's your performance overview.</p>
                        </div>
                        <div className="flex items-center gap-2 mt-4 sm:mt-0">
                            {isAdmin && (
                                <button onClick={() => setTargetModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-transform hover:scale-105">
                                    <Target size={18} /><span>Set Target</span>
                                </button>
                            )}
                            <button onClick={fetchData} className="p-2 sm:px-4 sm:py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition-transform hover:scale-105">
                                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> <span className="hidden sm:inline ml-2">Refresh</span>
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                        <StatCard title="Total Queries" value={overallStats.queries} icon={<FileText size={28}/>} color="bg-blue-500" />
                        <StatCard title="In Progress" value={overallStats.inProgress} icon={<Briefcase size={28}/>} color="bg-amber-500" />
                        <StatCard title="Active Clients" value={overallStats.clients} icon={<Users size={28}/>} color="bg-green-500" />
                        <StatCard title="Deals Completed" value={overallStats.completed} icon={<CheckCircle size={28}/>} color="bg-violet-500" />
                    </div>

                    {/* NEW: Target Achievement Section */}
                    <div className="mb-8">
                        {isAdmin ? (
                            <TargetAchievementSlider data={memberTargetAchievements} />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {memberTargetAchievements.length > 0 && (
                                     <div className="md:col-span-1 lg:col-span-1">
                                        <MemberTargetGauge 
                                            name="Your Monthly Target"
                                            achieved={memberTargetAchievements[0].achieved}
                                            target={memberTargetAchievements[0].target}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <ChartCard title={isAdmin ? "Team Sales Trend (This vs Last Month)" : "Monthly Sales Trend"}>
                            <Line key="sales-trend-chart" data={salesComparisonChartData} options={{ responsive: true, maintainAspectRatio: false }}/>
                        </ChartCard>
                        
                        <ChartCard title="Revenue vs. Target (Last 6 Months)">
                           <Bar key="revenue-target-chart" data={revenueChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false }, y: { stacked: false } } }} />
                        </ChartCard>

                        <ChartCard title="Lead Pipeline by Stage">
                            <Doughnut key="pipeline-chart" data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }}/>
                        </ChartCard>

                        <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center justify-center">
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Need Help?</h3>
                                <p className="text-gray-500">Contact our support team for any assistance.</p>
                                <button className="mt-4 px-5 py-2 bg-gray-800 text-white font-semibold rounded-lg shadow-md hover:bg-black transition-colors">
                                    Contact Support
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
};

export default Dashboard;
