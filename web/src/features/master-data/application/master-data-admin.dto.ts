export type MasterDataAdminViewKind = 'brands' | 'deviceModels' | 'categories';

export interface MasterDataAdminColumnDto {
  id: string;
  header: string;
}

export interface MasterDataAdminViewDto {
  kind: MasterDataAdminViewKind;
  title: string;
  description: string;
  breadcrumbs: readonly string[];
  searchLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  columns: readonly MasterDataAdminColumnDto[];
}

export interface MasterDataAdminViewsDto {
  brands: MasterDataAdminViewDto;
  deviceModels: MasterDataAdminViewDto;
  categories: MasterDataAdminViewDto;
}
