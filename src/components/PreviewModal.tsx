import React from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

type Props = {
  open: boolean;
  onClose: () => void;
  html?: string;
  onDownload?: () => Promise<void> | void;
  downloading?: boolean;
  title?: string;
};

const PreviewModal: React.FC<Props> = ({ open, onClose, html, onDownload, downloading, title }) => {
  if (!open) return null;

  // A4 at ~96dpi
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 bg-white/80 dark:bg-midnight-900/80 
                      backdrop-blur-xl border border-cloud-200/40 
                      dark:border-midnight-700/40 
                      rounded-2xl shadow-2xl w-[95vw] max-w-[1100px] 
                      max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-cloud-200/40 dark:border-midnight-700/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">
            {title || 'Quote Preview'}
          </h2>
          <div className="flex items-center gap-2">
            {onDownload && (
              <Button
                variant="secondary"
                onClick={onDownload}
                disabled={!!downloading}
              >
                {downloading ? 'Downloading...' : 'Download PDF'}
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-ivory-200 hover:bg-gray-100/70 dark:hover:bg-midnight-800 transition"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-cloud-50/30 dark:bg-midnight-950/20">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: 'calc(90vh - 120px)' }}
          >
            <div
              className="relative"
              style={{
                transformOrigin: 'top left',
                width: `${A4_WIDTH}px`,
                height: `${A4_HEIGHT}px`,
              }}
            >
              <iframe
                title="Quote Preview"
                style={{
                  width: `${A4_WIDTH}px`,
                  height: `${A4_HEIGHT}px`,
                  border: '1px solid rgba(229,231,235,0.6)',
                  background: '#fff',
                  borderRadius: '0.75rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                srcDoc={html || '<div style="padding:20px;font-family:Arial;color:#555">Loading...</div>'}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cloud-200/40 dark:border-midnight-700/40 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreviewModal;
