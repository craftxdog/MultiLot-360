# Modules

Business bounded contexts go here.

Each context should keep domain, application, infrastructure and presentation
separate. Do not place Prisma models or Nest controllers directly in domain
code.

Recommended shape:

```txt
<context>/
  domain/
    entities/
    value-objects/
    ports/
  application/
    use-cases/
    dto/
  infrastructure/
    persistence/
  presentation/
    http/
```
