import React from 'react';
import { Bar } from 'react-chartjs-2';
import { ChartData as ChartJsChartData, TooltipItem } from 'chart.js';
import { ChartData, AdminChartData } from '../services/dashboardService';

const RevenueChart: React.FC<{ data: ChartData | AdminChartData, isAdmin: boolean }> = ({ data, isAdmin }) => {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        callbacks: {
          label: function(context: TooltipItem<'bar'>) { // FIXED: Added TooltipItem type
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
            return label;
          }
        }
      },
    },
    scales: {
      x: {
        stacked: isAdmin,
      },
      y: {
        stacked: isAdmin,
        beginAtZero: true,
        ticks: {
          callback: function(value: string | number) { // FIXED: Added type for value
            return '$' + (Number(value) / 1000) + 'k';
          }
        }
      }
    },
  };

  const chartData: ChartJsChartData<'bar'> = isAdmin 
    ? data as AdminChartData
    : {
        labels: data.labels,
        datasets: [{
            label: 'Monthly Revenue',
            data: (data as ChartData).values,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            borderRadius: 5,
        }],
    };

  return <Bar data={chartData} options={chartOptions} />;
};

export default RevenueChart;
