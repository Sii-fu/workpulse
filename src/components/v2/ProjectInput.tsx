import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Project } from '../../types';
import { activeProjectsOf } from '../../utils/projects';
import { applyCompletion, completionState, nextSwatchColor, resolveProject } from '../../utils/projectCompletion';

/**
 * The project the selector shows. `chosenId` is what the user picked in this input; until then the last
 * project used (`lastProjectId`), else the first active one.
 */
export function useProjectChoice(projects: Project[], lastProjectId: string | undefined) {
  const [chosenId, setChosenId] = useState<string | undefined>();
  return { project: resolveProject(projects, chosenId, lastProjectId), setProjectId: setChosenId };
}

export interface ProjectInputProps {
  /** Id of the text field (so an outside label can point at it). */
  id: string;
  /** Accessible name of the field (visually hidden). */
  label: string;
  value: string;
  onChange(value: string): void;
  projects: Project[];
  /** The selected project (from `useProjectChoice`). */
  project: Project | undefined;
  onProjectChange(id: string): void;
  /** Creates a project and returns it, so the selector can switch to it. */
  onCreateProject(name: string, color: string): Project;
  /** Key presses the completion list did not use (Enter to submit, and so on). */
  onKeyDown?(e: React.KeyboardEvent): void;
  /** A textarea: picking writes the full `#Name` into the text and the selector is only the default for untagged lines. */
  multiline?: boolean;
  placeholder?: string;
  describedBy?: string;
  rows?: number;
  /** Marks the field as the one a dialog focuses first. */
  autoFocusMark?: boolean;
  /** Extra controls after the selector (single-line only), such as a Details button. */
  trailing?: React.ReactNode;
}

const CONTROL = 'v2-input text-[length:var(--fs-body)]';

export const ProjectInput: React.FC<ProjectInputProps> = ({
  id,
  label,
  value,
  onChange,
  projects,
  project,
  onProjectChange,
  onCreateProject,
  onKeyDown,
  multiline,
  placeholder,
  describedBy,
  rows = 3,
  autoFocusMark,
  trailing,
}) => {
  const uid = useId();
  const listId = `${uid}-list`;
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  // Escape closes the list for the text it was pressed on; typing on brings it back.
  const [dismissed, setDismissed] = useState<string | null>(null);

  const before = multiline ? value.slice(0, caret) : value;
  const state = completionState(before, projects);
  const open = state.open && dismissed !== before;
  const options: (Project | 'create')[] = state.canCreate ? ['create'] : state.matches;
  const current = Math.min(active, options.length - 1);

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !fieldRef.current) return;
    fieldRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    setCaret(pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  const pick = (opt: Project | 'create') => {
    const picked = opt === 'create' ? onCreateProject(state.query, nextSwatchColor(projects)) : opt;
    if (multiline) {
      const head = applyCompletion(before, picked, 'replace');
      pendingCaret.current = head.length;
      onChange(head + value.slice(caret));
    } else {
      onProjectChange(picked.id);
      onChange(applyCompletion(value, picked, 'remove'));
    }
    setDismissed(null);
    setActive(0);
    fieldRef.current?.focus();
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if (open && options.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((current + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
        return;
      }
      if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        pick(options[current]);
        return;
      }
      if (e.key === 'Escape') {
        // preventDefault also keeps a surrounding dialog from closing on this Escape.
        e.preventDefault();
        setDismissed(before);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const sync = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length);

  const fieldProps = {
    id,
    ref: fieldRef,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCaret(e.target.selectionStart ?? e.target.value.length);
      setActive(0);
      onChange(e.target.value);
    },
    onKeyDown: keyDown,
    onSelect: sync,
    onClick: sync,
    placeholder,
    autoComplete: 'off',
    'aria-label': label,
    'aria-describedby': describedBy,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open ? `${listId}-${current}` : undefined,
  };

  const selector = (
    <div className="relative shrink-0">
      <span
        aria-hidden="true"
        className="v2-ribbon absolute left-2 top-2.5 bottom-2.5 pointer-events-none"
        style={{ backgroundColor: project?.color ?? 'var(--border-control)' }}
      />
      <select
        aria-label={multiline ? 'Project for lines without a #project' : 'Project'}
        value={project?.id ?? ''}
        onChange={(e) => onProjectChange(e.target.value)}
        className={`${CONTROL} h-11 w-full max-w-[10rem] sm:max-w-[12rem] pl-6 pr-2 cursor-pointer`}
      >
        {activeProjectsOf(projects).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {project && project.isArchived && <option value={project.id}>{project.name}</option>}
      </select>
    </div>
  );

  const list = open && (
    <ul
      id={listId}
      role="listbox"
      aria-label="Projects"
      className="mt-1 border border-[var(--border-control)] rounded-[var(--radius-btn)] bg-[var(--bg-surface-elevated)] overflow-hidden"
    >
      {options.map((opt, i) => {
        const on = i === current;
        return (
          <li
            key={opt === 'create' ? 'create' : opt.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={on}
            // Keeps focus in the field; the pick happens on click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(opt)}
            className={`flex items-center gap-3 px-3 min-h-9 pointer-coarse:min-h-11 text-[length:var(--fs-body)] cursor-pointer ${
              on ? 'bg-[var(--bg-subtle-hover)] font-semibold' : ''
            }`}
          >
            {opt === 'create' ? (
              <span className="min-w-0 break-words">
                No project called "{state.query}" — <span className="underline underline-offset-4">Create it</span>
              </span>
            ) : (
              <>
                <span className="v2-ribbon self-stretch my-1.5" style={{ backgroundColor: opt.color }} aria-hidden="true" />
                <span className="min-w-0 break-words">{opt.name}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (multiline) {
    return (
      <div>
        <textarea
          {...fieldProps}
          data-autofocus={autoFocusMark ? '' : undefined}
          rows={rows}
          role="combobox"
          className={`${CONTROL} block w-full px-3 py-2.5 leading-snug resize-y`}
        />
        {list}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[length:var(--fs-small)] text-[var(--text-muted)]">
          <span>Lines without a #project go to</span>
          {selector}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input {...fieldProps} role="combobox" className={`${CONTROL} flex-1 basis-[12rem] min-w-0 h-11 px-3`} />
        {selector}
        {trailing}
      </div>
      {list}
    </div>
  );
};
