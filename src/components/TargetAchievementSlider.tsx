import React, { useState, useEffect } from 'react';
import { MemberTargetAchievement } from '../services/dashboardService';
import MemberTargetGauge from './MemberTargetGauge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TargetAchievementSliderProps {
    data: MemberTargetAchievement[];
    onEdit: (member: MemberTargetAchievement) => void;
}

const TargetAchievementSlider: React.FC<TargetAchievementSliderProps> = ({ data, onEdit }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const itemsToShow = 3;

    useEffect(() => {
        if (data.length <= itemsToShow) return;

        const timer = setInterval(() => {
            handleNext();
        }, 2000); // Slide every 2 seconds

        return () => clearInterval(timer);
    }, [data.length]);

    const handlePrev = () => {
        setCurrentIndex(prev => (prev - 1 + data.length) % data.length);
    };

    const handleNext = () => {
        setCurrentIndex(prev => (prev + 1) % data.length);
    };
    
    if (!data || data.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Member Target Achievement (This Month)</h3>
                <div className="text-center text-gray-500 py-10">
                    No member target data available for this month.
                </div>
            </div>
        );
    }

    const getVisibleItems = () => {
        const visibleItems = [];
        for (let i = 0; i < itemsToShow; i++) {
            const index = (currentIndex + i) % data.length;
            if (data[index]) {
                visibleItems.push(data[index]);
            }
        }
        return visibleItems;
    };
    
    const visibleData = getVisibleItems();

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Member Target Achievement (This Month)</h3>
            <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {visibleData.map((member, index) => (
                        <div key={`${member.name}-${index}`} onClick={() => onEdit(member)} className="cursor-pointer transition-transform duration-300 hover:scale-105">
                             <MemberTargetGauge
                                name={member.name}
                                achieved={member.achieved}
                                target={member.target}
                                isAchieved={member.isAchieved}
                            />
                        </div>
                    ))}
                </div>
                {data.length > itemsToShow && (
                    <>
                        <button onClick={handlePrev} className="absolute -left-3 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 z-10"><ChevronLeft size={20} /></button>
                        <button onClick={handleNext} className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 z-10"><ChevronRight size={20} /></button>
                    </>
                )}
            </div>
        </div>
    );
};

export default TargetAchievementSlider;
