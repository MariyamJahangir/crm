import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: {
    onCancel?: () => void;
    onConfirm?: () => void;
    cancelLabel?: string;
    confirmLabel?: string;
    confirmDisabled?: boolean;
    confirmLoading?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass = (s?: string) =>
  s === 'lg'
    ? 'max-w-2xl'
    : s === 'sm'
    ? 'max-w-md'
    : 'max-w-xl';

const Modal: React.FC<Props> = ({ open, title, onClose, children, footer, size }) => {
return (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Overlay */}
        <motion.div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Card */}
        <motion.div
          className={`relative w-full ${sizeClass(size)} mx-auto rounded-2xl 
                      bg-cloud-50/30 dark:bg-midnight-900/80 backdrop-blur-xl
                      border border-cloud-200/30 dark:border-midnight-700/50
                      shadow-2xl transition-all`}
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ duration: 0.25 }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-cloud-200/30 dark:border-midnight-700/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-midnight-900 dark:text-ivory-100">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-ivory-200 hover:bg-gray-200/40 dark:hover:bg-midnight-700/40 transition"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 text-midnight-900 dark:text-ivory-100">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-200/50 dark:border-midnight-700/50 flex justify-end gap-3">
              <button
                onClick={footer.onCancel || onClose}
                className="px-4 py-2 rounded-lg border border-gray-300/50 dark:border-midnight-700/50 
                           text-gray-800 dark:text-ivory-200 bg-white/70 dark:bg-midnight-800/70 backdrop-blur-sm
                           hover:text-midnight-900 dark:hover:text-white 
                           hover:border-gray-400 hover:bg-white/90 dark:hover:bg-midnight-700/70
                           shadow-sm hover:shadow-md transition-all"
              >
                {footer.cancelLabel || 'Cancel'}
              </button>

              <button
                onClick={footer.onConfirm}
                disabled={footer.confirmDisabled || footer.confirmLoading}
                className={`px-4 py-2 rounded-lg border border-sky-400/60 text-white
                           bg-sky-500/90 backdrop-blur-sm
                           hover:bg-sky-600
                           shadow-sm hover:shadow-md transition-all
                           ${footer.confirmDisabled || footer.confirmLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {footer.confirmLoading ? 'Saving...' : footer.confirmLabel || 'Create'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

};

export default Modal;
