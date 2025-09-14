import React from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass = (s?: string) => s === 'lg' ? 'max-w-2xl' : s === 'sm' ? 'max-w-md' : 'max-w-xl';

const Modal: React.FC<Props> = ({ open, title, onClose, children, footer, size }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative bg-white w-full ${sizeClass(size)} mx-4 rounded shadow-lg`}>
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
