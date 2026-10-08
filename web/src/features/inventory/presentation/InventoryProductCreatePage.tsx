import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { TextField } from '@/components/forms/TextField';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';

export function InventoryProductCreatePage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    item_type: 'used_phone',
    brand: '',
    model: '',
    description: '',
    operational_status: 'reparado',
    publication_status: 'publicado',
    inventory_purpose: 'sell_as_used_phone',
    is_sellable: 'true',
    stock_quantity: '1',
    cost_amount_minor: '0',
    sale_price_amount_minor: '',
    main_image_url: ''
  });

  const setField = (key: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setSuccess(false);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        ...form,
        is_sellable: form.is_sellable === 'true',
        stock_quantity: parseInt(form.stock_quantity || '0', 10),
        cost_amount_minor: parseInt(form.cost_amount_minor || '0', 10),
        sale_price_amount_minor: form.sale_price_amount_minor ? parseInt(form.sale_price_amount_minor, 10) : null,
        currency_code: 'UYU'
      };

      const res = await fetch('/api/v1/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setSuccess(true);
      setForm({
        title: '',
        item_type: 'used_phone',
        brand: '',
        model: '',
        description: '',
        operational_status: 'reparado',
        publication_status: 'publicado',
        inventory_purpose: 'sell_as_used_phone',
        is_sellable: 'true',
        stock_quantity: '1',
        cost_amount_minor: '0',
        sale_price_amount_minor: '',
        main_image_url: ''
      });
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const itemTypes = [
    { value: 'used_phone', label: 'Teléfono usado' },
    { value: 'spare_part', label: 'Repuesto' },
    { value: 'accessory', label: 'Accesorio' },
    { value: 'device', label: 'Dispositivo genérico' },
    { value: 'service_part', label: 'Insumo de Servicio' }
  ];

  const opStatuses = [
    { value: 'ingresado', label: 'Ingresado' },
    { value: 'diagnostico', label: 'En diagnóstico' },
    { value: 'para_reparar', label: 'Para Reparar' },
    { value: 'en_reparacion', label: 'En reparación' },
    { value: 'reparado', label: 'Reparado' },
    { value: 'para_deshuesar', label: 'Para Deshuesar' },
    { value: 'deshuesado', label: 'Deshuesado' },
    { value: 'en_stock', label: 'En Stock' },
    { value: 'reservado', label: 'Reservado' },
    { value: 'vendido', label: 'Vendido' },
    { value: 'devuelto', label: 'Devuelto' },
    { value: 'descartado', label: 'Descartado' }
  ];

  const pubStatuses = [
    { value: 'no_publicable', label: 'No Publicable' },
    { value: 'borrador', label: 'Borrador' },
    { value: 'publicado', label: 'Publicado' },
    { value: 'pausado', label: 'Pausado' },
    { value: 'vendido', label: 'Vendido (Oculto)' }
  ];

  const purposes = [
    { value: 'sell_as_used_phone', label: 'Vender como Usado' },
    { value: 'sell_as_spare_part', label: 'Vender como Repuesto' },
    { value: 'repair_then_sell', label: 'Reparar y Vender' },
    { value: 'repair_for_customer', label: 'Reparación de cliente' },
    { value: 'parts_donor', label: 'Donante (Deshuese)' },
    { value: 'internal_use', label: 'Uso Interno' },
    { value: 'discard', label: 'Descarte' }
  ];

  return (
    <PageShell breadcrumbs={[{ label: 'Inventario' }, { label: 'Registrar Producto' }]} description="Registra un producto real en la base de datos MySQL." title="Registrar Producto">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <form className="grid gap-4" onSubmit={submit}>
          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">Información principal</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField id="title" label="Título" value={form.title} onChange={v => setField('title', v)} />
              <SelectField id="item_type" label="Tipo de ítem" value={form.item_type} onChange={v => setField('item_type', v)} options={itemTypes} />
              <TextField id="brand" label="Marca" value={form.brand} onChange={v => setField('brand', v)} />
              <TextField id="model" label="Modelo" value={form.model} onChange={v => setField('model', v)} />
              <div className="md:col-span-2">
                <TextAreaField id="description" label="Descripción" value={form.description} onChange={v => setField('description', v)} />
              </div>
              <div className="md:col-span-2">
                <TextField id="main_image_url" label="URL de Imagen Principal" value={form.main_image_url} onChange={v => setField('main_image_url', v)} placeholder="https://..." />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">Estado y propósito</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField id="operational_status" label="Estado Operativo" value={form.operational_status} onChange={v => setField('operational_status', v)} options={opStatuses} />
              <SelectField id="inventory_purpose" label="Propósito en inventario" value={form.inventory_purpose} onChange={v => setField('inventory_purpose', v)} options={purposes} />
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-950">Venta y publicación</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField id="publication_status" label="Estado de publicación" value={form.publication_status} onChange={v => setField('publication_status', v)} options={pubStatuses} />
              <SelectField id="is_sellable" label="¿Es vendible?" value={form.is_sellable} onChange={v => setField('is_sellable', v)} options={[{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }]} />
              <TextField id="stock_quantity" label="Cantidad en Stock" value={form.stock_quantity} onChange={v => setField('stock_quantity', v)} />
              <TextField id="cost_amount_minor" label="Costo (UYU)" value={form.cost_amount_minor} onChange={v => setField('cost_amount_minor', v)} />
              <TextField id="sale_price_amount_minor" label="Precio de Venta (UYU)" value={form.sale_price_amount_minor} onChange={v => setField('sale_price_amount_minor', v)} placeholder="Dejar vacío si no se vende" />
            </div>
          </SurfaceCard>

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50" disabled={loading || !form.title} type="submit">
              {loading ? 'Guardando...' : 'Registrar en inventario'}
            </button>
            <Link className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900" to="/apps/inventory/devices">
              Cancelar
            </Link>
          </div>
        </form>

        <aside className="grid content-start gap-4">
          <SurfaceCard>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">Reglas del Showroom</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Solo los productos marcados como <strong>Publicado</strong>, que sean <strong>Vendibles</strong>, tengan un <strong>Precio de Venta</strong> asignado y <strong>Stock &gt; 0</strong> aparecerán en la tienda pública (Showroom).
            </p>
          </SurfaceCard>

          {error && (
            <SurfaceCard>
              <div role="status">
                <p className="text-sm font-semibold text-red-700">Error</p>
                <p className="mt-1 text-sm text-red-600 break-words">{error}</p>
              </div>
            </SurfaceCard>
          )}

          {success && (
            <SurfaceCard>
              <div role="status">
                <p className="text-sm font-semibold text-emerald-700">¡Producto registrado!</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">El ítem ha sido guardado exitosamente en MySQL.</p>
              </div>
            </SurfaceCard>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
