# Mailer

Infrastructure adapter for transactional emails.

Current provider:

- MailerSend official Node.js SDK.

Template renderer:

- Nunjucks.
- Templates live in `src/infrastructure/mailer/templates/<template-name>`.
- Every template has `html.njk` and `text.njk`.

Current template flows:

- `seller-invitation`: admin creates a seller account and invites the seller.
- `seller-access-code`: seller receives a one-time access code.
- `account-confirmation`: user confirms an account with a code.

The API token must stay in ignored env files as `MAILERSEND_API_TOKEN`. Never
commit the real token.
