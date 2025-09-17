import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { LeadStagesData } from '../services/dashboardService';

ChartJS.register(ArcElement, Tooltip, Legend);

const LeadStagesPieChart: React.FC<{ data: LeadStagesData }> = ({ data }) => {
  const chartData = {
    labels: ['Discovery', 'Quote Sent', 'Closed Won', 'Closed Lost'],
    datasets: [{
      label: 'Lead Stages',
      data: [
        data.discovery || 0,
        data.quote_sent || 0,
        data.closed_won || 0,
        data.closed_lost || 0,
      ],
      backgroundColor: [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(255, 99, 132, 0.8)',
      ],
      borderColor: '#fff',
      borderWidth: 2,
    }],
  };
  return <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />;
};

export default LeadStagesPieChart;
