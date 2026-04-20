# Night Economy

Night Economy is a static, live-updating cocktail market dashboard. It simulates a busy late-night venue with:

- A live market board for all drinks
- A rotating highlight panel for the current market view
- A crash sequence for dramatic market events
- Animated pricing, sparklines, and ticker updates

## Run Locally

From the project root:

```bash
python3 -m http.server 8081
```

Then open:

```text
http://127.0.0.1:8081
```

## Publish

This repo is a plain static site, so `index.html` is the publish page.

To publish on GitHub Pages:

1. Push the latest changes to `main`.
2. In GitHub, open the repository settings.
3. Turn on GitHub Pages and choose the `main` branch with the root folder.
4. Wait for GitHub to build and expose the site URL.

## Project Files

- `index.html` - app shell and page layout
- `styles.css` - visual system and animations
- `data.js` - drink data and market constants
- `shared.js` - shared market logic and rendering helpers
- `home.js` - board and right-panel updates
- `crash.js` - crash event sequence
- `spotlight.js` - spotlight-specific helpers and legacy rendering logic

## Notes

- The app is intentionally dependency-free at runtime.
- External fonts and Three.js are loaded from CDNs.
- If you change the site layout, keep the `id` values in sync with the scripts.
