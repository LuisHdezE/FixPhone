import { useState, type FormEvent } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import type { CustomerFormInput, CustomerSummary, CustomersCrudRepository } from './customers.types';

type Props = {
  customer?: CustomerSummary;
  repository: CustomersCrudRepository;
  onClose: () => void;
  onSaved: (message: string) => void;
};

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600';
const fieldClass = 'grid gap-1 text-xs font-semibold text-slate-700';

export function CustomerFormModal({ customer, repository, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CustomerFormInput>({
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    relationshipState: customer?.relationshipState ?? 'active',
    notes: customer?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof CustomerFormInput>(field: K, value: CustomerFormInput[K]) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      setError('Ingresá el nombre del cliente.');
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Ingresá un teléfono o un correo para contactar al cliente.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (customer) {
        await repository.update(customer.id, form);
        onSaved('Cliente actualizado correctamente.');
      } else {
        await repository.create(form);
        onSaved('Cliente registrado correctamente.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los datos.');
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell title={customer ? 'Editar cliente' : 'Registrar cliente'} onClose={onClose} disabled={saving}>
    <form className="grid gap-3 p-4" onSubmit={event => void submit(event)}>
      <p className="text-xs text-slate-500">
        {customer ? 'Actualizá los datos de contacto de este cliente.' : 'Registrá un cliente nuevo en el directorio de FixPhone.'}
        {' '}El nombre y al menos una forma de contacto son obligatorios.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldClass}>Nombre completo
          <input autoComplete="name" className={inputClass} maxLength={255} onChange={e => setField('name', e.target.value)} required value={form.name}/>
        </label>
        <label className={fieldClass}>Teléfono / WhatsApp
          <input autoComplete="tel" className={inputClass} maxLength={60} onChange={e => setField('phone', e.target.value)} type="tel" value={form.phone}/>
        </label>
        <label className={fieldClass}>Correo electrónico
          <input autoComplete="email" className={inputClass} maxLength={255} onChange={e => setField('email', e.target.value)} type="email" value={form.email}/>
        </label>
        <label className={fieldClass}>Estado de relación
          <select className={inputClass} onChange={e => setField('relationshipState', e.target.value as CustomerFormInput['relationshipState'])} value={form.relationshipState}>
            <option value="active">Activo</option>
            <option value="attention">Seguimiento</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </div>
      <label className={fieldClass}>Observaciones
        <textarea className={inputClass} maxLength={4000} onChange={e => setField('notes', e.target.value)} rows={3} value={form.notes}/>
      </label>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={saving} onClick={onClose} type="button">Cancelar</button>
        <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">
          {saving ? 'Guardando…' : customer ? 'Guardar cambios' : 'Registrar'}
        </button>
      </div>
    </form>
  </ModalShell>;
}
