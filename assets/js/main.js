/* Q4 Labs — site behaviour. No dependencies. */
(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.remove("no-js");

  /* ---------- Theme toggle (dark default, remembered) ---------- */
  const toggle = document.querySelector(".theme-toggle");
  function setTheme(t) {
    root.dataset.theme = t;
    try { localStorage.setItem("q4-theme", t); } catch (e) {}
    if (toggle) toggle.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    window.dispatchEvent(new Event("q4:theme"));
  }
  if (toggle) {
    toggle.setAttribute("aria-label", root.dataset.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    toggle.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
  }

  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  /* ---------- ASCII orb ---------- */
  const canvas = document.querySelector("#orb");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const ramp = " .·:-=+*#%@";
    const N = 760;
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, i % 41 === 0 ? (i % 82 === 0 ? "q" : "4") : null]);
    }
    let size = 0, dpr = 1, green = cssVar("--green"), running = true, raf = 0;

    /* Orientation is a 3x3 rotation matrix (trackball), so dragging works the same
       way from any orientation: horizontal drag turns around the screen's vertical
       axis, vertical drag around its horizontal axis, diagonal does both. */
    const AUTO = 0.0035;              // idle spin speed (rad / frame)
    let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let vx = AUTO, vy = 0;            // current spin velocity around screen Y / X axes
    const mul = (A, B) => [
      A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
      A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
      A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
    ];
    const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
    const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
    function orthonormalize() {
      // keep M a clean rotation after many small multiplications
      let [a, b, c] = [M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)];
      const n = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
      a = n(a);
      const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      b = n(b.map((x, i) => x - d * a[i]));
      c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      M = [...a, ...b, ...c];
    }
    function turn(ax, ay) { M = mul(mul(rotY(ax), rotX(ay)), M); }
    turn(0.6, -0.38);                 // start slightly tilted toward the viewer

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      if (!size) return;
      ctx.clearRect(0, 0, size, size);
      const R = size * 0.43, cx = size / 2, cy = size / 2;
      const fs = Math.max(9, Math.round(size / 46));
      ctx.font = `600 ${fs}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = green;
      const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = M;
      for (const [px, py, pz, special] of pts) {
        const x = m0 * px + m1 * py + m2 * pz;
        const y = m3 * px + m4 * py + m5 * pz;
        const z2 = m6 * px + m7 * py + m8 * pz;   // +1 = facing the viewer
        const d = (z2 + 1) / 2;
        if (d < 0.08) continue;
        const ch = special && d > 0.55 ? special : ramp[Math.min(ramp.length - 1, Math.floor(d * (ramp.length - 1)) + 1)];
        ctx.globalAlpha = 0.12 + 0.88 * d * d;
        ctx.fillText(ch, cx + x * R, cy + y * R);
      }
      ctx.globalAlpha = 1;
    }
    let dragging = false, lastX = 0, lastY = 0, lastMove = 0;
    function loop() {
      if (!dragging) {
        turn(vx, vy);
        // momentum fades back into the slow idle spin
        vx += (AUTO - vx) * 0.03;
        vy *= 0.95;
      }
      orthonormalize();
      draw();
      if (running) raf = requestAnimationFrame(loop);
    }

    /* Drag to spin (mouse, pen, touch) */
    const K = 0.008;                  // radians per pixel dragged
    const orbWrap = canvas.closest(".hero__orb");
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      vx = 0; vy = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("dragging");
      if (orbWrap) orbWrap.classList.add("touched");
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; lastMove = performance.now();
      vx = dx * K; vy = -dy * K;
      turn(vx, vy);
      if (reduceMotion || !running) draw();
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove("dragging");
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      // held still before letting go: no fling
      if (reduceMotion || performance.now() - lastMove > 90) { vx = 0; vy = 0; }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    // the browser can take the pointer away mid-drag without a pointerup
    canvas.addEventListener("lostpointercapture", release);
    window.addEventListener("q4:theme", () => { green = cssVar("--green"); draw(); });
    window.addEventListener("resize", resize);
    resize();

    /* Keeping the animation alive.
       The loop pauses while the globe is off screen. Coming back via the browser's
       back/forward cache, waking a tab, or a GPU reset can leave it paused with a
       wiped canvas, so every "page is back" signal re-measures, redraws and restarts. */
    const onScreen = () => {
      const r = canvas.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    };
    function restart() {
      green = cssVar("--green");
      resize();                                   // re-allocates the canvas and redraws
      cancelAnimationFrame(raf);
      running = !reduceMotion && onScreen();
      if (running) raf = requestAnimationFrame(loop);
    }
    if (!reduceMotion) {
      const io = new IntersectionObserver(([e]) => {
        running = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (running) raf = requestAnimationFrame(loop);
      });
      io.observe(canvas);
    }
    window.addEventListener("pageshow", (e) => { if (e.persisted) restart(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) restart(); });
    canvas.addEventListener("contextrestored", restart);
    // canvas box can change size without a window resize (fonts loading, layout shifts)
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => { if (canvas.clientWidth !== size) resize(); }).observe(canvas);
    }
    if (document.fonts) document.fonts.ready.then(draw);
  }

  /* ---------- Leader lines (YZi-style) ---------- */
  const NS = "http://www.w3.org/2000/svg";
  function drawLeaders(container) {
    const svg = container.querySelector(":scope > svg.leaders");
    if (!svg) return;
    svg.replaceChildren();
    if (getComputedStyle(svg).display === "none") return;
    const c = container.getBoundingClientRect();
    container.querySelectorAll("[data-leader]").forEach((el) => {
      const target = document.querySelector(el.dataset.leader);
      if (!target || !el.offsetParent) return;
      const own = el.getBoundingClientRect();
      const boxEl = el.dataset.leaderBox ? el.closest(el.dataset.leaderBox) : null;
      const b = boxEl ? boxEl.getBoundingClientRect() : own;
      // underline sits under the element itself but runs out to the edge of its box
      const a = { left: Math.min(own.left, b.left), right: Math.max(own.right, b.right), top: own.top, bottom: own.bottom, width: b.width, height: own.height };
      const t = target.getBoundingClientRect();
      const tx = t.left + t.width / 2 - c.left;
      const ty = t.top + t.height / 2 - c.top;
      const radius = (Math.min(t.width, t.height) / 2) * parseFloat(el.dataset.leaderR || "1");
      const leftOfTarget = a.left + a.width / 2 - c.left < tx;
      const under = el.dataset.leaderUnder !== "false";
      const y0 = (under ? a.bottom : a.top + a.height / 2) - c.top;
      const xs = (leftOfTarget ? a.left : a.right) - c.left;
      const xe = (leftOfTarget ? a.right + 10 : a.left - 10) - c.left;
      const dx = tx - xe, dy = ty - y0, len = Math.hypot(dx, dy) || 1;
      const ex = tx - (dx / len) * radius, ey = ty - (dy / len) * radius;
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", `M${under ? xs : xe} ${y0} H${xe} L${ex} ${ey}`);
      svg.appendChild(p);
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", ex); dot.setAttribute("cy", ey); dot.setAttribute("r", 3);
      svg.appendChild(dot);
    });
  }
  const leaderBoxes = document.querySelectorAll("[data-leaders]");
  const redraw = () => leaderBoxes.forEach(drawLeaders);
  if (leaderBoxes.length) {
    redraw();
    window.addEventListener("resize", redraw);
    window.addEventListener("load", redraw);
    if (document.fonts) document.fonts.ready.then(redraw);
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(redraw);
      leaderBoxes.forEach((b) => ro.observe(b));
    }
  }

  /* ---------- Typed terminal lines ---------- */
  document.querySelectorAll("[data-type]").forEach((el) => {
    const text = el.dataset.type;
    if (reduceMotion) { el.textContent = text; return; }
    el.textContent = "";
    let i = 0;
    const start = parseInt(el.dataset.typeDelay || "400", 10);
    setTimeout(function tick() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, 22 + Math.random() * 30);
    }, start);
  });

  /* ---------- Flashcard flip ---------- */
  document.querySelectorAll("[data-flashcard]").forEach((btn) => {
    const q = btn.querySelector("[data-side='q']");
    const a = btn.querySelector("[data-side='a']");
    const label = btn.querySelector("small");
    const hint = btn.querySelector(".hint");
    btn.addEventListener("click", () => {
      const showingQ = !q.hidden;
      q.hidden = showingQ;
      a.hidden = !showingQ;
      label.textContent = showingQ ? "FLASHCARD · ANSWER" : "FLASHCARD · QUESTION";
      hint.textContent = showingQ ? "tap to see the question" : "tap to reveal the answer";
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
