// components/Modal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
 
  footer?: React.ReactNode | {
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
  // Helper to determine if the footer is the structured object or custom JSX
  const isStructuredFooter = footer && typeof footer === 'object' && !React.isValidElement(footer);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[99] flex items-center bg-black/10 backdrop-blur-sm  justify-center p-4">
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-white/40 backdrop-blur-xl text-midnight-200"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Card */}
          <motion.div
            className={`relative w-full ${sizeClass(size)} mx-auto rounded-2xl
                         backdrop-blur-xl
                        border border-cloud-200/30 dark:border-midnight-700/50
                        shadow-2xl transition-all`}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-cloud-200/30 dark:border-midnight-700/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-midnight-800 dark:text-ivory-100">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-ivory-200 hover:bg-gray-200/40 dark:hover:bg-midnight-700/40 transition"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 text-midnight-700 dark:text-ivory-100">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-gray-200/50 dark:border-midnight-700/50 flex justify-end gap-3">
                {isStructuredFooter ? (
                  <>
                    <button
                      onClick={(footer as any).onCancel || onClose}
                      className="px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition"
                    >
                      {(footer as any).cancelLabel || 'Cancel'}
                    </button>
                    <button
                      onClick={(footer as any).onConfirm}
                      disabled={(footer as any).confirmDisabled || (footer as any).confirmLoading}
                      className={`px-5 py-2 rounded-xl 
                 border border-cloud-300/40 dark:border-midnight-600/40 
                 text-gray-700 
                 dark:hover:bg-cloud-400/70 bg-midnight-600/70 
                 shadow-md transition
                                  ${(footer as any).confirmDisabled || (footer as any).confirmLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {(footer as any).confirmLoading ? 'Saving...' : (footer as any).confirmLabel || 'Create'}
                    </button>
                  </>
                ) : (
                  
                  footer
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
