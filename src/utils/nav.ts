import { Layers, ListTodo, BarChart3, Settings, LucideIcon } from 'lucide-react';
import { AppNavTab } from '../types';

// The four top-level screens, defined once for the desktop top bar and the mobile bottom bar.
// `short` is the label that fits under an icon on a phone.
export const NAV_TABS: { id: AppNavTab; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'feed', label: 'Timeline', short: 'Timeline', icon: Layers },
  { id: 'backlog', label: 'Tasks', short: 'Tasks', icon: ListTodo },
  { id: 'analytics', label: 'Analytics', short: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings },
];
