/* Q4 Labs: site behaviour. No dependencies. */
(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.remove("no-js");

  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  /* ---------- ASCII globe ---------- */
  let kickGlobe = null;               // phones: scroll hands the globe momentum
  let rollGlobe = null;               // desktop scene: scroll progress turns it directly
  const canvas = document.querySelector("#orb");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    /* Earth: a 1-degree land mask (assets/js/earth-mask.js). Every character cell on a
       fixed grid is mapped back onto the rotating sphere, so the glyphs stay aligned like
       a terminal while the continents turn underneath. */
    const MW = 360, MH = 180;
    let mask = null;
    try {
      const raw = atob(window.Q4_EARTH || "");
      if (raw.length === (MW * MH) / 8) {
        mask = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) mask[i] = raw.charCodeAt(i);
      }
    } catch (e) { mask = null; }
    const isLand = (latDeg, lonDeg) => {
      if (!mask) return false;
      const r = Math.min(MH - 1, Math.max(0, Math.floor(90 - latDeg)));
      const c = ((Math.floor(lonDeg + 180) % MW) + MW) % MW;
      const i = r * MW + c;
      return (mask[i >> 3] >> (i & 7)) & 1;
    };
    const ramp = ".:-=+*#%@";
    const LIGHT = (() => { const v = [-0.5, -0.55, 0.68], l = Math.hypot(...v); return v.map((x) => x / l); })();
    const DEG = 180 / Math.PI;

    /* Colours come from the stylesheet, with fallbacks: Safari can run this script
       before the stylesheet has loaded, and an empty colour draws black on black. */
    let green = "#3DDC84", line = "#8E9691";
    const readColours = () => {
      green = cssVar("--signal") || "#3DDC84";
      line = cssVar("--muted") || "#8E9691";
    };
    readColours();
    let size = 0, dpr = 1, running = true, raf = 0;

    /* Orientation is a 3x3 rotation matrix (trackball): horizontal drag turns around
       the screen's vertical axis, vertical drag around its horizontal axis. */
    const AUTO = 0.0032;
    let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let vx = AUTO, vy = 0;
    const mul = (A, B) => [
      A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
      A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
      A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
    ];
    const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
    const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
    function orthonormalize() {
      let [a, b] = [M.slice(0, 3), M.slice(3, 6)];
      const n = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
      a = n(a);
      const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      b = n(b.map((x, i) => x - d * a[i]));
      const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      M = [...a, ...b, ...c];
    }
    function turn(ax, ay) { M = mul(mul(rotY(ax), rotX(ay)), M); }
    turn(-0.35, -0.42);                 // open on Africa and Europe, tipped toward the viewer

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
      const R = size * 0.44, cx = size / 2, cy = size / 2;
      const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = M;

      // atmosphere: a soft green falloff just outside the limb, and a hairline rim
      const halo = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 1.12);
      halo.addColorStop(0, "rgba(61, 220, 132, 0.13)");
      halo.addColorStop(1, "rgba(61, 220, 132, 0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
      ctx.arc(cx, cy, R, 0, Math.PI * 2, true);   // ring only: the disc itself stays dark
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // character grid
      const rows = Math.round(Math.min(60, Math.max(30, size / 12.5)));
      const ch = (2 * R) / rows;
      const cw = ch * 0.6;
      const cols = Math.floor((2 * R) / cw);
      const x0 = cx - (cols * cw) / 2;
      const tol = 90 / rows;             // half a cell, in degrees, for the graticule test
      ctx.font = `500 ${ch.toFixed(2)}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = green;

      for (let j = 0; j < rows; j++) {
        const py = cy - R + (j + 0.5) * ch;
        const y = (py - cy) / R;
        for (let i = 0; i < cols; i++) {
          const px = x0 + (i + 0.5) * cw;
          const x = (px - cx) / R;
          const d2 = x * x + y * y;
          if (d2 >= 1) continue;
          const z = Math.sqrt(1 - d2);
          // screen normal back to the globe's own frame (M is orthonormal, so M^T inverts it)
          const wx = m0 * x + m3 * y + m6 * z;
          const wy = m1 * x + m4 * y + m7 * z;
          const wz = m2 * x + m5 * y + m8 * z;
          const lat = Math.asin(Math.max(-1, Math.min(1, -wy))) * DEG;
          const lon = Math.atan2(wx, wz) * DEG;
          const lit = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
          const b = (0.16 + 0.84 * lit) * (0.5 + 0.5 * z);   // light + limb darkening
          if (isLand(lat, lon)) {
            const k = Math.min(ramp.length - 1, Math.floor(b * ramp.length));
            ctx.globalAlpha = 0.28 + 0.72 * b;
            ctx.fillText(ramp[k], px, py);
          } else {
            const onLat = Math.abs(lat / 30 - Math.round(lat / 30)) * 30 < tol;
            const onLon = Math.abs(lon / 30 - Math.round(lon / 30)) * 30 * Math.cos(lat / DEG) < tol * 0.6;
            if ((onLat || onLon) && (i + j) % 2 === 0) {
              ctx.globalAlpha = 0.05 + 0.16 * b;
              ctx.fillText("·", px, py);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    let dragging = false, lastX = 0, lastY = 0, lastMove = 0;
    function loop() {
      if (!dragging) {
        turn(vx, vy);
        vx += (AUTO - vx) * 0.03;
        vy *= 0.95;
      }
      orthonormalize();
      draw();
      if (running) raf = requestAnimationFrame(loop);
    }

    const K = 0.008;
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      vx = 0; vy = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("dragging");
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
      if (reduceMotion || performance.now() - lastMove > 90) { vx = 0; vy = 0; }
    };
    /* Scrolling rolls the globe forward like a ball under the page, with momentum. */
    rollGlobe = (ax, ay) => { if (!dragging) { turn(ax, ay); if (!running) draw(); } };
    kickGlobe = (dy) => {
      if (dragging) return;
      vy = Math.max(-0.08, Math.min(0.08, vy + dy * 0.00012));
      vx += dy * 0.00003;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);
    window.addEventListener("resize", resize);
    resize();

    /* The loop pauses off screen. bfcache restores, tab wakes and GPU resets can
       leave it paused with a wiped canvas, so each "page is back" signal restarts it. */
    const onScreen = () => {
      const r = canvas.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    };
    function restart() {
      readColours();
      resize();
      cancelAnimationFrame(raf);
      running = !reduceMotion && onScreen();
      if (running) raf = requestAnimationFrame(loop);
    }
    window.addEventListener("load", () => { readColours(); resize(); });
    if (reduceMotion) {
      running = false;
    } else {
      raf = requestAnimationFrame(loop);
      new IntersectionObserver(([e]) => {
        running = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (running) raf = requestAnimationFrame(loop);
      }).observe(canvas);
    }
    window.addEventListener("pageshow", (e) => { if (e.persisted) restart(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) restart(); });
    canvas.addEventListener("contextrestored", restart);
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => { if (canvas.clientWidth !== size) resize(); }).observe(canvas);
    }
    if (document.fonts) document.fonts.ready.then(draw);
  }

  /* ---------- Leader lines: tag edge, short elbow, then straight to the globe ---------- */
  const NS = "http://www.w3.org/2000/svg";
  function drawLeaders(container) {
    const svg = container.querySelector(":scope > svg.leaders");
    if (!svg || getComputedStyle(svg).display === "none") return;
    const c = container.getBoundingClientRect();
    container.querySelectorAll("[data-leader]").forEach((el) => {
      const target = document.querySelector(el.dataset.leader);
      if (!target || !el.offsetParent) return;
      let L = el._leader;
      if (!L) {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("pathLength", "1");
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("r", 2.5);
        svg.append(p, dot);
        L = el._leader = { p, dot };
      }
      const a = el.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const tx = t.left + t.width / 2 - c.left, ty = t.top + t.height / 2 - c.top;
      const radius = (Math.min(t.width, t.height) / 2) * 0.88 * parseFloat(el.dataset.leaderR || "1");
      const left = a.left + a.width / 2 - c.left < tx;
      const sx = (left ? a.right : a.left) - c.left;
      const sy = a.top + a.height / 2 - c.top;
      const ex0 = sx + (left ? 32 : -32);
      const dx = tx - ex0, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
      const ex = tx - (dx / len) * radius, ey = ty - (dy / len) * radius;
      L.p.setAttribute("d", `M${sx} ${sy} H${ex0} L${ex} ${ey}`);
      L.dot.setAttribute("cx", ex); L.dot.setAttribute("cy", ey);
      const host = el.closest(".callout");
      const on = !host || host.classList.contains("on");
      L.p.classList.toggle("on", on); L.dot.classList.toggle("on", on);
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

  /* ---------- Hero scene ----------
     Desktop (motion allowed): the stage pins under the bar for a stretch of scroll.
     Progress 0 to 1 fades the headline out, slides the globe to centre while it
     grows and turns, then switches the callouts on one at a time.
     Phones: no pin. Scroll gives the globe momentum and a light parallax. */
  const scene = document.querySelector("[data-scene]");
  if (scene) {
    const stage = scene.querySelector(".scene__stage");
    const head = scene.querySelector(".hero-head");
    const view = scene.querySelector(".viewport");
    const globe = scene.querySelector(".globe");
    const grid = scene.querySelector(".viewport__grid");
    const callouts = [...scene.querySelectorAll(".callout")];
    const desk = window.matchMedia("(min-width: 901px)");
    const bar = document.querySelector(".bar");
    const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
    let pinned = false, lastY = window.scrollY, lastP = 0, queued = false;

    const update = () => {
      queued = false;
      const y = window.scrollY, dy = y - lastY;
      lastY = y;
      const r = scene.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      if (pinned) {
        const span = scene.offsetHeight - stage.offsetHeight;
        const p = Math.min(1, Math.max(0, ((bar ? bar.offsetHeight : 0) - r.top) / span));
        const dp = p - lastP;
        lastP = p;
        if (rollGlobe && dp) rollGlobe(dp * Math.PI, dp * 0.7);
        const h = Math.min(1, p / 0.18);
        head.style.setProperty("--ho", (1 - h).toFixed(3));
        head.style.setProperty("--hy", (-h * 48).toFixed(1) + "px");
        head.style.visibility = h >= 1 ? "hidden" : "";
        const g = ease(p / 0.32);
        globe.style.setProperty("--gx", ((1 - g) * stage.clientWidth * 0.2).toFixed(1) + "px");
        globe.style.setProperty("--ps", (0.8 + 0.22 * g).toFixed(4));
        grid.style.setProperty("--gy", (-p * 96).toFixed(1) + "px");
        callouts.forEach((c, i) => c.classList.toggle("on", p > 0.3 + i * 0.1));
      } else if (!reduceMotion) {
        if (kickGlobe && dy) kickGlobe(dy);
        const d = Math.max(0, Math.min(y, view.offsetHeight + 400));
        globe.style.setProperty("--py", (d * 0.25).toFixed(1) + "px");
        grid.style.setProperty("--gy", (d * 0.1).toFixed(1) + "px");
      }
      drawLeaders(view);
    };
    const setMode = () => {
      // a viewer frame that grows to the page height makes "100svh" the whole page: no pin there
      const realWindow = window.innerHeight <= (window.screen ? window.screen.height : 1600) + 80;
      pinned = desk.matches && !reduceMotion && realWindow;
      scene.classList.toggle("is-pinned", pinned);
      ["--ho", "--hy", "visibility"].forEach((k) => head.style.removeProperty(k));
      ["--gx", "--ps", "--py"].forEach((k) => globe.style.removeProperty(k));
      grid.style.removeProperty("--gy");
      if (!pinned) callouts.forEach((c) => c.classList.add("on"));
      lastP = 0;
      update();
      drawLeaders(view);
    };
    window.addEventListener("scroll", () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    desk.addEventListener("change", setMode);
    setMode();
  }

  /* ---------- Segmented meters ---------- */
  document.querySelectorAll("[data-meter]").forEach((m) => {
    const n = parseInt(getComputedStyle(m).getPropertyValue("--n") || "20", 10) || 20;
    const on = parseInt(m.dataset.meter, 10) || 0;
    for (let i = 0; i < n; i++) {
      const seg = document.createElement("i");
      seg.style.setProperty("--i", i);
      if (i < on) seg.className = "on";
      m.appendChild(seg);
    }
  });

  /* ---------- Typed transmission: the text is all there, it just lights up ---------- */
  document.querySelectorAll("[data-typewrite]").forEach((el) => {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    const done = document.createElement("span");
    const caret = document.createElement("span");
    const todo = document.createElement("span");
    done.className = "done"; caret.className = "caret"; todo.className = "todo";
    caret.setAttribute("aria-hidden", "true");
    el.replaceChildren(done, caret, todo);
    if (reduceMotion || !("IntersectionObserver" in window)) {
      done.textContent = text; el.classList.add("is-done");
      return;
    }
    todo.textContent = text;
    let i = 0;
    const tick = () => {
      i = Math.min(text.length, i + 1);
      done.textContent = text.slice(0, i);
      todo.textContent = text.slice(i);
      if (i < text.length) setTimeout(tick, text[i - 1] === "." ? 260 : 14 + Math.random() * 22);
      else el.classList.add("is-done");
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { io.disconnect(); setTimeout(tick, 300); }
    }, { threshold: 0.5 });
    io.observe(el);
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

  /* ---------- Reveal on scroll (opacity) + meters fill when seen ---------- */
  const watch = document.querySelectorAll(".reveal, [data-meter]");
  const show = (el) => el.classList.add(el.matches("[data-meter]") ? "is-on" : "in");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    watch.forEach(show);
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    watch.forEach((el) => io.observe(el));
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
