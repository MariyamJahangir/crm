import React from 'react';
import Slider from 'react-slick';
import { MemberTargetAchievement } from '../services/dashboardService';
import MemberTargetGauge from './MemberTargetGauge';

// Import slick carousel styles
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

interface TargetAchievementSliderProps {
    data: MemberTargetAchievement[];
}

const TargetAchievementSlider: React.FC<TargetAchievementSliderProps> = ({ data }) => {
    const settings = {
        dots: true,
        infinite: data.length > 3,
        speed: 500,
        slidesToShow: Math.min(3, data.length),
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 4000,
        pauseOnHover: true,
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: Math.min(2, data.length),
                }
            },
            {
                breakpoint: 600,
                settings: {
                    slidesToShow: 1,
                }
            }
        ]
    };
    
    if (data.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-lg text-center">
                 <h3 className="text-lg font-bold text-gray-800 mb-2">Member Target Achievement</h3>
                 <p className="text-gray-500">No target data available for this month.</p>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg">
             <h3 className="text-lg font-bold text-gray-800 mb-4">Member Target Achievement (This Month)</h3>
            <Slider {...settings}>
                {data.map((member, index) => (
                    <div key={index} className="px-2">
                        <MemberTargetGauge
                            name={member.name}
                            achieved={member.achieved}
                            target={member.target}
                        />
                    </div>
                ))}
            </Slider>
        </div>
    );
};

export default TargetAchievementSlider;
