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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Card */}
          <motion.div
            className={`relative w-full ${sizeClass(size)} mx-4 rounded-2xl shadow-2xl
                        bg-white/10 backdrop-blur-2xl border border-white/20
                        shadow-[0_0_25px_rgba(255,255,255,0.15)]
                        hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-all`}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white drop-shadow-sm">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-300 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 text-white">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={footer.onCancel || onClose}
                  className="px-4 py-2 rounded-lg border border-white/30 text-white/80 
                             bg-white/5 backdrop-blur-sm
                             hover:text-white hover:border-white/60
                             hover:bg-white/10
                             hover:shadow-[0_0_12px_rgba(255,255,255,0.5)]
                             transition-all"
                >
                  {footer.cancelLabel || 'Cancel'}
                </button>

                <button
                  onClick={footer.onConfirm}
                  disabled={footer.confirmDisabled || footer.confirmLoading}
                  className={`px-4 py-2 rounded-lg border border-sky-400/40 text-sky-200
                             bg-sky-500/10 backdrop-blur-sm
                             hover:text-white hover:bg-sky-500/20
                             hover:shadow-[0_0_16px_rgba(56,189,248,0.6)]
                             transition-all
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
