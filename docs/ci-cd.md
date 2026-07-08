# CI/CD de MultiLot 360 API

El workflow principal vive en `.github/workflows/ci.yml` y protege las ramas
`develop` y `master`.

## Reglas por rama

| Rama | Uso | Validaciones | CD |
| --- | --- | --- | --- |
| `develop` | Integración y pruebas de cambios listos para staging. | CI completo obligatorio. | Gate `staging`. |
| `master` | Estado estable de producción. | CI completo obligatorio. | Gate `production`. |

No se deben mantener ramas locales o remotas permanentes fuera de `develop` y
`master` salvo trabajo temporal aprobado.

## CI obligatorio

Cada `push`, `pull_request` o ejecución manual valida:

1. Instalación reproducible con `yarn install --frozen-lockfile`.
2. `yarn prisma:validate`.
3. `yarn prisma:generate`.
4. Chequeo de presencia de migraciones Prisma versionadas.
5. `yarn format:check`.
6. `yarn docs:check`, que exige que `docs/api.md` y
   `docs/multilot-api.http` cubran todas las rutas registradas.
7. `yarn lint:check`.
8. `yarn test --runInBand --watchman=false`.
9. `yarn test:e2e --runInBand --watchman=false`.
10. `yarn build`.

El job levanta PostgreSQL 16 y Redis 7 como servicios de GitHub Actions para
que las pruebas que inicializan la aplicación tengan dependencias base sin
tocar Supabase real. Este repositorio usa un flujo introspectivo contra
Supabase y no conserva todavía una migración baseline inicial; por eso
`prisma migrate deploy` queda reservado para entornos con historial de
migraciones ya inicializado y no se ejecuta contra una base vacía en CI.

## Gate de despliegue

El job `deploy` solo corre después de CI verde y únicamente en `push` a
`develop` o `master`.

- `develop` usa environment `staging`.
- `master` usa environment `production`.

Si el secreto `DEPLOY_WEBHOOK_URL` no está configurado, el gate termina
correctamente y deja constancia en el summary. Esto permite activar branch
protection desde ya sin bloquear el repositorio por falta de proveedor de
deploy.

Cuando se conecte el proveedor real, configurar estos secretos en GitHub:

```txt
DEPLOY_WEBHOOK_URL
DEPLOY_WEBHOOK_TOKEN
```

El webhook recibe:

```json
{
  "repository": "owner/repo",
  "branch": "develop|master",
  "commit": "sha",
  "environment": "staging|production"
}
```

## Reglas recomendadas en GitHub

En Settings -> Rules -> Rulesets o Branch protection:

- Proteger `develop` y `master`.
- Requerir status check `Validate, test and build`.
- Requerir que el workflow esté verde antes de merge/push protegido.
- Requerir historial lineal si se decide evitar merge commits.
- Restringir force-push y borrado de ramas principales.
- En environment `production`, requerir aprobación manual antes de desplegar.

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
```
