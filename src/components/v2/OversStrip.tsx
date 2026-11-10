import React from 'react';
import type { Ball, Over } from '../../utils/segments';
import { localTimeStr } from '../../utils/dates';

const SLOT_MS = 10 * 60_000;
const hhmm = (ms: number) => localTimeStr(new Date(ms));

const ballTitle = (over: Over, i: number, ball: Ball): string => {
  const from = over.startMs + i * SLOT_MS;
  const span = `${hhmm(from)} to ${hhmm(from + SLOT_MS)}`;
  if (ball.kind === 'project') return `${span} · ${ball.projectName}`;
  if (ball.kind === 'now') return `${span} · now`;
  return `${span} · not tracked`;
};

const BALL = 'block size-3.5 rounded-full border-[1.5px]';

// The workday as overs of six 10-minute balls. Each ball takes the colour of the project tracked in it.
export const OversStrip: React.FC<{ overs: Over[] }> = ({ overs }) => {
  const balls = overs.flatMap((o) => o.balls);
  const nowIdx = balls.findIndex((b) => b.kind === 'now');
  const elapsedHours = Math.floor((nowIdx < 0 ? balls.length : nowIdx) / 6);
  const tracked = balls.filter((b) => b.kind === 'project').length;
  const summary = `${elapsedHours} of ${overs.length} hours, ${tracked} of ${balls.length} ten-minute slots tracked`;

  return (
    <div role="img" aria-label={summary} className="flex items-end gap-3.5">
      {overs.map((over) => (
        <div key={over.startMs} className="flex flex-col items-center gap-1.5">
          <div className="grid grid-cols-[repeat(3,14px)] gap-1">
            {over.balls.map((ball, i) => {
              const title = ballTitle(over, i, ball);
              if (ball.kind === 'project') {
                return (
                  <span
                    key={i}
                    title={title}
                    className={BALL}
                    style={{ backgroundColor: ball.color, borderColor: ball.color }}
                  />
                );
              }
              if (ball.kind === 'now') {
                return (
                  <span
                    key={i}
                    title={title}
                    className={`${BALL} v2-ball-now bg-[var(--accent)] border-[var(--accent)]`}
                  />
                );
              }
              return (
                <span
                  key={i}
                  title={title}
                  className={`${BALL} border-[color-mix(in_srgb,var(--band-ink)_35%,transparent)]`}
                />
              );
            })}
          </div>
          <span className="num text-[length:var(--fs-small)] leading-none text-[var(--band-muted)]">{over.label}</span>
        </div>
      ))}
    </div>
  );
};
