import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {WidgetApp} from './components/widgets/WidgetApp.tsx';
import './index.css';

// The desktop widget windows load this same page as /?widget=time or /?widget=tasks.
const widget = new URLSearchParams(window.location.search).get('widget');

createRoot(document.getElementById('root')!).render(
  widget === 'time' || widget === 'tasks' ? <WidgetApp kind={widget} /> : <App />,
);
