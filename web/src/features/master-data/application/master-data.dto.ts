export interface MasterDataBrandDto {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataDeviceModelDto {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  modelCode: string | null;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataCategoryDto {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  imageOrIcon: string | null;
  active: boolean;
  showInStorefront: boolean;
  sortOrder: number;
}

export interface MasterDataColorDto {
  id: string;
  name: string;
  slug: string;
  hex: string | null;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataStorageCapacityDto {
  id: string;
  label: string;
  valueGb: number;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataRamCapacityDto {
  id: string;
  label: string;
  valueGb: number;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataConditionDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  grade: string;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataSparePartTypeDto {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  active: boolean;
  sortOrder: number;
}

export interface MasterDataCatalogDto {
  brands: readonly MasterDataBrandDto[];
  deviceModels: readonly MasterDataDeviceModelDto[];
  categories: readonly MasterDataCategoryDto[];
  colors: readonly MasterDataColorDto[];
  storageCapacities: readonly MasterDataStorageCapacityDto[];
  ramCapacities: readonly MasterDataRamCapacityDto[];
  conditions: readonly MasterDataConditionDto[];
  sparePartTypes: readonly MasterDataSparePartTypeDto[];
}
