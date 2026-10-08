import type { MasterDataCatalogDto } from '../application/master-data.dto';
import type { MasterDataGateway, MasterDataKind } from '../application/master-data.contracts';

type CatalogResponse = {
  data: MasterDataCatalogDto;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const bodyText = await response.text();
    let errorMessage = `Master data request failed (${response.status}).`;
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.errors && typeof parsed.errors === 'object') {
        const errorMessages = Object.values(parsed.errors).flat();
        if (errorMessages.length > 0) {
          errorMessage = errorMessages.join(' ');
        } else if (parsed.message) {
          errorMessage = parsed.message;
        }
      } else if (parsed.message) {
        errorMessage = parsed.message;
      }
    } catch {
      if (bodyText) {
        errorMessage = bodyText;
      }
    }
    throw new Error(errorMessage);
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
      const bodyText = await response.text();
      let errorMessage = `Master data delete failed (${response.status}).`;
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed.message) {
          errorMessage = parsed.message;
        }
      } catch {
        if (bodyText) {
          errorMessage = bodyText;
        }
      }
      throw new Error(errorMessage);
    }
  }
}
