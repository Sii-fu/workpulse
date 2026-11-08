import React from 'react';
import { Clock, X, ArrowRight } from 'lucide-react';

interface ReminderBannerProps {
  hasLogsToday: boolean;
  isDismissed: boolean;
  onDismiss: () => void;
  onScrollToLogger: () => void;
}

export const ReminderBanner: React.FC<ReminderBannerProps> = ({
  hasLogsToday,
  isDismissed,
  onDismiss,
  onScrollToLogger,
}) => {
  if (hasLogsToday || isDismissed) {
    return null;
  }

  // Check if current hour is 17 (5 PM) or later
  const currentHour = new Date().getHours();
  if (currentHour < 17) {
    return null;
  }

  return (
    <div className="no-print mb-4 p-3.5 rounded-lg border border-warning/40 bg-warning/15 text-warning flex items-center justify-between gap-4 transition-all">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-md bg-warning/20 text-warning">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-warning">
            End of Day Check-in
          </p>
          <p className="text-xs text-warning">
            It is past 5:00 PM and no work logs have been recorded for today yet. Take a moment to log your wins before signing off!
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onScrollToLogger}
          className="px-3 py-1.5 rounded text-xs font-medium bg-warning-solid hover:bg-warning-solid-hover text-white transition-colors flex items-center gap-1.5"
        >
          <span>Log Work</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded text-warning hover:bg-warning/20"
          title="Dismiss reminder"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
