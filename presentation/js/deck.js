/* Animations de la presentation.
   Chaque slide animee a data-anim="nom" et des <span class="fragment step"> invisibles :
   le nombre d'etapes visibles donne l'etat a afficher, donc "precedent" revient
   proprement a l'etat d'avant. */

const PRINT = /print-pdf/gi.test(window.location.search);
const NS = "http://www.w3.org/2000/svg";
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const C = {};
["paper", "paper-2", "ink", "muted", "rule", "cell", "cpu", "v1", "v2", "v3", "pso"].forEach((k) => (C[k] = css("--" + k)));
const EASE = "power2.out";

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function txt(parent, x, y, s, attrs = {}) {
  const t = el("text", Object.assign({ x, y }, attrs), parent);
  t.textContent = s;
  return t;
}
function arrowDefs(svg, id, color) {
  const defs = el("defs", {}, svg);
  const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0,0 L10,5 L0,10 z", fill: color }, m);
}
function set(targets, vars) { gsap.set(targets, vars); }
function to(targets, vars, instant) {
  if (instant) { const v = Object.assign({}, vars); delete v.duration; delete v.delay; delete v.ease; delete v.stagger; gsap.set(targets, v); return; }
  gsap.to(targets, Object.assign({ duration: 0.5, ease: EASE, overwrite: "auto" }, vars));
}

/* ---------- grille de threads (titre et fin) ---------- */
function threadGrid(svg, instant) {
  svg.innerHTML = "";
  const cols = 14, rows = 10, s = 36, g = 4;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push(el("rect", { x: c * (s + g), y: r * (s + g), width: s, height: s, rx: 4, fill: C.cell }, svg));
  }
  const couleur = (i) => { const d = (i % cols) + Math.floor(i / cols); return d % 3 === 0 ? C.v3 : d % 3 === 1 ? C.v1 : C.v2; };
  if (instant) { cells.forEach((c, i) => c.setAttribute("fill", (i * 7) % 5 === 0 ? couleur(i) : C.cell)); return; }
  // une seule vague : les threads "s'allument" comme un lancement de kernel, puis se posent
  const order = cells.map((c, i) => ({ c, d: (i % cols) + Math.floor(i / cols) }));
  order.forEach(({ c, d }, i) => {
    const col = d % 3 === 0 ? C.v3 : d % 3 === 1 ? C.v1 : C.v2;
    gsap.fromTo(c, { attr: { fill: C.cell } }, { attr: { fill: col }, duration: 0.25, delay: 0.3 + d * 0.06, ease: "none" });
    gsap.to(c, { attr: { fill: (i * 7) % 5 === 0 ? col : C.cell }, duration: 0.6, delay: 1.2 + d * 0.06 });
  });
}

const ANIM = {};

ANIM.titre = { init(s) { this.svg = s.querySelector("#titre-grid"); }, enter(s, inst) { threadGrid(this.svg, inst); }, go() {} };
ANIM.fin = { init(s) { this.svg = s.querySelector("#fin-grid"); }, enter(s, inst) { threadGrid(this.svg, inst); }, go() {} };

/* ---------- Rastrigin 2D ---------- */
ANIM.probleme = {
  init(s) {
    const cv = s.querySelector("#rastrigin"), ctx = cv.getContext("2d");
    const N = 440, img = ctx.createImageData(N, N);
    const lo = [0x14, 0x21, 0x3d], hi = [0xea, 0xf0, 0xf8];
    let max = 0; const vals = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -5.12 + (10.24 * i) / N, y = 5.12 - (10.24 * j) / N;
      const f = 20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y);
      vals[j * N + i] = f; if (f > max) max = f;
    }
    for (let k = 0; k < N * N; k++) {
      const t = Math.pow(vals[k] / max, 0.6);
      for (let c = 0; c < 3; c++) img.data[4 * k + c] = lo[c] + (hi[c] - lo[c]) * t;
      img.data[4 * k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const svg = s.querySelector("#rastrigin-pts");
    const P = (x, y) => [(x + 5.12) / 10.24 * N, (5.12 - y) / 10.24 * N];
    this.P = P;
    const [sx, sy] = P(3.35, -2.3);
    this.desc = el("circle", { cx: sx, cy: sy, r: 9, fill: C.v2, stroke: C.paper, "stroke-width": 2.5, opacity: 0 }, svg);
    this.descLbl = txt(svg, sx + 14, sy - 14, "bloqué", { "font-size": 20, "font-weight": 700, fill: C.paper, opacity: 0 });
    this.pop = [];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 26; k++) {
      const x = -4.6 + 9.2 * rnd(), y = -4.6 + 9.2 * rnd();
      const [px, py] = P(x, y);
      this.pop.push({ e: el("circle", { cx: px, cy: py, r: 7, fill: C.v3, stroke: C.paper, "stroke-width": 2, opacity: 0 }, svg), px, py });
    }
    const [cx, cy] = P(0, 0);
    this.goal = el("circle", { cx, cy, r: 16, fill: "none", stroke: C.paper, "stroke-width": 3, opacity: 0 }, svg);
  },
  go(step, inst) {
    const [ax, ay] = this.P(3.35, -2.3), [bx, by] = this.P(2.98, -1.99);
    if (step >= 1) { to(this.desc, { opacity: 1, attr: { cx: bx, cy: by }, duration: 1.1, ease: "power3.inOut" }, inst); to(this.descLbl, { opacity: 1, delay: 1, attr: { x: bx + 14, y: by - 14 } }, inst); }
    else { to(this.desc, { opacity: 0, attr: { cx: ax, cy: ay } }, inst); to(this.descLbl, { opacity: 0 }, inst); }
    const [cx, cy] = this.P(0, 0);
    this.pop.forEach((p, k) => {
      if (step >= 2) {
        const r = 6 + (k % 5) * 3, a = k * 2.4;
        to(p.e, { opacity: 1, duration: 0.3, delay: k * 0.02 }, inst);
        if (!inst) gsap.fromTo(p.e, { attr: { cx: p.px, cy: p.py } }, { attr: { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a) }, duration: 2.2, delay: 0.5, ease: "power2.inOut" });
        else set(p.e, { attr: { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a) } });
      } else to(p.e, { opacity: 0, attr: { cx: p.px, cy: p.py } }, inst);
    });
    to(this.goal, { opacity: step >= 2 ? 1 : 0, delay: step >= 2 ? 2.4 : 0 }, inst);
  },
};

/* ---------- CPU / GPU ---------- */
ANIM.cuda = {
  init(s) {
    const cpu = s.querySelector("#cpu-cores"), gpu = s.querySelector("#gpu-cores");
    cpu.style.cssText = "display:grid;grid-template-columns:repeat(2,58px);gap:8px";
    gpu.style.cssText = "display:grid;grid-template-columns:repeat(16,14px);gap:4px";
    for (let i = 0; i < 4; i++) { const d = document.createElement("div"); d.style.cssText = `width:58px;height:58px;border-radius:6px;background:${C.cpu}`; cpu.appendChild(d); }
    this.g = [];
    for (let i = 0; i < 128; i++) { const d = document.createElement("div"); d.style.cssText = `width:14px;height:14px;border-radius:2px;background:${C.cell}`; gpu.appendChild(d); this.g.push(d); }
  },
  enter(s, inst) {
    if (inst) { this.g.forEach((d) => (d.style.background = C.v3)); return; }
    gsap.fromTo(this.g, { backgroundColor: C.cell }, { backgroundColor: C.v3, duration: 0.3, stagger: { each: 0.008, from: "start" }, delay: 0.3 });
  },
  go() {},
};

/* ---------- PSO fourni ---------- */
ANIM.pso = {
  init(s) {
    const svg = s.querySelector("#pso-svg"); this.svg = svg;
    arrowDefs(svg, "pso-ar", C.muted);
    const box = (x, y, w, h, title) => { el("rect", { x, y, width: w, height: h, rx: 10, fill: "none", stroke: C.ink, "stroke-width": 2 }, svg); txt(svg, x + 18, y + 36, title, { "font-size": 26, "font-weight": 700 }); };
    box(20, 20, 330, 330, "CPU");
    box(780, 20, 336, 330, "GPU");
    // bus PCIe
    el("rect", { x: 370, y: 160, width: 390, height: 50, rx: 25, fill: C["paper-2"] }, svg);
    txt(svg, 565, 245, "bus PCIe", { "font-size": 21, fill: C.muted, "text-anchor": "middle" });
    // kernels
    this.k1 = el("rect", { x: 800, y: 80, width: 296, height: 84, rx: 8, fill: C.cell }, svg);
    txt(svg, 816, 114, "kernelUpdateParticle", { class: "mono", "font-size": 21 });
    txt(svg, 816, 148, "1 thread par coordonnée", { "font-size": 22, fill: C.muted });
    this.k2 = el("rect", { x: 800, y: 186, width: 296, height: 84, rx: 8, fill: C.cell }, svg);
    txt(svg, 816, 220, "kernelUpdatePBest", { class: "mono", "font-size": 21 });
    txt(svg, 816, 254, "1 thread par particule", { "font-size": 22, fill: C.muted });
    this.cpuLoop = el("rect", { x: 40, y: 150, width: 290, height: 84, rx: 8, fill: C.cell }, svg);
    txt(svg, 56, 184, "boucle : meilleur global", { "font-size": 23 });
    txt(svg, 56, 216, "sur Pop particules", { "font-size": 22, fill: C.muted });
    // paquets
    this.pk1 = el("g", { opacity: 0 }, svg);
    el("rect", { x: -60, y: -18, width: 120, height: 36, rx: 18, fill: C.pso }, this.pk1);
    txt(this.pk1, 0, 7, "pBest", { "font-size": 18, "font-weight": 700, fill: C.paper, "text-anchor": "middle" });
    this.pk2 = el("g", { opacity: 0 }, svg);
    el("rect", { x: -60, y: -18, width: 120, height: 36, rx: 18, fill: C.pso }, this.pk2);
    txt(this.pk2, 0, 7, "gBest", { "font-size": 18, "font-weight": 700, fill: C.paper, "text-anchor": "middle" });
    this.cnt = txt(svg, 565, 120, "", { "font-size": 28, "font-weight": 700, "text-anchor": "middle" });
    this.note = txt(svg, 568, 392, "2 copies et 1 boucle CPU à chaque itération : c'est ce qui le rend lent", { "font-size": 26, "font-weight": 700, "text-anchor": "middle", opacity: 0 });
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    to([this.k1, this.k2], { attr: { fill: step >= 1 ? "#d7e7f8" : C.cell } }, inst);
    to(this.cpuLoop, { attr: { fill: step >= 3 ? "#e7e3fa" : C.cell } }, inst);
    set(this.pk1, { x: step >= 2 ? 450 : 700, y: 185, opacity: step === 2 ? 1 : 0 });
    set(this.pk2, { x: step >= 3 ? 700 : 450, y: 185, opacity: step === 3 ? 1 : 0 });
    if (!inst && step === 2) gsap.fromTo(this.pk1, { x: 700, opacity: 1 }, { x: 450, duration: 0.9, ease: "power1.inOut" });
    if (!inst && step === 3) gsap.fromTo(this.pk2, { x: 450, opacity: 1 }, { x: 700, duration: 0.9, delay: 0.3, ease: "power1.inOut" });
    this.cnt.textContent = step >= 4 ? "" : step >= 1 ? "itération 1" : "";
    to(this.note, { opacity: step >= 4 ? 1 : 0 }, inst);
    if (step >= 4) {
      if (inst) { this.cnt.textContent = "itération 2000"; return; }
      const o = { n: 1 }, me = this;
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(this.k1, { attr: { fill: "#b9d5f3" }, duration: 0.12 }).to(this.k1, { attr: { fill: "#d7e7f8" }, duration: 0.12 })
        .to(this.k2, { attr: { fill: "#b9d5f3" }, duration: 0.12 }).to(this.k2, { attr: { fill: "#d7e7f8" }, duration: 0.12 })
        .fromTo(this.pk1, { x: 700, opacity: 1 }, { x: 450, duration: 0.35, ease: "none" }).set(this.pk1, { opacity: 0 })
        .to(this.cpuLoop, { attr: { fill: "#d3ccf6" }, duration: 0.12 }).to(this.cpuLoop, { attr: { fill: "#e7e3fa" }, duration: 0.12 })
        .fromTo(this.pk2, { x: 450, opacity: 1 }, { x: 700, duration: 0.35, ease: "none" }).set(this.pk2, { opacity: 0 })
        .call(() => { o.n = Math.min(2000, Math.round(o.n * 2.3 + 1)); me.cnt.textContent = "itération " + o.n; if (o.n >= 2000) o.n = 1; });
      this.tl = tl;
    }
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- DE en 2D ---------- */
ANIM.de = {
  init(s) {
    const svg = s.querySelector("#de-svg"); this.svg = svg;
    arrowDefs(svg, "de-ar", C.ink);
    arrowDefs(svg, "de-ar2", C.v2);
    const cx = 290, cy = 250;
    for (const r of [230, 175, 120, 65]) el("circle", { cx, cy, r, fill: "none", stroke: C.rule, "stroke-width": 1.5 }, svg);
    el("circle", { cx, cy, r: 5, fill: C.muted }, svg);
    txt(svg, cx + 10, cy + 26, "minimum", { "font-size": 20, fill: C.muted });
    const others = [[120, 120], [470, 360], [400, 210], [90, 380], [250, 450], [520, 140], [180, 200], [360, 420]];
    others.forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 7, fill: C.cell, stroke: C.muted, "stroke-width": 1.5 }, svg));
    this.pt = {};
    const mk = (k, x, y, lab, dx = 12, dy = -12) => {
      const g = el("g", {}, svg);
      el("circle", { cx: x, cy: y, r: 9, fill: C.cell, stroke: C.ink, "stroke-width": 2 }, g);
      const t = txt(g, x + dx, y + dy, lab, { "font-size": 22, "font-weight": 700 });
      this.pt[k] = { g, x, y, t, c: g.firstChild };
    };
    mk("xi", 440, 100, "xᵢ");
    mk("r1", 190, 140, "r₁", -34, -10);
    mk("r2", 340, 330, "r₂");
    mk("r3", 140, 290, "r₃", -36, 8);
    // fleches
    this.diff = el("line", { x1: 140, y1: 290, x2: 340, y2: 330, stroke: C.ink, "stroke-width": 2.5, "marker-end": "url(#de-ar)", opacity: 0 }, svg);
    this.fdiff = el("line", { x1: 190, y1: 140, x2: 290, y2: 160, stroke: C.v2, "stroke-width": 3, "marker-end": "url(#de-ar2)", opacity: 0 }, svg);
    this.fLbl = txt(svg, 196, 198, "F × (r₂ − r₃)", { "font-size": 21, opacity: 0 });
    const g = el("g", { opacity: 0 }, svg);
    el("circle", { cx: 290, cy: 160, r: 9, fill: C.v2, stroke: C.paper, "stroke-width": 2 }, g);
    txt(g, 302, 150, "v", { "font-size": 22, "font-weight": 700 });
    this.v = g;
    // croisement : u = (x de v, y de xi)
    this.proj1 = el("line", { x1: 290, y1: 160, x2: 290, y2: 100, stroke: C.v2, "stroke-width": 2, "stroke-dasharray": "5 5", opacity: 0 }, svg);
    this.proj2 = el("line", { x1: 440, y1: 100, x2: 290, y2: 100, stroke: C.ink, "stroke-width": 2, "stroke-dasharray": "5 5", opacity: 0 }, svg);
    const gu = el("g", { opacity: 0 }, svg);
    el("rect", { x: 280, y: 90, width: 20, height: 20, rx: 3, fill: C.v3, stroke: C.paper, "stroke-width": 2 }, gu);
    txt(gu, 270, 78, "u", { "font-size": 22, "font-weight": 700 });
    this.u = gu;
    this.uLbl = txt(svg, 290, 492, "u : x de v, y de xᵢ", { "font-size": 22, fill: C.ink, "text-anchor": "middle", opacity: 0 });
    this.win = txt(svg, 290, 492, "f(u) < f(xᵢ) : u remplace xᵢ", { "font-size": 24, "font-weight": 700, "text-anchor": "middle", opacity: 0 });
  },
  go(step, inst) {
    for (let k = 0; k <= 4; k++) to(document.getElementById("de-t" + k), { opacity: k <= step ? 1 : 0, y: k <= step ? 0 : 8 }, inst);
    const on = (k, b) => to(this.pt[k].c, { attr: { fill: b ? C.ink : C.cell } }, inst);
    on("xi", true); ["r1", "r2", "r3"].forEach((k) => on(k, step >= 1));
    ["r1", "r2", "r3"].forEach((k) => to(this.pt[k].t, { opacity: step >= 1 ? 1 : 0 }, inst));
    to(this.diff, { opacity: step >= 2 ? 1 : 0 }, inst);
    if (step >= 2 && !inst) gsap.fromTo(this.fdiff, { opacity: 1, attr: { x2: 190, y2: 140 } }, { attr: { x2: 290, y2: 160 }, duration: 0.8, delay: 0.4, ease: EASE });
    else to(this.fdiff, { opacity: step >= 2 ? 1 : 0, attr: { x2: 290, y2: 160 } }, inst);
    to(this.fLbl, { opacity: step >= 2 ? 1 : 0, delay: step >= 2 ? 0.6 : 0 }, inst);
    to(this.v, { opacity: step >= 2 ? 1 : 0, delay: step >= 2 ? 1.1 : 0 }, inst);
    to([this.proj1, this.proj2], { opacity: step === 3 ? 1 : 0 }, inst);
    to(this.uLbl, { opacity: step === 3 ? 1 : 0 }, inst);
    to(this.u, { opacity: step >= 3 ? 1 : 0, delay: step === 3 ? 0.4 : 0 }, inst);
    // selection : xi glisse sur u
    const xi = this.pt.xi;
    if (step >= 4) {
      to(xi.g, { x: 290 - 440, y: 0, duration: 0.9, delay: 0.3, ease: "power3.inOut" }, inst);
      to(this.win, { opacity: 1, delay: 1 }, inst);
      to(xi.t, { opacity: 0, duration: 0.3 }, inst);
      to([this.diff, this.fdiff, this.fLbl], { opacity: 0.25 }, inst);
    } else { to(xi.g, { x: 0, y: 0 }, inst); to(this.win, { opacity: 0 }, inst); to(xi.t, { opacity: 1 }, inst); }
  },
};

/* ---------- grille population (v1) ---------- */
function popGrid(svg, ox, oy, rows, cols, s, label) {
  const cells = [];
  for (let r = 0; r < rows; r++) { cells.push([]); for (let c = 0; c < cols; c++) cells[r].push(el("rect", { x: ox + c * (s + 4), y: oy + r * (s + 4), width: s, height: s, rx: 3, fill: C.cell }, svg)); }
  if (label) txt(svg, ox, oy - 14, label, { class: "mono", "font-size": 21 });
  return cells;
}
ANIM.v1 = {
  init(s) {
    const svg = s.querySelector("#v1-svg"); this.svg = svg;
    const R = 6, Cc = 5, sz = 40;
    this.a = popGrid(svg, 70, 60, R, Cc, sz, "popIn");
    this.b = popGrid(svg, 350, 60, R, Cc, sz, "popOut");
    this.lblIn = svg.querySelectorAll("text")[0]; this.lblOut = svg.querySelectorAll("text")[1];
    this.th = [];
    for (let r = 0; r < R; r++) {
      const y = 60 + r * (sz + 4) + sz / 2;
      this.th.push(txt(svg, 22, y + 8, "t" + r, { "font-size": 22, "font-weight": 700 }));
    }
    this.cursor = el("rect", { x: 68, y: 56, width: sz + 4, height: R * (sz + 4) + 4, rx: 4, fill: "none", stroke: C.ink, "stroke-width": 2.5, opacity: 0 }, svg);
    this.swap = txt(svg, 300, 350, "échange des pointeurs", { "font-size": 22, "text-anchor": "middle", opacity: 0 });
    // boite kernel
    this.kbox = el("g", { opacity: 0 }, svg);
    el("rect", { x: 30, y: 380, width: 540, height: 110, rx: 10, fill: "none", stroke: C.v1, "stroke-width": 2.5 }, this.kbox);
    txt(this.kbox, 50, 416, "kernelDEGeneration", { class: "mono", "font-size": 21 });
    txt(this.kbox, 50, 460, "mutation → croisement → évaluation → sélection", { "font-size": 23 });
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    const rows = this.a;
    rows.forEach((r) => r.forEach((c) => to(c, { attr: { fill: "#cfe1f6" } }, inst)));
    this.b.forEach((r) => r.forEach((c) => to(c, { attr: { fill: step >= 2 ? C.cell : C.cell } }, inst)));
    to(this.kbox, { opacity: step >= 1 ? 1 : 0 }, inst);
    for (let k = 1; k <= 3; k++) to(document.getElementById("v1-l" + k), { opacity: step >= k ? 1 : 0.25 }, inst);
    to(this.cursor, { opacity: step === 1 ? 1 : 0, x: 0 }, inst);
    to(this.swap, { opacity: step >= 2 ? 1 : 0 }, inst);
    set([this.lblIn, this.lblOut], { x: 0 });
    if (inst) { if (step >= 2) this.b.forEach((r) => r.forEach((c) => c.setAttribute("fill", "#cfe1f6"))); return; }
    if (step === 1) {
      // chaque thread boucle sur ses D coordonnees, tous en meme temps
      this.tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 }).fromTo(this.cursor, { x: 0 }, { x: 4 * 44, duration: 1.6, ease: "steps(4)" });
    }
    if (step === 2) {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
      tl.set(this.b.flat(), { attr: { fill: C.cell } });
      for (let c = 0; c < 5; c++) tl.to(this.b.map((r) => r[c]), { attr: { fill: "#cfe1f6" }, duration: 0.18 });
      tl.to(this.lblIn, { x: 280, duration: 0.6, ease: "power2.inOut" }, "+=0.3").to(this.lblOut, { x: -280, duration: 0.6, ease: "power2.inOut" }, "<");
      tl.to([this.lblIn, this.lblOut], { x: 0, duration: 0.01 }, "+=0.8");
      this.tl = tl;
    }
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- v2 : organigramme anime ---------- */
ANIM.v2 = {
  init(s) {
    const svg = s.querySelector("#v2-svg"); this.svg = svg;
    arrowDefs(svg, "v2-ar", C.ink);
    txt(svg, 40, 30, "CPU", { "font-size": 20, "font-weight": 700 });
    txt(svg, 230, 30, "GPU", { "font-size": 20, "font-weight": 700 });
    // memoire globale
    el("rect", { x: 520, y: 50, width: 46, height: 480, rx: 6, fill: C["paper-2"], stroke: C.rule }, svg);
    const mt = txt(svg, 0, 0, "mémoire globale", { "font-size": 19, fill: C.muted, "text-anchor": "middle", transform: "translate(549 290) rotate(-90)" });
    const K = [["P", "tirage de r₁, r₂, r₃"], ["M", "mutation"], ["C", "croisement"], ["E", "évaluation"], ["S", "sélection"]];
    this.k = []; this.rw = [];
    K.forEach(([n, d], i) => {
      const y = 70 + i * 92;
      const r = el("rect", { x: 200, y, width: 260, height: 64, rx: 8, fill: C.cell, stroke: C.ink, "stroke-width": 1.5 }, svg);
      txt(svg, 218, y + 41, "(" + n + ")", { "font-size": 22, "font-weight": 700 });
      txt(svg, 268, y + 41, d, { "font-size": 21 });
      if (i < 4) el("line", { x1: 330, y1: y + 64, x2: 330, y2: y + 90, stroke: C.ink, "stroke-width": 2, "marker-end": "url(#v2-ar)" }, svg);
      const p = el("line", { x1: 460, y1: y + 32, x2: 520, y2: y + 32, stroke: C.v2, "stroke-width": 4, opacity: 0 }, svg);
      this.k.push(r); this.rw.push(p);
    });
    // boucle CPU
    el("path", { d: "M200 498 H120 V102 H196", fill: "none", stroke: C.ink, "stroke-width": 2, "marker-end": "url(#v2-ar)" }, svg);
    txt(svg, 0, 0, "5 lancements par génération", { "font-size": 18, "text-anchor": "middle", transform: "translate(100 300) rotate(-90)" });
    this.gen = txt(svg, 40, 560 - 6, "", { "font-size": 20, "font-weight": 700 });
  },
  enter(s, inst) { this.run(inst); },
  run(inst) {
    if (this.tl) this.tl.kill();
    if (inst || PRINT) { this.k.forEach((r) => r.setAttribute("fill", C.cell)); return; }
    const tl = gsap.timeline({ repeat: -1, delay: 0.5 });
    for (let g = 1; g <= 3; g++) {
      tl.call(() => (this.gen.textContent = "génération " + g));
      this.k.forEach((r, i) => {
        tl.to(r, { attr: { fill: "#f8c9b2" }, duration: 0.18 })
          .fromTo(this.rw[i], { opacity: 0 }, { opacity: 1, duration: 0.15 }, "<")
          .to(r, { attr: { fill: C.cell }, duration: 0.25 }, "+=0.15")
          .to(this.rw[i], { opacity: 0, duration: 0.2 }, "<");
      });
    }
    tl.to({}, { duration: 0.6 });
    this.tl = tl;
  },
  go() {},
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- graphiques Chart.js ---------- */
Chart.defaults.font.family = "Figtree, sans-serif";
Chart.defaults.font.size = 18;
Chart.defaults.color = C.muted;
Chart.defaults.borderColor = C.rule;
const NOM = { cpu: "DE CPU", gpu: "GPU v1", split: "GPU v2", dim: "GPU v3", pso: "PSO prof" };
const COUL = { cpu: C.cpu, gpu: C.v1, split: C.v2, dim: C.v3, pso: C.pso };
const TEMPS = {"10": {"cpu": [0.0236, 0.0242, 0.0242], "gpu": [0.0122, 0.0061, 0.0016], "split": [0.0267, 0.0135, 0.003], "dim": [0.0187, 0.01, 0.0023], "pso": [0.1846, 0.0992, 0.0417]}, "50": {"cpu": [0.4783, 0.4992, 0.5022], "gpu": [0.3886, 0.222, 0.0525], "split": [0.3818, 0.2207, 0.0492], "dim": [0.0951, 0.0518, 0.0149], "pso": [4.5667, 3.0707, 2.0924]}, "100": {"cpu": [1.9449, 1.9956, 2.0455], "gpu": [0.9017, 0.589, 0.1431], "split": [1.3067, 0.8208, 0.1836], "dim": [0.202, 0.1152, 0.0414], "pso": [18.0467, 12.2014, 9.1283]}};
const QUAL = {"cpu": 2.99e-05, "gpu": 3.66e-05, "split": 3.66e-05, "dim": 2.27e-05, "pso": 114.0};

// etiquette directe en bout de ligne (identite jamais portee par la couleur seule)
const finDeLigne = {
  id: "finDeLigne",
  afterDatasetsDraw(chart) {
    if (chart.config.type !== "line") return;
    const ctx = chart.ctx; ctx.save();
    ctx.font = "700 19px Figtree"; ctx.fillStyle = C.ink; ctx.textBaseline = "middle";
    const pts = [];
    chart.data.datasets.forEach((ds, i) => {
      const m = chart.getDatasetMeta(i); if (m.hidden) return;
      const p = m.data[m.data.length - 1]; if (p) pts.push({ y: p.y, x: p.x, t: ds.label });
    });
    pts.sort((a, b) => a.y - b.y);
    for (let i = 1; i < pts.length; i++) if (pts[i].y - pts[i - 1].y < 20) pts[i].y = pts[i - 1].y + 20;
    pts.forEach((p) => ctx.fillText(p.t, p.x + 12, p.y));
    ctx.restore();
  },
};
const fmtS = (v) => (v >= 1 ? v.toFixed(0) + " s" : v >= 0.1 ? v.toFixed(1) + " s" : v >= 0.01 ? v.toFixed(2) + " s" : v.toFixed(3) + " s");

ANIM.v2perf = {
  enter(s, inst) {
    if (this.ch) this.ch.destroy();
    this.ch = new Chart(s.querySelector("#chart-v2"), {
      type: "bar",
      data: {
        labels: ["(P)", "(M)", "(C)", "(E)", "(S)"],
        datasets: [
          { label: "D = 10, Pop 50", data: [3.0, 3.4, 4.2, 4.6, 3.0], backgroundColor: "#f6b694", borderRadius: 4, borderSkipped: "start" },
          { label: "D = 100, Pop 100", data: [3.1, 18.1, 20.7, 36.5, 3.7], backgroundColor: C.v2, borderRadius: 4, borderSkipped: "start" },
        ],
      },
      options: {
        maintainAspectRatio: false, animation: inst ? false : { duration: 900, easing: "easeOutQuart", delay: (c) => c.dataIndex * 90 },
        datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "µs par lancement" }, grid: { color: C.rule } }, x: { grid: { display: false }, ticks: { color: C.ink, font: { weight: 700 } } } },
        plugins: { legend: { position: "top", align: "start", labels: { boxWidth: 16, boxHeight: 16, color: C.ink } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label} : ${c.raw} µs` } } },
      },
    });
  },
  go() {},
  leave() { if (this.ch) { this.ch.destroy(); this.ch = null; } },
};

ANIM.qualite = {
  enter(s, inst) {
    if (this.ch) this.ch.destroy();
    const ks = ["cpu", "gpu", "split", "dim", "pso"];
    this.ch = new Chart(s.querySelector("#chart-qualite"), {
      type: "bar",
      data: { labels: ks.map((k) => NOM[k]), datasets: [{ label: "erreur", data: ks.map((k) => QUAL[k]), backgroundColor: ks.map((k) => COUL[k]), borderRadius: 4, borderSkipped: "start" }] },
      options: {
        maintainAspectRatio: false, animation: inst ? false : { duration: 1000, easing: "easeOutQuart", delay: (c) => c.dataIndex * 120 },
        scales: {
          y: { type: "logarithmic", min: 1e-6, max: 1e3, grid: { color: C.rule }, ticks: { callback: (v) => { const e = Math.log10(v); return Number.isInteger(e) && e % 2 === 0 ? "10" + String(e).replace(/[-0-9]/g, (ch) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(ch)]) : ""; } } },
          x: { grid: { display: false }, ticks: { color: C.ink, font: { weight: 700 } } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "erreur moyenne : " + c.raw.toExponential(1) } } },
      },
      plugins: [{
        id: "valeurs", afterDatasetsDraw(ch) {
          const ctx = ch.ctx, m = ch.getDatasetMeta(0); ctx.save(); ctx.font = "700 19px Figtree"; ctx.fillStyle = C.ink; ctx.textAlign = "center";
          m.data.forEach((b, i) => { const v = ch.data.datasets[0].data[i]; ctx.fillText(v >= 1 ? v.toFixed(0) : v.toExponential(1).replace("e-", "e−"), b.x, b.y - 10); });
          ctx.restore();
        },
      }],
    });
  },
  go() {},
  leave() { if (this.ch) { this.ch.destroy(); this.ch = null; } },
};

ANIM.temps = {
  init(s) {
    this.btns = [...s.querySelectorAll(".dimbtns button")];
    this.btns.forEach((b) => b.addEventListener("click", () => this.show(b.dataset.d)));
  },
  enter(s, inst) {
    if (this.ch) this.ch.destroy();
    const ks = ["cpu", "gpu", "split", "dim", "pso"];
    this.ch = new Chart(s.querySelector("#chart-temps"), {
      type: "line",
      data: { labels: ["50", "100", "500"], datasets: ks.map((k, i) => ({
        label: NOM[k], data: TEMPS["100"][k], borderColor: COUL[k], backgroundColor: COUL[k], borderWidth: 2.5,
        pointRadius: 5, pointHoverRadius: 7, pointStyle: ["circle", "rect", "triangle", "rectRot", "crossRot"][i], pointBorderWidth: 2, pointBackgroundColor: C.paper,
      })) },
      options: {
        maintainAspectRatio: false, layout: { padding: { right: 92 } },
        animation: inst ? false : { duration: 900, easing: "easeOutQuart" },
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { type: "logarithmic", min: 0.001, max: 30, title: { display: true, text: "temps d'un run" }, grid: { color: C.rule }, ticks: { callback: (v) => ([0.001, 0.01, 0.1, 1, 10].includes(+v.toPrecision(1)) ? fmtS(v) : "") } },
          x: { title: { display: true, text: "Population" }, grid: { display: false }, ticks: { color: C.ink } },
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label} : ${fmtS(c.raw)}` } } },
      },
      plugins: [finDeLigne],
    });
    this.cur = "100"; this.mark("100");
  },
  mark(d) { this.btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.d === d ? "true" : "false")); },
  show(d, inst) {
    if (!this.ch || this.cur === d) return;
    this.cur = d; this.mark(d);
    this.ch.data.datasets.forEach((ds, i) => (ds.data = TEMPS[d][["cpu", "gpu", "split", "dim", "pso"][i]]));
    this.ch.update(inst ? "none" : undefined);
  },
  go(step, inst) {
    this.show(step === 0 ? "100" : step === 1 ? "50" : "10", inst);
    to(document.getElementById("tps-t2"), { opacity: step >= 2 ? 1 : 0 }, inst);
  },
  leave() { if (this.ch) { this.ch.destroy(); this.ch = null; } },
};

/* ---------- v3 : repartition des threads ---------- */
ANIM.v3map = {
  init(s) {
    const svg = s.querySelector("#v3-svg"); this.svg = svg;
    const ox = 150, oy = 60, sz = 92, g = 8;
    ["x", "y", "z"].forEach((n, c) => txt(svg, ox + c * (sz + g) + sz / 2, oy - 14, n, { "font-size": 22, "text-anchor": "middle", fill: C.muted }));
    this.cells = [];
    for (let r = 0; r < 3; r++) {
      txt(svg, ox - 16, oy + r * (sz + g) + sz / 2 + 7, "individu " + r, { "font-size": 19, "text-anchor": "end" });
      for (let c = 0; c < 3; c++) this.cells.push(el("rect", { x: ox + c * (sz + g), y: oy + r * (sz + g), width: sz, height: sz, rx: 6, fill: C.cell }, svg));
    }
    // v1/v2 : une bande par individu
    this.bands = [0, 1, 2].map((r) => {
      const gr = el("g", {}, svg);
      el("rect", { x: ox - 4, y: oy + r * (sz + g) - 4, width: 3 * sz + 2 * g + 8, height: sz + 8, rx: 10, fill: "none", stroke: C.v1, "stroke-width": 3 }, gr);
      txt(gr, ox + 3 * (sz + g) + 14, oy + r * (sz + g) + sz / 2 + 8, "t" + r, { "font-size": 22, "font-weight": 700 });
      return gr;
    });
    // v3 : un thread par case
    this.lbl = this.cells.map((c, k) => txt(svg, +c.getAttribute("x") + sz / 2, +c.getAttribute("y") + sz / 2 + 8, "t" + k, { "font-size": 24, "font-weight": 700, "text-anchor": "middle", opacity: 0 }));
    // memoire lineaire
    const my = 400, ms = 54;
    this.mem = [];
    for (let k = 0; k < 9; k++) {
      this.mem.push(el("rect", { x: 40 + k * (ms + 4), y: my, width: ms, height: ms, rx: 4, fill: C.cell, opacity: 0 }, svg));
      txt(svg, 40 + k * (ms + 4) + ms / 2, my + ms + 22, String(k), { "font-size": 17, fill: C.muted, "text-anchor": "middle", class: "memi", opacity: 0 });
    }
    this.memT = txt(svg, 40, my - 18, "mémoire : la case k", { "font-size": 19, opacity: 0 });
    this.r1 = txt(svg, 40, my + 112, "v1 : t0, t1, t2 lisent 0, 3, 6", { "font-size": 19, opacity: 0 });
    this.r3 = txt(svg, 330, my + 112, "v3 : t0, t1, t2 lisent 0, 1, 2", { "font-size": 19, "font-weight": 700, opacity: 0 });
  },
  go(step, inst) {
    to(this.bands, { opacity: step === 0 ? 1 : 0 }, inst);
    this.cells.forEach((c, k) => to(c, { attr: { fill: step >= 1 ? (step >= 2 && k === 5 ? C.v3 : "#cdeee2") : C.cell } }, inst));
    to(this.lbl, { opacity: step >= 1 ? 1 : 0, stagger: 0.06 }, inst);
    for (let k = 0; k <= 3; k++) to(document.getElementById("v3-t" + k), { opacity: k <= step ? 1 : 0 }, inst);
    const memOn = step >= 3;
    to([...this.mem, this.memT, ...this.svg.querySelectorAll(".memi"), this.r1, this.r3], { opacity: memOn ? 1 : 0 }, inst);
    if (this.tl) { this.tl.kill(); this.tl = null; }
    this.mem.forEach((m) => set(m, { attr: { fill: C.cell } }));
    if (memOn && !inst) {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
      tl.to([0, 3, 6].map((i) => this.mem[i]), { attr: { fill: C.v1 }, duration: 0.3 }).to(this.mem, { attr: { fill: C.cell }, duration: 0.3 }, "+=0.7")
        .to([0, 1, 2].map((i) => this.mem[i]), { attr: { fill: C.v3 }, duration: 0.3 }).to(this.mem, { attr: { fill: C.cell }, duration: 0.3 }, "+=0.7");
      this.tl = tl;
    } else if (memOn) [0, 1, 2].forEach((i) => this.mem[i].setAttribute("fill", C.v3));
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- v3 : reduction en memoire partagee ---------- */
ANIM.v3red = {
  init(s) {
    const svg = s.querySelector("#red-svg"); this.svg = svg;
    this.vals0 = [1.2, 0.4, 2.1, 0.8, 0.3, 1.5, 0.9, 0.6, 1.1, 0.7, 0, 0, 0, 0, 0, 0];
    txt(svg, 0, 26, "mémoire partagée d'un individu (D = 10, donc 16 cases)", { "font-size": 22, fill: C.muted });
    this.cells = []; this.tx = [];
    const w = 62, gp = 6;
    for (let k = 0; k < 16; k++) {
      const x = k * (w + gp);
      this.cells.push(el("rect", { x, y: 48, width: w, height: 62, rx: 5, fill: k < 10 ? "#cdeee2" : C.cell }, svg));
      this.tx.push(txt(svg, x + w / 2, 87, "", { "font-size": 22, "text-anchor": "middle", "font-weight": 700 }));
    }
    txt(svg, 10 * (w + gp) + 2, 138, "threads en trop : ils mettent 0", { "font-size": 20, fill: C.muted });
    this.round = txt(svg, 0, 180, "", { "font-size": 26, "font-weight": 700 });
    this.res = txt(svg, 0, 226, "", { "font-size": 26 });
    this.sync = txt(svg, 1136, 180, "", { "font-size": 21, fill: C.muted, "text-anchor": "end" });
    this.reset();
  },
  reset() {
    this.vals = this.vals0.slice();
    this.tx.forEach((t, k) => { t.textContent = k < 10 ? this.vals[k].toFixed(1) : "0"; });
    this.cells.forEach((c, k) => { c.setAttribute("fill", k < 10 ? "#cdeee2" : C.cell); c.setAttribute("opacity", 1); });
    this.tx.forEach((t) => t.setAttribute("opacity", 1));
    this.round.textContent = "chaque thread écrit son terme"; this.res.textContent = ""; this.sync.textContent = "";
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    if (step < 3) { this.reset(); return; }
    const final = () => {
      this.cells.forEach((c, k) => { c.setAttribute("opacity", k === 0 ? 1 : 0.15); c.setAttribute("fill", k === 0 ? C.v3 : C.cell); });
      this.tx.forEach((t, k) => t.setAttribute("opacity", k === 0 ? 1 : 0)); this.tx[0].textContent = "9.6";
      this.round.textContent = "somme = 9,6"; this.res.textContent = "f = 9,6 − 330 = −320,4 (Rastrigin)"; this.sync.textContent = "__syncthreads() entre deux tours";
    };
    if (inst || step > 3) { final(); return; }
    this.reset();
    const tl = gsap.timeline({ delay: 0.4 });
    for (let s = 8; s >= 1; s /= 2) {
      const half = s;
      tl.call(() => { this.round.textContent = `tour : les ${half} premiers ajoutent la case + ${half}`; this.sync.textContent = "__syncthreads() entre deux tours"; });
      const tgt = [], src = [];
      for (let k = 0; k < half; k++) { tgt.push(this.cells[k]); src.push(this.cells[k + half]); }
      tl.to(src, { attr: { fill: C.v3 }, duration: 0.25 })
        .call(() => { for (let k = 0; k < half; k++) { this.vals[k] += this.vals[k + half]; this.tx[k].textContent = this.vals[k].toFixed(1); } })
        .to(src, { opacity: 0.15, duration: 0.3 }).to(src.map((c) => this.tx[this.cells.indexOf(c)]), { opacity: 0, duration: 0.3 }, "<")
        .to(tgt, { attr: { fill: "#9fdcc5" }, duration: 0.2 }, "<").to({}, { duration: 0.6 });
    }
    tl.call(final);
    this.tl = tl;
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- protocole : 36 cas ---------- */
ANIM.protocole = {
  init(s) {
    const svg = s.querySelector("#proto-svg");
    const F = ["Sphere", "Rastrigin", "Rosenbrock", "Griewank"];
    const cols = [];
    [10, 50, 100].forEach((d) => [50, 100, 500].forEach((p) => cols.push([d, p])));
    cols.forEach(([d, p], j) => {
      const x = 170 + j * 42;
      if (j % 3 === 0) txt(svg, x + 42, 22, "D = " + d, { "font-size": 17, "text-anchor": "middle", fill: C.muted });
      txt(svg, x, 300, String(p), { "font-size": 16, "text-anchor": "middle", fill: C.muted });
    });
    txt(svg, 170 + 4 * 42, 330, "Pop", { "font-size": 16, "text-anchor": "middle", fill: C.muted });
    this.dots = [];
    F.forEach((f, i) => {
      const y = 70 + i * 58;
      txt(svg, 140, y + 6, f, { "font-size": 19, "text-anchor": "end" });
      cols.forEach((_, j) => this.dots.push(el("circle", { cx: 170 + j * 42, cy: y, r: 13, fill: C.ink, opacity: 0 }, svg)));
    });
  },
  enter(s, inst) {
    if (inst) { this.dots.forEach((d) => d.setAttribute("opacity", 1)); return; }
    gsap.fromTo(this.dots, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.025, delay: 0.3, ease: "back.out(2)" });
  },
  go() {},
};

/* ---------- CR 0,9 contre 0,3 (haltere) ---------- */
ANIM.cr = {
  init(s) {
    const svg = s.querySelector("#cr-svg");
    const rows = [
      ["Rastrigin D10 P50", 0.5, 1.0, 1.0], ["Rastrigin D10 P100", 0.0, 1.0, 1.0], ["Griewank D10 P50", 0.2, 0.9, 1.0],
      ["Sphere D50 P500", 0.0, 1.0, 1.0], ["Griewank D100 P500", 0.0, 1.0, 0.96], ["Rosenbrock D10 P100", 1.0, 0.0, 0.32],
    ];
    const x0 = 250, W = 300, X = (v) => x0 + v * W;
    [0, 0.5, 1].forEach((v) => { el("line", { x1: X(v), y1: 30, x2: X(v), y2: 330, stroke: C.rule }, svg); txt(svg, X(v), 22, v.toFixed(1).replace(".", ","), { "font-size": 16, "text-anchor": "middle", fill: C.muted }); });
    this.items = [];
    rows.forEach(([n, a, b, art], i) => {
      const y = 60 + i * 52;
      txt(svg, x0 - 18, y + 7, n, { "font-size": 20, "text-anchor": "end" });
      const tick = el("line", { x1: X(art), y1: y - 14, x2: X(art), y2: y + 14, stroke: C.muted, "stroke-width": 3 }, svg);
      const line = el("line", { x1: X(a), y1: y, x2: X(a), y2: y, stroke: C.ink, "stroke-width": 3 }, svg);
      const p9 = el("circle", { cx: X(a), cy: y, r: 9, fill: C.paper, stroke: C.ink, "stroke-width": 2.5 }, svg);
      const p3 = el("circle", { cx: X(a), cy: y, r: 9, fill: C.ink, opacity: 0 }, svg);
      this.items.push({ line, p3, a: X(a), b: X(b) });
    });
    const ly = 380;
    el("circle", { cx: 20, cy: ly, r: 9, fill: C.paper, stroke: C.ink, "stroke-width": 2.5 }, svg); txt(svg, 36, ly + 6, "CR = 0,9", { "font-size": 20 });
    el("circle", { cx: 150, cy: ly, r: 9, fill: C.ink }, svg); txt(svg, 166, ly + 6, "CR = 0,3", { "font-size": 20 });
    el("line", { x1: 280, y1: ly - 12, x2: 280, y2: ly + 12, stroke: C.muted, "stroke-width": 3 }, svg); txt(svg, 292, ly + 6, "article", { "font-size": 20 });
  },
  go(step, inst) {
    this.items.forEach((it, i) => {
      to(it.p3, { opacity: step >= 1 ? 1 : 0, attr: { cx: step >= 1 ? it.b : it.a }, duration: 0.8, delay: step >= 1 ? i * 0.12 : 0 }, inst);
      to(it.line, { attr: { x2: step >= 1 ? it.b : it.a }, duration: 0.8, delay: step >= 1 ? i * 0.12 : 0 }, inst);
    });
  },
};

/* ---------- limites : la droite des float ---------- */
ANIM.limites = {
  init(s) {
    const svg = s.querySelector("#float-svg");
    el("line", { x1: 20, y1: 150, x2: 520, y2: 150, stroke: C.ink, "stroke-width": 2 }, svg);
    for (let k = 0; k < 6; k++) {
      const x = 45 + k * 90;
      el("line", { x1: x, y1: 138, x2: x, y2: 162, stroke: C.ink, "stroke-width": 2 }, svg);
    }
    txt(svg, 45, 198, "−450", { "font-size": 21, "text-anchor": "middle" });
    txt(svg, 135, 198, "+3e−5", { "font-size": 20, "text-anchor": "middle", fill: C.muted });
    txt(svg, 20, 40, "les valeurs qu'un float peut stocker", { "font-size": 21, fill: C.muted });
    this.a = el("circle", { cx: 70, cy: 110, r: 10, fill: C.v3 }, svg);
    this.b = el("circle", { cx: 100, cy: 110, r: 10, fill: C.v2 }, svg);
    this.la = txt(svg, 70, 84, "u", { "font-size": 24, "font-weight": 700, "text-anchor": "middle" });
    this.lb = txt(svg, 100, 84, "xᵢ", { "font-size": 24, "font-weight": 700, "text-anchor": "middle" });
    this.msg = txt(svg, 20, 262, "même valeur : la sélection ne voit plus la différence", { "font-size": 22, "font-weight": 700, opacity: 0 });
  },
  go(step, inst) {
    const on = step >= 1;
    to(this.a, { attr: { cx: on ? 45 : 70, cy: on ? 150 : 110 }, duration: 0.8, ease: "power3.inOut" }, inst);
    to(this.b, { attr: { cx: on ? 45 : 100, cy: on ? 150 : 110 }, duration: 0.8, ease: "power3.inOut" }, inst);
    to(this.la, { attr: { x: on ? 30 : 70 } }, inst); to(this.lb, { attr: { x: on ? 60 : 100 } }, inst);
    to(this.msg, { opacity: on ? 1 : 0, delay: on ? 0.7 : 0 }, inst);
  },
};

/* ---------- moteur : etapes et entree/sortie de slide ---------- */
const inited = new Set();
function stepOf(slide) { return slide.querySelectorAll(".fragment.step.visible").length; }
function enterSlide(slide, inst) {
  const name = slide.dataset.anim; if (!name || !ANIM[name]) return;
  const a = ANIM[name];
  if (!inited.has(name)) { a.init && a.init(slide); inited.add(name); }
  a.enter && a.enter(slide, inst);
  a.go(PRINT ? 99 : stepOf(slide), true);
  if (!inst && !PRINT) a.go(stepOf(slide), false);
}
function leaveSlide(slide) { const a = slide && ANIM[slide.dataset.anim]; if (a && a.leave) a.leave(); }

Reveal.initialize({
  width: 1280, height: 720, margin: 0, center: false, hash: true,
  controls: false, controlsTutorial: false, progress: true, slideNumber: "c/t",
  transition: "fade", transitionSpeed: "fast", backgroundTransition: "none",
  pdfSeparateFragments: false, pdfMaxPagesPerSlide: 1,
  plugins: [RevealNotes],
}).then(() => {
  if (PRINT) {
    document.querySelectorAll(".slides section[data-anim]").forEach((s) => {
      const a = ANIM[s.dataset.anim]; a.init && a.init(s); a.enter && a.enter(s, true); a.go(a === ANIM.temps ? 0 : 99, true);
    });
    return;
  }
  enterSlide(Reveal.getCurrentSlide(), false);
});
Reveal.on("slidechanged", (e) => { leaveSlide(e.previousSlide); enterSlide(e.currentSlide, false); });
const onFrag = () => { const s = Reveal.getCurrentSlide(); const a = ANIM[s.dataset.anim]; if (a) a.go(stepOf(s), false); };
Reveal.on("fragmentshown", onFrag);
Reveal.on("fragmenthidden", onFrag);
