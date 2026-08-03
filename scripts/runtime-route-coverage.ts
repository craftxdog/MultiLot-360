import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Route = {
  method: string;
  path: string;
  key: string;
  matcher: RegExp;
  specificity: number;
};

const collectionPath = join(process.cwd(), 'docs', 'multilot-api.http');

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routeMatcher = (path: string): RegExp => {
  if (path === '/') return /^\/$/;
  const pattern = path
    .split('/')
    .map((segment) =>
      segment.startsWith(':') ? '[^/]+' : escapeRegExp(segment),
    )
    .join('/');
  return new RegExp(`^${pattern}$`);
};

export const expectedRuntimeRoutes = (): Route[] => {
  const collection = readFileSync(collectionPath, 'utf8');
  return [
    ...collection.matchAll(/^# ROUTE: (GET|POST|PUT|PATCH|DELETE) (\/.*)$/gm),
  ]
    .map((match) => {
      const method = match[1];
      const path = match[2];
      return {
        method,
        path,
        key: `${method} ${path}`,
        matcher: routeMatcher(path),
        specificity: path
          .split('/')
          .filter((segment) => segment && !segment.startsWith(':')).length,
      };
    })
    .sort((left, right) => right.specificity - left.specificity);
};

export const recordRuntimeRoute = (
  method: string,
  requestPath: string,
): void => {
  const coverageFile = process.env.API_ROUTE_COVERAGE_FILE;
  if (!coverageFile) return;

  const path = requestPath.split('?')[0] || '/';
  const route = expectedRuntimeRoutes().find(
    (candidate) =>
      candidate.method === method.toUpperCase() && candidate.matcher.test(path),
  );
  if (route) appendFileSync(coverageFile, `${route.key}\n`, 'utf8');
};

export const assertCompleteRuntimeRouteCoverage = (
  coverageFile: string,
): { covered: number; total: number } => {
  const expected = expectedRuntimeRoutes();
  const covered = new Set(
    readFileSync(coverageFile, 'utf8').split(/\r?\n/).filter(Boolean),
  );
  const missing = expected.filter((route) => !covered.has(route.key));
  if (missing.length > 0) {
    throw new Error(
      `Runtime API coverage is missing ${missing.length} route(s):\n${missing
        .map((route) => `- ${route.key}`)
        .join('\n')}`,
    );
  }
  return { covered: expected.length, total: expected.length };
};
