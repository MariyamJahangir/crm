import React from "react";
import Select from "react-select";

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: "0.75rem",
    borderColor: state.isFocused ? "#BFC5C7" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(191, 197, 199, 0.58)" : "none",
    padding: "2px 6px",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    transition: "all 0.2s ease",
    "&:hover": { borderColor: "#79A1B9" },
    fontSize: "0.875rem",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "rgba(121, 160, 185, 0.5)" : "transparent",
    color: state.isSelected ? "#0284c7" : "#1e293b",
    borderRadius: "0.5rem",
    padding: "8px 12px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontSize: "0.875rem",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "0.75rem",
    boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(8px)",
    overflow: "hidden",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#1e293b",
    fontWeight: "400",
    fontSize: "0.875rem",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    fontWeight: "400",
    fontSize: "0.875rem",
  }),
};

const CustomSelect = ({ label, options, value, onChange, placeholder = "Select..." }) => {
  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-midnight-800 dark:text-ivory-200 mb-2">
          {label}
        </label>
      )}
      <Select
        options={options}
        value={options.find((opt) => opt.value === value) || null}
        onChange={(opt) => onChange(opt?.value || "")}
        styles={customSelectStyles}
        placeholder={placeholder}
        className="w-full"
        // isOptionDisabled={(option) => option.isDisabled}
      />
    </div>
  );
};

export default CustomSelect;
