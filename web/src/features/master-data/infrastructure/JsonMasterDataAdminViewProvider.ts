import rawViews from './master-data-admin.view.json';
import type { MasterDataAdminViewProvider } from '../application/master-data.contracts';
import type { MasterDataAdminViewDto, MasterDataAdminViewKind, MasterDataAdminViewsDto } from '../application/master-data-admin.dto';

const viewKinds: readonly MasterDataAdminViewKind[] = ['brands', 'deviceModels', 'categories'];

export class JsonMasterDataAdminViewProvider implements MasterDataAdminViewProvider {
  private readonly views: MasterDataAdminViewsDto;

  constructor() {
    this.views = rawViews as MasterDataAdminViewsDto;
    this.validateViews(this.views);
  }

  getViews(): MasterDataAdminViewsDto {
    return this.views;
  }

  getView(kind: MasterDataAdminViewKind): MasterDataAdminViewDto {
    return this.views[kind];
  }

  private validateViews(views: MasterDataAdminViewsDto): void {
    for (const kind of viewKinds) {
      const view = views[kind];
      if (!view || view.kind !== kind) throw new Error(`Master data admin view ${kind} is missing or mismatched.`);
      if (!view.title || !view.description || !view.breadcrumbs.length || !view.columns.length) throw new Error(`Master data admin view ${kind} is incomplete.`);
      const columnIds = new Set(view.columns.map((column) => column.id));
      if (columnIds.size !== view.columns.length) throw new Error(`Master data admin view ${kind} has duplicated columns.`);
    }
  }
}
