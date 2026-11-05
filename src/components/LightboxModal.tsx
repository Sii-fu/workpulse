import React from 'react';
import { X, Download } from 'lucide-react';

interface LightboxModalProps {
  imageBase64: string | null;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  imageBase64,
  onClose,
}) => {
  if (!imageBase64) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageBase64;
    a.download = `workpulse-proof-${Date.now()}.png`;
    a.click();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-lg p-2 shadow-2xl flex flex-col items-center"
      >
        <div className="w-full flex items-center justify-between pb-2 px-2 border-b border-[var(--border-app)] text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-main)]">Attached Proof of Work / Screenshot</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-1 hover:text-[var(--text-main)] rounded transition-colors flex items-center gap-1"
              title="Download image"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:text-[var(--text-main)] rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center">
          <img
            src={imageBase64}
            alt="Expanded Proof of Work"
            className="max-h-[75vh] max-w-full object-contain rounded border border-[var(--border-app)]"
          />
        </div>
      </div>
    </div>
  );
};
