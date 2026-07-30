# Night Economy Repository Rules

## Button interaction testing

Every new or changed user-facing button must be covered by a Playwright test running in Chromium.

The test must:

1. Reach the button through the same workflow a user follows.
2. Click the button; calling the underlying handler or API directly does not count.
3. Assert the intended observable outcome, such as navigation, visible state, persisted request payload, dialog behavior, or service state.
4. Assert important negative outcomes where relevant, such as a cancelled confirmation producing no write.
5. Fail when the click does nothing, produces the wrong payload, navigates incorrectly, or never reaches the expected state.

Unit tests are still required for non-trivial logic, but they never replace the Chromium interaction test for a button.

Before considering button work complete, run:

```bash
npm run test:e2e
npm run check
```

When the change will be deployed to Cloudflare Pages, also run the relevant workflow against the deployed site:

```bash
E2E_BASE_URL=https://night-econemy.pages.dev npx playwright test
```

Do not weaken selectors or assertions merely to make a failing workflow pass. Treat a failure as a product or test-fixture defect and identify the actual cause.
