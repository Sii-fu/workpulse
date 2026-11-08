import React from 'react';
import { sameTasksIgnoringLiveTime } from '../utils/timerStore';
import { TasksProps, useTasksModel } from './tasks/useTasksModel';
import { TasksHeader } from './tasks/TasksHeader';
import { MinimalistTasksView } from './tasks/MinimalistTasksView';
import { CompactTasksView } from './tasks/CompactTasksView';
import { MatrixTasksView } from './tasks/MatrixTasksView';
import { ModernTasksView } from './tasks/ModernTasksView';
import { SelectionFloatingBar } from './tasks/SelectionFloatingBar';

// The Tasks screen: shared state in useTasksModel, a shared header, and one view per theme.
// To change how tasks look in a theme, edit that theme's view; to change what they do, edit the model.
function TasksScreen(props: TasksProps) {
  const m = useTasksModel(props);
  const View =
    props.activeTheme === 'minimalist'
      ? MinimalistTasksView
      : props.activeTheme === 'compact'
      ? CompactTasksView
      : props.activeTheme === 'matrix'
      ? MatrixTasksView
      : ModernTasksView;

  return (
    <div className="space-y-6">
      <TasksHeader m={m} />
      <View m={m} />
      <SelectionFloatingBar m={m} />
    </div>
  );
}

// App re-renders every second while a timer runs. This screen does not need to: its clocks read the
// live seconds themselves (see tasks/Clock.tsx), so it only redraws when something other than a
// running task's elapsed time changes. The handlers it receives must be stable (App wraps them).
export const BacklogSection = React.memo(TasksScreen, (prev, next) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof TasksProps>;
  for (const k of keys) {
    if (k === 'backlog') {
      if (!sameTasksIgnoringLiveTime(prev.backlog, next.backlog)) return false;
    } else if (!Object.is(prev[k], next[k])) {
      return false;
    }
  }
  return true;
});
