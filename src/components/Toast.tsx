import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '../lib/store';

export default function Toast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);
  if (!toast) return null;
  const Icon = toast.kind === 'error' ? AlertCircle : toast.kind === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <Icon size={17} />
      <span>{toast.message}</span>
      <button className="toast-close" onClick={hideToast} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
