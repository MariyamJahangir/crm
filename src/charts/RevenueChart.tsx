import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { ChartData } from  '../services/dashboardService';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const RevenueChart: React.FC<{ data: ChartData }> = ({ data }) => {
  const chartData = {
    labels: data.labels,
    datasets: [{
      label: 'Monthly Revenue',
      data: data.values,
      backgroundColor: 'rgba(54, 162, 235, 0.7)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }],
  };
  return <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />;
};

export default RevenueChart;
