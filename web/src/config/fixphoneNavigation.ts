import type { AppIconName } from '@/components/AppIcon';

export type FixPhoneNavItem = {
  label: string;
  to?: string;
  icon: AppIconName;
  exact?: boolean;
  planned?: boolean;
};

export type FixPhoneNavGroup = {
  label: string;
  items: readonly FixPhoneNavItem[];
};

export const fixPhoneNavigation: readonly FixPhoneNavGroup[] = [
  {
    label: 'Operación',
    items: [
      { label: 'Panel operativo', to: '/apps/inventory/dashboard', icon: 'dashboard', exact: true },
      { label: 'Equipos', to: '/apps/inventory/devices', icon: 'device', exact: true },
      { label: 'Presupuestos', to: '/admin/repair-quotes', icon: 'forms' },
      { label: 'ValuPhone · Tasaciones', to: '/admin/valuations', icon: 'chart' },
      { label: 'Diagnósticos', icon: 'check-circle', planned: true },
      { label: 'Órdenes de reparación', icon: 'wrench', planned: true },
      { label: 'Deshuesado', icon: 'components', planned: true }
    ]
  },
  {
    label: 'Inventario y Ventas',
    items: [
      { label: 'Inventario general', to: '/applications/management/inventory', icon: 'package' },
      { label: 'Clientes', to: '/applications/management/customers', icon: 'user' },
      { label: 'Pedidos', to: '/applications/management/orders', icon: 'table' },
      { label: 'Ventas consignadas', to: '/admin/finance/consignment-sales', icon: 'store' },
      { label: 'Ubicaciones', icon: 'map', planned: true },
      { label: 'Conteos', icon: 'check-circle', planned: true },
      { label: 'Lotes de adquisición', icon: 'layers', planned: true }
    ]
  },
  {
    label: 'Catálogo maestro',
    items: [
      { label: 'Marcas', to: '/admin/master-data/brands', icon: 'tag' },
      { label: 'Modelos', to: '/admin/master-data/device-models', icon: 'device' },
      { label: 'Categorías', to: '/admin/master-data/categories', icon: 'widgets' },
      { label: 'Colores', to: '/admin/master-data/colors', icon: 'palette' },
      { label: 'Almacenamientos', to: '/admin/master-data/storage-capacities', icon: 'hard-drive' },
      { label: 'RAM', to: '/admin/master-data/ram-capacities', icon: 'cpu' },
      { label: 'Condiciones', to: '/admin/master-data/conditions', icon: 'check-circle' },
      { label: 'Tipos de repuesto', to: '/admin/master-data/spare-part-types', icon: 'wrench' },
      { label: 'Catálogo comercial', icon: 'store', planned: true }
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Liquidaciones 50%', to: '/admin/finance/settlements', icon: 'chart' },
      { label: 'Precios de referencia', to: '/admin/reference-prices', icon: 'chart' },
      { label: 'Almacenamiento multimedia', to: '/admin/settings/media-storage', icon: 'pages' },
      { label: 'Configuración', to: '/user/account-settings', icon: 'settings' },
      { label: 'Usuarios y roles', icon: 'user', planned: true },
      { label: 'Gastos', icon: 'table', planned: true },
      { label: 'Rentabilidad', icon: 'chart', planned: true },
      { label: 'Aging inventario', icon: 'chart', planned: true },
      { label: 'Integraciones', icon: 'apps', planned: true },
      { label: 'Reclamos de garantía', icon: 'check-circle', planned: true },
      { label: 'Auditoría', icon: 'document', planned: true }
    ]
  }
] as const;
