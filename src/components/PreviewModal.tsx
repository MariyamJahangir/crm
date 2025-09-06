// components/PreviewModal.tsx
import React from 'react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-[1200px] max-h-[90vh] flex flex-col">
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="font-semibold">{title || 'Quote Preview'}</div>
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
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">×</button>
          </div>
        </div>

        {/* Content area that computes scale to fit A4 into available space */}
        <div className="flex-1 overflow-auto p-3">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: 'calc(90vh - 100px)' }} // leave space for header/footer
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
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  borderRadius: 4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
                srcDoc={html || '<div style="padding:20px;font-family:Arial;color:#555">Loading...</div>'}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
