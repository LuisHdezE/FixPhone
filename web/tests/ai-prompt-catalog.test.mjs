import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('AI prompt catalog page does not include editable code on creation and presents automatic generation notice', () => {
  const pageSource = read('../src/features/prompts/presentation/AiPromptCatalogPage.tsx');
  const gatewaySource = read('../src/features/prompts/infrastructure/aiPromptCatalogGateway.ts');

  // Verify creation form does NOT render an editable code field
  assert.doesNotMatch(pageSource, /<input[^>]*name="code"/i);
  assert.match(pageSource, /Se generará automáticamente \(PROMPT-xxxx\)/);
  assert.match(pageSource, /Los códigos se generan automáticamente \(PROMPT-xxxx\)/);

  // In edition, code is readOnly / disabled
  assert.match(pageSource, /modal\.prompt\.code/);
  assert.match(pageSource, /disabled value=\{modal\.prompt\.code\} readOnly/);

  // Table columns include Código, Descripción, Versión, Estado, Acciones
  assert.match(pageSource, /<th[^>]*>Código<\/th>/);
  assert.match(pageSource, /<th[^>]*>Descripción<\/th>/);
  assert.match(pageSource, /<th[^>]*>Versión<\/th>/);
  assert.match(pageSource, /<th[^>]*>Estado<\/th>/);
  assert.match(pageSource, /<th[^>]*>Acciones<\/th>/);

  // Active and archived status badges
  assert.match(pageSource, /Activo/);
  assert.match(pageSource, /Archivado/);

  // Version input and initial value
  assert.match(pageSource, /version: '1\.0'/);
  assert.match(pageSource, /placeholder="1\.0"/);

  // Gateway input type does not require code
  assert.match(gatewaySource, /export type AiPromptInput = \{ description: string; content: string; version\?: string \};/);
  assert.doesNotMatch(gatewaySource, /export type AiPromptInput = \{ code: string;/);
});

test('AI prompt catalog provides explicit Nueva versión action and modal distinct from Edit and Create', () => {
  const pageSource = read('../src/features/prompts/presentation/AiPromptCatalogPage.tsx');
  const gatewaySource = read('../src/features/prompts/infrastructure/aiPromptCatalogGateway.ts');

  // 1. "Nueva versión" action exists on prompt rows
  assert.match(pageSource, /name=\{'Nueva versión de ' \+ prompt\.code\}/);
  assert.match(pageSource, /selectPrompt\(prompt\.code, 'new_version'\)/);

  // 2. Preloads description and content from prompt, resets version for input
  assert.match(pageSource, /if \(kind === 'new_version'\) setForm\(\{ description: prompt\.description, version: '', content: prompt\.content \}\)/);

  // 3. Modal shows read-only code, visible current version, and editable new version
  assert.match(pageSource, /disabled value=\{modal\.prompt\.code\} readOnly title="El código es inmutable"/);
  assert.match(pageSource, /disabled value=\{'v' \+ modal\.prompt\.version\} readOnly title="Versión actualmente vigente"/);
  assert.match(pageSource, /Nueva versión/);
  assert.match(pageSource, /placeholder="Ej\. 2\.0"/);

  // 4. Informs user that current version will be preserved in history
  assert.match(pageSource, /Se conservará la versión actual \(v\{modal\.prompt\.version\}\) en el historial/);

  // 5. Submit dispatches createAiPromptVersion, NEVER createAiPrompt
  assert.match(pageSource, /await createAiPromptVersion\(\s*modal\.prompt\.code,\s*\{\s*description,\s*content:\s*form\.content,\s*version\s*\},\s*modal\.prompt\.lock_version,\s*\)/);
  assert.match(gatewaySource, /export async function createAiPromptVersion\(/);
  assert.match(gatewaySource, /path\(code\) \+ '\/versions'/);

  // 6. In Edit mode, version is read-only and cannot be altered
  assert.match(pageSource, /disabled value=\{'v' \+ modal\.prompt\.version\} readOnly title="La versión no se modifica al editar\. Usá 'Nueva versión'\."/);

  // 7. Success refreshes catalog and displays version notice
  assert.match(pageSource, /Nueva versión v' \+ result\.version \+ ' creada para ' \+ result\.code/);

  // 8. Errors 409/422 are visible in alert
  assert.match(pageSource, /error \? <p role="alert"/);

  // 9. "Nuevo prompt" remains reserved for creating a new family
  assert.match(pageSource, /\+ Nuevo prompt/);
  assert.match(pageSource, /if \(modal\.kind === 'create'\) \{[\s\S]*await createAiPrompt\(\{/);
});
