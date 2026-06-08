# Virtuoso Academy Deployment

## Render

This app is configured for Render with `render.yaml`, including a Render Postgres database.

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Render, create a new Blueprint from the repo.
3. Set these secret environment variables in Render:
   - `ADMIN_PASSWORD`
   - `GEMINI_API_KEY` when ready for live AI responses
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY` for live transactional email
   - `MAIL_FROM` using a verified sender, for example `Virtuoso Academy <founder@virtuosoacademy.space>`
   - `SUPPORT_EMAIL`
4. Deploy.

Student accounts, enrollments, submissions, critiques, revisions, and founder notes use Postgres when `DATABASE_URL` is present. Local development falls back to ignored JSON files in `data/`.

## Stripe Checkout

Payments use Stripe Checkout and Stripe webhooks.

1. In Stripe, copy the live secret key into Render as `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint in Stripe:
   - `https://virtuoso-academy.onrender.com/api/stripe/webhook`
3. Subscribe the endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret into Render as `STRIPE_WEBHOOK_SECRET`.

Access rules:
- First Rep: free drills only after student login.
- Academy Elite: subscription access to VIP courses except Founder Shield.
- Inner Circle: subscription access to all premium courses, including Founder Shield.
- Individual premium course checkout grants access to that specific course.

## Authentication

Student login sessions are stored server-side and survive deploys/restarts when Postgres is connected. Password reset tokens are one-time use, stored hashed, and expire after 30 minutes.

For local testing only, set `EXPOSE_RESET_LINKS=true` to return reset links in the API response. Keep it off in production unless you are deliberately testing; live reset delivery should be connected to an email provider before public launch.

## Email Delivery

Transactional email uses Resend when `RESEND_API_KEY` is present. Without that key, the app still logs every attempted email in the admin portal so the workflow can be tested safely.

Email events currently covered:
- Welcome email after student signup.
- Password reset email.
- Stripe access confirmation after successful checkout.
- Critique saved notification.
- Revision saved notification.
- Founder intervention email from the admin portal.

Before public launch:
1. Verify `virtuosoacademy.space` inside Resend.
2. Set `RESEND_API_KEY` in Render.
3. Set `MAIL_FROM` to a sender on the verified domain.
4. Set `SUPPORT_EMAIL` to the inbox students should use for help.
5. Visit `/api/health` and confirm `emailReady` is `true`.
