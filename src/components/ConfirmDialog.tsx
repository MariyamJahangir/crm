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
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="px-5 py-4 border-b">
          <h2 id="confirm-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
        </div>

        <div className="px-5 py-4">
          <p className="text-gray-700">{message}</p>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="danger"
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
