import { adminFetch } from '@/auth/adminApiSession';

export type AiPromptSummary = { code: string; description: string; updated_at: string };
export type AiPromptDetail = AiPromptSummary & { content: string };

async function decode<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = 'No se pudo consultar la biblioteca de prompts.';
    if (payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string') {
      message = payload.detail;
    }
    throw new Error(message + ' (HTTP ' + response.status + ')');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('La respuesta del servidor no contiene datos.');
  }
  return (payload as { data: T }).data;
}

export async function listAiPrompts(): Promise<AiPromptSummary[]> {
  return decode<AiPromptSummary[]>(await adminFetch('/api/v1/admin/ai-prompts'));
}

export async function getAiPrompt(code: string): Promise<AiPromptDetail> {
  return decode<AiPromptDetail>(
    await adminFetch('/api/v1/admin/ai-prompts/' + encodeURIComponent(code)),
  );
}
