import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installOfflineFetch, flushOfflineQueue } from './utils/offlineSync';

installOfflineFetch();

if (navigator.onLine) void flushOfflineQueue();

createRoot(document.getElementById('root')!).render(<App />);
