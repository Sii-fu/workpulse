import React, { useSyncExternalStore } from 'react';
import { BacklogTask } from '../../types';
import { liveSecondsOf, subscribeTimers } from '../../utils/timerStore';
import { formatDigitalTimer } from './helpers';

// The only parts of the Tasks screen that redraw every second: they read the live seconds from the
// timer store instead of from props, so the rest of the screen can stay still.

export const TaskClock: React.FC<{ task: BacklogTask }> = ({ task }) => {
  const seconds = useSyncExternalStore(subscribeTimers, () => liveSecondsOf(task));
  return <>{formatDigitalTimer(seconds)}</>;
};
