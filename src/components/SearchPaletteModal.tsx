import React, { useState, useEffect, useRef } from 'react';
import { WorkLog, Project } from '../types';
import { Search, X, ExternalLink, Calendar, Clock, Image as ImageIcon } from 'lucide-react';

interface SearchPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: WorkLog[];
  projects: Project[];
  onSelectLog: (log: WorkLog) => void;
  onOpenImage: (base64: string) => void;
}

export const SearchPaletteModal: React.FC<SearchPaletteModalProps> = ({
  isOpen,
  onClose,
  logs,
  projects,
  onSelectLog,
  onOpenImage,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = query.trim()
    ? logs.filter((log) => {
        const q = query.toLowerCase();
        return (
          log.description.toLowerCase().includes(q) ||
          log.projectName.toLowerCase().includes(q) ||
          log.tags.some((t) => t.toLowerCase().includes(q)) ||
          (log.linkUrl && log.linkUrl.toLowerCase().includes(q))
        );
      })
    : logs.slice(0, 8); // show recent 8 if no query

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-4 pt-16 sm:pt-24">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 p-3.5 border-b border-[var(--border-app)] bg-[var(--bg-subtle)]/50">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all past work logs, projects, tags, links... (ESC to close)"
            className="flex-1 bg-transparent text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]/60 focus:outline-hidden"
          />
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-[var(--border-app)] flex-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              No matching work logs found for "{query}".
            </div>
          ) : (
            results.map((log) => {
              const project = projects.find((p) => p.id === log.projectId);

              return (
                <div
                  key={log.id}
                  onClick={() => {
                    onSelectLog(log);
                    onClose();
                  }}
                  className="p-3.5 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-[var(--text-main)]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: project?.color || '#6366f1' }}
                      />
                      <span>{log.projectName}</span>
                    </span>
                    <span className="font-mono tabular-nums">{log.date} · {log.time}</span>
                  </div>

                  <p className="text-xs text-[var(--text-main)] line-clamp-2 leading-relaxed">
                    {log.description}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-muted)]">
                    {log.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                    {log.linkUrl && (
                      <span className="flex items-center gap-0.5 text-[var(--accent)]">
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{log.linkUrl}</span>
                      </span>
                    )}
                    {log.imageBase64 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenImage(log.imageBase64!);
                        }}
                        className="flex items-center gap-0.5 hover:text-[var(--accent)]"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Proof</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 border-t border-[var(--border-app)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
          <span>Found {results.length} result{results.length === 1 ? '' : 's'}</span>
          <span className="font-mono">Navigate with click or ESC to dismiss</span>
        </div>

      </div>
    </div>
  );
};
