/* Grimoire: the projects and how they are revealed.
   The dial draws one at random after a time-stop (P4); the Index and the sigil row open one directly (P9).
   Each opens as a full-size spread of the book: real text on top, and behind it a canvas painted with the
   book's own pen (js/ink.js): paper, stains, ruling, a seal, a table of signs and lines of handwriting. */
"use strict";
(function () {
  /* grimoire.js normally provides this; the fallback keeps the page usable if it failed to load */
  const G = window.Grimoire || { ready: true, calm: () => matchMedia("(prefers-reduced-motion: reduce)").matches, reveal: cb => cb() };
  /* the four public repositories, in the words of their own descriptions. f is the page each one lives on. */
  const PROJECTS = [
    { n: "Cafeteria Pre-Order System", l: "C++", f: 7, u: "https://ali-ioi.github.io/CAFETERIA-PRE-ORDER-SYSTEM/", d: "University cafeteria pre-order system (BAUSTK, DSA I): a C++17 server on hand-built data structures. Live demo runs in your browser via WebAssembly." },
    { n: "Infinite Approximation", l: "C++", f: 19, u: "https://ali-ioi.github.io/INFINITE-APPROXIMATION/", d: "Type a family of curves, see its orthogonal trajectories. All maths in C++ compiled to WebAssembly." },
    { n: "Rihito's Journal", l: "CSS", f: 28, u: "https://ali-ioi.github.io/RIHITOS-JOURNAL/", d: "My Flight Path 2029 robotics tracker, from Arduino to ESP32, ROS 2, drones and a research Masters (plain HTML, CSS and JavaScript)." },
    { n: "Home Page", l: "HTML", f: 36, u: "https://ali-ioi.github.io/", d: "Home page for my projects." }
  ];
  const GLY = "△◇○▽✕＋";
  const $ = id => document.getElementById(id);
  const reader = $("reader"), index = $("index"), wipe = $("wipe");

  /* loader: goes once the book has drawn its first frame (or straight away without WebGL) */
  const loaded = () => $("loader").classList.add("done");
  if (G.ready) loaded(); else { document.addEventListener("grimoire-ready", loaded); setTimeout(loaded, 6000); }

  const el = (tag, props, kids) => { const e = Object.assign(document.createElement(tag), props); (kids || []).forEach(k => e.appendChild(k)); return e; };
  const hide = e => { e.setAttribute("aria-hidden", "true"); return e; };

  /* sigil row: one mark per project */
  let current = -1;
  PROJECTS.forEach((p, i) => {
    const sg = el("button", { className: "sg", type: "button", title: p.n, textContent: GLY[i % GLY.length] });
    sg.dataset.i = i; sg.setAttribute("aria-label", "Open " + p.n); $("sigils").appendChild(sg);
  });
  const paintSigils = () => document.querySelectorAll(".sg").forEach((b, i) => b.setAttribute("aria-current", String(i === current)));

  /* ---------- painting a spread ---------- */
  const paperImg = new Image();
  paperImg.src = "assets/paper/paper-color.jpg";            // CC0, see assets/paper/SOURCE.txt

  function ringText(c, text, cx, cy, r, size, color) {       // a name lettered round a circle, repeated to close the ring
    const s = (text + " · ").toUpperCase(), around = Math.PI * 2 * r;
    size = Math.min(size, around / (s.length * 0.82));        // small seals letter the name smaller so it still fits once
    const n = s.length * Math.max(1, Math.floor(around / (size * 0.82) / s.length));   // whole repeats only, so the ring closes cleanly
    c.save(); c.fillStyle = color; c.font = "700 " + size + "px Almendra, Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / n;
      c.save(); c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.rotate(a + Math.PI / 2); c.fillText(s[k % s.length], 0, 0); c.restore();
    }
    c.restore();
  }
  function sheet(c, x, y, w, h, gutter, dark, q) {           // paper, browned edges, the shadow of the fold, foxing and a tide mark
    c.fillStyle = paperImg.naturalWidth ? c.createPattern(paperImg, "repeat") : "#b9966a"; c.fillRect(x, y, w, h);
    c.fillStyle = dark ? "rgba(4,3,3,.93)" : "rgba(250,241,218,.8)"; c.fillRect(x, y, w, h);
    const tone = dark ? "106,13,13" : "96,58,22";
    let g = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(" + tone + ",0)"); g.addColorStop(1, "rgba(" + tone + "," + (dark ? 0.38 : 0.34) + ")");
    c.fillStyle = g; c.fillRect(x, y, w, h);
    if (gutter) {
      const gx = gutter === "right" ? x + w : x;
      g = c.createLinearGradient(gx, 0, gx + (gutter === "right" ? -70 : 70), 0);
      g.addColorStop(0, dark ? "rgba(0,0,0,.75)" : "rgba(70,42,18,.4)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(x, y, w, h);
    }
    for (let i = 0; i < 70; i++) {
      const fx = x + q() * w, fy = y + q() * h, r = 2 + q() * q() * 26, f = c.createRadialGradient(fx, fy, 0, fx, fy, r);
      f.addColorStop(0, "rgba(" + (dark ? "120,18,14" : "110,66,24") + "," + (0.05 + q() * 0.09) + ")"); f.addColorStop(1, "rgba(" + (dark ? "120,18,14" : "110,66,24") + ",0)");
      c.fillStyle = f; c.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
    c.strokeStyle = "rgba(" + tone + ",.2)"; c.lineWidth = 5; c.beginPath();
    const sx = x + w * (0.25 + q() * 0.5), sy = y + h * (0.25 + q() * 0.5), sr = Math.min(w, h) * (0.12 + q() * 0.1);
    for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2, rr = sr * (1 + 0.12 * Math.sin(t * 3) + 0.07 * Math.sin(t * 7)); c[i ? "lineTo" : "moveTo"](sx + Math.cos(t) * rr, sy + Math.sin(t) * rr * 0.6); }
    c.stroke();
  }
  function ruling(c, box, x0, y0, color) {                   // the ruled frame of the writing block, run out to the page edges as a scribe would
    const cs = getComputedStyle(box), l = x0 + parseFloat(cs.paddingLeft), r = x0 + box.clientWidth - parseFloat(cs.paddingRight),
      t = y0 + parseFloat(cs.paddingTop), b = y0 + Math.max(box.clientHeight, box.scrollHeight) - parseFloat(cs.paddingBottom);
    c.strokeStyle = color; c.lineWidth = 0.9; c.beginPath();
    [l - 6, l, r].forEach(xx => { c.moveTo(xx, y0); c.lineTo(xx, y0 + Math.max(box.clientHeight, box.scrollHeight)); });
    [t - 6, b].forEach(yy => { c.moveTo(x0, yy); c.lineTo(x0 + box.clientWidth, yy); });
    c.stroke();
  }

  function paintLeaf(dlg) {
    if (!dlg.open) return;
    const host = dlg.querySelector(".pages"), cv = dlg.querySelector(".leaf-art");
    const single = getComputedStyle(host).display === "flex";
    cv.style.height = "0px";                                 // measure the content without the canvas's old height, so it can shrink
    const W = host.clientWidth, H = single ? host.scrollHeight : host.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px";
    const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(dlg), dark = document.documentElement.getAttribute("data-theme") === "dark";
    const INK = cs.getPropertyValue("--ink").trim(), RED = cs.getPropertyValue("--red").trim();
    const hb = host.getBoundingClientRect(), top = host.scrollTop;
    const rel = e => { const r = e.getBoundingClientRect(); return [r.left - hb.left, r.top - hb.top + top, r.width, r.height]; };
    const seed = dlg._seed || 1;

    if (single) { sheet(c, 0, 0, W, H, null, dark, Ink.rng(seed * 31 + 1)); ruling(c, host, 0, 0, RED + "38"); }
    else host.querySelectorAll(".page").forEach((pg, n) => {
      const [x, y, w, h] = rel(pg);
      sheet(c, x, y, w, h, n === 0 ? "right" : "left", dark, Ink.rng(seed * 31 + n * 7 + 1));
      ruling(c, pg, x, y, RED + "38");
    });

    c.globalAlpha = 0.86;
    if (dark) { c.shadowColor = "rgba(244,240,234,.55)"; c.shadowBlur = 4; }
    host.querySelectorAll("[data-art]").forEach((a, n) => {
      const [x, y, w, h] = rel(a); if (w < 4 || h < 4) return;
      const q = Ink.rng(seed * 97 + n * 13 + 5), kind = a.dataset.art;
      c.strokeStyle = c.fillStyle = INK; c.globalAlpha = 0.86;
      if (kind === "seal") {                            // the name in runes round the rim and the work's planet at the centre; the name in letters outside
        const R = Math.min(w, h) / 2 * 0.8, cx = x + w / 2, cy = y + h / 2;
        Ink.seal(c, q, cx, cy, R, { word: a.dataset.name, planet: a.dataset.planet });
        if (a.dataset.name) ringText(c, a.dataset.name, cx, cy, R * 1.13, Math.max(10, R * 0.11), RED);
      } else if (kind === "table") {                    // the planetary hours: Sunday to Saturday, four hours from sunrise
        const tw = Math.min(w, h * 1.75); Ink.table(c, q, x + (w - tw) / 2, y, tw, h, 7, 4);
      } else if (kind === "rubric") {
        c.fillStyle = RED; Ink.line(c, a.dataset.text || "", x + w / 2, y + h * 0.72, Math.min(22, h * 0.6), "center", true, w);
      } else {                                          // the book's verse, kept lighter than the page's own text so that stays the thing you read first
        c.globalAlpha = 0.42; c.shadowBlur = 0;
        Ink.prose(c, x, y, w, h, 14, 24, seed * 13 + n * 29);
      }
    });
    c.globalAlpha = 1; c.shadowBlur = 0;
  }
  const paint = (dlg, seed) => { if (seed !== undefined) dlg._seed = seed; requestAnimationFrame(() => paintLeaf(dlg)); };
  const repaintOpen = () => [reader, index].forEach(d => { if (d.open) paint(d); });
  paperImg.addEventListener("load", repaintOpen);
  if (document.fonts) document.fonts.addEventListener("loadingdone", repaintOpen);
  let rz = 0; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(repaintOpen, 120); });
  /* the opening animation shrinks and tilts the spread, which skews every measurement: paint again once it has settled */
  [reader, index].forEach(d => d.querySelector(".pages").addEventListener("animationend", () => paintLeaf(d)));

  /* ---------- the reader: one project as a spread ---------- */
  function fillReader(i) {
    const p = PROJECTS[i], next = PROJECTS[(i + 1) % PROJECTS.length];
    $("r-fol-l").textContent = "Page " + (p.f - 1) + " of ∞";
    $("r-page").textContent = "Page " + p.f + " of ∞";          // the book never admits how many pages it has
    $("r-name").textContent = p.n;
    $("r-kind").textContent = "Written in " + p.l;
    $("r-desc").textContent = p.d;
    $("r-link").href = p.u;
    $("r-catch").textContent = next.n.split(" ")[0];
    /* each work's planet: Mercury, planet of reckoning and craft, for code; Venus, planet of beauty and appearance, for pages made to be looked at */
    const pl = p.l === "C++" ? ["mercury", "Mercury, planet of reckoning and craft"] : ["venus", "Venus, planet of beauty and of what is seen"];
    reader.querySelectorAll("[data-art=seal]").forEach(s => { s.dataset.name = p.n; s.dataset.planet = pl[0]; });
    reader.querySelector("[data-art=rubric]").dataset.text = "Here begins the work called " + p.n;
    reader.querySelectorAll(".seal-cap").forEach(e => { e.textContent = "Round the rim, its name in runes; at the centre, the sign of " + pl[1] + "."; });
  }
  function show(i) {
    current = i;
    fillReader(i);
    if (!G.calm()) { wipe.classList.remove("go"); void wipe.offsetWidth; wipe.classList.add("go"); }
    const pages = reader.querySelector(".pages");
    if (reader.open) { pages.style.animation = "none"; void pages.offsetWidth; pages.style.animation = ""; pages.scrollTop = 0; }
    else reader.showModal();
    paintSigils();
    paint(reader, 100 + i);
  }
  let ticket = 0;                                       // each draw gets a ticket; closing the book or opening the Index voids any draw still on its way
  function open(i) {                                    // i omitted: a random project, never the one already open
    const t = ++ticket;
    const draw = () => {                                // chosen when the page opens, so two quick draws can't land on the same project
      if (t !== ticket) return;
      let k = i;
      if (k === undefined) do { k = Math.floor(Math.random() * PROJECTS.length); } while (k === current && PROJECTS.length > 1);
      show(k);
    };
    if (reader.open) draw();                            // the time-stop would play hidden behind the open book, so just turn the page
    else G.reveal(draw);
  }
  reader.addEventListener("close", () => { ticket++; current = -1; paintSigils(); });
  $("r-again").addEventListener("click", () => open());
  $("r-close").addEventListener("click", () => reader.close());
  $("sigils").addEventListener("click", e => { const b = e.target.closest(".sg"); if (b) open(+b.dataset.i); });
  /* a plain click on the book opens a project; a press that turns into a drag only spins the book */
  let press = null;
  const stage = $("stage");
  stage.addEventListener("pointerdown", e => { press = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener("pointerup", e => {
    if (!press || reader.open || index.open) return;
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    press = null;
    if (moved < 6) open();
  });
  stage.addEventListener("pointercancel", () => { press = null; });

  /* ---------- the index: five ways of writing the contents (IX1 list, IX4 rings, IX8 ribbons, IX9 slips, IX10 table) ---------- */
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const pj = (i, cls, kids) => { const b = el("button", { className: "pj " + cls, type: "button" }, kids); b.dataset.i = i; return b; };
  const NS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs, kids) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); (kids || []).forEach(k => e.appendChild(k)); return e; };
  function rings() {
    const C = 200, step = 150 / PROJECTS.length, out = svg("svg", { class: "rings", viewBox: "0 0 400 400", role: "group", "aria-label": "The works written round a seal" });
    out.appendChild(svg("circle", { class: "core", cx: C, cy: C, r: 32 }));
    out.appendChild(svg("text", { class: "core-t", x: C, y: C + 5 }, [document.createTextNode("The Book")]));
    PROJECTS.forEach((p, i) => {
      const r = 38 + step * (i + 1), tr = r - 10, id = "ring-path-" + i;
      const g = svg("g", { class: "ring pj", role: "button", tabindex: "0", "aria-label": "Open " + p.n });
      g.dataset.i = i;
      g.append(
        svg("path", { id, d: `M${C - tr} ${C}a${tr} ${tr} 0 1 1 ${tr * 2} 0a${tr} ${tr} 0 1 1 ${-tr * 2} 0`, fill: "none" }),
        svg("circle", { class: "hit", cx: C, cy: C, r: r - step / 2, "stroke-width": step }),   // the whole band between rings is the tap target
        svg("circle", { class: "vis", cx: C, cy: C, r }),
        svg("text", { class: "nm" }, [svg("textPath", { href: "#" + id, startOffset: "25%", "text-anchor": "middle" }, [document.createTextNode(p.n)])]),
        svg("text", { class: "mark", "aria-hidden": "true" }, [svg("textPath", { href: "#" + id, startOffset: "75%", "text-anchor": "middle" }, [document.createTextNode(GLY[i % GLY.length] + " " + p.f)])])
      );
      out.appendChild(g);
    });
    return out;
  }
  const VIEWS = {
    list: body => body.appendChild(el("ol", {}, PROJECTS.map((p, i) => el("li", {}, [pj(i, "row", [hide(el("b", { textContent: "¶" })), el("span", { textContent: p.n }), hide(el("i")), el("em", { textContent: String(p.f) })])])))),
    rings: body => body.appendChild(rings()),
    ribbons: body => PROJECTS.forEach((p, i) => body.appendChild(pj(i, "rb", [el("span", { className: "rbf" }, [hide(el("b", { textContent: ROMAN[i] })), el("span", { textContent: p.n })])]))),
    labels: body => PROJECTS.forEach((p, i) => {
      const t = pj(i, "tg", [el("span", { textContent: p.n }), el("small", { textContent: "page " + p.f })]);
      t.style.setProperty("--h", [26, 84, 12, 56][i % 4] + "px"); t.style.setProperty("--rot", [-3, 2, -1.5, 3][i % 4] + "deg");
      body.appendChild(t);
    }),
    strips: body => PROJECTS.forEach((p, i) => body.appendChild(pj(i, "st", [el("span", { textContent: p.n })])))
  };
  let view = "list";
  try { const s = localStorage.getItem("grimoire-index-view"); if (VIEWS[s]) view = s; } catch (e) {}
  function renderIndex(v) {
    view = v;
    const body = $("ix-body"); body.textContent = ""; body.className = "ix-" + v;
    VIEWS[v](body);
    document.querySelectorAll("#ix-views button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    try { localStorage.setItem("grimoire-index-view", v); } catch (e) {}
    if (index.open) paint(index);
  }
  renderIndex(view);
  $("ix-views").addEventListener("click", e => { const b = e.target.closest("button"); if (b) renderIndex(b.dataset.v); });
  $("index-open").addEventListener("click", () => { ticket++; index.showModal(); paint(index, 7); });
  $("ix-close").addEventListener("click", () => index.close());
  const pick = b => { index.close(); open(+b.dataset.i); };
  index.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) pick(b); });
  index.addEventListener("keydown", e => {                // the rings are SVG, so Enter and Space are handled here
    const b = e.target.closest && e.target.closest("[role=button][data-i]");
    if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(b); }
  });

  /* L3 full bleed: after a few quiet seconds only the book, the name and the theme switch stay; any input brings the rest back */
  let idleT = 0;
  const wake = () => {
    document.body.classList.remove("idle"); clearTimeout(idleT);
    idleT = setTimeout(() => { if (!reader.open && !index.open) document.body.classList.add("idle"); }, 6000);
  };
  ["pointermove", "pointerdown", "keydown", "wheel"].forEach(t => window.addEventListener(t, wake, { passive: true }));
  wake();
  wipe.addEventListener("animationend", () => wipe.classList.remove("go"));
})();
