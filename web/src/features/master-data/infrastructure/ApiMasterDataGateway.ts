import type { MasterDataCatalogDto } from '../application/master-data.dto';
import type { MasterDataGateway, MasterDataKind } from '../application/master-data.contracts';

type CatalogResponse = {
  data: MasterDataCatalogDto;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Master data request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

export class ApiMasterDataGateway implements MasterDataGateway {
  async fetchCatalog(): Promise<MasterDataCatalogDto> {
    const response = await fetch('/api/v1/admin/master-data', {
      headers: { Accept: 'application/json' },
    });
    const payload = await parseResponse<CatalogResponse>(response);
    return payload.data;
  }

  async create<T>(kind: MasterDataKind, payload: object): Promise<T> {
    const response = await fetch(`/api/v1/admin/master-data/${kind}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseResponse<T>(response);
  }

  async update<T>(kind: MasterDataKind, id: string, payload: object): Promise<T> {
    const response = await fetch(`/api/v1/admin/master-data/${kind}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseResponse<T>(response);
  }

  async delete(kind: MasterDataKind, id: string): Promise<void> {
    const response = await fetch(`/api/v1/admin/master-data/${kind}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Master data delete failed (${response.status}).`);
    }
  }
}
