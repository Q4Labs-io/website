# Q4 Labs website

Static site, no build step: plain HTML, CSS and JS.

```
index.html        landing: hero + globe viewport, transmission (lab rule), method, yapFlow demo, operators, contact
projects.html     project index (ls -la), yapFlow, next experiment, lab log
lab.html          how we work (the loop + house rules) and contact
assets/css/styles.css   all styles; tokens are CSS variables in :root
assets/js/main.js       ASCII globe, leader lines, typed transmission, meters, clocks, flashcard, reveals
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
- Q4 Labs X icon (footer on all 3 pages): `href="#"` with `data-todo="q4-x"`. Replace `#` with the real page URL.

## Design system: "lab instrument panel"

Dark only. One typeface, one signal colour, hairline panels, square corners.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#070807` | page |
| `--panel` | `#0B0D0C` | panels and tiles |
| `--line` / `--line-2` | `#1B201D` / `#2A312D` | hairlines / stronger borders |
| `--text` / `--muted` / `--dim` | `#E3E7E3` / `#8B938E` / `#59615C` | text levels |
| `--signal` | `#3DDC84` | brand green: live states, meters, primary action only |

Font (Google Fonts): Geist Mono, weights 300 to 700.

Building blocks in `styles.css`:

- `.frame` + `.block`: the page is one bordered column; each section is a block with a top rule and registration marks.
- `.tiles`: a grid whose 1px gap is the hairline, so panels share borders.
- `.ph` / `.pb`: panel head (label + arrow) and body.
- `.lbl`: 11px tracked uppercase label. `.spec`: `KEY : value` table.
- `.meter` + `data-meter="n"`: segmented bar, lights `n` segments when scrolled into view.
- `.tag` (chamfered callout) and `.chip` (value badge).
- `[data-typewrite]`: text lights up character by character once, when seen.

Motion rules: the globe is the only ambient motion. Everything else runs once, on an event. `prefers-reduced-motion` turns it all off.

Copy rules: no em dashes.
