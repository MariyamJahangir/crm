import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService, DashboardData } from '../services/dashboardService';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import Sidebar from '../components/Sidebar';
import { FileText, Briefcase, Users, CheckCircle, Search, Upload } from 'lucide-react';

// Register all necessary Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

// --- REUSABLE UI COMPONENTS ---

const Loader: React.FC = () => (
    <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-600"></div>
    </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="h-72">{children}</div>
    </div>
);

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
        <div className="bg-blue-100 text-blue-600 p-3 rounded-full">{icon}</div>
        <div className="ml-4">
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm text-gray-500">{title}</p>
        </div>
    </div>
);

// --- MAIN DASHBOARD COMPONENT ---

const Dashboard: React.FC = () => {
    const { user, token } = useAuth();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                setError("Authentication token not found.");
                setLoading(false);
                return;
            }
            try {
                const response = await dashboardService.getData(token);
                if (response.success && response.data) {
                    setDashboardData(response.data);
                } else {
                    throw new Error('Failed to fetch or parse dashboard data.');
                }
            } catch (err: any) {
                setError(err.message || 'An unexpected error occurred.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    if (loading) return <div className="flex bg-gray-100"><Sidebar /><Loader /></div>;
    if (error) return <div className="flex bg-gray-100"><Sidebar /><p className="m-auto text-red-500">{error}</p></div>;
    if (!dashboardData) return <div className="flex bg-gray-100"><Sidebar /><p className="m-auto">No data found.</p></div>;

    const { overallStats, totalSalesComparison, leadPipeline, revenueLastSixMonths } = dashboardData;

    return (
        <div className="flex min-h-screen bg-gray-100 pl-10">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                {/* Header Section */}
                <header className="flex justify-between items-center mb-8">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Type to filter..." className="pl-10 pr-4 py-2 w-72 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition">
                            <Upload size={18} />
                            <span>Export</span>
                        </button>
                    </div>
                </header>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <ChartCard title="Monthly Sales Report">
                        <Line data={{
                            labels: totalSalesComparison.labels,
                            datasets: [{
                                label: 'Total Sales', data: totalSalesComparison.values,
                                borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                fill: true, tension: 0.4,
                            }]
                        }} options={{ responsive: true, maintainAspectRatio: false }} />
                    </ChartCard>

                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">Overall Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard title="Queries" value={overallStats.queries} icon={<FileText size={22} />} />
                            <StatCard title="In Progress" value={overallStats.inProgress} icon={<Briefcase size={22} />} />
                            <StatCard title="Clients" value={overallStats.clients} icon={<Users size={22} />} />
                            <StatCard title="Completed" value={overallStats.completed} icon={<CheckCircle size={22} />} />
                        </div>
                    </div>
                    
                    <ChartCard title="Pipeline with Stages">
                        <Doughnut data={{
                            labels: Object.keys(leadPipeline).map(k => k.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())),
                            datasets: [{
                                data: Object.values(leadPipeline),
                                backgroundColor: ['#3B82F6', '#F59E0B', '#10B981'],
                                hoverOffset: 8, borderWidth: 0,
                            }]
                        }} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%' }} />
                    </ChartCard>

                    <ChartCard title="Actual Revenue">
                        <Bar data={{
                            labels: revenueLastSixMonths.labels,
                            datasets: [{
                                label: 'Revenue', data: revenueLastSixMonths.values,
                                backgroundColor: 'rgba(59, 130, 246, 0.6)', borderRadius: 4,
                            }]
                        }} options={{ responsive: true, maintainAspectRatio: false }} />
                    </ChartCard>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
