import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartData, ScriptableContext } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface FuturisticBarChartProps {
    data: ChartData<'bar'>;
    title: string;
}

const FuturisticBarChart: React.FC<FuturisticBarChartProps> = ({ data, title }) => {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: '#A1A1AA',
                    font: {
                        size: 14,
                    }
                }
            },
            title: {
                display: true,
                text: title,
                color: '#E4E4E7',
                font: {
                    size: 18,
                    weight: 'bold',
                }
            },
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: '#A1A1AA',
                },
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                },
                ticks: {
                    color: '#A1A1AA',
                    callback: function(value: any) {
                        return '$' + (value / 1000) + 'k';
                    }
                },
            },
        },
    };

    const enhancedData = {
        ...data,
        datasets: data.datasets.map((ds, i) => {
            const createGradient = (ctx: ScriptableContext<'bar'>) => {
                const chart = ctx.chart;
                const { ctx: chartCtx, chartArea } = chart;
                if (!chartArea) return '#000';
                const gradient = chartCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                gradient.addColorStop(0, `hsla(${200 + i*30}, 90%, 30%, 0.8)`);
                gradient.addColorStop(1, `hsla(${220 + i*30}, 90%, 60%, 0.8)`);
                return gradient;
            };
            return {
                ...ds,
                backgroundColor: createGradient,
                borderColor: `hsla(${220 + i*30}, 90%, 50%, 1)`,
                borderWidth: 2,
                borderRadius: 5,
                hoverBackgroundColor: `hsla(${220 + i*30}, 100%, 70%, 1)`,
            }
        })
    };

    return <Bar options={options} data={enhancedData} />;
};

export default FuturisticBarChart;
