import React, { useEffect, useState } from "react";
import { Crown } from "lucide-react";

interface MemberTargetGaugeProps {
  name: string;
  achieved: number;
  target: number;
  isAchieved: boolean;
}

const CIRCUMFERENCE = 283; // 2πr for r=45

const MemberTargetGauge: React.FC<MemberTargetGaugeProps> = ({
  name,
  achieved,
  target,
  isAchieved,
}) => {
  const percentage = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;

  // Animation states
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [animatedOffset, setAnimatedOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1200; // ms
    const targetOffset = CIRCUMFERENCE - (CIRCUMFERENCE * percentage) / 100;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);

      setAnimatedPercent(Math.floor(progress * percentage));
      setAnimatedOffset(
        CIRCUMFERENCE - (CIRCUMFERENCE * (progress * percentage)) / 100
      );

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [percentage]);

  return (
    <div
      className="relative w-[18rem] h-[18rem] 
      bg-gradient-to-br from-midnight-800 via-midnight-700 to-midnight-900
      border border-sky-500/30 shadow-lg shadow-sky-500/20 
      rounded-2xl p-6 flex flex-col items-center justify-between
      transform-gpu transition-all duration-500
      hover:scale-105 hover:shadow-sky-400/40"
    >
      {/* Title */}
      <h4 className="text-base font-semibold tracking-wide text-sky-200 uppercase">
        {name}
      </h4>

      {/* Gauge Circle */}
      <div className="relative w-[9rem] h-[9rem]">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Background ring */}
          <circle
            className="text-midnight-600"
            strokeWidth="10"
            stroke="currentColor"
            fill="transparent"
            r="45"
            cx="50"
            cy="50"
          />

          {/* Animated progress ring */}
          <circle
            className="drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
            strokeWidth="10"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animatedOffset}
            strokeLinecap="round"
            stroke={`url(#neon-gradient-${name})`}
            fill="transparent"
            r="45"
            cx="50"
            cy="50"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
              transition: "stroke-dashoffset 0.3s ease-out",
            }}
          />

          {/* Gradient defs */}
          <defs>
            <linearGradient id={`neon-gradient-${name}`} x1="1" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isAchieved ? "#facc15" : "#38bdf8"} // gold or cyan
              />
              <stop
                offset="100%"
                stopColor={isAchieved ? "#d97706" : "#0ea5e9"} // deep gold or blue
              />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isAchieved ? (
            <Crown className="text-yellow-400 w-10 h-10 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)] animate-bounce" />
          ) : (
            <span className="text-3xl font-bold text-sky-100 drop-shadow-sm">
              {`${animatedPercent}%`}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      {isAchieved ? (
        <p className="text-sm font-semibold text-yellow-400 tracking-wide animate-pulse">
          Target Achieved!
        </p>
      ) : (
        <p className="text-xs text-sky-300">
          <span className="font-semibold text-sky-200">
            AED {achieved.toLocaleString()}
          </span>{" "}
          /{" "}
          <span className="font-medium text-sky-400">
            AED {target.toLocaleString()}
          </span>
        </p>
      )}
    </div>
  );
};

export default MemberTargetGauge;
