import { api } from './api';

// Type definitions for clarity
export interface GridLayouts {
  [breakpoint: string]: any[];
}

export interface LayoutResponse {
  success: boolean;
  layout: GridLayouts | null;
}

export interface SaveResponse {
  success: boolean;
  message: string;
}

export const layoutService = {
  /**
   * Fetches the saved dashboard layout from the backend.
   * @param {string | null | undefined} token - The user's authentication token.
   */
  getLayout: (token?: string | null) =>
    api.get<LayoutResponse>('/layout',token),

  /**
   * Saves the dashboard layout to the backend.
   * @param {string} token - The user's authentication token.
   * @param {GridLayouts} layout - The layout object to save.
   */
  saveLayout: (token: string, layout: GridLayouts) =>
    api.put<SaveResponse>('/layout', layout,token),
};
