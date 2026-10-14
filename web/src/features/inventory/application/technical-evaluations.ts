export const technicalChecks = [
  { key: 'display_touch', label: 'Pantalla y táctil' },
  { key: 'housing', label: 'Chasis y tapa trasera' },
  { key: 'moisture', label: 'Indicadores de humedad' },
  { key: 'battery_charging', label: 'Batería y carga' },
  { key: 'cameras', label: 'Cámaras' },
  { key: 'audio_microphones', label: 'Audio y micrófonos' },
  { key: 'connectivity', label: 'Conectividad' },
  { key: 'biometrics', label: 'Biometría' },
] as const;

export type TechnicalCheckKey = (typeof technicalChecks)[number]['key'];
export type TechnicalCheckResult = 'not_tested' | 'ok' | 'fault' | 'not_applicable';
export type TechnicalOverallResult = 'partial' | 'with_faults' | 'passed';

export type TechnicalCheck = {
  key: TechnicalCheckKey;
  result: TechnicalCheckResult;
  notes: string;
};

export type TechnicalEvaluationInput = {
  request_id: string;
  checks: readonly TechnicalCheck[];
  notes: string;
};

export type TechnicalEvaluation = {
  id: string;
  inventory_item_id: string;
  revision: number;
  device_sku_snapshot: string | null;
  device_title_snapshot: string;
  overall_result: TechnicalOverallResult;
  notes: string | null;
  technician_name: string;
  created_at: string;
  checks: readonly { check_key: TechnicalCheckKey; result: TechnicalCheckResult; notes: string | null }[];
};

export const technicalResultLabels: Record<TechnicalCheckResult, string> = {
  not_tested: 'Sin probar',
  ok: 'Correcto',
  fault: 'Con falla',
  not_applicable: 'No aplica',
};

export const overallResultLabels: Record<TechnicalOverallResult, string> = {
  partial: 'Evaluación parcial',
  with_faults: 'Se detectaron fallas',
  passed: 'Pruebas sin fallas',
};
