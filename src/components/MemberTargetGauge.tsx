import React from 'react';
import GaugeChart from 'react-gauge-chart';

interface MemberTargetGaugeProps {
    name: string;
    achieved: number;
    target: number;
}

const MemberTargetGauge: React.FC<MemberTargetGaugeProps> = ({ name, achieved, target }) => {
    const percent = target > 0 ? achieved / target : 0;
    
    const formatValue = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    };

    return (
        <div className="text-center p-4 bg-white rounded-2xl shadow-lg w-full">
            <h4 className="text-md font-bold text-gray-700 truncate">{name}</h4>
            <GaugeChart
                id={`gauge-chart-${name.replace(/\s/g, '')}`}
                nrOfLevels={20}
                colors={["#EA4228", "#F5CD19", "#5BE12C"]}
                arcWidth={0.3}
                percent={percent > 1 ? 1 : percent}
                textColor="#333"
                needleColor="#DB2777"
                needleBaseColor="#F472B6"
                hideText={false}
                formatTextValue={() => `${(percent * 100).toFixed(1)}%`}
            />
            <div className="mt-2 text-sm">
                <p className="font-semibold text-gray-600">
                    <span className="text-green-600">{formatValue(achieved)}</span> / <span className="text-gray-800">{formatValue(target)}</span>
                </p>
            </div>
        </div>
    );
};

export default MemberTargetGauge;
