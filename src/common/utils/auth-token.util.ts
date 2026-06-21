import { IncomingHttpHeaders } from 'http';
import {
  AUTHORIZATION_HEADER,
  BEARER_TOKEN_PREFIX,
} from '../constants/auth.constant';

const getHeaderValue = (
  headers: IncomingHttpHeaders,
  key: string,
): string | undefined => {
  const value: unknown = headers[key];

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
};

export const extractBearerToken = (request: {
  headers: IncomingHttpHeaders;
}): string | undefined => {
  const authorization = getHeaderValue(request.headers, AUTHORIZATION_HEADER);

  if (!authorization?.startsWith(BEARER_TOKEN_PREFIX)) {
    return undefined;
  }

  return authorization.slice(BEARER_TOKEN_PREFIX.length).trim();
};
