# Certificación prepublicación de la API — 2026-10-13

Rama objetivo: `develop`.

## Dictamen

La API y sus migraciones versionadas están certificadas para `develop` mediante
pruebas locales aisladas. **No se autoriza una promoción a `master` ni a
producción** hasta recuperar evidencia de la API development y de la base de
datos remota actualmente inactiva. La ausencia de acceso al entorno real no se
puede sustituir con resultados locales.

Los scripts y artefactos no versionados que ya existían en el worktree se
preservaron y no forman parte de este corte.

## Datos y migraciones reproducibles

Se creó PostgreSQL 16 efímero y se aplicaron en orden las 30 migraciones SQL de
`supabase/migrations/`, desde `20260713` hasta `20260902`, junto con el seed
idempotente. Las siguientes comprobaciones pasaron contra esa base:

| Comprobación | Resultado |
| --- | --- |
| `multi_tenant_isolation.test.sql` | Aprobada |
| `bank_transfer_billing.test.sql` | Aprobada |
| `platform_bootstrap.test.sql` | Aprobada |
| Roles, módulos y permisos del seed | 3 roles, 15 módulos, 21 permisos |
| Acceso directo de `anon`/`authenticated` a negocio | Sin privilegios ni políticas de exposición |
| RLS en tablas públicas | Habilitado en todas las tablas verificadas |
| Rol de aplicación | `rolbypassrls = false` |

La base temporal se eliminó después de la prueba. No se escribió sobre datos
de clientes, y por tanto no se declara que los conteos de clientes remotos sean
iguales a los locales.

## Calidad y contrato HTTP

| Área | Evidencia | Resultado |
| --- | --- | --- |
| Unitarias | `yarn test --runInBand --watchman=false` | 74 suites, 250 pruebas aprobadas. |
| E2E | `yarn test:e2e` | 1 prueba aprobada; 1 suite externa omitida por diseño. |
| Compilación, formato, lint, Prisma y documentación | `yarn build`, `format:check`, `lint:check`, `prisma:validate`, `docs:check` | Aprobados. `docs:check` cubre las 91 rutas registradas. |
| Contenedor productivo | `bash scripts/docker-smoke.sh` | Aprobado con imagen reconstruida: health/ready 200, `/sales` 401 y `/docs` 404; Postgres, Redis y API temporales eliminados al finalizar. |
| Dependencias runtime | `yarn audit --groups dependencies --level high --json` | 0 críticas, 0 altas, 18 moderadas, 1 baja. |

## Endurecimiento incorporado

El endpoint público `POST /identity-access/sellers/access-code/confirm` ahora
está protegido explícitamente con `ThrottlerGuard` y un límite de 5 intentos
por 15 minutos. La prueba de controlador verifica tanto el guard como la
metadata de límite; se realizó una mutación controlada del valor para comprobar
que la prueba falla si se modifica el contrato.

La auditoría inicial detectó una vulnerabilidad crítica transitiva en
`proxy-addr`. Se actualizaron las resoluciones bloqueadas y Nodemailer; después
del lockfile reproducible, la auditoría de dependencias runtime no contiene
hallazgos altos ni críticos. Yarn advierte cinco resoluciones que están fuera
del rango semver solicitado por dependencias transitivas (`multer`, `js-yaml`,
`mysql2` y `deepmerge-ts`); permanecen documentadas porque el build, la suite
completa y el contenedor se validaron con sus versiones corregidas.

La revisión adicional confirmó los controles existentes de Helmet, CORS
restringido, validación global con whitelist, cookies seguras, RBAC por tenant,
verificación de evidencia, URLs firmadas de corta vida y configuración de
producción que exige TLS, secretos fuertes y Redis autenticado.

## Gates que siguen bloqueando producción

| Gate | Estado | Acción requerida |
| --- | --- | --- |
| API development | `dev-api.alphaby.cloud` no resolvió DNS desde esta certificación. | Recuperar conectividad y ejecutar health/readiness y el recorrido autorizado de QA. |
| Datos remotos | El proyecto Supabase conectado está inactivo; no se reactivó por su posible coste/impacto. | Autorizar reactivación o proporcionar un entorno activo de sólo lectura; comparar migraciones, RLS y conteos antes de promoción. |
| Rate limiting distribuido | `ThrottlerGuard` usa el store local por defecto. | Antes de escalar horizontalmente, configurar un store Redis compartido y probar límite entre réplicas. |
| Impresión de tickets | La API produce datos y comprobantes, pero no puede descubrir impresoras Bluetooth del equipo. | Para una PT-210, usar el cliente Desktop y un adaptador nativo/driver que envíe ESC/POS; no exponer ese acceso al navegador ni a la API pública. |

## Publicación y rollback

1. Integrar y push de estos commits a `develop`; esperar el workflow `API CI`
   verde y el deployment development con readiness y smoke 200.
2. Validar de sólo lectura el estado de migraciones y el aislamiento de los
   tenants QA en el entorno activo.
3. Crear la release desde el SHA de `develop`, promover a `master` sólo con
   aprobación de production y verificar la etiqueta inmutable desplegada.
4. Ante una regresión, ejecutar `git revert` del commit correspondiente,
   redeployar la imagen inmutable anterior y verificar `/health/ready`, la ruta
   protegida y Swagger deshabilitado.

Este corte no añade una migración de datos; el rollback de aplicación no exige
revertir SQL.
