import React, { useId, useSyncExternalStore } from 'react';
import { ActivitySuggestionsPanel, ActivitySuggestionsPanelProps } from '../../activity/ActivitySuggestionsDialog';
import { getActivitySession, subscribeActivitySession } from '../../../utils/activity/sessionStore';
import { localDateStr } from '../../../utils/dates';

export type SuggestionsCardProps = Omit<ActivitySuggestionsPanelProps, 'compact' | 'titleId' | 'headerEnd'>;

/** "Suggested from your activity" on the Today screen: the activity panel in compact mode. */
export const SuggestionsCard: React.FC<SuggestionsCardProps> = (props) => {
  const id = useId();
  const { folders, sources, onOpenSettings } = props;
  const date = props.date ?? localDateStr();
  // The count comes from the day's kept check, so it survives leaving and coming back to Today.
  const session = useSyncExternalStore(subscribeActivitySession, () => getActivitySession(date));
  const pending = session ? session.rows.length : null;

  const sourceNames = [sources.git && 'git', sources.claude && 'Claude Code'].filter(Boolean).join(' + ');

  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="v2-head">
        <span>Suggested from your activity</span>
        {folders.length > 0 && (sourceNames || pending !== null) && (
          <span className="v2-head-meta">
            {sourceNames}
            {sourceNames && pending !== null && ' · '}
            {pending !== null && <span className="num">{pending} new</span>}
          </span>
        )}
      </h2>
      <div className="v2-panel v2-inset py-[var(--row-pad)]">
        {folders.length === 0 ? (
          <p className="text-[length:var(--fs-body)] text-[var(--text-muted)]">
            Choose the folders you work in, and your commits can turn into log lines here.{' '}
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer"
            >
              Set up in Settings
            </button>
          </p>
        ) : (
          <ActivitySuggestionsPanel {...props} date={date} compact />
        )}
      </div>
    </section>
  );
};
