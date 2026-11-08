import React, { useState, useEffect } from 'react';
import { localDateStr } from '../utils/dates';
import { WorkLog, ReportFormat, ReportTone } from '../types';
import { generateAiReport } from '../utils/aiGenerator';
import { modelLabel } from '../utils/geminiModels';
import {
  Sparkles,
  Copy,
  ExternalLink,
  MessageSquare,
  X,
  Check,
  Send,
  Loader2,
  FileText,
} from 'lucide-react';

interface AiStandupModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: WorkLog[];
  selectedLogIds: string[];
  geminiApiKey: string;
  defaultRecipientName?: string;
  defaultTone: ReportTone;
  onCopySuccess: () => void;
}

export const AiStandupModal: React.FC<AiStandupModalProps> = ({
  isOpen,
  onClose,
  logs,
  selectedLogIds,
  geminiApiKey,
  defaultRecipientName,
  defaultTone,
  onCopySuccess,
}) => {
  const [format, setFormat] = useState<ReportFormat>('whatsapp');
  const [tone, setTone] = useState<ReportTone>(defaultTone || 'casual');
  const [recipientName, setRecipientName] = useState<string>(defaultRecipientName || '');
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSource, setGenerationSource] = useState<'gemini' | 'template' | null>(null);
  const [aiModel, setAiModel] = useState<string | undefined>(undefined);
  const [aiError, setAiError] = useState<string | null>(null);

  // Active logs to include: if specific logs are selected, use them; otherwise use today's logs
  const todayStr = localDateStr();
  const activeLogs =
    selectedLogIds.length > 0
      ? logs.filter((l) => selectedLogIds.includes(l.id))
      : logs.filter((l) => l.date === todayStr);

  // Trigger initial generation when modal opens; clear everything when it closes so a reopened
  // modal never shows (and lets you copy) an earlier report.
  useEffect(() => {
    if (!isOpen) {
      setGeneratedReport('');
      setGenerationSource(null);
      setAiModel(undefined);
      setAiError(null);
      return;
    }
    if (activeLogs.length > 0) {
      handleGenerate();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    // Nothing to report: do not fall back to older logs, they would be sent as today's work.
    if (activeLogs.length === 0) {
      setGeneratedReport('');
      setGenerationSource(null);
      setAiError(null);
      return;
    }
    setIsGenerating(true);
    setAiError(null);
    try {
      const result = await generateAiReport({
        logs: activeLogs,
        format,
        tone,
        customApiKey: geminiApiKey,
        recipientName: recipientName.trim() || undefined,
      });
      setGeneratedReport(result.text);
      setGenerationSource(result.source);
      setAiModel(result.model);
      setAiError(result.error ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!generatedReport) return;
    try {
      await navigator.clipboard.writeText(generatedReport);
      onCopySuccess();
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!generatedReport) return;
    const encoded = encodeURIComponent(generatedReport);
    window.open(`https://web.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-card)] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-app)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-[var(--accent)] text-[var(--on-accent)] shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">
                AI Standup & Communication Hub
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Transform {activeLogs.length} work log{activeLogs.length === 1 ? '' : 's'} into customized reports using Gemini AI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Controls Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          
          {/* Format Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Target Communication Channel:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('whatsapp')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  format === 'whatsapp'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                    : 'border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>📱</span> WhatsApp to Lead
                </div>
                <p className="text-[11px] opacity-80 mt-1">Concise, mobile-optimized, polite bullets with emoji highlights.</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('slack')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  format === 'slack'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                    : 'border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>💬</span> Slack / Teams Standup
                </div>
                <p className="text-[11px] opacity-80 mt-1">Standard 3-part: Done, In-Progress, and Blockers.</p>
              </button>

              <button
                type="button"
                onClick={() => setFormat('executive')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  format === 'executive'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                    : 'border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>📊</span> Executive Memo
                </div>
                <p className="text-[11px] opacity-80 mt-1">Structured leadership summary with milestone impact & risks.</p>
              </button>
            </div>
          </div>

          {/* Tone Selector & Optional Recipient */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Tone of Voice:
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ReportTone)}
                className="w-full bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--accent)]"
              >
                <option value="casual">Casual & Direct (Team standup)</option>
                <option value="corporate">Formal Corporate (Management)</option>
                <option value="bullet">Brief / Bullet-only (High velocity)</option>
                <option value="client">Client-Facing (Deliverables focus)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                Recipient Name / Title (Optional):
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Sarah, Tech Lead, Team"
                className="w-full bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Regenerate Button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || activeLogs.length === 0}
              className="px-3.5 py-1.5 rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--border-app)] text-[var(--text-main)] text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                  <span>Synthesizing with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Regenerate Report</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Result Output Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold">Generated Message Output (Editable):</span>
              {generationSource && (
                <span className="text-[11px] opacity-75">
                  Powered by {generationSource === 'gemini' ? modelLabel(aiModel) : 'High-Fidelity Smart Template'}
                </span>
              )}
            </div>

            {activeLogs.length === 0 && (
              <div className="text-[11px] px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-[var(--border-app)] bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                No logs for today yet. Add a log, or select logs in the timeline, then reopen the standup.
              </div>
            )}
            {aiError && (
              <div className="text-[11px] px-2.5 py-1.5 rounded-[var(--radius-btn)] border border-warning/40 bg-warning/10 text-warning">
                AI failed: {aiError} Showing template text instead. Check it before sending.
              </div>
            )}

            <textarea
              value={generatedReport}
              onChange={(e) => setGeneratedReport(e.target.value)}
              rows={9}
              className="w-full bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-md p-3 text-xs sm:text-sm text-[var(--text-main)] font-mono leading-relaxed focus:outline-hidden focus:border-[var(--accent)] resize-y"
            />
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-[var(--border-app)] bg-[var(--bg-subtle)]/50">
          <div className="text-xs text-[var(--text-muted)]">
            Ready to send to superiors or paste in standup channels.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToClipboard}
              disabled={!generatedReport}
              className="px-3.5 py-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-app)] hover:border-[var(--accent)] text-[var(--text-main)] text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy to Clipboard</span>
            </button>

            {format === 'whatsapp' && (
              <button
                onClick={handleOpenWhatsApp}
                disabled={!generatedReport}
                className="px-3.5 py-2 rounded-md bg-success-solid hover:bg-success-solid-hover text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in WhatsApp Web</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
