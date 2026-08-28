import { useDatasetStore } from '../store';

export function Toast() {
  const toast = useDatasetStore((s) => s.toast);
  const clear = useDatasetStore((s) => s.clearToast);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status" onClick={clear}>
      {toast.message}
    </div>
  );
}
