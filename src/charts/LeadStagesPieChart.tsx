import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { TooltipItem } from 'chart.js';
import { LeadStagesData } from '../services/dashboardService';

const LeadStagesPieChart: React.FC<{ data: LeadStagesData }> = ({ data }) => {
  const chartData = {
    labels: data.labels,
    datasets: [{
      label: 'Leads',
      data: data.values,
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
      ],
      borderColor: '#fff',
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 20,
          padding: 20,
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'doughnut'>) { // FIXED: Added TooltipItem type
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((acc: number, val: number) => acc + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  return <Doughnut data={chartData} options={chartOptions} />;
};

export default LeadStagesPieChart;
