# Infrastructure

Adapters for external systems live here.

Current adapters:

- `database/prisma`: Prisma Client service and reusable Prisma repository base
  classes.
- `mailer`: MailerSend adapter and Nunjucks templates for transactional emails.

Domain and application modules should depend on ports defined in
`src/modules/<context>/domain`. Infrastructure adapters implement those ports
and are bound in module wiring.
