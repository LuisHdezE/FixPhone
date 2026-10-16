export const editableTechnicalFields = [
  ['display', 'Pantalla'], ['chipset', 'Procesador'], ['wifi', 'Wi-Fi'],
  ['bluetooth', 'Bluetooth'], ['battery', 'Batería'], ['camera', 'Cámaras'],
  ['network', 'Redes'], ['os', 'Sistema operativo'],
] as const;

/** Preserve fields outside this compact form, including structured import data. */
export function technicalSpecsPayload(specs: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...specs };
  for (const [key] of editableTechnicalFields) {
    const value = payload[key];
    if (typeof value === 'string') {
      if (value.trim()) payload[key] = value.trim();
      else delete payload[key];
    }
  }
  return payload;
}
