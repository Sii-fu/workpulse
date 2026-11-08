import React from 'react';

// The WorkPulse mark: three ruled lines of a daybook, the first ending in a dot that is "now".
// Drawn in currentColor so every theme tints it with its own accent.
export const LogoMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <path d="M3 6h10M3 12h18M3 18h13" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    <circle cx="19" cy="6" r="2.5" fill="currentColor" />
  </svg>
);
