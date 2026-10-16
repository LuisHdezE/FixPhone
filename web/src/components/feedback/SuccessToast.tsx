import { useEffect, useState } from 'react';

/** Compact, non-blocking confirmation. Errors must remain in their originating view. */
export function SuccessToast({ message }: { message: string | null | undefined }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[70] w-[min(22rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      <div className="pointer-events-auto flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 shadow-lg">
        <span className="flex-1">{message}</span>
        <button type="button" aria-label="Cerrar notificación" className="rounded px-1 hover:bg-emerald-100 focus-visible:outline-2" onClick={() => setVisible(false)}>×</button>
      </div>
    </div>
  );
}
