import React, { useState, useEffect, useRef } from 'react';
import { defaultProject } from '../utils/projects';
import { localDateStr, localTimeStr } from '../utils/dates';
import { downscaleImage } from '../utils/image';
import { Project, TaskStatus, WorkLog, ThemeId } from '../types';
import {
  saveActiveDraft,
  loadActiveDraft,
  clearActiveDraft,
} from '../utils/storage';
import {
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Flame,
  Clock,
  X,
  Check,
  FolderPlus,
  Terminal,
  CornerDownLeft,
  Zap,
} from 'lucide-react';

interface DailyLoggerProps {
  projects: Project[];
  availableTags: string[];
  activeTheme?: ThemeId;
  prefillData?: { description: string; projectId: string; status?: TaskStatus } | null;
  onClearPrefill?: () => void;
  editingLog?: WorkLog | null;
  onUpdateLog?: (id: string, data: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onCancelEdit?: () => void;
  onAddLog: (log: Omit<WorkLog, 'id' | 'createdAt'>) => void;
  onAddProject: (name: string, color: string) => void;
  onAddTag: (tag: string) => void;
}

const PRESET_DURATIONS = [
  { label: '15m', mins: 15 },
  { label: '30m', mins: 30 },
  { label: '45m', mins: 45 },
  { label: '1h', mins: 60 },
  { label: '1.5h', mins: 90 },
  { label: '2h', mins: 120 },
];

export const DailyLogger: React.FC<DailyLoggerProps> = ({
  projects,
  availableTags,
  activeTheme,
  prefillData,
  onClearPrefill,
  editingLog,
  onUpdateLog,
  onCancelEdit,
  onAddLog,
  onAddProject,
  onAddTag,
}) => {
  const today = localDateStr();
  const nowTime = localTimeStr();

  const [date, setDate] = useState<string>(today);
  const dateTouched = useRef(false); // true once the user picked a date by hand
  const [time, setTime] = useState<string>(nowTime);
  const [projectId, setProjectId] = useState<string>(defaultProject(projects)?.id || '');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('completed');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [energyRating, setEnergyRating] = useState<number>(4);

  // Accordion & Modals
  const [showAdditional, setShowAdditional] = useState<boolean>(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectColor, setNewProjectColor] = useState<string>('#6366f1');
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [showNewTagInput, setShowNewTagInput] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the date on "today" if the app stays open past midnight, unless the user chose one (B8).
  useEffect(() => {
    if (!dateTouched.current) setDate(today);
  }, [today]);

  // Load draft on mount
  useEffect(() => {
    const draft = loadActiveDraft();
    if (draft) {
      if (draft.description) setDescription(draft.description);
      if (draft.projectId) setProjectId(draft.projectId);
      if (draft.status) setStatus(draft.status);
      if (draft.tags) setSelectedTags(draft.tags);
      if (draft.linkUrl) setLinkUrl(draft.linkUrl);
      if (draft.durationMinutes) setDurationMinutes(draft.durationMinutes);
      if (draft.energyRating) setEnergyRating(draft.energyRating);
      // Only restore a draft's date if it is still today: an old draft must not file today's work under an old date (B8).
      if (draft.date && draft.date === localDateStr()) setDate(draft.date);
    } else if (defaultProject(projects)?.id) {
      setProjectId(defaultProject(projects)!.id);
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (editingLog) return; // editing an existing log must not overwrite the saved draft
    if (description.trim().length > 0 || linkUrl.trim().length > 0) {
      saveActiveDraft({
        description,
        projectId,
        status,
        tags: selectedTags,
        linkUrl,
        durationMinutes,
        energyRating,
        date,
      });
    }
  }, [description, projectId, status, selectedTags, linkUrl, durationMinutes, energyRating, date, editingLog]);

  // Load a log into the form when the user clicks Edit on it (U5)
  useEffect(() => {
    if (!editingLog) return;
    dateTouched.current = true;
    setDescription(editingLog.description);
    setProjectId(editingLog.projectId);
    setStatus(editingLog.status);
    setSelectedTags(editingLog.tags);
    setLinkUrl(editingLog.linkUrl || '');
    setImageBase64(editingLog.imageBase64 || '');
    setDurationMinutes(editingLog.durationMinutes || 0);
    setEnergyRating(editingLog.energyRating || 4);
    setDate(editingLog.date);
    setTime(editingLog.time);
    setShowAdditional(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [editingLog]);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(defaultProject(projects)!.id);
    }
  }, [projects, projectId]);

  // Handle prefilled task data from "Log with Details"
  useEffect(() => {
    if (prefillData) {
      if (prefillData.description) setDescription(prefillData.description);
      if (prefillData.projectId) setProjectId(prefillData.projectId);
      if (prefillData.status) setStatus(prefillData.status);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [prefillData]);

  const activeProject = projects.find((p) => p.id === projectId) || defaultProject(projects);

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = newTagInput.trim();
    if (!cleaned) return;
    if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
    onAddTag(cleaned);
    if (!selectedTags.includes(cleaned)) {
      setSelectedTags([...selectedTags, cleaned]);
    }
    setNewTagInput('');
    setShowNewTagInput(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    downscaleImage(file)
      .then((dataUrl) => setImageBase64(dataUrl))
      .catch((err) => {
        alert(err instanceof Error ? err.message : 'Could not load that image.');
        e.target.value = '';
      });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!description.trim()) {
      textareaRef.current?.focus();
      return;
    }

    const payload = {
      date,
      time: time || localTimeStr(),
      projectId: activeProject?.id || 'default',
      projectName: activeProject?.name || 'General',
      description: description.trim(),
      status,
      tags: selectedTags,
      linkUrl: linkUrl.trim() || undefined,
      imageBase64: imageBase64 || undefined,
      durationMinutes: durationMinutes || undefined,
      energyRating,
    };

    if (editingLog && onUpdateLog) {
      onUpdateLog(editingLog.id, payload);
      onCancelEdit?.();
    } else {
      onAddLog(payload);
      clearActiveDraft();
    }

    setDescription('');
    setLinkUrl('');
    setImageBase64('');
    setSelectedTags([]);
    // Back to today after each submit (B8)
    dateTouched.current = false;
    setDate(localDateStr());
    setTime(localTimeStr());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onAddProject(newProjectName.trim(), newProjectColor);
    setNewProjectName('');
    setShowNewProjectModal(false);
  };

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const charCount = description.length;

  return (
    <div className="glass-panel p-4 sm:p-5 transition-all">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-app)] pb-3">
          
          {/* Project selector with color indicator */}
          <div className="flex items-center gap-2">
            {activeTheme === 'matrix' ? (
              <span className="font-mono text-xs text-[var(--accent-text)] font-bold">[PROJ]:</span>
            ) : (
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Project:
              </span>
            )}
            
            <div className="flex items-center gap-1.5">
              <div className="relative flex items-center">
                <span
                  className="w-2.5 h-2.5 rounded-full absolute left-2.5 pointer-events-none"
                  style={{ backgroundColor: activeProject?.color || '#6366f1' }}
                />
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="bg-[var(--bg-subtle)] border border-[var(--border-app)] text-[var(--text-main)] text-xs sm:text-sm font-semibold rounded-[var(--radius-btn)] pl-7 pr-3 py-1.5 focus:outline-hidden focus:border-[var(--border-focus)] transition-colors cursor-pointer"
                >
                  {projects
                    .filter((p) => !p.isArchived)
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-[var(--bg-surface)]">
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] transition-colors cursor-pointer"
                title="Create New Project"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Date & Time Picker */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                dateTouched.current = true;
                setDate(e.target.value);
              }}
              className="bg-[var(--bg-subtle)] border border-[var(--border-app)] text-[var(--text-main)] rounded-[var(--radius-btn)] px-2 py-1 text-xs focus:outline-hidden cursor-pointer"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-[var(--bg-subtle)] border border-[var(--border-app)] text-[var(--text-main)] rounded-[var(--radius-btn)] px-2 py-1 text-xs focus:outline-hidden cursor-pointer"
            />
          </div>
        </div>

        {/* Textarea with Theme-Specific Chrome */}
        <div className="relative">
          {editingLog && (
            <div className="mb-2 p-2 rounded-[var(--radius-btn)] bg-warning/10 border border-warning/40 text-xs text-[var(--text-main)] flex items-center justify-between gap-2">
              <span className="font-medium">
                <span className="text-warning font-bold">Editing log</span> from {editingLog.date} {editingLog.time}: change it below and save.
              </span>
              <button
                type="button"
                onClick={() => {
                  onCancelEdit?.();
                  setDescription('');
                  setLinkUrl('');
                  setImageBase64('');
                  setSelectedTags([]);
                  dateTouched.current = false;
                  setDate(localDateStr());
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] underline cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          {prefillData && !editingLog && (
            <div className="mb-2 p-2 rounded-[var(--radius-btn)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--text-main)] flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="w-3.5 h-3.5 text-[var(--accent-text)] fill-current shrink-0" />
                <span className="text-[var(--accent-text)] font-bold">Pre-filled from Planned Task:</span>
                <span className="truncate max-w-[280px] sm:max-w-md italic">{prefillData.description}</span>
              </span>
              {onClearPrefill && (
                <button
                  type="button"
                  onClick={onClearPrefill}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] underline cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {activeTheme === 'matrix' && (
            <div className="font-mono text-[11px] text-[var(--accent-text)] mb-1 flex items-center gap-1 opacity-80">
              <span>$ workpulse log --input &gt;</span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTheme === 'matrix'
                ? 'ENTER LOG DATA (CTRL+ENTER TO COMMIT)...'
                : 'What did you accomplish or work on? Use markdown, paste PR links, or write bullets... (Ctrl + Enter to log)'
            }
            rows={3}
            className={`w-full bg-[var(--bg-subtle)]/70 focus:bg-[var(--bg-surface)] border border-[var(--border-app)] focus:border-[var(--border-focus)] rounded-[var(--radius-card)] p-3 text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-hidden transition-all resize-y leading-relaxed ${
              activeTheme === 'modern' ? 'shadow-inner' : ''
            }`}
          />

          {/* Live Character & Word Count */}
          <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-app)] font-mono text-[10px]">
                Ctrl + Enter
              </kbd>
              <span>to commit</span>
            </span>
            <span className="font-mono tabular-nums opacity-90">
              {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} chars
            </span>
          </div>
        </div>

        {/* Status Selector & Categories */}
        <div className="space-y-2.5">
          {/* Status Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">Status:</span>
            
            <button
              type="button"
              onClick={() => setStatus('completed')}
              className={`px-3 py-1 rounded-[var(--radius-btn)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                status === 'completed'
                  ? 'bg-success-solid text-white shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-app)]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Completed</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('in_progress')}
              className={`px-3 py-1 rounded-[var(--radius-btn)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                status === 'in_progress'
                  ? 'bg-info-solid text-white shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-app)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>In Progress</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('blocked')}
              className={`px-3 py-1 rounded-[var(--radius-btn)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                status === 'blocked'
                  ? 'bg-danger-solid text-white shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-app)]'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              <span>Blocked</span>
            </button>
          </div>

          {/* Tags List */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">Tags:</span>
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`text-xs px-2.5 py-0.5 rounded-[var(--radius-btn)] transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] font-medium shadow-xs'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-app)]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}

            {/* Quick add custom tag */}
            {showNewTagInput ? (
              <form onSubmit={handleAddNewTag} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="#tag"
                  className="w-20 px-1.5 py-0.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] text-[var(--text-main)] focus:outline-hidden"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-xs px-1.5 py-0.5 bg-[var(--accent)] text-[var(--on-accent)] rounded cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTagInput(false)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] px-1 cursor-pointer"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewTagInput(true)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] px-2 py-0.5 rounded-[var(--radius-btn)] border border-dashed border-[var(--border-app)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                title="Add custom tag"
              >
                + Tag
              </button>
            )}
          </div>
        </div>

        {/* Links & Screenshot Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex items-center gap-2 bg-[var(--bg-subtle)]/70 border border-[var(--border-app)] rounded-[var(--radius-btn)] px-3 py-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Attach URL (PR, Jira, Figma, Docs)"
              className="w-full bg-transparent text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between gap-2 bg-[var(--bg-subtle)]/70 border border-[var(--border-app)] rounded-[var(--radius-btn)] px-3 py-1.5">
            <div className="flex items-center gap-2 overflow-hidden">
              <ImageIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="text-xs text-[var(--text-muted)] truncate">
                {imageBase64 ? 'Proof Screenshot Attached' : 'Attach Screenshot / Proof'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-2.5 py-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-surface)] border border-[var(--border-app)] hover:border-[var(--accent)] text-[var(--text-main)] transition-colors cursor-pointer font-medium"
              >
                {imageBase64 ? 'Replace' : 'Upload'}
              </button>
              {imageBase64 && (
                <button
                  type="button"
                  onClick={() => setImageBase64('')}
                  className="text-danger hover:text-danger p-0.5 cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Thumbnail Preview */}
        {imageBase64 && (
          <div className="flex items-center gap-3 p-2 bg-[var(--bg-subtle)] rounded-[var(--radius-btn)] border border-[var(--border-app)]">
            <img
              src={imageBase64}
              alt="Proof of Work Thumbnail"
              className="w-12 h-12 object-cover rounded-[var(--radius-btn)] border border-[var(--border-app)]"
            />
            <div className="text-xs">
              <p className="font-semibold text-[var(--text-main)]">Screenshot Attached</p>
              <p className="text-[var(--text-muted)]">Click on the feed thumbnail anytime to expand in full-screen.</p>
            </div>
          </div>
        )}

        {/* Collapsible Additional Details */}
        <div className="border-t border-[var(--border-app)] pt-2">
          <button
            type="button"
            onClick={() => setShowAdditional(!showAdditional)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            {showAdditional ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showAdditional ? 'Hide Additional Details' : '+ Additional Details (Duration, Energy / Focus)'}</span>
          </button>

          {showAdditional && (
            <div className="mt-2.5 p-3 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)]/50 border border-[var(--border-app)] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  Time Spent:
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_DURATIONS.map((preset) => (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => setDurationMinutes(preset.mins)}
                      className={`text-xs px-2.5 py-1 rounded-[var(--radius-btn)] transition-all cursor-pointer ${
                        durationMinutes === preset.mins
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] font-semibold'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-app)] text-[var(--text-main)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-2">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={durationMinutes || ''}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-[var(--radius-btn)] text-[var(--text-main)] font-mono text-center focus:outline-hidden"
                    />
                    <span className="text-xs text-[var(--text-muted)]">mins</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Focus / Energy Level:
                  </label>
                  <span className="text-xs font-medium text-[var(--text-main)] font-mono">
                    {energyRating === 5
                      ? 'Peak Flow'
                      : energyRating === 4
                      ? 'High Focus'
                      : energyRating === 3
                      ? 'Steady'
                      : energyRating === 2
                      ? 'Low'
                      : 'Drained'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEnergyRating(lvl)}
                      className={`p-1.5 rounded transition-transform cursor-pointer ${
                        energyRating >= lvl
                          ? 'text-warning hover:scale-110'
                          : 'text-[var(--text-subtle)] opacity-70 hover:opacity-100 hover:text-warning'
                      }`}
                      title={`Rating ${lvl} of 5`}
                    >
                      <Flame className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-[var(--text-muted)] font-mono">
            Target: <span className="font-semibold text-[var(--text-main)]">{activeProject?.name}</span>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-xs sm:text-sm font-semibold shadow-md shadow-[var(--accent-glow)] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{editingLog ? 'Save changes' : 'Commit Work Log'}</span>
            <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
          </button>
        </div>

      </form>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="glass-panel p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-main)]">Add New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Infrastructure Modernization"
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-[var(--bg-subtle)] border border-[var(--border-app)] rounded-[var(--radius-btn)] text-[var(--text-main)] focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Color Marker</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newProjectColor}
                    onChange={(e) => setNewProjectColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-[var(--text-muted)]">{newProjectColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--accent)] text-[var(--on-accent)] rounded-[var(--radius-btn)] hover:bg-[var(--accent-hover)] cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
