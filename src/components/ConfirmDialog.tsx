import React from 'react';
import Button from './Button';

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirm Deletion',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Yes, Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
     <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
  >
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
      aria-hidden="true"
    />

    {/* Panel */}
    <div className="relative w-full max-w-md rounded-2xl bg-cloud-50/30 dark:bg-midnight-900/30 
                    backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 
                    shadow-xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cloud-200/30 dark:border-midnight-700/40">
        <h2 id="confirm-title" className="text-lg font-semibold text-midnight-800 dark:text-ivory-100">
          {title}
        </h2>
      </div>

      {/* Body */}
      <div className="px-6 py-4">
        <p className="text-midnight-700 dark:text-ivory-200">{message}</p>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-cloud-200/30 dark:border-midnight-700/40 flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 rounded-xl bg-cloud-100/60 dark:bg-midnight-700/60 
                     border border-cloud-300/40 dark:border-midnight-600/40 
                     text-midnight-700 dark:text-ivory-200 
                     hover:bg-cloud-200/70 dark:hover:bg-midnight-600/70 
                     backdrop-blur-md shadow-md transition"
          onClick={onCancel}
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-600 
                     text-white shadow-lg transition"
          onClick={onConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </div>
  </div>
  );
};

export default ConfirmDialog;
