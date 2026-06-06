# Virtuoso Academy Deployment

## Render

This app is configured for Render with `render.yaml`, including a Render Postgres database.

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Render, create a new Blueprint from the repo.
3. Set these secret environment variables in Render:
   - `ADMIN_PASSWORD`
   - `GEMINI_API_KEY` when ready for live AI responses
4. Deploy.

Student accounts, enrollments, submissions, critiques, revisions, and founder notes use Postgres when `DATABASE_URL` is present. Local development falls back to ignored JSON files in `data/`.
