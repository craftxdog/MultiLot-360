# Shared kernel

Framework-free primitives shared by bounded contexts.

Allowed here:

- result types.
- domain/application error types.
- generic value objects.
- use-case interfaces.

Not allowed here:

- NestJS providers, controllers, guards or interceptors.
- Prisma services or generated models.
- Supabase, Redis, MailerSend or other external clients.
