/* Q4 Labs: site behaviour. No dependencies. */
(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.remove("no-js");

  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const pad = (n, w = 2) => String(n).padStart(w, "0");

  /* ---------- Clock (status bar) + session timer (viewport) ---------- */
  const clocks = document.querySelectorAll("[data-clock]");
  const sessions = document.querySelectorAll("[data-session]");
  const t0 = Date.now();
  function tickClocks() {
    const d = new Date();
    const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    clocks.forEach((el) => (el.textContent = hms));
    const s = Math.floor((Date.now() - t0) / 1000);
    const elapsed = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    sessions.forEach((el) => (el.textContent = elapsed));
  }
  if (clocks.length || sessions.length) { tickClocks(); setInterval(tickClocks, 1000); }

  /* ---------- ASCII globe ---------- */
  const canvas = document.querySelector("#orb");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const ramp = " .·:-=+*#";
    const N = 760;
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, i % 41 === 0 ? (i % 82 === 0 ? "q" : "4") : null]);
    }
    /* graticule: 6 meridians + 5 parallels, sampled as polylines */
    const rings = [];
    const S = 72;
    for (let m = 0; m < 6; m++) {
      const a = (m / 6) * Math.PI, ring = [];
      for (let k = 0; k <= S; k++) {
        const t = (k / S) * Math.PI * 2;
        ring.push([Math.cos(t) * Math.cos(a), Math.sin(t), Math.cos(t) * Math.sin(a)]);
      }
      rings.push(ring);
    }
    for (const lat of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const r = Math.sqrt(1 - lat * lat), ring = [];
      for (let k = 0; k <= S; k++) {
        const t = (k / S) * Math.PI * 2;
        ring.push([Math.cos(t) * r, lat, Math.sin(t) * r]);
      }
      rings.push(ring);
    }

    let size = 0, dpr = 1, green = cssVar("--signal"), line = cssVar("--muted"), running = true, raf = 0, frame = 0;
    const yawEl = document.querySelector("[data-yaw]");
    const pitchEl = document.querySelector("[data-pitch]");

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
    turn(0.6, -0.38);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function telemetry() {
      if (!yawEl) return;
      const yaw = ((Math.atan2(M[2], M[0]) * 180) / Math.PI + 360) % 360;
      const pitch = (Math.asin(Math.max(-1, Math.min(1, -M[5]))) * 180) / Math.PI;
      yawEl.textContent = yaw.toFixed(1).padStart(5, "0");
      pitchEl.textContent = (pitch < 0 ? "-" : "+") + Math.abs(pitch).toFixed(1).padStart(4, "0");
    }
    function draw() {
      if (!size) return;
      ctx.clearRect(0, 0, size, size);
      const R = size * 0.44, cx = size / 2, cy = size / 2;
      const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = M;

      // rim
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // graticule: front half visible, back half faint
      ctx.strokeStyle = green;
      for (const ring of rings) {
        for (let k = 1; k < ring.length; k++) {
          const [ax, ay, az] = ring[k - 1], [bx, by, bz] = ring[k];
          const z = m6 * (ax + bx) / 2 + m7 * (ay + by) / 2 + m8 * (az + bz) / 2;
          ctx.globalAlpha = z > 0 ? 0.08 + 0.14 * z : 0.03;
          ctx.beginPath();
          ctx.moveTo(cx + (m0 * ax + m1 * ay + m2 * az) * R, cy + (m3 * ax + m4 * ay + m5 * az) * R);
          ctx.lineTo(cx + (m0 * bx + m1 * by + m2 * bz) * R, cy + (m3 * bx + m4 * by + m5 * bz) * R);
          ctx.stroke();
        }
      }

      // points
      const fs = Math.max(9, Math.round(size / 44));
      ctx.font = `600 ${fs}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = green;
      for (const [px, py, pz, special] of pts) {
        const z = m6 * px + m7 * py + m8 * pz;
        const d = (z + 1) / 2;
        if (d < 0.1) continue;
        const ch = special && d > 0.55 ? special : ramp[Math.min(ramp.length - 1, Math.floor(d * (ramp.length - 1)) + 1)];
        ctx.globalAlpha = 0.1 + 0.9 * d * d;
        ctx.fillText(ch, cx + (m0 * px + m1 * py + m2 * pz) * R, cy + (m3 * px + m4 * py + m5 * pz) * R);
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
      if (++frame % 6 === 0) telemetry();
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
      if (reduceMotion || !running) { draw(); telemetry(); }
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove("dragging");
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (reduceMotion || performance.now() - lastMove > 90) { vx = 0; vy = 0; }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);
    window.addEventListener("resize", resize);
    resize();
    telemetry();

    /* The loop pauses off screen. bfcache restores, tab wakes and GPU resets can
       leave it paused with a wiped canvas, so each "page is back" signal restarts it. */
    const onScreen = () => {
      const r = canvas.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    };
    function restart() {
      resize();
      cancelAnimationFrame(raf);
      running = !reduceMotion && onScreen();
      if (running) raf = requestAnimationFrame(loop);
    }
    if (reduceMotion) {
      running = false;
    } else {
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
    if (!svg) return;
    svg.replaceChildren();
    if (getComputedStyle(svg).display === "none") return;
    const c = container.getBoundingClientRect();
    container.querySelectorAll("[data-leader]").forEach((el) => {
      const target = document.querySelector(el.dataset.leader);
      if (!target || !el.offsetParent) return;
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
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", `M${sx} ${sy} H${ex0} L${ex} ${ey}`);
      svg.appendChild(p);
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", ex); dot.setAttribute("cy", ey); dot.setAttribute("r", 2.5);
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
