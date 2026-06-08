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
