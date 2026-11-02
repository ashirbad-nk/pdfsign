import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { useAppStore } from './lib/store';

if (import.meta.env.DEV) {
  (window as unknown as { __pdfsign: typeof useAppStore }).__pdfsign = useAppStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
