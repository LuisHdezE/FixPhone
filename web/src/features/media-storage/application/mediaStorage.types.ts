export type MediaStorageProvider = 'r2';

export interface MediaStorageProfile {
  id: string;
  name: string;
  provider: MediaStorageProvider;
  bucket: string;
  endpoint_url: string;
  public_base_url: string | null;
  object_prefix: string;
  is_selected: boolean;
  has_credentials: boolean;
  connection_status: 'not_tested';
  updated_at: string | null;
}

export interface MediaStorageProfileInput {
  name: string;
  provider: MediaStorageProvider;
  bucket: string;
  endpoint_url: string;
  public_base_url: string | null;
  object_prefix: string;
  access_key_id?: string;
  secret_access_key?: string;
}
