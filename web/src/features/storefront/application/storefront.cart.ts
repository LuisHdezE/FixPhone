import type { StorefrontCartLineDto } from './storefront.dto';

export type StorefrontCartQuantities = Readonly<Record<string, number>>;

export interface StorefrontInteractiveCartLine {
  line: StorefrontCartLineDto;
  quantity: number;
  lineTotalMinor: number;
}

export interface StorefrontInteractiveCart {
  lines: readonly StorefrontInteractiveCartLine[];
  itemCount: number;
  subtotalMinor: number;
  currencyCode: string | undefined;
  hasMixedCurrencies: boolean;
}

export function getInitialCartQuantities(
  lines: readonly StorefrontCartLineDto[],
): StorefrontCartQuantities {
  return Object.fromEntries(lines.map((line) => [line.id, line.initialQuantity]));
}

export function setCartLineQuantity(
  quantities: StorefrontCartQuantities,
  line: StorefrontCartLineDto,
  nextQuantity: number,
): StorefrontCartQuantities {
  const normalizedQuantity = Math.max(0, Math.min(line.maxQuantity, Math.trunc(nextQuantity)));

  if (normalizedQuantity === 0) {
    return Object.fromEntries(
      Object.entries(quantities).filter(([lineId]) => lineId !== line.id),
    );
  }

  return {
    ...quantities,
    [line.id]: normalizedQuantity,
  };
}

export function deriveStorefrontCart(
  lines: readonly StorefrontCartLineDto[],
  quantities: StorefrontCartQuantities,
): StorefrontInteractiveCart {
  const activeLines = lines
    .filter((line) => (quantities[line.id] ?? 0) > 0)
    .map((line) => {
      const quantity = Math.min(line.maxQuantity, quantities[line.id] ?? line.initialQuantity);
      return {
        line,
        quantity,
        lineTotalMinor: line.unitPriceMinor * quantity,
      };
    });

  const currencies = [...new Set(activeLines.map(({ line }) => line.currencyCode))];

  return {
    lines: activeLines,
    itemCount: activeLines.reduce((sum, item) => sum + item.quantity, 0),
    subtotalMinor: activeLines.reduce((sum, item) => sum + item.lineTotalMinor, 0),
    currencyCode: currencies.length === 1 ? currencies[0] : undefined,
    hasMixedCurrencies: currencies.length > 1,
  };
}

export function formatCartMoney(currencyCode: string, amountMinor: number) {
  const integerAmount = Math.round(amountMinor / 100);
  return `${currencyCode} ${new Intl.NumberFormat('es-UY', {
    maximumFractionDigits: 0,
  }).format(integerAmount)}`;
}
