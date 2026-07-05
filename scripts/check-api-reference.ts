import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_ROOT = join(process.cwd(), 'src');
const REFERENCE_PATH = join(process.cwd(), 'docs', 'api.md');
const HTTP_COLLECTION_PATH = join(process.cwd(), 'docs', 'multilot-api.http');
const HTTP_DECORATOR = /@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/g;

type HttpRoute = {
  controller: string;
  method: string;
  path: string;
};

const listControllers = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listControllers(path);
    return path.endsWith('.controller.ts') ? [path] : [];
  });

const normalizePath = (...segments: Array<string | undefined>): string => {
  const path = segments
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
    .replace(/\/$/, '');

  return path ? `/${path}` : '/';
};

const readRoutes = (controllerPath: string): HttpRoute[] => {
  const source = readFileSync(controllerPath, 'utf8');
  const controller = source.match(/@Controller\((?:'([^']*)')?\)/)?.[1];

  return [...source.matchAll(HTTP_DECORATOR)].map((match) => ({
    controller: relative(process.cwd(), controllerPath),
    method: match[1].toUpperCase(),
    path: normalizePath(controller, match[2]),
  }));
};

const reference = readFileSync(REFERENCE_PATH, 'utf8');
const httpCollection = readFileSync(HTTP_COLLECTION_PATH, 'utf8');
const routes = listControllers(SOURCE_ROOT).flatMap(readRoutes);
const undocumented = routes.filter(
  ({ method, path }) => !reference.includes(`| ${method} | \`${path}\` |`),
);
const missingFromHttpCollection = routes.filter(
  ({ method, path }) => !httpCollection.includes(`# ROUTE: ${method} ${path}`),
);

if (undocumented.length > 0) {
  console.error('The API reference is missing these controller routes:');
  for (const route of undocumented) {
    console.error(`- ${route.method} ${route.path} (${route.controller})`);
  }
  process.exitCode = 1;
} else {
  console.log(`API reference covers all ${routes.length} controller routes.`);
}

if (missingFromHttpCollection.length > 0) {
  console.error('The HTTP collection is missing these controller routes:');
  for (const route of missingFromHttpCollection) {
    console.error(`- ${route.method} ${route.path} (${route.controller})`);
  }
  process.exitCode = 1;
} else {
  console.log(`HTTP collection covers all ${routes.length} controller routes.`);
}
