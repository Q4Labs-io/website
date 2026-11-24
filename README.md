# Q4 Labs website

Static site, no build step: plain HTML, CSS and JS.

```
index.html        landing: hero + globe viewport, method, Yapflow demo, team, contact
projects.html     project index, Yapflow, log
lab.html          how we work (the loop + house rules) and contact
assets/css/styles.css   all styles; tokens are CSS variables in :root
assets/js/earth-mask.js land mask for the globe
assets/js/main.js       ASCII earth globe, scroll roll + parallax, leader lines, typed text, meters, flashcard, reveals
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

Dark only. Geist Mono for titles, labels, commands and data; Geist (sans) for paragraphs and buttons. One signal colour, hairlines, square corners.

References studied (live pages, Nov 2026): Linear (type, section intros, open columns, quiet nav), Stripe (bold lead-in paragraphs, text links over secondary buttons), Apple (scroll-pinned scenes), Framer (tight display type), Pentagram (the work is the hero).

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#070807` | page |
| `--panel` | `#0B0D0C` | panels |
| `--line` / `--line-2` | `#1B201D` / `#2A312D` | hairlines / stronger borders |
| `--text` / `--muted` / `--dim` | `#E8EBE8` / `#8E9691` / `#5A625D` | text levels |
| `--signal` | `#3DDC84` | brand green: live states, meters, primary action, text links |

Fonts (Google Fonts): Geist 400 to 600, Geist Mono 400 to 600.

Globe: an ASCII earth. `assets/js/earth-mask.js` holds a 1 degree land mask (Natural Earth 1:50m land, public domain, via world-atlas). Each character cell on a fixed grid is mapped back onto the rotating sphere; land is drawn in lit glyphs, ocean stays dark apart from faint 30 degree graticule dots, and a soft glow sits outside the limb. Brand name is written "Yapflow".

Building blocks in `styles.css`:

- `.frame` + `.block`: the page is one bordered column; each section has a top rule and registration marks.
- `.intro`: section opener. Mono command + big plain title on the left, one sentence on the right.
- `.cols` (`--2`, `--5`): open columns split by hairlines. Each item starts with a bold lead-in.
- `.btn--signal` (one per section), `.more` (text link with chevron), `.btn--light` (nav only).
- `.panel` / `.ph` / `.pb`: framed panels for product surfaces (demo, terminal).
- `.lbl`, `.cmd`, `.chip`, `.tag`: mono labels.
- `.meter` + `data-meter="n"`: segmented bar, lights `n` segments when seen.
- `[data-typewrite]`: text lights up character by character once, when seen.

Hero scene: on desktop the hero pins under the bar for about 1.6 screens of scroll. Progress fades the headline out, glides the globe to centre while it grows and turns, then switches the four callouts on one at a time with their leader lines drawing in. Phones get no pin: the globe takes scroll momentum and a light parallax. `prefers-reduced-motion` turns all of it off and shows everything.

Copy rules: no em dashes, no rhetorical headings, no decorative numbering or status text that isn't true.
