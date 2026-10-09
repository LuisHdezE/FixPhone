export type FixPhoneNavItem = {
  label: string;
  to?: string;
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
      { label: 'Panel operativo', to: '/apps/inventory/dashboard' },
      { label: 'Equipos', to: '/apps/inventory/devices' },
      { label: 'Registrar equipo', to: '/apps/inventory/devices/new' },
      { label: 'Presupuestos', to: '/admin/repair-quotes' },
      { label: 'ValuPhone · Tasaciones', to: '/admin/valuations' },
      { label: 'Evaluación', to: '/apps/inventory/devices/evaluation' },
      { label: 'Diagnósticos', planned: true },
      { label: 'Órdenes de reparación', planned: true },
      { label: 'Deshuesado', planned: true }
    ]
  },
  {
    label: 'Inventario',
    items: [
      { label: 'Inventario', to: '/applications/management/inventory' },
      { label: 'Ubicaciones', planned: true },
      { label: 'Conteos', planned: true }
    ]
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', to: '/applications/management/customers' },
      { label: 'Pedidos', to: '/applications/management/orders' },
      { label: 'Lotes de adquisición', planned: true },
      { label: 'Consignaciones', planned: true }
    ]
  },
  {
    label: 'Catálogo maestro',
    items: [
      { label: 'Marcas', to: '/admin/master-data/brands' },
      { label: 'Modelos', to: '/admin/master-data/device-models' },
      { label: 'Categorías', to: '/admin/master-data/categories' },
      { label: 'Colores', to: '/admin/master-data/colors' },
      { label: 'Almacenamientos', to: '/admin/master-data/storage-capacities' },
      { label: 'RAM', to: '/admin/master-data/ram-capacities' },
      { label: 'Condiciones', to: '/admin/master-data/conditions' },
      { label: 'Tipos de repuesto', to: '/admin/master-data/spare-part-types' },
      { label: 'Catálogo comercial', planned: true }
    ]
  },
  {
    label: 'Administración',
    items: [
      { label: 'Usuarios y roles', planned: true },
      { label: 'Gastos', planned: true },
      { label: 'Liquidaciones', planned: true },
      { label: 'Rentabilidad', planned: true },
      { label: 'Aging inventario', planned: true },
      { label: 'Integraciones', planned: true },
      { label: 'Almacenamiento de imágenes', to: '/admin/settings/media-storage' },
      { label: 'Reclamos de garantía', planned: true },
      { label: 'Auditoría', planned: true },
      { label: 'Perfil', to: '/user/profile' },
      { label: 'Configuración', to: '/user/account-settings' }
    ]
  }
] as const;
