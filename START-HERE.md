# Start Here

Night Economy is a drink-pricing experience for venues. It includes the public-facing venue screens, the TV display, a guest menu, and an operator portal.

You do not need to understand every folder to work comfortably in this project. Start with the part of the experience you want to change.

## Where to make changes

| If you want to… | Start here |
| --- | --- |
| Change a public venue page | `src/pages/Site.tsx` and `src/components/site/` |
| Change the big TV display | `src/pages/Tv.tsx` and `src/components/tv/` |
| Change the guest menu | `src/pages/Menu.tsx` and `src/components/market/` |
| Change the operator portal | `src/pages/Portal.tsx` and `src/components/portal/` |
| Change drinks, venue demo content, or default prices | `src/demo/marketSeed.ts` and the venue data in Supabase |
| Change colours and shared styling | `src/styles/app.css` |

## The TV display at a glance

The TV has one display surface with two states:

- **Market live** — a market board on the left and a featured-drink/breaking-news panel on the right.
- **Market resting** — a large countdown until the next market opens.

The small expand icon makes either state fill the screen. TV-specific work belongs in `src/components/tv/`.

## Folder guide

| Folder | Plain-English purpose |
| --- | --- |
| `src/` | The main website and app screens. This is where most design work happens. |
| `public/` | Files served directly to visitors, such as icons and redirects. |
| `docs/` | Project notes, testing and deployment guides, plus visual references. |
| `pos-simulator/` | A separate local tool that imitates a point-of-sale system during service testing. |
| `supabase/` | The database history and server-side jobs. Treat migrations as permanent history. |
| `tests/` | Automated checks that help make sure the product still works. |
| `scripts/` | Small maintenance and verification helpers used by developers. Start with the commands listed in `package.json`; do not run a script that mutates Supabase unless you understand its name and inputs. |

## Folders you can usually ignore

- `node_modules/` — downloaded code used to run the project.
- `dist/` — the generated website build.
- `.wrangler/` — local Cloudflare temporary files.

These are recreated automatically and are not part of the product source.

## Everyday commands

```bash
npm run dev       # open the main app locally
npm run build     # make sure the app can be built
npm run test:all  # run all automated checks
npm run check     # run the complete pre-deploy suite
```

For the full technical reference, use the [main README](README.md). The [documentation index](docs/README.md) points to operational notes and visual reference material.

## Keeping the project clean

- Put a component beside the feature it supports; delete it when it is no longer imported.
- Keep comments for decisions, constraints, and external behaviour—not for obvious code.
- Add database changes as a new immutable migration. Never edit an applied migration.
- Update the relevant guide in `docs/` when a user-visible flow, operational command, or deployment step changes.
