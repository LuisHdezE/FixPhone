export type PublicPartsDonor = {
  id: string;
  model_name: string;
  title: string;
  category: 'phones_for_parts';
  fault_type: 'icloud' | 'no_signal' | 'board' | 'other';
  fault_label: string;
  screen_condition: 'good' | 'damaged' | 'unknown';
  power_state: 'yes' | 'no' | 'unknown';
  price_minor: number;
  currency_code: 'UYU';
  image_url: string;
  description: string;
  availability: 'available';
  href: string;
};

export const partsDonorPrice = (price: number): string =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(price / 100);
