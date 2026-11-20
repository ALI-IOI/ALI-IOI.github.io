/* Grimoire: theme toggle + the 3D coverless book (a ring of manuscript pages turning around a spine).
   Light mode: aged paper, gold edges, a green-tinted mist, a clock dial and a time-stop / rewind cycle.
   Dark mode: jet-black pages, white ink, red edges, and red-and-black glitch bursts.
   site.js drives the project reveal through window.Grimoire (see "api" below). */
"use strict";
(function () {
  const root = document.documentElement;
  const KEY = "grimoire-theme";
  const theme = () => (root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  /* ---------- theme toggle ---------- */
  const btn = document.getElementById("mode");
  const paint = () => btn.setAttribute("aria-checked", String(theme() === "dark"));

  /* what site.js may ask of the book. These defaults stand when WebGL is missing: no book, so a reveal just opens. */
  const api = window.Grimoire = {
    ready: false,
    calm: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    reveal: cb => cb()           // stop time, then call cb
  };
  const announce = () => { api.ready = true; document.dispatchEvent(new Event("grimoire-ready")); };
  btn.addEventListener("click", () => {
    const next = theme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    paint();
  });
  paint();

  /* ---------- 3D scene ---------- */
  const canvas = document.getElementById("scene");
  const stage = document.getElementById("stage");
  let renderer;
  try {
    if (!window.THREE) throw new Error("three.js missing");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    document.getElementById("nogl").hidden = false;
    stage.style.cursor = "default"; stage.setAttribute("aria-label", "The grimoire");
    announce();
    return;
  }
  const coarse = matchMedia("(pointer: coarse)").matches;

  /* motion: follows the system "reduce motion" setting until the Motion button is used */
  const MKEY = "grimoire-motion", motionBtn = document.getElementById("motion");
  let calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try { const s = localStorage.getItem(MKEY); if (s === "full") calm = false; else if (s === "calm") calm = true; } catch (e) {}
  function paintMotion() {
    document.getElementById("motion-text").textContent = calm ? "Motion off" : "Motion on";
    document.body.classList.toggle("calm", calm);
  }
  api.calm = () => calm;
  motionBtn.hidden = false;
  motionBtn.addEventListener("click", () => { calm = !calm; try { localStorage.setItem(MKEY, calm ? "calm" : "full"); } catch (e) {} paintMotion(); });
  paintMotion();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const rand = (a, b) => a + Math.random() * (b - a);
  const { rng, prose, line, seal, table } = window.Ink;   // the pen shared with the full-size pages (js/ink.js)

  /* book dimensions */
  const N = coarse ? 32 : 40;          // pages
  const V = 4;                         // different page designs, dealt round the ring in turn
  const R0 = 0.15, R1 = 1.3, H = 2.3;  // spine radius, page reach, page height
  const BEND = 1.0;                    // how far a page curls round the spine (radians)

  /* A point on one page: u runs spine -> fore-edge, v runs bottom -> top.
     Old paper is never flat or square: each design gets its own cockle (waviness) and an uneven hand-cut edge. */
  const pageSurface = ph => (u, v) => {
    const cockle = u * (0.022 * Math.sin(v * 5.3 + ph) + 0.009 * Math.sin(v * 13 + u * 7 + ph * 2));
    const ragged = 1 + u * u * (0.006 * Math.sin(v * 37 + ph) + 0.004 * Math.sin(v * 91 + ph * 3));
    const r = (R0 + u * (R1 - R0)) * ragged, a = BEND * u * u + cockle;
    return [r * Math.cos(a), (v - 0.5) * H * (1 + 0.006 * Math.sin(u * 31 + ph)), r * Math.sin(a)];
  };
  /* triangulated strips of a surface, merged into one geometry */
  /* Texture u follows the distance along the curled page rather than the raw parameter, so writing and seals keep their
     shape all the way to the fore-edge. ARC is the cumulative arc length across the middle of a page. */
  const ARC = (() => {
    const s = pageSurface(0), t = [0]; let p = s(0, 0.5);
    for (let i = 1; i <= 200; i++) { const q = s(i / 200, 0.5); t.push(t[i - 1] + Math.hypot(q[0] - p[0], q[2] - p[2])); p = q; }
    return t;
  })();
  const PAGE_W = ARC[200];                                 // the page's real width, measured round its curl
  const arcU = u => {
    if (u >= 1) return 1 + (u - 1) * (ARC[200] - ARC[199]) * 200 / PAGE_W;
    if (u <= 0) return u;
    const f = u * 200, i = Math.min(199, Math.floor(f));
    return (ARC[i] + (ARC[i + 1] - ARC[i]) * (f - i)) / PAGE_W;
  };
  function sheet(surf, strips) {
    const pos = [], uv = [], idx = [];
    strips.forEach(([u0, u1, v0, v1, nu, nv]) => {
      const base = pos.length / 3;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = u0 + (u1 - u0) * i / nu, v = v0 + (v1 - v0) * j / nv;
        pos.push(...surf(u, v)); uv.push(arcU(u), v);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const E = 0.014, T = 0.007;          // gilt liner width along the fore-edge, and along top and bottom

  /* ---------- page art: real paper underneath, hand-drawn manuscript on top ---------- */
  const TW = 1024, LH = 1885;          // texture is square; LH is the page height in "drawing" pixels, so circles stay round on the tall page
  const INK = "rgba(48,31,16,.86)", RED = "rgba(138,26,18,.9)";

  function paintPage(v, mapCanvas, glowCanvas, paper) {
    const a = mapCanvas.getContext("2d"), b = glowCanvas.getContext("2d"), q0 = rng(11 + v * 97);
    a.setTransform(1, 0, 0, 1, 0, 0); b.setTransform(1, 0, 0, 1, 0, 0);
    /* the sheet: a photographed paper texture, lifted from kraft brown to parchment */
    if (paper) a.drawImage(paper, 0, 0, TW, TW); else { a.fillStyle = "#b9966a"; a.fillRect(0, 0, TW, TW); }
    a.fillStyle = "rgba(250,241,218,.8)"; a.fillRect(0, 0, TW, TW);
    b.fillStyle = "#000"; b.fillRect(0, 0, TW, TW);
    /* age: browned edges, foxing spots and one tide-mark */
    [[0, 0, 150, 0], [TW, 0, TW - 110, 0], [0, 0, 0, 90], [0, TW, 0, TW - 110]].forEach(([x0, y0, x1, y1], i) => {
      const g = a.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, i ? "rgba(96,58,22,.3)" : "rgba(70,42,18,.4)"); g.addColorStop(1, "rgba(96,58,22,0)");
      a.fillStyle = g; a.fillRect(0, 0, TW, TW);
    });
    for (let i = 0; i < 70; i++) {
      const x = q0() * TW, y = q0() * TW, r = 3 + q0() * q0() * 38, g = a.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(110,66,24," + (0.1 + q0() * 0.2) + ")"); g.addColorStop(1, "rgba(110,66,24,0)");
      a.fillStyle = g; a.fillRect(x - r, y - r, r * 2, r * 2);
    }
    a.strokeStyle = "rgba(104,66,28,.2)"; a.lineWidth = 7; a.beginPath();
    const sx = 250 + q0() * 500, sy = 250 + q0() * 500, sr = 120 + q0() * 130;
    for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2, rr = sr * (1 + 0.12 * Math.sin(t * 3 + v) + 0.07 * Math.sin(t * 7)); a[i ? "lineTo" : "moveTo"](sx + Math.cos(t) * rr, sy + Math.sin(t) * rr * 0.6); }
    a.stroke();

    /* the writing, drawn twice with the same strokes: ink on the paper, and a mask that glows in dark mode */
    /* the drawing is laid out 1024 units wide and LH tall; one unit must be the same real length across and down,
       so the layout is narrowed to the page's true proportions and centred, leaving wider outer margins */
    const kx = TW * H / (LH * PAGE_W), ox = (TW - TW * kx) / 2;
    a.setTransform(kx, 0, 0, TW / LH, ox, 0); b.setTransform(kx, 0, 0, TW / LH, ox, 0);
    const draw = (red, fn) => {
      const seed = Math.floor(q0() * 1e9) + 1;
      a.strokeStyle = a.fillStyle = red ? RED : INK; b.strokeStyle = b.fillStyle = red ? "#fff" : "rgba(255,255,255,.72)";
      fn(a, rng(seed)); fn(b, rng(seed));
    };
    const L = 130, Rm = 925, TOPM = 150, BOT = LH - 190, GAP = 36, MID = (L + Rm) / 2;
    /* blocks of the book's verse (js/ink.js); each block starts at a different word so no two pages read the same */
    let k = 0;                                             // each block of verse on a page starts on a different sentence
    const lines = (y0, y1, x0 = L, x1 = Rm, from, dropCap) => { const f = from === undefined ? v * 3 + 1 + k++ : from; draw(false, c => prose(c, x0, y0 - 26, x1 - x0, y1 - y0 + 26, 27, GAP, f, dropCap)); };
    const rubric = (text, x, y, size, align) => draw(true, c => line(c, text, x, y, size, align, true, Rm - L));
    rubric(["Here begins the book that has no end", "Of the seal and its name", "Of the hours of the planets", "Of the two seals"][v], MID, TOPM - 26, 40, "center");
    if (v === 0) {
      draw(true, c => { c.lineWidth = 5; c.strokeRect(L, TOPM, 118, 118); line(c, "H", L + 59, TOPM + 98, 96, "center", true); });   // the initial of "Here begins"
      lines(TOPM + 22, TOPM + 110, L + 140, Rm, 0, true);
      lines(TOPM + 150, 900);
      rubric("Of the dial, and of stopping the hours", L, 958, 30, "left");
      lines(1000, BOT);
    } else if (v === 1) {
      lines(TOPM, 470);
      draw(false, (c, q) => seal(c, q, MID, 860, 310));                                   // GRIMOIRE in runes, Saturn at the centre
      rubric("Its rim spells GRIMOIRE; at its heart, Saturn, who keeps time.", MID, 1243, 25, "center");
      lines(1290, BOT);
    } else if (v === 2) {
      lines(TOPM, 380);
      draw(false, (c, q) => table(c, q, L + 20, 440, Rm - L - 40, 520, 7, 6));            // Sunday to Saturday, six hours from sunrise
      rubric("Across from Sunday, down from sunrise.", L, 1038, 28, "left");
      lines(1080, BOT);
    } else {
      draw(false, (c, q) => seal(c, q, L + 205, TOPM + 210, 195, { word: "TIME", planet: "saturn" }));
      draw(false, (c, q) => seal(c, q, Rm - 205, TOPM + 210, 195, { word: "HOURS", planet: "sun" }));
      lines(TOPM + 470, 1150);
      rubric("Left, the seal of time; right, the seal of the hours.", L, 1208, 26, "left");
      lines(1250, BOT);
    }
  }

  const pageMats = [], edgeMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.32, metalness: 0.55 });
  const spineMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 });
  const pageCanvases = [];
  for (let v = 0; v < V; v++) {
    const mc = document.createElement("canvas"), gc = document.createElement("canvas");
    mc.width = mc.height = gc.width = gc.height = TW;
    paintPage(v, mc, gc, null);
    const map = new THREE.CanvasTexture(mc), glowMap = new THREE.CanvasTexture(gc);
    map.encoding = THREE.sRGBEncoding; map.anisotropy = glowMap.anisotropy = 8;
    pageCanvases.push([mc, gc, map, glowMap]);
    pageMats.push(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.92, metalness: 0, map, emissive: 0x000000, emissiveMap: glowMap }));
  }
  /* the photographed paper (CC0, see assets/paper/SOURCE.txt): colour under the ink, normal map for the fibre relief */
  const paperImg = new Image();
  const repaintPages = () => pageCanvases.forEach(([mc, gc, map, glowMap], v) => { paintPage(v, mc, gc, paperImg.naturalWidth ? paperImg : null); map.needsUpdate = glowMap.needsUpdate = true; });
  paperImg.onload = repaintPages;
  /* the writing is set in the scribal hand, which arrives with the font stylesheet a little after the page: paint again once it is here */
  if (document.fonts) {
    let tries = 0;
    const waitForHand = () => Promise.all([document.fonts.load("400 27px Fondamento"), document.fonts.load("700 40px Almendra")])
      .then(([a, b]) => { if (a.length && b.length) repaintPages(); else if (++tries < 40) setTimeout(waitForHand, 500); }, () => {});
    waitForHand();
  }
  paperImg.src = "assets/paper/paper-color.jpg";
  new THREE.TextureLoader().load("assets/paper/paper-normal.jpg", tex => {
    pageMats.forEach(mat => { mat.normalMap = tex; mat.normalScale = new THREE.Vector2(0.7, 0.7); mat.needsUpdate = true; });
  });

  const book = new THREE.Group(), pageSets = [], edgeSets = [];
  for (let v = 0; v < V; v++) {
    const surf = pageSurface(v * 1.7 + 0.4), count = Math.ceil((N - v) / V);
    const p = new THREE.InstancedMesh(sheet(surf, [[0, 1, 0, 1, 14, 12]]), pageMats[v], count);
    const e = new THREE.InstancedMesh(sheet(surf, [[1, 1 + E, -T, 1 + T, 1, 12], [0, 1, 1, 1 + T, 14, 1], [0, 1, -T, 0, 14, 1]]), edgeMat, count);
    p.frustumCulled = e.frustumCulled = false;
    pageSets.push(p); edgeSets.push(e); book.add(p, e);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, H * 1.01, 16), spineMat);
  book.add(spine);
  const tilt = new THREE.Group(); tilt.rotation.set(0.16, 0, -0.07); tilt.add(book);
  scene.add(tilt);

  /* ---------- time magic (light mode): a clock dial behind the book and a stasis sphere ---------- */
  function dialTexture(kind) {
    const S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"); x.translate(S / 2, S / 2); x.strokeStyle = x.fillStyle = "#fff"; x.lineCap = "round";
    const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(0, 0, r * S, 0, Math.PI * 2); x.stroke(); };
    const tick = (a, r0, r1, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(Math.cos(a) * r0 * S, Math.sin(a) * r0 * S); x.lineTo(Math.cos(a) * r1 * S, Math.sin(a) * r1 * S); x.stroke(); };
    if (kind === 0) {                                   // outer ring: minute ticks and Roman hours
      ring(0.485, 3); ring(0.455, 2); ring(0.365, 2);
      for (let i = 0; i < 60; i++) tick(i * Math.PI / 30, i % 5 ? 0.467 : 0.455, 0.485, i % 5 ? 2 : 5);
      x.font = "600 46px Georgia, 'Times New Roman', serif"; x.textAlign = "center"; x.textBaseline = "middle";
      ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"].forEach((n, i) => {
        x.save(); x.rotate(i * Math.PI / 6); x.fillText(n, 0, -0.41 * S); x.restore();
      });
    } else if (kind === 1) {                            // inner ring: twenty-four divisions, turns the other way
      ring(0.33, 2); ring(0.3, 2); ring(0.07, 2);
      for (let i = 0; i < 24; i++) tick(i * Math.PI / 12, 0.3, i % 2 ? 0.315 : 0.33, i % 6 ? 2 : 5);
      for (let i = 0; i < 8; i++) tick(i * Math.PI / 4, 0.07, 0.3, 1.2);
    } else {                                            // a hand: long for minutes, short for hours
      const len = kind === 2 ? 0.44 : 0.27, w = kind === 2 ? 0.012 : 0.02;
      x.beginPath(); x.moveTo(0, 0.05 * S); x.lineTo(w * S, 0); x.lineTo(0, -len * S); x.lineTo(-w * S, 0); x.closePath(); x.fill();
      x.beginPath(); x.arc(0, 0, 0.022 * S, 0, Math.PI * 2); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  const dial = new THREE.Group(), dialParts = [];
  for (let k = 0; k < 4; k++) {
    const mat = new THREE.MeshBasicMaterial({ map: dialTexture(k), color: 0xa87b12, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 5.3), mat);
    mesh.position.z = k * 0.01; dialParts.push(mesh); dial.add(mesh);
  }
  scene.add(dial);

  function sphereTexture() {                             // a translucent blue ball with a bright rim
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d"), g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, "rgba(255,255,255,.10)"); g.addColorStop(0.7, "rgba(255,255,255,.22)"); g.addColorStop(0.9, "rgba(255,255,255,.5)");
    g.addColorStop(0.96, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  }
  const stasis = new THREE.Sprite(new THREE.SpriteMaterial({ map: sphereTexture(), color: 0x4ea2f5, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  stasis.renderOrder = 10; scene.add(stasis);

  /* one loop of the cycle: flow, slow to a stop, hold, run backwards, snap forward. Returns [time scale, sphere strength]. */
  const CYCLE = 10;
  function timeCycle(c) {
    if (c < 6.2) return [1, 0];
    if (c < 6.5) { const k = (c - 6.2) / 0.3; return [1 - k, k]; }
    if (c < 7.7) return [0, 1];
    if (c < 8.6) return [-1.6, 1];
    if (c < 9.2) { const k = (c - 8.6) / 0.6; return [2.2 - 1.2 * k, 1 - k]; }
    return [1, 0];
  }

  /* ---------- atmosphere ---------- */
  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glow = glowTexture();
  const TOP = 2.4;

  /* motes: they fall as green-tinted droplets of mist in light, and rise as embers in dark */
  const M = coarse ? 70 : 150, mote = new Float32Array(M * 3), moteSeed = [];
  for (let i = 0; i < M; i++) {
    const a = Math.random() * Math.PI * 2, r = rand(1.5, 3.2);
    mote[i * 3] = Math.cos(a) * r; mote[i * 3 + 1] = rand(-TOP, TOP); mote[i * 3 + 2] = Math.sin(a) * r;
    moteSeed.push(rand(0.05, 0.17));
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(mote, 3));
  const moteMat = new THREE.PointsMaterial({ size: 0.06, map: glow, transparent: true, opacity: 0.9, depthWrite: false });
  scene.add(new THREE.Points(moteGeo, moteMat));

  /* streaks: thin falling lines, the "rain" of the mist; light mode only */
  const K = coarse ? 36 : 80, streak = new Float32Array(K * 6), streakSeed = [];
  for (let i = 0; i < K; i++) {
    const a = Math.random() * Math.PI * 2, r = rand(0.9, 3.4), len = rand(0.12, 0.34), y = rand(-TOP, TOP);
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    streak.set([px, y, pz, px, y - len, pz], i * 6);
    streakSeed.push(rand(0.9, 1.9));
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streak, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0x4fb787, transparent: true, opacity: 0.5, depthWrite: false });
  scene.add(new THREE.LineSegments(streakGeo, streakMat));

  /* smoke: soft puffs that sink in light and smoulder upwards in dark */
  const smoke = [];
  for (let i = 0; i < (coarse ? 8 : 14); i++) {
    const mat = new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat), a = Math.random() * Math.PI * 2, r = rand(0.5, 2.3), sc = rand(1.3, 2.7);
    s.position.set(Math.cos(a) * r, rand(-TOP, TOP), Math.sin(a) * r); s.scale.set(sc, sc * 1.25, 1);
    s.userData = { x: s.position.x, sway: rand(0.2, 0.6), ph: rand(0, 6.28), v: rand(0.1, 0.24), o: rand(0.6, 1) };
    smoke.push(s); scene.add(s);
  }

  /* bolts: jagged red arcs that only exist during a glitch burst */
  const B = 9, SEG = 7, bolt = new Float32Array(B * SEG * 6);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute("position", new THREE.BufferAttribute(bolt, 3));
  const bolts = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0xa01515).convertSRGBToLinear(), transparent: true, opacity: 0.95 }));
  bolts.visible = false; bolts.frustumCulled = false; scene.add(bolts);
  function strikeBolts() {
    for (let b = 0; b < B; b++) {
      const a = Math.random() * Math.PI * 2, r = rand(0.3, 1.5);
      let x = Math.cos(a) * r, y = rand(-1.3, 1.3), z = Math.sin(a) * r;
      const dx = Math.cos(a) * 0.2, dz = Math.sin(a) * 0.2, dy = rand(-0.12, 0.12);
      for (let s = 0; s < SEG; s++) {
        const nx = x + dx + rand(-0.16, 0.16), ny = y + dy + rand(-0.22, 0.22), nz = z + dz + rand(-0.16, 0.16);
        bolt.set([x, y, z, nx, ny, nz], (b * SEG + s) * 6);
        x = nx; y = ny; z = nz;
      }
    }
    boltGeo.attributes.position.needsUpdate = true;
  }

  /* lights */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1); key.position.set(3, 4, 5);
  const core = new THREE.PointLight(0xffffff, 1, 7); core.position.set(0, 0, 0.9);
  scene.add(hemi, key, core);

  /* ---------- the two looks, blended by m (0 = light, 1 = dark) ---------- */
  const C = h => new THREE.Color(h);
  const D = h => new THREE.Color(h).convertSRGBToLinear();   // dark-mode colours are given as true screen colours, so crimson stays crimson
  /* light edges are Gold (#FFD700); dark edges are Dragon's blood (#6A0D0D), lit from within so the dark red still reads on black */
  const LOOK = {
    page: [C(0xffffff), D(0x020202)], pageGlow: [C(0x000000), D(0xf4f0ea)],
    edge: [C(0xffd700), D(0x2a0505)], edgeGlow: [C(0x7a5c00), D(0x6a0d0d)],
    spine: [C(0xe6c200), D(0x140303)], spineGlow: [C(0x5a4400), D(0x3d0808)],
    mote: [C(0x58b889), D(0xb02020)], smoke: [C(0x86d8ae), D(0x3d0808)],
    sky: [C(0xf6fff9), D(0x2a0c0c)], ground: [C(0xbfe6cf), D(0x050305)],
    key: [C(0xfff6e6), D(0x8a2a2a)], core: [C(0xc6f2d6), D(0x8a1414)],
    stasis: [C(0x4ea2f5), D(0xb01c1c)]
  };
  const mix = (t, k, m) => t.copy(LOOK[k][0]).lerp(LOOK[k][1], m);
  const lerp = (a, b, m) => a + (b - a) * m;
  function applyLook(m) {
    pageMats.forEach(mat => { mix(mat.color, "page", m); mix(mat.emissive, "pageGlow", m); mat.emissiveIntensity = lerp(0, 1.1, m); });
    mix(edgeMat.color, "edge", m); mix(edgeMat.emissive, "edgeGlow", m); edgeMat.emissiveIntensity = lerp(0.25, 1.8, m); edgeMat.metalness = lerp(0.55, 0, m);
    mix(spineMat.color, "spine", m); mix(spineMat.emissive, "spineGlow", m); spineMat.emissiveIntensity = lerp(0.5, 1, m);
    mix(moteMat.color, "mote", m); moteMat.size = lerp(0.075, 0.045, m);
    streakMat.opacity = Math.max(0, 0.5 - m * 1.2);
    smoke.forEach(s => { mix(s.material.color, "smoke", m); s.material.opacity = s.userData.o * lerp(0.2, 0.34, m); });
    mix(hemi.color, "sky", m); mix(hemi.groundColor, "ground", m); hemi.intensity = lerp(0.95, 0.5, m);
    mix(key.color, "key", m); key.intensity = lerp(0.5, 0.55, m);
    mix(core.color, "core", m); core.intensity = lerp(0.4, 1.7, m);
    mix(stasis.material.color, "stasis", m);
    const d = Math.max(0, 1 - m * 2.5);
    dialParts.forEach((p, k) => { p.material.opacity = d * (k < 2 ? 0.5 : 0.62); });
  }

  /* ---------- size ---------- */
  /* The scene is framed into the free band between the header and the bottom dock, so the book and the clock dial never
     run under the controls: the camera backs off until the dial's outer ring fits the band, and the view is shifted so the
     book sits in the band's middle. baseY is that shift, reused by the glitch renderer. */
  let baseY = 0;
  const DIAL_R = 0.485 * 5.3, DIAL_BACK = 1.9;           // the dial's outer ring radius and its distance behind the book
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = Math.tan(camera.fov * Math.PI / 360);
    const bar = document.querySelector(".top"), dock = document.querySelector(".dock");
    const top = (bar ? bar.getBoundingClientRect().bottom : 0) + 8, bottom = h - (dock ? dock.getBoundingClientRect().top : h) + 8;
    const band = Math.max(120, h - top - bottom), room = Math.min(band, w) / 2 * 0.94;   // the largest dial radius, in pixels, that fits
    const dist = Math.max(2.9 / half, 2.3 / (half * camera.aspect), DIAL_R * (h / 2) / (room * half) - DIAL_BACK);
    camera.position.set(0, 0.55, dist); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    baseY = Math.round(h / 2 - (top + band / 2));
    if (baseY) camera.setViewOffset(w, h, 0, baseY, w, h); else camera.clearViewOffset();
    /* the dial sits behind the book on the line of sight, and the stasis sphere is sized so its rim lands exactly on the dial's outer ring */
    dial.position.copy(camera.position).normalize().multiplyScalar(-DIAL_BACK); dial.lookAt(camera.position);
    const D = camera.position.length(), sc = (DIAL_R / (D + DIAL_BACK)) * D / 0.48;
    stasis.scale.set(sc, sc, 1);
  }
  window.addEventListener("resize", resize); resize();
  if (document.fonts) document.fonts.ready.then(resize);   // the header and dock settle their size once the fonts arrive

  /* ---------- drag to turn ---------- */
  let down = false, lastX = 0, push = 0;
  stage.addEventListener("pointerdown", e => { down = true; lastX = e.clientX; stage.classList.add("drag"); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", e => { if (!down) return; const dx = e.clientX - lastX; lastX = e.clientX; book.rotation.y += dx * 0.006; push = dx * 0.35; });
  const up = () => { down = false; stage.classList.remove("drag"); };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);

  /* ---------- glitch bursts (dark mode) ---------- */
  const tears = Array.from(document.querySelectorAll("#tear i"));
  let glitchEnd = 0, nextGlitch = 1.5, reshuffle = 0, bands = [];
  function shuffleGlitch() {
    const h = window.innerHeight, w = window.innerWidth;
    bands = [];
    for (let y = 0; y < h;) { const bh = Math.min(h - y, rand(18, 130)); bands.push([y, bh, Math.random() < 0.5 ? rand(-70, 70) : 0]); y += bh; }
    tears.forEach(el => {                                 // solid red and black bars torn across the page
      const bw = rand(0.12, 0.6) * w;
      el.style.cssText = "top:" + rand(0.08, 0.9) * h + "px;height:" + rand(2, 22) + "px;left:" + rand(0, w - bw) + "px;width:" + bw + "px;background:" + (Math.random() < 0.5 ? "#6a0d0d" : "#000");
    });
    strikeBolts();
  }
  function renderGlitch() {                               // the scene drawn in horizontal bands, each pushed sideways
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setScissorTest(true);
    bands.forEach(([y, bh, dx]) => {
      camera.setViewOffset(w, h, dx, baseY, w, h);
      renderer.setScissor(0, y, w, bh);
      renderer.render(scene, camera);
    });
    if (baseY) camera.setViewOffset(w, h, 0, baseY, w, h); else camera.clearViewOffset();
    renderer.setScissorTest(false);
  }

  /* ---------- loop ---------- */
  const spin = () => (calm ? 0 : 0.32);      // radians per second, the same in both modes; with motion off the book only turns when dragged
  const dummy = new THREE.Object3D();
  let m = theme() === "dark" ? 1 : 0, last = performance.now(), t = 0, tw = 0, cyc = 0;

  /* a reveal: time slows to a stop inside the stasis sphere, the project opens, then time runs again */
  let rev = -1, revCb = null;
  api.reveal = cb => {
    if (revCb) { const f = revCb; revCb = null; f(); }    // finish any reveal still under way first
    if (calm) { cb(); return; }
    rev = 0; revCb = cb;
  };

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const real = Math.min(0.25, (now - last) / 1000), dt = Math.min(0.05, real); last = now; t += dt;

    const target = theme() === "dark" ? 1 : 0;
    m += (target - m) * Math.min(1, dt * 3);
    if (Math.abs(target - m) < 0.001) m = target;
    applyLook(m);

    /* time magic: in light mode the book's own clock slows, stops, rewinds and snaps forward */
    let ts = 1, hold = 0;
    if (!calm && m < 0.3) { cyc = (cyc + dt) % CYCLE; [ts, hold] = timeCycle(cyc); hold *= 1 - m / 0.3; ts = lerp(ts, 1, m / 0.3); } else cyc = 0;
    if (rev >= 0) {
      rev += real;                                       // wall-clock time, so a slow device still opens the project on schedule
      const k = rev < 0.35 ? rev / 0.35 : rev < 1 ? 1 : Math.max(0, 1 - (rev - 1) / 0.5);
      ts = lerp(ts, 0, k); hold = Math.max(hold, k);
      if (rev >= 0.9 && revCb) { const f = revCb; revCb = null; f(); }
      if (rev > 1.5) rev = -1;
    }
    const dts = dt * ts; tw += dts;
    stasis.material.opacity = hold * 0.85;

    if (!calm) {
      dialParts[0].rotation.z = -tw * 0.05; dialParts[1].rotation.z = tw * 0.09;
      dialParts[2].rotation.z = -tw * 0.6; dialParts[3].rotation.z = -tw * 0.05;
    }

    /* glitch scheduling */
    if (!calm && m > 0.7 && t > nextGlitch) { glitchEnd = t + rand(0.14, 0.42); nextGlitch = glitchEnd + rand(1.4, 4.2); reshuffle = 0; }
    const glitching = !calm && m > 0.7 && t < glitchEnd;
    if (glitching && t > reshuffle) { shuffleGlitch(); reshuffle = t + 0.055; }
    document.body.classList.toggle("glitch", glitching);
    bolts.visible = glitching;

    if (!down) book.rotation.y += (spin() + push) * dts;
    push *= Math.exp(-dt * 2.2);
    tilt.position.y = calm ? 0 : Math.sin(tw * 0.9) * 0.07;
    tilt.position.x = glitching ? rand(-0.05, 0.05) : 0;

    for (let i = 0; i < N; i++) {                       // each page breathes slightly out of step
      dummy.rotation.y = i / N * Math.PI * 2 + (calm ? 0 : 0.03 * Math.sin(tw * 1.1 + i * 1.7));
      dummy.position.y = calm ? 0 : 0.012 * Math.sin(tw * 1.6 + i);
      dummy.updateMatrix();
      pageSets[i % V].setMatrixAt(Math.floor(i / V), dummy.matrix); edgeSets[i % V].setMatrixAt(Math.floor(i / V), dummy.matrix);
    }
    for (let v = 0; v < V; v++) pageSets[v].instanceMatrix.needsUpdate = edgeSets[v].instanceMatrix.needsUpdate = true;

    if (!calm) {
      for (let i = 0; i < M; i++) {                     // motes: down in light, up in dark
        let y = mote[i * 3 + 1] + lerp(-moteSeed[i] * 5, moteSeed[i], m) * dts;
        if (y > TOP) y = -TOP; else if (y < -TOP) y = TOP;
        mote[i * 3 + 1] = y;
      }
      moteGeo.attributes.position.needsUpdate = true;
      if (m < 0.45) {
        for (let i = 0; i < K; i++) {
          const d = streakSeed[i] * dts; let y0 = streak[i * 6 + 1] - d, y1 = streak[i * 6 + 4] - d;
          if (y0 < -TOP) { y0 += TOP * 2; y1 += TOP * 2; } else if (y1 > TOP) { y0 -= TOP * 2; y1 -= TOP * 2; }
          streak[i * 6 + 1] = y0; streak[i * 6 + 4] = y1;
        }
        streakGeo.attributes.position.needsUpdate = true;
      }
      smoke.forEach(s => {
        const u = s.userData; let y = s.position.y + lerp(-u.v, u.v * 0.5, m) * dts;
        if (y > TOP) y = -TOP; else if (y < -TOP) y = TOP;
        s.position.y = y; s.position.x = u.x + Math.sin(tw * 0.3 + u.ph) * u.sway;
      });
    }
    if (glitching) renderGlitch(); else renderer.render(scene, camera);
    if (!api.ready) announce();                          // the first frame is on screen
  }
  requestAnimationFrame(frame);
})();
