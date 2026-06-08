# Night Economy

Night Economy is a static prototype for a live cocktail market product. It currently includes:

- A TV market board for the room
- A guest-facing mobile menu with cocktails, zeroes, beers, and food
- A public landing `site`
- A subscription-aware operator `portal`
- A crash sequence and live market simulation

## Run Locally

From the project root:

```bash
python3 -m http.server 8081
```

Then open one of these:

```text
http://127.0.0.1:8081/?view=tv
http://127.0.0.1:8081/?view=mobile
http://127.0.0.1:8081/?view=site
http://127.0.0.1:8081/?view=portal
```

## Publish

This repo is a plain static site, so `index.html` is the publish page.

To publish on GitHub Pages:

1. Push the latest changes to `main`.
2. In GitHub, open the repository settings.
3. Turn on GitHub Pages and choose the `main` branch with the root folder.
4. Wait for GitHub to build and expose the site URL.

## Project Files

- `index.html` - app shell and route entrypoint
- `styles.css` - shared visual system and page styling
- `data.js` - drink data and market constants
- `shared.js` - shared market logic and rendering helpers
- `home.js` - TV board and right-panel updates
- `pages.js` - site, mobile, portal, and legacy route handling
- `crash.js` - crash event sequence

## Notes

- The app is intentionally dependency-free at runtime.
- External fonts, Three.js, and ECharts are loaded from CDNs.
- If you change the site layout, keep the `id` values in sync with the scripts.
