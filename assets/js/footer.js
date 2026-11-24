/* Q4 Labs: footer behaviour. No dependencies.
   1. The directory prompt shows the command each link would run.
   2. The ASCII field: the q4_labs wordmark rendered as a character grid, lit by a
      light that drifts on its own and follows the pointer. Faint crosshairs track
      the light; the readout in the corner is the light's own grid position. */
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Prompt ---------- */
  const cmd = document.querySelector("[data-sf-cmd]");
  if (cmd) {
    const idle = cmd.textContent;
    document.querySelectorAll(".sf__nav a[data-cmd]").forEach((a) => {
      const show = () => { cmd.textContent = a.dataset.cmd; };
      const hide = () => { cmd.textContent = idle; };
      a.addEventListener("mouseenter", show);
      a.addEventListener("focus", show);
      a.addEventListener("mouseleave", hide);
      a.addEventListener("blur", hide);
    });
  }

  /* ---------- Back to top: a short signal glitch, then home ----------
     ~540 ms in 45 ms steps. The page jitters, tear bands of ASCII noise and thin
     scan lines flicker, and the scroll jumps to the top halfway through, so the
     glitch resolves onto the hero. Reduced motion: a plain jump. */
  const toTop = document.querySelectorAll('a[href="#top"]');
  if (toTop.length) {
    const NOISE = ":-=+*#%@01/\\|_";
    const noise = (n) => { let s = ""; for (let i = 0; i < n; i++) s += NOISE[(Math.random() * NOISE.length) | 0]; return s; };
    let busy = false;
    const jump = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    toTop.forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const keyboard = e.detail === 0;
      const settle = () => {
        if (keyboard) { const home = document.querySelector(".bar .logo"); if (home) home.focus({ preventScroll: true }); }
      };
      if (reduceMotion || busy) { jump(); settle(); return; }
      busy = true;

      const layers = [".bar", "main", "footer"].map((s) => document.querySelector(s)).filter(Boolean);
      const ov = document.createElement("div");
      ov.className = "glitch";
      ov.setAttribute("aria-hidden", "true");
      const bars = Array.from({ length: 8 }, () => ov.appendChild(document.createElement("i")));
      const tag = ov.appendChild(document.createElement("b"));
      tag.textContent = "$ cd ~";
      document.body.appendChild(ov);

      const TOTAL = 12, JUMP_AT = 6;
      let n = 0;
      const tick = () => {
        n++;
        const hard = n % 3 === 0;
        layers.forEach((el) => {
          el.style.translate = `${((Math.random() * 2 - 1) * (hard ? 16 : 5)).toFixed(1)}px ${((Math.random() * 2 - 1) * 2).toFixed(1)}px`;
          el.style.opacity = hard ? "0.82" : "";
        });
        bars.forEach((b) => {
          const thin = Math.random() < 0.35;
          const h = thin ? 1 + ((Math.random() * 2) | 0) : 6 + Math.random() * 34;
          b.className = thin ? "line" : "";
          b.style.top = `${(Math.random() * 100).toFixed(1)}%`;
          b.style.height = `${h.toFixed(0)}px`;
          b.style.translate = `${((Math.random() * 2 - 1) * 60).toFixed(0)}px 0`;
          b.style.visibility = Math.random() < 0.75 ? "visible" : "hidden";
          b.textContent = thin ? "" : noise(160);
        });
        tag.style.visibility = n >= 3 && n <= 9 ? "visible" : "hidden";
        if (n === JUMP_AT) jump();
        if (n < TOTAL) { setTimeout(tick, 45); return; }
        layers.forEach((el) => { el.style.translate = ""; el.style.opacity = ""; });
        ov.remove();
        busy = false;
        settle();
      };
      tick();
    }));
  }

  /* back-to-top wakes up the first time it is fully in view */
  const btn = document.querySelector(".sf__totop");
  if (btn) {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { btn.classList.add("is-ready"); io.disconnect(); }
      }, { threshold: 1 });
      io.observe(btn);
    } else {
      btn.classList.add("is-ready");
    }
  }

  /* tree summary, counted from the markup so it never drifts */
  const sum = document.querySelector("[data-sf-tree]");
  if (sum) {
    const d = document.querySelectorAll(".sf__dir").length;
    const f = document.querySelectorAll(".sf__dir li").length;
    sum.textContent = `${d} ${d === 1 ? "directory" : "directories"}, ${f} ${f === 1 ? "file" : "files"}`;
  }

  /* ---------- 2. ASCII field ---------- */
  const field = document.querySelector("[data-sf-field]");
  const canvas = field && field.querySelector("canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const outX = field.querySelector("[data-sf-x]");
  const outY = field.querySelector("[data-sf-y]");
  const WORD = "q4_labs";
  const RAMP = ":-=+*#%@";
  const FONT = '"Geist Mono", ui-monospace, monospace';
  let green = "#3DDC84";
  const readColour = () => {
    green = getComputedStyle(document.documentElement).getPropertyValue("--signal").trim() || "#3DDC84";
  };

  let W = 0, H = 0, dpr = 1, ch = 11, cw = 6.6, cols = 0, rows = 0, ox = 0, oy = 0;
  let mask = new Uint8Array(0);            // 0 empty, 1 letter, 2 cursor block
  let lx = 0, ly = 0;                      // light, in CSS pixels
  let px = null, py = null;                // pointer target, when present
  let running = false, raf = 0, last = 0;

  function build() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ch = W < 640 ? 7 : W < 1000 ? 9 : 11;  // character cell height
    cw = ch * 0.6;
    cols = Math.floor(W / cw);
    rows = Math.floor(H / ch);
    ox = (W - cols * cw) / 2;
    oy = (H - rows * ch) / 2;

    // Rasterise the wordmark (plus the logo's block cursor) off screen, then sample per cell.
    const off = document.createElement("canvas");
    off.width = Math.ceil(W);
    off.height = Math.ceil(H);
    const o = off.getContext("2d");
    o.font = `600 100px ${FONT}`;
    const unit = o.measureText(WORD).width / 100;          // width per px of font size
    const block = 0.62 * (unit / WORD.length);              // cursor width, as in the logo
    const gap = 0.18 * (unit / WORD.length);
    const fitW = (W * 0.9) / (unit + gap + block);
    const fitH = (H * 0.86) / 0.98;                        // ascender to descender, roughly
    const fs = Math.max(24, Math.min(fitW, fitH));
    const textW = unit * fs, total = textW + (gap + block) * fs;
    const x0 = (W - total) / 2;
    const base = H / 2 + fs * 0.27;                         // optical centre for lowercase
    o.font = `600 ${fs}px ${FONT}`;
    o.textBaseline = "alphabetic";
    o.fillStyle = "#ffffff";
    o.fillText(WORD, x0, base);
    o.fillStyle = "#ff0000";
    o.fillRect(x0 + textW + gap * fs, base - fs * 0.72, block * fs, fs * 0.86);
    const img = o.getImageData(0, 0, off.width, off.height).data;

    mask = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      const sy = Math.min(off.height - 1, Math.round(oy + (j + 0.5) * ch));
      for (let i = 0; i < cols; i++) {
        const sx = Math.min(off.width - 1, Math.round(ox + (i + 0.5) * cw));
        const k = (sy * off.width + sx) * 4;
        if (img[k + 3] > 120) mask[j * cols + i] = img[k + 1] < 100 ? 2 : 1;
      }
    }
    if (!lx) { lx = W * 0.32; ly = H * 0.45; }
    draw();
  }

  function draw() {
    if (!cols) return;
    ctx.clearRect(0, 0, W, H);
    ctx.font = `500 ${ch.toFixed(2)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = green;
    const sigma = Math.max(W * 0.13, 90);
    const s2 = 2 * sigma * sigma;
    const li = Math.floor((lx - ox) / cw), lj = Math.floor((ly - oy) / ch);

    for (let j = 0; j < rows; j++) {
      const y = oy + (j + 0.5) * ch;
      const dy = y - ly;
      for (let i = 0; i < cols; i++) {
        const x = ox + (i + 0.5) * cw;
        const dx = x - lx;
        const g = Math.exp(-(dx * dx + dy * dy) / s2);
        const m = mask[j * cols + i];
        if (m === 1) {
          const b = 0.3 + 0.7 * g;
          ctx.globalAlpha = 0.35 + 0.65 * b;
          ctx.fillText(RAMP[Math.min(RAMP.length - 1, Math.floor(b * RAMP.length))], x, y);
        } else if (m === 2) {
          // the logo's block cursor, built from the same cells: small square pixels
          ctx.globalAlpha = 0.4 + 0.5 * g;
          ctx.fillRect(x - cw / 2 + 0.75, y - ch / 2 + 0.75, cw - 1.5, ch - 1.5);
        } else if (i === li || j === lj) {
          // tracking crosshair through the light, dotted
          if ((i + j) % 2 === 0) { ctx.globalAlpha = 0.1 + 0.25 * g; ctx.fillText("·", x, y); }
        } else if (i % 4 === 0 && j % 2 === 0) {
          ctx.globalAlpha = 0.05 + 0.35 * g;
          ctx.fillText("·", x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (outX) outX.textContent = String(Math.max(0, li)).padStart(3, "0");
    if (outY) outY.textContent = String(Math.max(0, lj)).padStart(2, "0");
  }

  function frame(t) {
    raf = 0;
    if (!running) return;
    if (t - last >= 33) {                   // ~30 fps is plenty for a slow light
      last = t;
      const tx = px !== null ? px : W * (0.5 + 0.4 * Math.sin(t * 0.00021));
      const ty = py !== null ? py : H * (0.5 + 0.28 * Math.sin(t * 0.00037 + 1.3));
      lx += (tx - lx) * 0.08;
      ly += (ty - ly) * 0.08;
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!reduceMotion && !raf) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
    if (reduceMotion) { lx = px; ly = py; draw(); }   // follows the pointer, but no easing or drift
  };
  canvas.addEventListener("pointermove", point);
  canvas.addEventListener("pointerdown", point);
  canvas.addEventListener("pointerleave", () => { px = py = null; });
  canvas.addEventListener("pointercancel", () => { px = py = null; });

  readColour();
  build();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
  } else {
    start();
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => { if (canvas.clientWidth !== W || canvas.clientHeight !== H) build(); }).observe(canvas);
  } else {
    window.addEventListener("resize", build);
  }
  // the wordmark is drawn with the web font: rebuild once it has loaded
  if (document.fonts && document.fonts.load) document.fonts.load(`600 100px ${FONT}`).then(build).catch(() => {});
  window.addEventListener("load", () => { readColour(); build(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stop(); return; }
    const r = canvas.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) start();
  });
})();
