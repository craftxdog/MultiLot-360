# Health

Public operational endpoints:

- `GET /api/v1/health`: liveness. Confirms the Nest app is alive.
- `GET /api/v1/health/ready`: readiness. Checks config, database and Redis.

These endpoints stay public because deployment platforms and uptime monitors
must call them without a user token.
