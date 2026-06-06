# Virtuoso Academy Deployment

## Render

This app is configured for Render with `render.yaml`.

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Render, create a new Blueprint from the repo.
3. Set these secret environment variables in Render:
   - `ADMIN_PASSWORD`
   - `GEMINI_API_KEY` when ready for live AI responses
4. Deploy.

The MVP currently stores student, enrollment, and submission JSON files on local disk. On Render free web services, disk data is ephemeral. Use this deployment for public testing and move to a managed database before real students.
