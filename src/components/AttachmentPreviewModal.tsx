import React, { useState } from 'react';
import { X, Download, File, ImageOff, FileSpreadsheet } from 'lucide-react';

interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  attachment: Attachment | null;
}

// Helper function to categorize file types for previewing
const getPreviewType = (mimeType: string): 'image' | 'pdf' | 'excel' | 'other' => {
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if ([
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ].includes(mimeType)) {
    return 'excel';
  }
  return 'other';
};

const AttachmentPreviewModal: React.FC<Props> = ({ open, onClose, attachment }) => {
  const [imgError, setImgError] = useState(false);

  if (!open || !attachment) return null;

  const previewType = getPreviewType(attachment.mimeType);

  const renderPreview = () => {
    switch (previewType) {
      case 'image':
        if (imgError) {
          return (
            <div className="flex flex-col items-center justify-center text-center">
              <ImageOff size={64} className="text-red-400" />
              <p className="mt-4 text-lg text-midnight-700 dark:text-ivory-300">
                Image could not be loaded.
              </p>
            </div>
          );
        }
        return (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full h-auto mx-auto rounded-md"
            onError={() => setImgError(true)}
          />
        );

      case 'pdf':
        return (
          <iframe
            src={attachment.url}
            className="w-full h-[70vh]"
            title={attachment.name}
            frameBorder="0"
          />
        );

      case 'excel':
        return (
          <div className="flex flex-col items-center justify-center text-center">
            <FileSpreadsheet size={64} className="text-green-500" />
            <p className="mt-4 text-lg text-midnight-700 dark:text-ivory-300">
              Preview is not available for Excel files.
            </p>
            <p className="text-sm text-gray-500">Please download to view.</p>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center text-center">
            <File size={64} className="text-gray-400" />
            <p className="mt-4 text-lg text-midnight-700 dark:text-ivory-300">
              No preview available for this file type.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-midnight-800 rounded-xl shadow-2xl w-full max-w-4xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 ..."><X size={24} /></button>
        <h2 className="text-xl font-bold ...">{attachment.name}</h2>
        
        <div className="my-4 border rounded-lg max-h-[75vh] min-h-[40vh] overflow-auto flex items-center justify-center">
          {renderPreview()}
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="...">Close</button>
          <a href={attachment.url} download={attachment.name} target="_blank" rel="noopener noreferrer" className="...">
            <Download size={18} /> Download
          </a>
        </div>
      </div>
    </div>
  );
};

export default AttachmentPreviewModal;
