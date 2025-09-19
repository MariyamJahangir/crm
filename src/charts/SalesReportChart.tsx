import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ChartData } from '../services/dashboardService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const SalesReportChart: React.FC<{ data: ChartData }> = ({ data }) => {
  const chartData = {
    labels: data.labels,
    datasets: [{
      label: 'Deals Closed',
      data: data.values,
      fill: false,
      borderColor: 'rgba(75, 192, 192, 1)',
      tension: 0.1,
    }],
  };
  return <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />;
};

export default SalesReportChart;
