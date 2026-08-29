# Contributing to Night Economy

Thanks for helping improve Night Economy.

## Before you start

- Read [START-HERE.md](START-HERE.md) for the project map.
- Check existing issues before opening a new one.
- Do not commit credentials, venue data exports, or service-role keys.

## Making a change

1. Create a focused branch from the current default branch.
2. Keep the change small and explain any user-visible behaviour change.
3. Add or update tests for changed behaviour, especially buttons and portal flows.
4. Run `npm run check` before opening a pull request.
5. Update the relevant documentation when a workflow, operation, or deployment step changes.

## Database and production safety

- Add a new Supabase migration for every schema or database-data change. Never edit an applied migration.
- Never expose server-only Supabase secrets in browser code or `VITE_*` variables.
- Production deployment steps are in [docs/deployment.md](docs/deployment.md).

## Pull requests

Describe the problem, the solution, verification performed, and any production follow-up. Keep screenshots or recordings focused on the changed interface.
