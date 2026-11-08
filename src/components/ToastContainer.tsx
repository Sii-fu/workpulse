import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-lg shadow-lg border border-[var(--border-control)] bg-[var(--bg-app)] text-[var(--text-main)] text-sm transition-all transform translate-y-0"
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-danger shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-info shrink-0" />}
            <span className="font-medium text-xs md:text-sm">{toast.message}</span>
          </div>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className="shrink-0 px-2 py-1 rounded text-xs font-bold text-[var(--accent-text)] hover:underline cursor-pointer"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
