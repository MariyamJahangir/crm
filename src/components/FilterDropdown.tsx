import React, { useState, useRef, useEffect } from 'react';

// Defines a generic filter object that can be used across different pages
export interface Filter {
  type: string; // The key for the filter, e.g., 'Industry'
  label: string; // The display name for the filter pill, e.g., 'Industry'
  values: string[]; // The selected values for the filter
}

interface FilterDropdownProps {
  // A map of filter types (keys) to their available string options (values)
  options: Record<string, string[]>;
  // The array of currently applied filters
  appliedFilters: Filter[];
  // Callback function to update the filters in the parent component
  onApplyFilters: (filters: Filter[]) => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ options, appliedFilters, onApplyFilters }) => {
  const [isOpen, setIsOpen] = useState(false);
  // The currently active tab in the dropdown (e.g., 'Industry', 'Category')
  const [currentTab, setCurrentTab] = useState<string>(Object.keys(options)[0]);
  // The values selected in the current tab's checkbox list
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Effect to close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When a tab is clicked, update the current view and load existing selections
  const openTab = (tab: string) => {
    setCurrentTab(tab);
    const existingFilter = appliedFilters.find(f => f.type === tab);
    setSelectedValues(existingFilter?.values || []);
  };

  // Toggles a checkbox option on or off
  const toggleOption = (option: string) => {
    setSelectedValues(prev =>
      prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option]
    );
  };

  // Applies the filters for the current tab and closes the dropdown
  const handleApply = () => {
    // Remove the old filter for the current tab to avoid duplicates
    let newFilters = appliedFilters.filter(f => f.type !== currentTab);
    // Add the new selection back if any values are selected
    if (selectedValues.length > 0) {
      newFilters.push({
        type: currentTab,
        label: currentTab, // Use the tab name as the label
        values: selectedValues
      });
    }
    onApplyFilters(newFilters);
    setIsOpen(false);
  };

  // Removes an entire filter pill when the 'x' is clicked
  const handleRemoveFilter = (type: string) => {
    onApplyFilters(appliedFilters.filter(f => f.type !== type));
  };

  return (
    <div className="w-full">
      <div className="relative inline-block text-left" ref={ref}>
        {/* The main "Filter" button that toggles the dropdown */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              // Default to the first tab when opening
              openTab(Object.keys(options)[0]);
            }
          }}
          className="border rounded-lg px-4 py-2 bg-white text-gray-700 shadow-sm"
        >
          Filter
        </button>

        {/* The dropdown menu */}
        {isOpen && (
          <div className="origin-top-left absolute left-0 mt-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
            <div className="flex border-b">
              {Object.keys(options).map(tab => (
                <button
                  key={tab}
                  onClick={() => openTab(tab)}
                  className={`flex-1 px-4 py-2 text-sm capitalize ${currentTab === tab ? 'font-bold border-b-2 border-blue-600' : 'text-gray-600'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="max-h-60 overflow-y-auto p-2">
              {(options[currentTab] || []).map(option => (
                <div key={option} className="flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer" onClick={() => toggleOption(option)}>
                  <input type="checkbox" className="mr-2 h-4 w-4" checked={selectedValues.includes(option)} readOnly />
                  <span className="text-sm">{option}</span>
                </div>
              ))}
            </div>

            <div className="border-t px-4 py-3">
              <button onClick={handleApply} className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-blue-700">
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Display applied filters as pills below the button */}
      <div className="flex flex-wrap gap-2 mt-4">
        {appliedFilters.map(filter => (
          <div key={filter.type} className="flex items-center bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm">
            <span className="font-semibold mr-1">{filter.label}:</span>
            <span>{filter.values.join(', ')}</span>
            <button onClick={() => handleRemoveFilter(filter.type)} className="ml-2 font-bold text-blue-600 hover:text-blue-900">&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterDropdown;
