import { BadRequestException } from '@nestjs/common';

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  try {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8'),
    ) as { id?: unknown };

    if (typeof payload.id !== 'string' || payload.id.length === 0) {
      throw new Error('Invalid cursor payload');
    }

    return payload.id;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
