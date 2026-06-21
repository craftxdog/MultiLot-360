import { randomUUID } from 'crypto';

const sanitizePathSegment = (value: string): string =>
  value
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '-'))
    .join('/');

export function buildKey(originalName: string, folder?: string): string {
  const safeName = sanitizePathSegment(originalName);
  const key = `${randomUUID()}-${safeName}`;
  const safeFolder = folder ? sanitizePathSegment(folder) : undefined;

  return safeFolder ? `${safeFolder}/${key}` : key;
}
