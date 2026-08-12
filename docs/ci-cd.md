# CI/CD de MultiLot 360 API

El workflow principal vive en `.github/workflows/ci.yml` y protege las ramas
`develop` y `master`.

## Reglas por rama

| Rama | Uso | Validaciones | CD |
| --- | --- | --- | --- |
| `develop` | Integración y pruebas de cambios listos para development. | CI completo obligatorio. | Imagen + gate `development`. |
| `master` | Estado estable de producción. | CI completo obligatorio. | Gate `production`. |

No se deben mantener ramas locales o remotas permanentes fuera de `develop` y
`master` salvo trabajo temporal aprobado.

## CI obligatorio

Cada `push`, `pull_request` o ejecución manual valida:

1. Política de ramas y contención completa de `develop` en cada publicación de
   `master`.
2. Instalación reproducible con `yarn install --frozen-lockfile`.
3. `yarn prisma:validate`.
4. `yarn prisma:generate`.
5. Chequeo de presencia de migraciones Prisma versionadas.
6. `yarn format:check`.
7. `yarn docs:check`, que exige que `docs/api.md` y
   `docs/multilot-api.http` cubran todas las rutas registradas.
8. `yarn lint:check`.
9. `yarn test --runInBand --watchman=false`.
10. `yarn test:e2e --runInBand --watchman=false`.
11. `yarn build`.

El job levanta PostgreSQL 16 y Redis 7 como servicios de GitHub Actions para
que las pruebas que inicializan la aplicación tengan dependencias base sin
tocar Supabase real. Este repositorio usa un flujo introspectivo contra
Supabase y no conserva todavía una migración baseline inicial; por eso
`prisma migrate deploy` queda reservado para entornos con historial de
migraciones ya inicializado y no se ejecuta contra una base vacía en CI.

## Gate de despliegue

El job `image` corre después de CI verde en cada `push` a `develop` o `master`.
Publica una etiqueta mutable por entorno y otra inmutable con el SHA:

```text
develop -> ghcr.io/craftxdog/multilot-api360:development
master  -> ghcr.io/craftxdog/multilot-api360:production
ambas   -> ghcr.io/craftxdog/multilot-api360:<github-sha>
```

El job `deploy` solo corre cuando CI e imagen terminan correctamente.

- `develop` usa environment `development`.
- `master` usa environment `production`.

`DEPLOY_WEBHOOK_URL` debe ser un secreto de environment, no un secreto global
compartido. Cada environment contiene el webhook de su propio servicio
Dokploy. Development puede omitir el deploy mientras se termina de conectar el
proveedor; producción falla si no existe webhook y nunca se declara desplegada.

Después del webhook, el workflow consulta readiness con reintentos. La variable
opcional `DEPLOY_HEALTHCHECK_URL` permite sustituir la URL por environment; por
defecto usa `dev-api.alphaby.cloud` en `develop` y `api.alphaby.cloud` en
`master`. Después valida también el contrato público de planes con
`DEPLOY_SMOKE_URL`. Un webhook `2xx` sin readiness y smoke `200` no es un
despliegue exitoso.

Cuando se conecte el proveedor real, configurar estos secretos en GitHub:

```txt
DEPLOY_WEBHOOK_URL
DEPLOY_WEBHOOK_TOKEN
DEPLOY_HEALTHCHECK_URL (variable opcional)
DEPLOY_SMOKE_URL (variable opcional)
```

El webhook recibe:

```json
{
  "repository": "owner/repo",
  "branch": "develop|master",
  "commit": "sha",
  "environment": "development|production"
}
```

## Reglas recomendadas en GitHub

En Settings -> Rules -> Rulesets o Branch protection:

- Proteger `develop` y `master`.
- Requerir status checks `Policy and branch rules` y `Validate, test and build`.
- Requerir que el workflow esté verde antes de merge/push protegido.
- Requerir historial lineal si se decide evitar merge commits.
- Restringir force-push y borrado de ramas principales.
- En environment `production`, requerir aprobación manual antes de desplegar.

La guía detallada de ambos modelos de despliegue, límites y rollback está en
`docs/deployment-strategies.md`.

## Validación local equivalente

Antes de publicar:

```bash
yarn prisma:validate
yarn prisma:generate
yarn format:check
yarn docs:check
yarn lint:check
yarn test --runInBand --no-watchman
yarn test:e2e --runInBand --no-watchman
yarn build
yarn docker:smoke
```
