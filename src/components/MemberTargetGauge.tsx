import React, { useEffect, useState } from "react";
import { Crown } from "lucide-react";

interface MemberTargetGaugeProps {
  name: string;
  achieved: number;
  target: number;
  isAchieved: boolean;
}

const CIRCUMFERENCE = 2 * Math.PI * 45; // 2πr for r=45

const MemberTargetGauge: React.FC<MemberTargetGaugeProps> = ({
  name,
  achieved,
  target,
  isAchieved,
}) => {
  const percentage = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [strokeOffset, setStrokeOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const animation = requestAnimationFrame(() => {
      setAnimatedPercent(percentage);
      setStrokeOffset(CIRCUMFERENCE - (CIRCUMFERENCE * percentage) / 100);
    });
    return () => cancelAnimationFrame(animation);
  }, [percentage]);

  return (
    <div className="relative w-[18rem] h-[18rem] bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-indigo-500/30 shadow-lg shadow-indigo-500/20 rounded-2xl p-6 flex flex-col items-center justify-between transform-gpu transition-all duration-500 hover:scale-105 hover:shadow-indigo-400/40">
      <h4 className="text-base font-semibold tracking-wide text-indigo-200 uppercase truncate w-full text-center">
        {name}
      </h4>

      <div className="relative w-[9rem] h-[9rem]">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle className="text-gray-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
          <circle
            className="drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]"
            strokeWidth="10"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            stroke={isAchieved ? "url(#gold-gradient)" : "url(#indigo-gradient)"}
            fill="transparent"
            r="45"
            cx="50"
            cy="50"
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 1.2s ease-out" }}
          />
          <defs>
            <linearGradient id="indigo-gradient" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="gold-gradient" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isAchieved ? (
            <Crown className="text-yellow-400 w-10 h-10 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] animate-pulse" />
          ) : (
            <span className="text-3xl font-bold text-indigo-100 drop-shadow-sm">
              {`${Math.round(animatedPercent)}%`}
            </span>
          )}
        </div>
      </div>

      {isAchieved ? (
        <p className="text-sm font-semibold text-yellow-400 tracking-wide animate-pulse">
          Target Achieved!
        </p>
      ) : (
        <p className="text-xs text-indigo-300">
          <span className="font-semibold text-indigo-200">
            AED {achieved.toLocaleString()}
          </span> / <span className="font-medium text-indigo-400">
            AED {target.toLocaleString()}
          </span>
        </p>
      )}
    </div>
  );
};

export default MemberTargetGauge;