import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MetricCard, type MetricCardTone } from '@/components/data-display/MetricCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { DeviceDestination } from '../application/devices.dto';
import type { InventoryDemoProvider } from '../application/inventory.contracts';

const metricTone: Record<'success' | 'warning' | 'info' | 'neutral', MetricCardTone> = {
  success: 'positive',
  warning: 'warning',
  info: 'neutral',
  neutral: 'neutral',
};

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function InventoryDeviceEvaluationPage({ provider }: { provider: InventoryDemoProvider }) {
  const view = provider.getDeviceEvaluationView();
  const [destination, setDestination] = useState<DeviceDestination>(view.recommendedDestination);
  const [notes, setNotes] = useState(view.evaluatorNotes);
  const [submitted, setSubmitted] = useState(false);
  const selectedDecision = view.decisions.find((decision) => decision.destination === destination);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return <PageShell breadcrumbs={view.breadcrumbs.map((label) => ({ label }))} description={view.description} title={view.title}>
    <div className="grid gap-4" data-device-evaluation>
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">{view.device.id}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{view.device.manufacturer} {view.device.model}</h2>
            <p className="mt-1 text-sm text-slate-500">{view.device.storage} · {view.device.color}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={optionLabel(view.decisions.map((decision) => ({ value: decision.destination, label: decision.label })), view.device.destination)} tone={view.device.destinationTone} />
            <Link className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900" to="/apps/inventory/devices">{view.backLabel}</Link>
          </div>
        </div>
      </SurfaceCard>

      <section aria-label={view.summaryTitle} className="grid gap-4 md:grid-cols-3">
        {view.metrics.map((metric) => <MetricCard key={metric.id} label={metric.label} note={metric.note} tone={metricTone[metric.tone]} value={metric.value} />)}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-4">
          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">{view.identitySectionTitle}</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-semibold text-slate-500">{view.fields.serialOrImei}</dt><dd className="mt-1 font-mono text-sm text-slate-800">{view.device.serialOrImei}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-semibold text-slate-500">{view.fields.acquisitionSource}</dt><dd className="mt-1 text-sm text-slate-800">{view.device.acquisitionSource}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-semibold text-slate-500">{view.fields.acquisitionCost}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{view.device.acquisitionCost}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-semibold text-slate-500">{view.fields.accountLock}</dt><dd className="mt-1 text-sm text-slate-800">{view.device.accountLock}</dd></div>
            </dl>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">{view.visualSectionTitle}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {view.visualChecks.map((check) => <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3" key={check.id}>
                <div><p className="text-sm font-medium text-slate-800">{check.label}</p><p className="mt-0.5 text-xs text-slate-500">{check.value}</p></div>
                <StatusBadge label={check.value} tone={check.tone} />
              </div>)}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">{view.functionalSectionTitle}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {view.functionalChecks.map((check) => <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3" key={check.id}>
                <div><p className="text-sm font-medium text-slate-800">{check.label}</p><p className="mt-0.5 text-xs text-slate-500">{check.value}</p></div>
                <StatusBadge label={check.value} tone={check.tone} />
              </div>)}
            </div>
          </SurfaceCard>
        </div>

        <aside className="grid content-start gap-4">
          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">{view.commercialSectionTitle}</h2>
            <dl className="mt-4 grid gap-3">
              <div><dt className="text-[11px] font-semibold text-slate-500">{view.fields.estimatedRecoverableValue}</dt><dd className="mt-1 text-xl font-semibold text-slate-950">{view.commercial.estimatedRecoverableValue}</dd></div>
              <div><dt className="text-[11px] font-semibold text-slate-500">{view.fields.estimatedPartsValue}</dt><dd className="mt-1 text-sm text-slate-700">{view.commercial.estimatedPartsValue}</dd></div>
              <div><dt className="text-[11px] font-semibold text-slate-500">{view.fields.estimatedRefurbCost}</dt><dd className="mt-1 text-sm text-slate-700">{view.commercial.estimatedRefurbCost}</dd></div>
            </dl>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{view.commercial.profitabilitySignal}</p>
          </SurfaceCard>

          <form className="grid gap-4" onSubmit={submit}>
            <SurfaceCard>
              <h2 className="text-base font-semibold text-slate-950">{view.decisionSectionTitle}</h2>
              <div className="mt-4 grid gap-4">
                <SelectField id="device-evaluation-destination" label={view.fields.recommendedDestination} onChange={(value) => { setDestination(value as DeviceDestination); setSubmitted(false); }} options={view.decisions.map((decision) => ({ value: decision.destination, label: decision.label }))} value={destination} />
                {selectedDecision ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <StatusBadge label={selectedDecision.label} tone={selectedDecision.tone} />
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedDecision.description}</p>
                </div> : null}
                <TextAreaField id="device-evaluation-notes" label={view.fields.evaluatorNotes} onChange={(value) => { setNotes(value); setSubmitted(false); }} rows={5} value={notes} />
                <p className="text-xs leading-5 text-slate-500">{view.localNotice}</p>
                <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700" type="submit">{view.submitLabel}</button>
              </div>
            </SurfaceCard>
            {submitted ? <SurfaceCard>
              <div role="status" data-device-evaluation-success>
                <p className="text-sm font-semibold text-emerald-700">{view.successTitle}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{view.successMessage}</p>
              </div>
            </SurfaceCard> : null}
          </form>
        </aside>
      </div>
    </div>
  </PageShell>;
}
