# Estrategias de despliegue con GitHub Actions y Dokploy

Esta guía describe las dos formas soportadas de desplegar MultiLot 360 API y
la configuración recomendada para el VPS actual y para un servidor futuro con
más recursos.

## Decisión recomendada

Para el VPS actual de 1 CPU y 1.92 GiB de RAM, usar siempre imágenes
preconstruidas:

```text
push -> GitHub Actions -> pruebas -> imagen GHCR -> webhook -> Dokploy pull/run
```

GitHub Actions absorbe la instalación de dependencias, Prisma, TypeScript y el
build de Docker. Dokploy solo descarga una imagen ya validada y sustituye el
contenedor. Esto reduce picos de RAM, CPU, espacio temporal y tiempo de caída.

Esta estrategia sigue siendo la recomendada aunque el VPS crezca. Un servidor
de build dedicado solo empieza a aportar valor cuando se necesita una red
privada, un registry privado propio o requisitos regulatorios que impidan usar
GitHub-hosted runners.

## Flujo de ramas e imágenes

| Rama | Entorno GitHub | Imagen mutable | Dominio Dokploy |
| --- | --- | --- | --- |
| `develop` | `development` | `ghcr.io/craftxdog/multilot-api360:development` | `dev-api.alphaby.cloud` |
| `master` | `production` | `ghcr.io/craftxdog/multilot-api360:production` | `api.alphaby.cloud` |

Cada ejecución también publica una etiqueta inmutable con el SHA completo:

```text
ghcr.io/craftxdog/multilot-api360:<github-sha>
```

La etiqueta de canal simplifica el despliegue automático. La etiqueta SHA
permite auditar y hacer rollback a la imagen exacta.

## Método A: GitHub construye y Dokploy descarga

### 1. GitHub Actions

El workflow `.github/workflows/ci.yml` ejecuta, en este orden:

1. PostgreSQL y Redis efímeros.
2. Validación de Prisma, migraciones y baseline SQL.
3. Formato, documentación, lint, unit tests y E2E.
4. Build de NestJS.
5. Build multi-stage del `Dockerfile`.
6. Publicación de SBOM, provenance y las etiquetas GHCR.
7. Webhook del environment correspondiente.

Permisos mínimos del workflow:

```yaml
permissions:
  contents: read

# Solo el job que publica la imagen:
permissions:
  contents: read
  packages: write
```

No se almacenan secretos de aplicación dentro de la imagen. Supabase, Redis,
MailerSend y URLs se inyectan en runtime desde Dokploy.

### 2. Environments y secretos de GitHub

Crear en GitHub `Settings -> Environments`:

- `development`
- `production`

En cada environment crear un secreto con el mismo nombre, pero con su propio
webhook de Dokploy:

```text
DEPLOY_WEBHOOK_URL
```

Opcionalmente, si el proveedor valida un bearer token separado:

```text
DEPLOY_WEBHOOK_TOKEN
```

No usar un único secreto de repositorio para ambos entornos: un push de
`develop` podría desplegar el servicio de producción.

En `production` se recomienda activar required reviewers. Así la imagen queda
publicada y probada, pero el webhook espera una aprobación humana.

### 3. Visibilidad de GHCR

Hay dos configuraciones válidas:

#### Imagen pública

Dokploy solo necesita:

```text
Docker Image: ghcr.io/craftxdog/multilot-api360:development|production
Registry URL: vacío
Username: vacío
Password: vacío
```

La imagen puede descargarse sin credenciales. Los secretos no se filtran
porque nunca se copian al artefacto.

#### Imagen privada

Crear un token de GitHub con alcance de solo lectura de paquetes y configurar:

```text
Registry URL: ghcr.io
Username: <usuario-github>
Password: <token-con-read-packages>
```

Preferir una GitHub App o token técnico rotatable, no el token personal usado
para administrar la cuenta.

### 4. Dokploy development

En `Multilot360 -> development -> dev-api -> General`:

```text
Provider: Docker
Docker Image: ghcr.io/craftxdog/multilot-api360:development
```

En `Environment`, mantener únicamente configuración de development. Valores
recomendados para el VPS actual:

```text
NODE_ENV=development
NODE_OPTIONS=--max-old-space-size=192
DB_POOL_MAX=2
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=10000
REDIS_KEY_PREFIX=multilot360:development:
REALTIME_REDIS_KEY=multilot360:development:socket.io
```

El host de Redis debe ser su nombre interno de Dokploy. No publicar el puerto
6379 a Internet.

Dominio:

```text
Host: dev-api.alphaby.cloud
Container port: 3000
HTTPS: enabled
Certificate: Let's Encrypt
```

Recursos actuales:

| Recurso | Reservation | Limit |
| --- | ---: | ---: |
| RAM | 64 MiB | 256 MiB |
| CPU | 0.05 | 0.30 |
| Réplicas | - | 1 |

Swagger puede permanecer habilitado en development si el equipo lo necesita.
Si el entorno es accesible públicamente, protegerlo con Basic Auth, VPN o una
allowlist; nunca depender solo de que la URL sea difícil de adivinar.

### 5. Dokploy production

En `Multilot360 -> production -> Production-API -> General`:

```text
Provider: Docker
Docker Image: ghcr.io/craftxdog/multilot-api360:production
```

Runtime recomendado para el VPS actual:

```text
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=256
DB_POOL_MAX=3
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=10000
SWAGGER_ENABLED=false
AUTH_SIGNUP_ENABLED=false
LOG_LEVEL=log
```

Recursos actuales:

| Recurso | Reservation | Limit |
| --- | ---: | ---: |
| RAM | 128 MiB | 384 MiB |
| CPU | 0.10 | 0.50 |
| Réplicas | - | 1 |

Usar `api.alphaby.cloud`, puerto interno 3000 y HTTPS. La base de datos debe
usar el Session Pooler de Supabase y Redis debe permanecer en la red interna.

### 6. Despliegue y rollback

Despliegue normal:

```text
push develop -> development image -> development webhook
merge master -> production image -> production approval/webhook
```

Rollback seguro:

1. Abrir el despliegue verde anterior en GitHub y copiar su SHA.
2. Cambiar temporalmente Docker Image en Dokploy a
   `ghcr.io/craftxdog/multilot-api360:<sha>`.
3. Deploy y comprobar `/api/v1/health/ready`.
4. Corregir el código y volver después a la etiqueta de canal.

No hacer rollback automático de la base de datos. Los cambios SQL deben ser
compatibles hacia atrás o tener un plan explícito de restauración.

## Método B: Dokploy clona y construye en el VPS

Este método es útil para prototipos, repositorios sin CI o un servidor de build
dedicado. No es el recomendado para el VPS actual.

### Configuración

En `General -> Provider`:

```text
Provider: GitHub
Repository: MultiLot-360
Branch: develop o master
Build Path: /
Trigger: On Push
```

En `Build Type`:

```text
Build Type: Dockerfile
Docker File: ./Dockerfile
Docker Context Path: .
Docker Build Stage: runner
```

No usar `/dist` como Build Path: Dokploy necesita el repositorio completo,
`package.json`, `yarn.lock`, Prisma y el Dockerfile.

Con este método Dokploy ejecuta localmente:

```bash
docker build --target runner .
```

Ventajas:

- menos configuración inicial;
- logs del build en el mismo panel;
- no requiere registry.

Costes:

- picos de CPU y RAM durante `yarn install`, Prisma y Nest build;
- cache Docker consume disco del VPS;
- despliegues lentos;
- el proceso de build compite con API, Redis, Traefik y Dokploy;
- un OOM puede afectar servicios ya activos.

### Recursos mínimos razonables

| Escenario | CPU | RAM | Disco libre | Recomendación |
| --- | ---: | ---: | ---: | --- |
| VPS actual | 1 | 1.92 GiB | ~21 GiB | No construir en VPS |
| Build ocasional | 2 | 4 GiB | 30 GiB | Posible, limitar concurrencia |
| Dev + prod estable | 4 | 8 GiB | 50+ GiB | Aceptable |
| Build server separado | 2-4 | 4-8 GiB | 50+ GiB | Buena alternativa privada |

Aunque el VPS tenga 4 CPU y 8 GiB, GitHub Actions + GHCR sigue ofreciendo
mejor aislamiento. Si se elige build local, nunca ejecutar builds simultáneos,
activar limpieza programada y conservar al menos 25% del disco libre.

## Perfiles al ampliar el VPS

No aumentar límites solo porque exista RAM disponible. Medir p95 de memoria,
latencia y event-loop antes de cambiar.

### 2 CPU / 4 GiB

| Servicio | RAM limit | CPU limit | Réplicas |
| --- | ---: | ---: | ---: |
| API production | 512-768 MiB | 1.0 | 1 |
| API development | 256-384 MiB | 0.5 | 1 |
| Redis production | 192 MiB | 0.3 | 1 |
| Redis development | 96 MiB | 0.2 | 1 |

### 4 CPU / 8 GiB

| Servicio | RAM limit | CPU limit | Réplicas |
| --- | ---: | ---: | ---: |
| API production | 768 MiB-1 GiB por réplica | 1.0-1.5 | 2 |
| API development | 384-512 MiB | 0.5 | 1 |
| Redis production | 256-512 MiB | 0.5 | 1 |
| Redis development | 128 MiB | 0.2 | 1 |

Antes de usar 2 réplicas:

- `REALTIME_REDIS_ENABLED=true`;
- sesiones y rate limiting no deben depender de memoria local;
- migraciones deben ejecutarse una sola vez, fuera del startup de cada réplica;
- probar graceful shutdown y rolling update;
- mantener `DB_POOL_MAX` bajo. Dos réplicas con pool 5 consumen hasta 10
  conexiones, no 5.

## Pruebas Docker locales

### Imagen construida desde el checkout

```bash
yarn docker:smoke
```

El comando:

1. construye el stage `runner`;
2. levanta PostgreSQL, Redis y la API en una red aislada;
3. espera los healthchecks;
4. valida liveness y readiness;
5. exige `401` en una ruta protegida;
6. exige `404` en Swagger deshabilitado;
7. elimina contenedores y datos efímeros.

### Imagen publicada en GHCR

```bash
yarn docker:smoke:image ghcr.io/craftxdog/multilot-api360:development
yarn docker:smoke:image ghcr.io/craftxdog/multilot-api360:production
```

Las imágenes publicadas por el pipeline están orientadas al VPS
`linux/amd64`. El script detecta la arquitectura de Docker y, en Macs Apple
Silicon, ejecuta esa imagen mediante emulación. Para probar otro destino se
puede declarar `API_IMAGE_PLATFORM`, por ejemplo `linux/arm64`.

Para evitar colisión de puerto:

```bash
API_SMOKE_PORT=3200 yarn docker:smoke
```

### Validación remota después de Dokploy

```bash
curl --fail https://dev-api.alphaby.cloud/api/v1/health
curl --fail https://dev-api.alphaby.cloud/api/v1/health/ready
curl --fail https://api.alphaby.cloud/api/v1/health
curl --fail https://api.alphaby.cloud/api/v1/health/ready
```

Además:

- una ruta protegida sin bearer debe responder `401`;
- `/docs` debe responder `404` en producción;
- un origen CORS desconocido no debe recibir
  `Access-Control-Allow-Origin`;
- TLS debe ser válido y responder HSTS;
- logs no deben contener contraseñas, tokens, URLs completas con credenciales
  ni OTP.

## Limpieza y observabilidad

- Conservar el cleanup diario de Docker en Dokploy.
- No ejecutar `docker system prune --volumes` de forma automática.
- Mantener alertas a 75% de RAM, 80% de disco y readiness fallido.
- Conservar al menos una imagen SHA estable anterior para rollback.
- Revisar mensualmente imágenes y build cache.
- En Supabase Free, mantener exportaciones verificadas porque las opciones de
  backup gestionado son más limitadas que en Pro.
