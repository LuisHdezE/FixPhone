import type { DeviceTier } from './repairQuote.types';

export type RateOption = { id: string; name: string; unitPriceUyu: number };

/** Imported from the customer's standalone calculator (index.zip).
 * These are FixPhone's previous working tariffs, NOT scraped current-market prices.
 * The media-grade charging port value of UYU 100 is retained exactly as supplied
 * and should be reviewed by the owner before routine production quoting.
 */
export const quoteServiceRates: Record<DeviceTier, readonly RateOption[]> = {
  baja: [
    { id: 'low-screen', name: 'Cambio de pantalla', unitPriceUyu: 1200 },
    { id: 'low-battery', name: 'Cambio de batería', unitPriceUyu: 800 },
    { id: 'low-port', name: 'Reparación de puerto de carga', unitPriceUyu: 800 },
    { id: 'low-flex', name: 'Flex de carga', unitPriceUyu: 800 },
    { id: 'low-cover', name: 'Cambio de tapa trasera - hasta el XR', unitPriceUyu: 1500 },
  ],
  media: [
    { id: 'mid-screen', name: 'Cambio de pantalla', unitPriceUyu: 1500 },
    { id: 'mid-battery', name: 'Cambio de batería', unitPriceUyu: 1000 },
    { id: 'mid-port', name: 'Reparación de puerto de carga', unitPriceUyu: 100 },
    { id: 'mid-flex', name: 'Flex de carga', unitPriceUyu: 1500 },
    { id: 'mid-cover', name: 'Cambio de tapa trasera - iPhone 11 al 13', unitPriceUyu: 1800 },
  ],
  alta: [
    { id: 'high-screen', name: 'Cambio de pantalla', unitPriceUyu: 2000 },
    { id: 'high-battery', name: 'Cambio de batería', unitPriceUyu: 1500 },
    { id: 'high-port', name: 'Reparación de puerto de carga', unitPriceUyu: 1300 },
    { id: 'high-flex', name: 'Flex de carga', unitPriceUyu: 1800 },
    { id: 'high-cover', name: 'Cambio de tapa trasera - iPhone 14 en adelante', unitPriceUyu: 2300 },
  ],
};
export const originalCourierUyu = 130;
export const partsMarkupPercent = 20;
