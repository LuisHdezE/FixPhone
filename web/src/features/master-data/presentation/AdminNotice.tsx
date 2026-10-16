import { useEffect } from 'react';

export type Notice = { tone: 'success' | 'warning'; message: string } | null;

export function AdminNotice({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [notice, onDismiss]);

  if (!notice) return null;

  if (notice.tone === 'warning') {
    return <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700" role="alert">{notice.message}</div>;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[70] w-[min(22rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      <div className="pointer-events-auto flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 shadow-lg">
        <span className="flex-1">{notice.message}</span>
        <button type="button" aria-label="Cerrar notificación" className="rounded px-1 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={onDismiss}>×</button>
      </div>
    </div>
  );
}
