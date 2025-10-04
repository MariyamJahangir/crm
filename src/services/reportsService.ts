import { api } from './api';

// --- API Parameter and Filter Interfaces ---

/**
 * Defines the structure for a single filter criterion sent to the API.
 */
export interface Filter {
  field: string;
  include?: string[];
  exclude?: string[];
}

/**
 * Defines the complete set of parameters for a lead report API request.
 */
export interface ReportParams {
  dateFilter?: string;
  customStartDate?: string;
  customEndDate?: string;
  filters?: Filter[];
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  groupBy?: string;
}

// --- API Response Data Interfaces ---

/**
 * Represents a single row of data in a standard (non-grouped) lead report.
 */
export interface LeadReportRow {
  companyName: string;
  uniqueNumber: string;
  country: string | null;
  salesmanName: string | null;
  closingDate: string;
  stage: string;
  forecastCategory: string;
  quoteValue: number | null;
  gpAmount: number | null;
  gpPercentage: number | null;
  createdAt: string;
}

/**
 * Represents a row of data when the report is grouped by a specific field.
 */
export interface GroupedReportRow {
  groupName: string;
  leadCount: number;
  totalQuoteValue: number;
  totalGpAmount: number;
}

/**
 * Defines the structure for the summary statistics block.
 */
export interface ReportTotalStats {
  totalLeads: number;
  totalQuoteValue: number;
  totalGpAmount: number;
}

// --- Top-Level API Response Interfaces ---

/**
 * Defines the structure for the API response when fetching a lead report.
 */
export interface LeadReportResponse {
  success: boolean;
  results: LeadReportRow[] | GroupedReportRow[];
  totalStats?: ReportTotalStats;
  isGrouped: boolean;
  groupBy?: string;
  message?: string;
}

/**
 * Defines the structure for the API response when fetching filter dropdown options.
 */
export interface FilterOptionsResponse {
  success: boolean;
  salesmen: { id: string; name: string }[];
  countries: string[];
  stages: string[];
  forecasts: string[];
  message?: string;
}

// --- Component Prop Interfaces ---

/**
 * Defines the props for the MultiSelectDropdown component.
 */
export interface MultiSelectDropdownProps {
  title: string;
  options: (string | { id: string; name: string })[];
  selected: string[];
  onChange: (newSelection: string[]) => void;
}

// --- Service Definition (Corrected) ---

export const reportsService = {
  /**
   * Fetches the lead report from the API, now requiring a token.
   */
  getLeadReport: (params: ReportParams, token: string): Promise<LeadReportResponse> => {
    return api.post('/reports/leads', params, token);
  },

  /**
   * Fetches the available options for report filters, now requiring a token.
   */
  getFilterOptions: (token: string): Promise<FilterOptionsResponse> => {
    return api.get('/reports/filter-options', token);
  },
};
