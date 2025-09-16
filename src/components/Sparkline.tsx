// src/components/Sparkline.tsx
import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 30,
  strokeColor = '#10B981', // A nice green color
  strokeWidth = 2,
}) => {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-gray-400">No data</div>;
  }

  const maxVal = Math.max(...data);
  const minVal = Math.min(...data, 0); // Ensure Y-axis starts at 0
  const range = maxVal - minVal;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      // Adjust y-calculation to handle cases where all data points are 0
      const y = height - (range > 0 ? ((d - minVal) / range) * (height - strokeWidth * 2) : height / 2) - strokeWidth;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;
