import { randomUUID } from 'crypto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolveRequestId = (
  header: string | string[] | undefined,
): string => {
  const value = Array.isArray(header) ? header[0] : header;

  if (value && UUID_REGEX.test(value)) {
    return value;
  }

  return randomUUID();
};
