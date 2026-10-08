import type {
  MasterDataBrandDto,
  MasterDataCatalogDto,
  MasterDataCategoryDto,
  MasterDataColorDto,
  MasterDataConditionDto,
  MasterDataDeviceModelDto,
  MasterDataRamCapacityDto,
  MasterDataSparePartTypeDto,
  MasterDataStorageCapacityDto,
} from './master-data.dto';
import type { MasterDataAdminViewDto, MasterDataAdminViewKind, MasterDataAdminViewsDto } from './master-data-admin.dto';

export type MasterDataKind = 'brands' | 'deviceModels' | 'categories' | 'colors' | 'storageCapacities' | 'ramCapacities' | 'conditions' | 'sparePartTypes';

export interface MasterDataGateway {
  fetchCatalog(): Promise<MasterDataCatalogDto>;
  create<T>(kind: MasterDataKind, payload: object): Promise<T>;
  update<T>(kind: MasterDataKind, id: string, payload: object): Promise<T>;
  delete(kind: MasterDataKind, id: string): Promise<void>;
}

export interface MasterDataProvider {
  getCatalog(): MasterDataCatalogDto;
  getBrands(): readonly MasterDataBrandDto[];
  getDeviceModels(): readonly MasterDataDeviceModelDto[];
  getCategories(): readonly MasterDataCategoryDto[];
  getColors(): readonly MasterDataColorDto[];
  getStorageCapacities(): readonly MasterDataStorageCapacityDto[];
  getRamCapacities(): readonly MasterDataRamCapacityDto[];
  getConditions(): readonly MasterDataConditionDto[];
  getSparePartTypes(): readonly MasterDataSparePartTypeDto[];
}

export interface MasterDataAdminViewProvider {
  getViews(): MasterDataAdminViewsDto;
  getView(kind: MasterDataAdminViewKind): MasterDataAdminViewDto;
}
