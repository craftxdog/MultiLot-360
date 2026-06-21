# Infrastructure

Adapters for external systems live here.

Current adapters:

- `database/prisma`: Prisma Client service and reusable Prisma repository base
  classes.
- `mailer`: MailerSend adapter and Nunjucks templates for transactional emails.

Domain modules should depend on ports defined in `src/modules/<context>/domain`
and bind those ports to infrastructure adapters inside module wiring.
