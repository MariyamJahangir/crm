import React from 'react';
import { Crown } from 'lucide-react';

interface MemberTargetGaugeProps {
    name: string;
    achieved: number;
    target: number;
    isAchieved: boolean; 
}

const MemberTargetGauge: React.FC<MemberTargetGaugeProps> = ({ name, achieved, target, isAchieved }) => {
    const percentage = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
    const strokeDashoffset = 283 - (283 * percentage) / 100;

    const getRingColor = () => {
        if (isAchieved) return 'text-green-500'; 
        if (percentage > 75) return 'text-yellow-500';
        return 'text-indigo-600';
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-md flex flex-col items-center justify-center text-center transition-all duration-300">
            <h4 className="text-lg font-bold text-gray-800 mb-2 truncate w-full">{name}</h4>
            <div className="relative w-36 h-36">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                        className="text-gray-200"
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                        r="45"
                        cx="50"
                        cy="50"
                    />
                    {/* Progress circle */}
                    <circle
                        className={`${getRingColor()} transition-all duration-1000 ease-out`}
                        strokeWidth="10"
                        strokeDasharray="283"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="45"
                        cx="50"
                        cy="50"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isAchieved ? (
                        <Crown className="text-yellow-400 w-8 h-8" />
                    ) : (
                        <span className="text-3xl font-extrabold text-gray-800">{`${Math.round(percentage)}%`}</span>
                    )}
                </div>
            </div>
            {isAchieved ? (
                 <p className="mt-2 text-sm font-bold text-green-600 animate-pulse">Target Achieved!</p>
            ) : (
                <p className="mt-2 text-xs text-gray-800">
                    Achieved: AED {achieved.toLocaleString()} / Target: AED {target.toLocaleString()}
                </p>
            )}
        </div>
    );
};

export default MemberTargetGauge;
