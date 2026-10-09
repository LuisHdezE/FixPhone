import type { ReactNode } from 'react';

export type AppIconName =
  | 'apps'
  | 'bell'
  | 'book'
  | 'chart'
  | 'chevron-down'
  | 'components'
  | 'dashboard'
  | 'device'
  | 'document'
  | 'edit'
  | 'forms'
  | 'help'
  | 'layers'
  | 'lock'
  | 'map'
  | 'menu'
  | 'palette'
  | 'package'
  | 'pages'
  | 'search'
  | 'store'
  | 'settings'
  | 'table'
  | 'trash'
  | 'user'
  | 'power'
  | 'wrench'
  | 'check-circle'
  | 'widgets';

const iconPaths: Record<AppIconName, ReactNode> = {
  apps: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  book: <path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 2V5Zm16 0a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 2V5Z" />,
  chart: <path d="M4 19V9m5 10V5m5 14v-7m5 7V3" />,
  'chevron-down': <path d="m7 10 5 5 5-5" />,
  components: <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5" />,
  device: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" /></>,
  dashboard: <path d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h7v7H4v-7Zm9-3h7v10h-7V10Z" />,
  document: <path d="M6 2h8l4 4v16H6V2Zm8 0v5h5M9 12h6m-6 4h6" />,
  edit: <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Zm11-13 3 3" />,
  forms: <path d="M5 3h14v18H5V3Zm3 5h8M8 12h8m-8 4h5" />,
  help: <path d="M9.5 9a2.8 2.8 0 1 1 4.7 2c-1.1.9-2.2 1.4-2.2 3m0 4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5" />,
  lock: <path d="M6 10h12v11H6V10Zm3 0V7a3 3 0 0 1 6 0v3" />,
  map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  palette: <path d="M12 3a9 9 0 1 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h2a7 7 0 0 0 0-14h-2Zm-4 6h.01m3-3h.01m4 1h.01m2 4h.01" />,
  package: <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4m-8 4v10" />,
  pages: <path d="M4 4h16v16H4V4Zm0 5h16M9 9v11" />,
  search: <path d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />,
  store: <><path d="M4 10h16l-1-5H5l-1 5Zm1 0v10h14V10" /><path d="M8 14h4v6M4 10a2 2 0 0 0 4 0m0 0a2 2 0 0 0 4 0m0 0a2 2 0 0 0 4 0m0 0a2 2 0 0 0 4 0" /></>,
  settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-3.5 2-1-2-3-2.2.5L15 7l-.2-2.3h-3.6L11 7 9.2 8.5 7 8 5 11l2 1-2 1 2 3 2.2-.5L11 17l.2 2.3h3.6L15 17l1.8-1.5L19 16l2-3-2-1Z" />,
  table: <path d="M3 5h18v14H3V5Zm0 4h18M8 5v14m6-14v14" />,
  trash: <path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
  power: <path d="M12 2v10m6.4-6.4a9 9 0 1 1-12.8 0" />,
  wrench: <path d="M14.5 6.5a4 4 0 0 0-5-4.8l2.4 2.4-2.8 2.8-2.4-2.4a4 4 0 0 0 4.8 5L19 17l-2 2-7.5-7.5a4 4 0 0 1-5-4.8" />,
  'check-circle': <path d="M21 11a9 9 0 1 1-4.9-8M9 11l2 2 7-7" />,
  widgets: <path d="M4 4h7v5H4V4Zm9 0h7v8h-7V4ZM4 11h7v9H4v-9Zm9 3h7v6h-7v-6Z" />,
};

interface AppIconProps {
  name: AppIconName;
  className?: string;
}

export function AppIcon({ name, className = '' }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  );
}
