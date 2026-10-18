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
