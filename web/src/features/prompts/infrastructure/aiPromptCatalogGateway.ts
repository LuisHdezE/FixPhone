import { adminFetch } from '@/auth/adminApiSession';

export type AiPromptSummary = {
  code: string;
  description: string;
  version: string;
  lock_version: number;
  archived_at: string | null;
  updated_at: string;
};
export type AiPromptDetail = AiPromptSummary & { content: string; id: string };
export type AiPromptRevision = {
  version: number;
  prompt_version?: string;
  description: string;
  action: string;
  actor_id: string | null;
  created_at: string;
};
export type AiPromptList = { data: AiPromptSummary[]; can_manage: boolean };
export type AiPromptInput = { description: string; content: string; version?: string };

async function decode<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = 'No se pudo completar la operación.';
    if (payload && typeof payload === 'object') {
      if ('detail' in payload && typeof payload.detail === 'string') message = payload.detail;
      else if ('message' in payload && typeof payload.message === 'string') message = payload.message;
      if ('errors' in payload && payload.errors && typeof payload.errors === 'object') {
        const errors = Object.values(payload.errors).flatMap((value) => Array.isArray(value) ? value : []);
        if (errors.length) message = errors.map(String).join(' ');
      }
    }
    throw new Error(message + ' (HTTP ' + response.status + ')');
  }
  if (!payload || typeof payload !== 'object') throw new Error('Respuesta vacía del servidor.');
  return payload as T;
}
const json = () => ({ 'Content-Type': 'application/json' } as const);
const path = (code: string) => '/api/v1/admin/ai-prompts/' + encodeURIComponent(code);

export async function listAiPrompts(): Promise<AiPromptList> {
  return decode<AiPromptList>(await adminFetch('/api/v1/admin/ai-prompts'));
}
export async function getAiPrompt(code: string): Promise<AiPromptDetail> {
  return (await decode<{ data: AiPromptDetail }>(await adminFetch(path(code)))).data;
}
export async function getAiPromptHistory(code: string): Promise<AiPromptRevision[]> {
  return (await decode<{ data: AiPromptRevision[] }>(
    await adminFetch(path(code) + '/history'),
  )).data;
}
export async function createAiPrompt(data: AiPromptInput): Promise<AiPromptDetail> {
  return (await decode<{ data: AiPromptDetail }>(await adminFetch('/api/v1/admin/ai-prompts', {
    method: 'POST', headers: json(), body: JSON.stringify(data),
  }))).data;
}
export async function updateAiPrompt(
  code: string,
  data: Pick<AiPromptInput, 'description' | 'content'> & { version?: string },
  expectedVersion: number,
): Promise<AiPromptDetail> {
  return (await decode<{ data: AiPromptDetail }>(await adminFetch(path(code), {
    method: 'PATCH', headers: json(), body: JSON.stringify({ ...data, expected_version: expectedVersion }),
  }))).data;
}
export async function archiveAiPrompt(code: string, expectedVersion: number): Promise<AiPromptDetail> {
  return (await decode<{ data: AiPromptDetail }>(await adminFetch(path(code), {
    method: 'DELETE', headers: json(), body: JSON.stringify({ expected_version: expectedVersion }),
  }))).data;
}
export async function reactivateAiPrompt(code: string, expectedVersion: number): Promise<AiPromptDetail> {
  return (await decode<{ data: AiPromptDetail }>(await adminFetch(path(code) + '/reactivate', {
    method: 'POST', headers: json(), body: JSON.stringify({ expected_version: expectedVersion }),
  }))).data;
}
export async function restoreAiPromptRevision(code: string, version: number, expectedVersion: number): Promise<AiPromptDetail> {
  return (await decode<{ data: AiPromptDetail }>(await adminFetch(
    path(code) + '/revisions/' + version + '/restore', {
      method: 'POST', headers: json(), body: JSON.stringify({ expected_version: expectedVersion }),
    },
  ))).data;
}
