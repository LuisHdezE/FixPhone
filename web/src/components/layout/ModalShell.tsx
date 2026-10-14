import { useEffect, useRef, type ReactNode } from 'react';

export function ModalShell({
  children,
  title,
  onClose,
  disabled = false,
  density = 'regular',
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  disabled?: boolean;
  density?: 'regular' | 'compact';
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    if (modalRef.current) {
      modalRef.current.focus();
    }

    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, disabled]);

  return (
    <div className={density === 'compact' ? 'fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-2' : 'fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3'} role="dialog" aria-modal="true" aria-label={title}>
      <div 
        ref={modalRef} 
        tabIndex={-1} 
        className={density === 'compact' ? 'w-full max-w-lg overflow-y-auto max-h-[calc(100dvh-1rem)] rounded-md border border-slate-200 bg-white shadow-2xl outline-none' : 'w-full max-w-4xl overflow-y-auto max-h-[90vh] rounded-md border border-slate-200 bg-white shadow-2xl outline-none'}
      >
        <div className={density === 'compact' ? 'sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2' : 'sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3'}>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button 
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={onClose} 
            disabled={disabled}
            type="button"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
