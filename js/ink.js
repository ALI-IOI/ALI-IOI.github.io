/* The grimoire's pen: the drawing used on the 3D book's pages and on the full-size pages that open from it.
   Every mark is meant to be read:
   - writing is real text (the book's own verse below), set in a scribal hand;
   - seal rims spell a word in Elder Futhark runes, letter by letter;
   - signs are the seven classical planets, drawn as their traditional symbols;
   - tables are tables of planetary hours: a column per weekday from Sunday, a row per hour from sunrise,
     filled in the Chaldean order (Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon) starting from the day's ruler. */
"use strict";
window.Ink = (function () {
  const TAU = Math.PI * 2;
  const HAND = '"Fondamento", Georgia, serif', RUB = '"Almendra", Georgia, serif';
  const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };   // repeatable randomness

  /* the book's verse: written for this site, and written out wherever a page has room */
  const VERSE = "Here begins the book that has no last page. Every leaf in it was written by one hand and kept. " +
    "When the dial is turned the hours stand still, the sphere closes round the book, and one page comes loose. " +
    "Read what is written on it, then let the hour go on. Nothing in this book is lost; a page that is closed is only waiting. " +
    "The red lines mark where a work begins. The runes round each seal spell its name, and the sign at its centre is the planet that governs it. " +
    "The tables keep the hours of the planets, day by day, from sunrise. Whoever opens the book should close it gently, " +
    "for it remembers every hand that turned it.";
  const WORDS = VERSE.split(" ");
  const STARTS = WORDS.map((w, i) => i).filter(i => i === 0 || /\.$/.test(WORDS[i - 1]));   // where each sentence begins

  /* lines of the verse, as many as fit between y and y + h; "from" picks the sentence to start at so pages differ.
     dropCap leaves off the first letter, which a drawn initial beside the text supplies. */
  function prose(c, x, y, w, h, size, gap, from, dropCap) {
    c.font = "400 " + size + "px " + HAND; c.textAlign = "left"; c.textBaseline = "alphabetic";
    let k = STARTS[from % STARTS.length], first = !!dropCap;
    const word = i => { const wd = WORDS[i % WORDS.length]; if (first && i === k0) return wd.slice(1); return wd; };
    const k0 = k;
    for (let ly = y + size; ly <= y + h; ly += gap) {
      let line = "";
      for (;;) {
        const test = line ? line + " " + word(k) : word(k);
        if (line && c.measureText(test).width > w) break;
        line = test; k++;
      }
      c.fillText(line, x, ly);
    }
  }
  /* one line of red rubric or ink, aligned left or centred; given maxW, a long line is written smaller until it fits */
  function line(c, text, x, y, size, align, rubric, maxW) {
    const face = rubric ? RUB : HAND;
    c.font = "700 " + size + "px " + face; c.textAlign = align || "left"; c.textBaseline = "alphabetic";
    while (maxW && size > 9 && c.measureText(text).width > maxW) { size -= 1; c.font = "700 " + size + "px " + face; }
    c.fillText(text, x, y);
  }

  /* ---------- the seven planets ---------- */
  function planet(c, p, x, y, s) {
    c.save(); c.lineWidth = Math.max(1.2, s * 0.08); c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
    const R = s * 0.36;
    if (p === "sun") { c.arc(x, y, R, 0, TAU); c.moveTo(x + s * 0.05, y); c.arc(x, y, s * 0.05, 0, TAU); }
    else if (p === "moon") {                      // a crescent: the outer arc on the left, the inner arc cut by a larger circle
      c.arc(x, y, R, Math.PI * 0.5, Math.PI * 1.5);
      const a = Math.atan2(-R, -0.5 * R), b = Math.atan2(R, -0.5 * R);
      c.arc(x + 0.5 * R, y, Math.hypot(0.5 * R, R), a, b, true);
    } else if (p === "mercury") {                 // horns, a circle, a cross
      c.arc(x, y - s * 0.02, s * 0.18, 0, TAU);
      c.moveTo(x + s * 0.15, y - s * 0.42); c.arc(x, y - s * 0.42, s * 0.15, 0, Math.PI);
      c.moveTo(x, y + s * 0.16); c.lineTo(x, y + s * 0.48); c.moveTo(x - s * 0.13, y + s * 0.32); c.lineTo(x + s * 0.13, y + s * 0.32);
    } else if (p === "venus") {                   // a circle over a cross
      c.arc(x, y - s * 0.14, s * 0.22, 0, TAU);
      c.moveTo(x, y + s * 0.08); c.lineTo(x, y + s * 0.48); c.moveTo(x - s * 0.15, y + s * 0.28); c.lineTo(x + s * 0.15, y + s * 0.28);
    } else if (p === "mars") {                    // a circle with an arrow to the upper right
      c.arc(x - s * 0.07, y + s * 0.07, s * 0.24, 0, TAU);
      c.moveTo(x + s * 0.1, y - s * 0.1); c.lineTo(x + s * 0.38, y - s * 0.38);
      c.moveTo(x + s * 0.14, y - s * 0.38); c.lineTo(x + s * 0.38, y - s * 0.38); c.lineTo(x + s * 0.38, y - s * 0.14);
    } else if (p === "jupiter") {                 // the hooked figure like a 4
      c.moveTo(x - s * 0.3, y - s * 0.26); c.quadraticCurveTo(x - s * 0.02, y - s * 0.5, x - s * 0.08, y - s * 0.16);
      c.lineTo(x - s * 0.32, y + s * 0.12); c.lineTo(x + s * 0.34, y + s * 0.12);
      c.moveTo(x + s * 0.16, y - s * 0.34); c.lineTo(x + s * 0.16, y + s * 0.46);
    } else {                                      // saturn: a cross with a hooked tail
      c.moveTo(x - s * 0.12, y - s * 0.46); c.lineTo(x - s * 0.12, y + s * 0.08);
      c.moveTo(x - s * 0.3, y - s * 0.3); c.lineTo(x + s * 0.06, y - s * 0.3);
      c.moveTo(x - s * 0.12, y - s * 0.04); c.quadraticCurveTo(x + s * 0.32, y - s * 0.18, x + s * 0.16, y + s * 0.18);
      c.quadraticCurveTo(x + s * 0.02, y + s * 0.38, x + s * 0.22, y + s * 0.46);
    }
    c.stroke(); c.restore();
  }

  /* ---------- Elder Futhark: each rune as strokes in a unit box (x 0..1, y 0..1 from the top) ---------- */
  const RUNE = {
    F: [[.3, 0, .3, 1], [.3, .35, .8, .05], [.3, .6, .8, .3]],                                  // fehu
    U: [[.25, 1, .25, 0, .75, .35, .75, 1]],                                                    // uruz
    A: [[.3, 0, .3, 1], [.3, .05, .8, .35], [.3, .35, .8, .65]],                                // ansuz
    R: [[.3, 1, .3, 0, .75, .25, .3, .5, .75, 1]],                                              // raido
    K: [[.75, .1, .3, .5, .75, .9]],                                                            // kaunan
    G: [[.15, .1, .85, .9], [.85, .1, .15, .9]],                                                // gebo
    W: [[.3, 1, .3, 0, .75, .25, .3, .5]],                                                      // wunjo
    H: [[.2, 0, .2, 1], [.8, 0, .8, 1], [.2, .3, .8, .7]],                                      // hagalaz
    N: [[.5, 0, .5, 1], [.25, .35, .75, .65]],                                                  // naudiz
    I: [[.5, 0, .5, 1]],                                                                        // isaz
    J: [[.45, .15, .2, .35, .45, .55], [.55, .45, .8, .65, .55, .85]],                          // jera
    P: [[.25, 0, .25, 1], [.25, 0, .7, .25, .85, 0], [.25, 1, .7, .75, .85, 1]],                // perthro
    Z: [[.5, 0, .5, 1], [.5, .4, .15, .05], [.5, .4, .85, .05]],                                // algiz
    S: [[.7, 0, .3, .35, .7, .65, .3, 1]],                                                      // sowilo
    T: [[.5, 0, .5, 1], [.15, .35, .5, 0, .85, .35]],                                           // tiwaz
    B: [[.3, 0, .3, 1], [.3, 0, .75, .25, .3, .5, .75, .75, .3, 1]],                            // berkano
    E: [[.15, 1, .15, 0, .5, .35, .85, 0, .85, 1]],                                             // ehwaz
    M: [[.15, 0, .15, 1], [.85, 0, .85, 1], [.15, 0, .85, .45], [.85, 0, .15, .45]],            // mannaz
    L: [[.35, 1, .35, 0, .75, .3]],                                                             // laguz
    D: [[.15, 0, .15, 1, .85, 0, .85, 1, .15, 0]],                                              // dagaz
    O: [[.5, 0, .8, .3, .5, .6, .2, .3, .5, 0], [.35, .45, .85, 1], [.65, .45, .15, 1]]         // othala
  };
  const LATIN = { C: "K", Q: "K", V: "W", Y: "I" };   // Y is written as a vowel, with isaz
  /* a word as a run of runes; X is written K S, apostrophes are dropped, any other non-letter becomes a word divider,
     and a closing divider marks where the name starts reading round the ring */
  function runesOf(word) {
    const out = [];
    for (const ch of word.toUpperCase()) {
      if (ch === "'" || ch === "\u2019") continue;
      if (ch === "X") out.push("K", "S");
      else if (RUNE[LATIN[ch] || ch]) out.push(LATIN[ch] || ch);
      else if (out.length && out[out.length - 1] !== ":") out.push(":");
    }
    while (out[out.length - 1] === ":") out.pop();
    out.push(":");
    return out;
  }
  function rune(c, r, x, y, s) {                  // centred on x, y, s tall
    c.beginPath();
    if (r === ":") { c.moveTo(x + s * 0.06, y - s * 0.18); c.arc(x, y - s * 0.18, s * 0.06, 0, TAU); c.moveTo(x + s * 0.06, y + s * 0.18); c.arc(x, y + s * 0.18, s * 0.06, 0, TAU); c.fill(); return; }
    RUNE[r].forEach(pts => { for (let i = 0; i < pts.length; i += 2) c[i ? "lineTo" : "moveTo"](x + (pts[i] - 0.5) * s * 0.6, y + (pts[i + 1] - 0.5) * s); });
    c.stroke();
  }

  /* a circular seal: rings, a star polygon, a word in runes round the rim, and a planet at the centre */
  function seal(c, q, cx, cy, R, opts) {
    const o = opts || {}, word = runesOf(o.word || "GRIMOIRE");
    c.lineWidth = 3; c.lineCap = "round"; c.lineJoin = "round";
    [1, 0.84, 0.46].forEach(k => { c.beginPath(); c.arc(cx, cy, R * k, 0, TAU); c.stroke(); });
    const n = 6 + Math.floor(q() * 3), step = n === 8 ? 3 : 2;      // {6/2}, {7/2} or {8/3}: every edge passes well clear of the centre
    for (let pass = 0; pass < (n === 6 ? 2 : 1); pass++) {
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + ((i * step + pass) % n) * TAU / n;
        c[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84);
      }
      c.stroke();
    }
    const s = Math.min(R * 0.12, TAU * R * 0.92 / word.length * 0.9);
    c.lineWidth = Math.max(1, s * 0.12);
    word.forEach((r, i) => {                      // read clockwise from the top
      const a = -Math.PI / 2 + i * TAU / word.length;
      c.save(); c.translate(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92); c.rotate(a + Math.PI / 2); rune(c, r, 0, 0, s); c.restore();
    });
    planet(c, o.planet || "saturn", cx, cy, R * 0.62);
  }

  /* the table of planetary hours */
  const CHALDEAN = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"];
  const DAY_RULER = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];   // Sunday to Saturday
  function table(c, q, x, y, w, h, cols, rows) {
    c.lineWidth = 2.5; c.strokeRect(x, y, w, h); c.beginPath();
    for (let i = 1; i < cols; i++) { c.moveTo(x + w * i / cols, y); c.lineTo(x + w * i / cols, y + h); }
    for (let j = 1; j < rows; j++) { c.moveTo(x, y + h * j / rows); c.lineTo(x + w, y + h * j / rows); }
    c.stroke();
    for (let i = 0; i < cols; i++) {
      const first = CHALDEAN.indexOf(DAY_RULER[i % 7]);
      for (let j = 0; j < rows; j++) planet(c, CHALDEAN[(first + j) % 7], x + w * (i + 0.5) / cols, y + h * (j + 0.5) / rows, Math.min(w / cols, h / rows) * 0.62);
    }
  }
  return { rng, prose, line, planet, seal, table, HAND, RUB };
})();
