const SYSTEM_PARAMETER_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.:-]{1,119}$/;

export const normalizeSystemParameterKey = (key: string): string => key.trim();

export const isValidSystemParameterKey = (key: string): boolean =>
  SYSTEM_PARAMETER_KEY_PATTERN.test(key);

const MILESTONE_KEYS = new Set([
  'enabled',
  'thresholdMiles',
  'thresholdSalesCount',
  'sellerTitle',
  'sellerMessage',
  'adminTitle',
  'adminMessage',
]);

export const validateSystemParameterValue = (
  key: string,
  value: string,
): string | undefined => {
  if (key !== 'notifications.sales_milestone') return undefined;

  let config: unknown;
  try {
    config = JSON.parse(value);
  } catch {
    return 'notifications.sales_milestone must be valid JSON';
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return 'notifications.sales_milestone must be a JSON object';
  }

  const record = config as Record<string, unknown>;
  const unknownKey = Object.keys(record).find(
    (candidate) => !MILESTONE_KEYS.has(candidate),
  );
  if (unknownKey) return `Unknown milestone setting: ${unknownKey}`;
  if (record.enabled !== undefined && typeof record.enabled !== 'boolean') {
    return 'Milestone enabled must be boolean';
  }
  for (const threshold of ['thresholdMiles', 'thresholdSalesCount']) {
    const candidate = record[threshold];
    if (
      candidate !== undefined &&
      (typeof candidate !== 'number' ||
        !Number.isFinite(candidate) ||
        candidate <= 0 ||
        (threshold === 'thresholdSalesCount' && !Number.isInteger(candidate)))
    ) {
      return `${threshold} must be a positive number`;
    }
  }
  for (const template of [
    'sellerTitle',
    'sellerMessage',
    'adminTitle',
    'adminMessage',
  ]) {
    const candidate = record[template];
    if (
      candidate !== undefined &&
      (typeof candidate !== 'string' ||
        candidate.trim().length === 0 ||
        candidate.length > 500)
    ) {
      return `${template} must be a non-empty string of at most 500 characters`;
    }
  }
  return undefined;
};
