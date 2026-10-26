# Strong Think Web Designers — Agency Platform

**Brand line:** *Never Give Up. Just Create.*

A responsive agency website and a full-stack starter for project delivery. The repository includes the public marketing experience, a role-protected admin workspace, a client portal, a SQLite data layer, lead/CRM capture, private project files, feedback, hour logs, invoices, and optional third-party integrations.

## What is included

- **Public website:** Home, Services, Portfolio & Case Studies, About, Journal, and Contact routes. Responsive navigation, filterable work cards, case-study details, article modals, inquiry capture, newsletter signup, SEO metadata, JSON-LD, robots, and sitemap.
- **Admin / agency control center:** Project and task management, client accounts, progress, deadlines, hour logging, private project file uploads, service/portfolio/blog/testimonial CMS, lead pipeline and interaction notes, invoices, mark-paid actions, and client feedback review.
- **Client portal:** Project progress, milestones, deadlines, shared contracts, private mockup/document downloads, invoices, payment options when configured, and comments/design approval/revision feedback.
- **Security basics:** Password hashes with bcrypt, session regeneration at login, HttpOnly/SameSite cookies, production-only Secure cookies, CSRF validation on authenticated mutations, sign-in and public-form rate limits, Helmet security headers/CSP, server-side input validation, parameterized database operations, and ownership-checked private file downloads.
- **Optional services:** SMTP lead notifications, Mailchimp subscriber sync, GA4, Meta Pixel, Hotjar, Calendly, Google Maps embed, Stripe Checkout + signed webhook, PayPal checkout/capture, and bank-transfer instructions. These only become active after real configuration values are provided.

## Run locally

Requirements: Node.js 20 or newer and npm. A persistent writable filesystem is required for SQLite and uploaded files.

1. Extract the ZIP.
2. Open a terminal in `strong-think-platform/`.
3. Copy `.env.example` to `.env`.
4. Install dependencies: `npm install`.
5. Start the server: `npm start`.
6. Visit `http://localhost:3000`.

The database is created as `strongthink.db` in the project folder by default. Set `DB_PATH` to move it to a persistent data volume. Uploaded files are stored privately under `storage/uploads/`, outside the public web directory.

### Local demo logins

When `NODE_ENV` is not `production` and the database is empty, sample data is seeded for preview. Default local credentials are:

- **Admin:** `admin@strongthink.local` / `ChangeMe!2026`
- **Client:** `client@example.com` / `ClientDemo!2026`

These credentials are for local preview only. Change them in `.env`; do not expose a development instance publicly. Production startup refuses the known sample admin password and requires a strong session secret and an admin password of at least 14 characters. Production does not seed the demo client, sample projects, example portfolio items, or sample testimonials.

The sample portfolio and testimonial records shown in development are illustrative concepts and are not claims of verified customer results. Replace them with approved client work before launch.

## Production launch checklist

1. **Domain & contact identity:** Set `PUBLIC_BASE_URL` in `.env` to the real HTTPS domain. Replace `https://strongthink.design` and `hello@strongthink.design` placeholders where used in page metadata/structured data, Open Graph metadata, `public/sitemap.xml`, `public/robots.txt`, and page footers with the verified domain and business email. The address and map are not invented; configure `GOOGLE_MAPS_EMBED_URL` only after confirming the correct address.
2. **Secrets:** Set a long random `SESSION_SECRET`, unique `ADMIN_EMAIL`, and unique strong `ADMIN_PASSWORD`. Keep `.env`, database files, and uploads out of version control. Use HTTPS at the hosting layer and review trusted proxy configuration for your host.
3. **Persistent storage & backups:** Put `DB_PATH` on a durable volume and back up the SQLite database plus private uploads on a schedule. Test restoration. Use a host that supports persistent storage and SQLite locking, or replace SQLite with a managed database for multi-instance scale.
4. **Content and privacy:** Add only real client projects, permitted visuals, verified testimonials/results, current services/pricing, and actual contract links. Publish privacy/cookie terms, client terms, refund/payment terms, and consent notices that fit your jurisdiction and configured analytics tools.
5. **Account lifecycle:** Create each client from the admin panel with a temporary password delivered securely. This starter does not yet implement self-service password reset, mandatory password rotation, MFA, or automated invite email. Add those before handling sensitive/high-value work at scale.
6. **Monitoring & email:** Configure SMTP and verify inbox delivery, errors, database backups, uptime, and rate limits. Add a production logging/alerting policy and ensure logs do not include secrets or sensitive client material.
7. **Search and measurement:** Submit the corrected sitemap after domain setup. Configure GA4/Meta/Hotjar only with the appropriate consent and privacy controls. Analytics scripts require both a configured ID and visitor opt-in through the Privacy choices banner. The preference is saved in the visitor browser; publish a complete privacy notice and review consent requirements for your jurisdiction before launch.

## Optional integrations

All credentials are kept server-side in `.env` except public analytics identifiers and configured public links.

### Stripe

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. In Stripe, register the endpoint `https://YOUR-DOMAIN/api/webhooks/stripe` for `checkout.session.completed`. Keep the webhook signing secret secret. The webhook updates invoices to `Paid` after Stripe confirms `payment_status=paid`. The starter allows USD, EUR, GBP, CAD, AUD, NZD, and SGD for Stripe Checkout.

### PayPal

Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Non-production uses PayPal sandbox by default; production uses PayPal live API. Set `PAYPAL_API_BASE` only if you intentionally need to override the provider endpoint. Confirm currencies supported by your PayPal merchant account before presenting the option to clients.

### Bank transfer

Set `BANK_TRANSFER_INSTRUCTIONS`. These instructions are shown only within an authenticated client portal and only for unpaid invoices.

### SMTP and Mailchimp

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, and `ADMIN_EMAIL` to receive inquiry notifications. Configure `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID` to sync newsletter signups. Subscribers are saved locally even if the provider sync fails; monitor server logs and reconcile failed syncs.

### Calendly, Google Maps, analytics

- `CALENDLY_URL`: a real scheduling URL; its link is enabled only when configured.
- `GOOGLE_MAPS_EMBED_URL`: a Google Maps embed URL starting with `https://www.google.com/maps/embed`; the map remains hidden until configured.
- `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`, `HOTJAR_ID`: optional IDs. Add suitable consent and privacy controls before enabling in production.

## Data and scaling notes

The default SQLite database contains users, sessions, projects, tasks, portfolio, services, blog, testimonials, leads, CRM interactions, invoices, private project files, feedback, hour logs, and subscribers. Foreign keys and basic indexes are enabled. For significant concurrent traffic, a multi-instance deployment, or more demanding finance/audit requirements, migrate to PostgreSQL, use a managed session store, and introduce background jobs and explicit payment reconciliation.

The app tracks project budget and time but is not a full accounting or tax compliance package. Payment provider availability depends on your region, merchant account, currency, and credentials. No third-party integrations are live in the included source until configured.

## Validation performed for this package

JavaScript syntax checks and a SQLite schema validation were performed during assembly. A dependency-backed server smoke test could not be completed in this environment because package installation timed out; install dependencies and verify all provider integrations in a staging environment before production deployment.
