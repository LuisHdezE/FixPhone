export type InlineFeedbackTone = 'info' | 'warning' | 'error' | 'neutral';

export type InlineFeedbackProps = {
  title: string;
  message: string;
  tone?: InlineFeedbackTone;
};

const toneClasses: Record<InlineFeedbackTone, string> = {
  info: 'border-brand-100 bg-brand-50/70 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function InlineFeedback({ title, message, tone = 'neutral' }: InlineFeedbackProps) {
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 opacity-80">{message}</p>
    </div>
  );
}
