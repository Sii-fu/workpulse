import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Shown while the browser says it has no network. Logging, timers and saving are local and keep
// working; only the AI writer and the Google Sheet wait.
export const OfflineNotice: React.FC = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div
      role="status"
      className="no-print flex items-center gap-2 px-4 py-2 text-xs rounded-[var(--radius-card)] border border-warning/40 bg-warning/15 text-warning"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        You are offline. Logging and timers keep working and are saved on this computer. The AI writer and Google Sheet sync
        wait until you are back online.
      </span>
    </div>
  );
};
