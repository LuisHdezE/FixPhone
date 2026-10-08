import rawCatalog from './master-data.catalog.json';
import type { MasterDataProvider } from '../application/master-data.contracts';
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
} from '../application/master-data.dto';

function assertUniqueIds(items: readonly { id: string }[], label: string): void {
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error(`Master data ${label} contains duplicated ids.`);
}

function assertRequiredCollection<T>(items: readonly T[], label: string): void {
  if (!items.length) throw new Error(`Master data ${label} collection is empty.`);
}

export class JsonMasterDataProvider implements MasterDataProvider {
  private readonly catalog: MasterDataCatalogDto;

  constructor(catalog: MasterDataCatalogDto = rawCatalog as MasterDataCatalogDto) {
    this.catalog = catalog;
    this.validateCatalog(this.catalog);
  }

  getCatalog(): MasterDataCatalogDto {
    return this.catalog;
  }

  getBrands(): readonly MasterDataBrandDto[] {
    return this.catalog.brands;
  }

  getDeviceModels(): readonly MasterDataDeviceModelDto[] {
    return this.catalog.deviceModels;
  }

  getCategories(): readonly MasterDataCategoryDto[] {
    return this.catalog.categories;
  }

  getColors(): readonly MasterDataColorDto[] {
    return this.catalog.colors;
  }

  getStorageCapacities(): readonly MasterDataStorageCapacityDto[] {
    return this.catalog.storageCapacities;
  }

  getRamCapacities(): readonly MasterDataRamCapacityDto[] {
    return this.catalog.ramCapacities;
  }

  getConditions(): readonly MasterDataConditionDto[] {
    return this.catalog.conditions;
  }

  getSparePartTypes(): readonly MasterDataSparePartTypeDto[] {
    return this.catalog.sparePartTypes;
  }

  private validateCatalog(catalog: MasterDataCatalogDto): void {
    assertRequiredCollection(catalog.brands, 'brands');
    assertRequiredCollection(catalog.deviceModels, 'device models');
    assertRequiredCollection(catalog.categories, 'categories');
    assertRequiredCollection(catalog.colors, 'colors');
    assertRequiredCollection(catalog.storageCapacities, 'storage capacities');
    assertRequiredCollection(catalog.ramCapacities, 'RAM capacities');
    assertRequiredCollection(catalog.conditions, 'conditions');
    assertRequiredCollection(catalog.sparePartTypes, 'spare part types');

    assertUniqueIds(catalog.brands, 'brands');
    assertUniqueIds(catalog.deviceModels, 'device models');
    assertUniqueIds(catalog.categories, 'categories');
    assertUniqueIds(catalog.colors, 'colors');
    assertUniqueIds(catalog.storageCapacities, 'storage capacities');
    assertUniqueIds(catalog.ramCapacities, 'RAM capacities');
    assertUniqueIds(catalog.conditions, 'conditions');
    assertUniqueIds(catalog.sparePartTypes, 'spare part types');

    const brandIds = new Set(catalog.brands.map((brand) => brand.id));
    const categoryIds = new Set(catalog.categories.map((category) => category.id));
    const sparePartTypeIds = new Set(catalog.sparePartTypes.map((type) => type.id));

    for (const model of catalog.deviceModels) {
      if (!brandIds.has(model.brandId)) throw new Error(`Master data device model ${model.id} references an unknown brand.`);
      if (!model.name || !model.slug) throw new Error(`Master data device model ${model.id} is incomplete.`);
    }

    for (const brand of catalog.brands) {
      if (!brand.name || !brand.slug) throw new Error(`Master data brand ${brand.id} is incomplete.`);
    }

    for (const category of catalog.categories) {
      if (!category.name || !category.slug) throw new Error(`Master data category ${category.id} is incomplete.`);
      if (category.parentId && !categoryIds.has(category.parentId)) throw new Error(`Master data category ${category.id} references an unknown parent.`);
    }

    for (const color of catalog.colors) {
      if (!color.name || !color.slug) throw new Error(`Master data color ${color.id} is incomplete.`);
    }

    for (const storage of catalog.storageCapacities) {
      if (!storage.label || storage.valueGb <= 0) throw new Error(`Master data storage capacity ${storage.id} is incomplete.`);
    }

    for (const ram of catalog.ramCapacities) {
      if (!ram.label || ram.valueGb <= 0) throw new Error(`Master data RAM capacity ${ram.id} is incomplete.`);
    }

    for (const condition of catalog.conditions) {
      if (!condition.name || !condition.slug || !condition.grade) throw new Error(`Master data condition ${condition.id} is incomplete.`);
    }

    for (const type of catalog.sparePartTypes) {
      if (!type.name || !type.slug) throw new Error(`Master data spare part type ${type.id} is incomplete.`);
      if (type.parentId && !sparePartTypeIds.has(type.parentId)) throw new Error(`Master data spare part type ${type.id} references an unknown parent.`);
    }
  }
}
