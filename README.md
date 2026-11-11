# Q4 Labs website

Static site, no build step: plain HTML, CSS and JS.

```
index.html        landing: ASCII orb hero, lab rule, what we do, yapFlow demo, team, contact CTA
projects.html     project list (ls -la style), yapFlow, next experiment, lab log
lab.html          how we work (the loop + house rules) and contact
assets/css/styles.css   all styles; colours are CSS variables, light mode via [data-theme="light"]
assets/js/main.js       theme toggle, ASCII orb, leader lines, typing, flashcard, scroll reveals
assets/img/             wordmark SVGs (on dark / on light)
brand/                  every logo + favicon export (SVG, PNG, ICO)
favicon.*, apple-touch-icon.png, icon-*.png   served from the site root
```

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Fill these in

- `lab.html`, contact: swap the Gmail address for an @q4labs.io one once the domain is live.
- Q4 Labs X and LinkedIn icons (hero WHAT WE DO + footer on all 3 pages): `href="#"` with `data-todo="q4-x"` / `data-todo="q4-linkedin"`. Replace `#` with the real page URLs.

## Theme

Dark is the default. The toggle saves the choice in `localStorage` (`q4-theme`).

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#0B0D10` | `#F4F3EF` |
| `--text` | `#E8E6E1` | `#0B0D10` |
| `--green` | `#3DDC84` | `#0E7A44` |

Fonts (Google Fonts): JetBrains Mono (body), Instrument Serif italic (accents), Silkscreen (orb label).
