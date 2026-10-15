export function recoveredPartCopy(type: string, brand: string, model: string, variant: string) {
  const detail = variant.trim().replace(/\s+/gu, ' ');
  return {
    title: `${type} · ${brand} ${model}${detail ? ` · ${detail}` : ''} · Recuperado`,
    description: `${type} recuperado de ${brand} ${model}.${detail ? ` Variante: ${detail}.` : ''} Consultá la condición indicada en esta ficha.`,
  };
}
