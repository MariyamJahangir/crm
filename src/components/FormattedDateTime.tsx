import React from 'react';

interface FormattedDateTimeProps {
  isoString: string;
  className?: string;
}

const FormattedDateTime: React.FC<FormattedDateTimeProps> = ({ isoString, className }) => {
  if (!isoString) {
    return null;
  }

  try {
    const date = new Date(isoString);

    const formattedDate = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // --- MODIFIED ---: Added hour12: true to show AM/PM
    const formattedTime = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, // This ensures AM/PM is displayed
    });

    return (
      <div className={`relative inline-block group ${className}`}>
        {formattedDate}
        <div 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 
                     bg-gray-800 text-white text-xs font-semibold rounded-md shadow-lg 
                     opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                     whitespace-nowrap pointer-events-none"
        >
          {formattedTime}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-[6px] border-t-gray-800"></div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Invalid date string provided to FormattedDateTime:", isoString);
    return null;
  }
};

export default FormattedDateTime;
