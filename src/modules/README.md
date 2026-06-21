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

Equivalent hexagonal names are:

- `domain` + `application` = core.
- `presentation` = primary/driving adapters.
- `infrastructure` = secondary/driven adapters.

Controllers should stay thin: receive HTTP DTOs, delegate mapping to
presentation mappers, and call use cases. Use cases own application commands
and queries; domain entities should not depend on HTTP DTOs.
