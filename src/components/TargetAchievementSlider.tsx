import React, { useState, useEffect } from 'react';
import { MemberTargetAchievement } from '../services/dashboardService';
import MemberTargetGauge from './MemberTargetGauge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ★ NOTE ★: You must add 'id' to this interface in dashboardService.ts
export interface MemberTargetAchievementWithId extends MemberTargetAchievement {
    id: string; 
}

interface TargetAchievementSliderProps {
    data: MemberTargetAchievementWithId[];
    onEdit: (member: MemberTargetAchievementWithId) => void;
}

const TargetAchievementSlider: React.FC<TargetAchievementSliderProps> = ({ data, onEdit }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const itemsToShow = 5;
    const isSliderActive = data.length > itemsToShow;

    useEffect(() => {
        if (!isSliderActive) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % data.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [data.length, isSliderActive]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + data.length) % data.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % data.length);
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Member Target Achievement (This Month)
        </h3>
        <div className="text-center text-gray-500 py-10">
          No member target data available for this month.
        </div>
      </div>
    );
  }

    const getVisibleItems = () => {
        if (!isSliderActive) return data;
        const visibleItems: MemberTargetAchievementWithId[] = [];
        for (let i = 0; i < itemsToShow; i++) {
            const index = (currentIndex + i) % data.length;
            visibleItems.push(data[index]);
        }
        return visibleItems;
    };
    
    const visibleData = getVisibleItems();

    return (
    <div className="bg-gray-100/50 backdrop-blur-sm border border-gray-200/60 py-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500">
      <h3 className="text-2xl font-bold text-center text-gray-800 tracking-tight">
        Member Target Achievement <span className="text-indigo-600">(This Month)</span>
      </h3>
      <div className="relative flex justify-center items-center h-[400px] max-w-[1200px] mx-auto" style={{ perspective: "1200px" }}>
        {visibleData.map((member, index) => {
          const isCenter = index === 2;
          const isLeft1 = index === 1;
          const isLeft2 = index === 0;
          const isRight1 = index === 3;
          const isRight2 = index === 4;

          const baseClasses = "absolute cursor-pointer transition-all duration-700 ease-in-out transform-gpu";
          let positionClasses = "";
          if (isCenter) positionClasses = "z-30 scale-105 translate-y-0 shadow-2xl rotate-y-0";
          else if (isLeft1) positionClasses = "z-20 scale-95 -translate-x-[12rem] opacity-90 -rotate-y-10";
          else if (isLeft2) positionClasses = "z-10 scale-90 -translate-x-[20rem] opacity-75 -rotate-y-20";
          else if (isRight1) positionClasses = "z-20 scale-95 translate-x-[12rem] opacity-90 rotate-y-10";
          else if (isRight2) positionClasses = "z-10 scale-90 translate-x-[20rem] opacity-75 rotate-y-20";
          
          return (
            <div key={member.id} onClick={() => onEdit(member)} className={`${baseClasses} ${positionClasses}`}>
              <MemberTargetGauge {...member} />
            </div>
          );
        })}
        {isSliderActive && (
          <>
            <button onClick={handlePrev} className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-md border rounded-full p-2 shadow-md hover:bg-gray-100 transition-all duration-300 z-40">
              <ChevronLeft size={20} className="text-indigo-600" />
            </button>
            <button onClick={handleNext} className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-md border rounded-full p-2 shadow-md hover:bg-gray-100 transition-all duration-300 z-40">
              <ChevronRight size={20} className="text-indigo-600" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TargetAchievementSlider;