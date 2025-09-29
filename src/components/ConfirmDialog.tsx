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
  children?: React.ReactNode; // <-- FIX: Add children prop
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  children, // <-- FIX: Destructure children from props
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cloud-200/30 dark:border-midnight-700/40">
          <h2 className="text-lg font-semibold text-midnight-800 dark:text-ivory-100">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* --- FIX: Render children if they exist, otherwise show the message --- */}
          {children ? (
            <div>{children}</div>
          ) : (
            <p className="text-midnight-700 dark:text-ivory-200">{message}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cloud-200/30 dark:border-midnight-700/40 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            className="px-4 py-2 rounded-xl ..."
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="danger"
            className="px-4 py-2 rounded-xl ..."
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
