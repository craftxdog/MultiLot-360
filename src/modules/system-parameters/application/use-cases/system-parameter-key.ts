const SYSTEM_PARAMETER_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.:-]{1,119}$/;

export const normalizeSystemParameterKey = (key: string): string => key.trim();

export const isValidSystemParameterKey = (key: string): boolean =>
  SYSTEM_PARAMETER_KEY_PATTERN.test(key);
