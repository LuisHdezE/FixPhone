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
