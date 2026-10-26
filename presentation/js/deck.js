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

/* ---------- paysage de Rastrigin en 3D (titre et fin) ---------- */
const rast = (x, y) => 20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function landscape(cv, instant) {
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, k = W / 620;
  const N = 64, L = 3.5, th = -0.62, ct = Math.cos(th), st = Math.sin(th);
  const sc = 68 * k, hz = 2.3 * k, cx = W / 2, cy = H * 0.6;
  const lo = hex(C.ink), hi = hex("#e4eaf2");
  const proj = (x, y, z) => { const X = x * ct - y * st, Y = x * st + y * ct; return [cx + X * sc, cy + Y * sc * 0.52 - z * hz, Y]; };
  const g = (i) => -L + (2 * L * i) / N;
  const quads = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const xs = [g(i), g(i + 1), g(i + 1), g(i)], ys = [g(j), g(j), g(j + 1), g(j + 1)];
    const z = xs.map((x, q) => rast(x, ys[q]));
    quads.push({ xs, ys, z, depth: proj((xs[0] + xs[1]) / 2, (ys[0] + ys[2]) / 2, 0)[2], zm: (z[0] + z[1] + z[2] + z[3]) / 4 });
  }
  quads.sort((a, b) => a.depth - b.depth);
  // billes : quelques puits locaux et le minimum global
  const billes = [[2, 1], [-2, -1], [1, -2], [-1, 2], [3, -1], [-3, 1], [0, 0]].map(([x, y], n) => ({ x, y, drop: 1, glob: x === 0 && y === 0, n }));
  const st0 = { rise: instant ? 1 : 0 };
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 0.6 * k; ctx.strokeStyle = "rgba(244,246,249,0.35)";
    for (const q of quads) {
      const t = Math.pow(Math.min(1, q.zm / 62), 0.7);
      const c = lo.map((v, m) => Math.round(v + (hi[m] - v) * t));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath();
      for (let m = 0; m < 4; m++) { const [px, py] = proj(q.xs[m], q.ys[m], q.z[m] * st0.rise); m ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (const b of billes) {
      if (b.drop >= 1 && !instant && st0.rise < 1) continue;
      const [px, py] = proj(b.x, b.y, rast(b.x, b.y) * st0.rise + b.drop * 160);
      const r = (b.glob ? 13 : 9) * k;
      if (b.glob && b.drop === 0) { ctx.beginPath(); ctx.arc(px, py - r, r * 2.1, 0, 7); ctx.strokeStyle = C.v3; ctx.lineWidth = 3 * k; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(px, py - r, r, 0, 7);
      ctx.fillStyle = b.glob ? C.v3 : C.paper; ctx.fill();
      ctx.lineWidth = 2.5 * k; ctx.strokeStyle = C.ink; ctx.stroke();
    }
  }
  if (cv._tl) cv._tl.kill();
  if (instant) { billes.forEach((b) => (b.drop = 0)); draw(); return; }
  billes.forEach((b) => (b.drop = 1));
  const tl = gsap.timeline({ onUpdate: draw, delay: 0.3 });
  tl.to(st0, { rise: 1, duration: 1.6, ease: "power2.inOut" });
  billes.forEach((b, n) => tl.to(b, { drop: 0, duration: 0.7, ease: "bounce.out" }, 1.5 + n * 0.14));
  cv._tl = tl;
  draw();
}

const ANIM = {};

ANIM.titre = { init(s) { this.cv = s.querySelector("canvas.land"); }, enter(s, inst) { landscape(this.cv, inst); }, go() {} };
ANIM.fin = { init(s) { this.cv = s.querySelector("canvas.land"); }, enter(s, inst) { landscape(this.cv, inst); }, go() {} };

/* ---------- Rastrigin 1D : les puits ---------- */
ANIM.probleme = {
  init(s) {
    const svg = s.querySelector("#puits-svg");
    const f = (x) => 10 + x * x - 10 * Math.cos(2 * Math.PI * x);
    const X = (x) => 40 + ((x + 5.12) / 10.24) * 1056, Y = (v) => 262 - v * 5.3;
    this.f = f; this.X = X; this.Y = Y;
    let d = "";
    for (let n = 0; n <= 600; n++) { const x = -5.12 + (10.24 * n) / 600; d += (n ? "L" : "M") + X(x).toFixed(1) + "," + Y(f(x)).toFixed(1); }
    el("path", { d: d + `L${X(5.12)},272 L${X(-5.12)},272 Z`, fill: C["paper-2"] }, svg);
    el("path", { d, fill: "none", stroke: C.ink, "stroke-width": 2.5 }, svg);
    el("path", { d: `M${X(0)},278 l-8,13 h16 z`, fill: C.v3 }, svg);
    txt(svg, X(0) + 14, 293, "minimum global", { "font-size": 19, "font-weight": 700 });
    const bille = (fill) => el("circle", { r: 10, fill, stroke: C.ink, "stroke-width": 2.5, opacity: 0 }, svg);
    this.place = (b, x) => { b.x = x; b.e.setAttribute("cx", X(x)); b.e.setAttribute("cy", Y(f(x)) - 11); };
    this.loc = { e: bille(C.ink), x: 3.62 };
    this.locLbl = txt(svg, X(2.985), 20, "bloquée : minimum local", { "font-size": 20, "font-weight": 700, "text-anchor": "middle", opacity: 0 });
    this.locArr = el("line", { x1: X(2.985), y1: 30, x2: X(2.985), y2: Y(f(2.985)) - 30, stroke: C.ink, "stroke-width": 2, "stroke-dasharray": "4 4", opacity: 0 }, svg);
    // population : 4 generations precalculees (les points se rapprochent du centre en passant de puits en puits)
    const x0 = [-4.7, -3.9, -3.1, -2.2, -1.4, -0.7, 0.6, 1.6, 2.4, 3.3, 4.1, 4.8];
    this.gens = [x0, x0.map((x) => Math.round(x * 0.62) + 0.06 * Math.sign(x)), x0.map((x) => Math.round(x * 0.3) + 0.04 * Math.sign(x)), x0.map((x, n) => ((n % 5) - 2) * 0.035)];
    this.pop = x0.map((x) => ({ e: bille(C.paper), x }));
    this.gen = txt(svg, 40, 20, "", { "font-size": 20, "font-weight": 700, fill: C.muted });
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    const place = this.place;
    place(this.loc, step >= 1 ? 2.985 : 3.62);
    set(this.loc.e, { opacity: step === 1 ? 1 : 0 });
    set([this.locLbl, this.locArr], { opacity: step === 1 ? 1 : 0 });
    this.pop.forEach((b, n) => { place(b, this.gens[step >= 2 ? 3 : 0][n]); set(b.e, { opacity: step >= 2 ? 1 : 0 }); });
    this.gen.textContent = step >= 2 ? "génération 3" : "";
    if (inst) return;
    if (step === 1) {
      place(this.loc, 3.62); set([this.locLbl, this.locArr], { opacity: 0 });
      const o = { x: 3.62 };
      this.tl = gsap.timeline({ delay: 0.2 })
        .to(o, { x: 2.985, duration: 1.3, ease: "power2.in", onUpdate: () => place(this.loc, o.x) })
        .to(o, { x: 3.12, duration: 0.35, ease: "power1.out", onUpdate: () => place(this.loc, o.x) })
        .to(o, { x: 2.985, duration: 0.45, ease: "power1.inOut", onUpdate: () => place(this.loc, o.x) })
        .to([this.locLbl, this.locArr], { opacity: 1, duration: 0.4 });
    }
    if (step === 2) {
      const tl = gsap.timeline({ delay: 0.3 });
      this.pop.forEach((b, n) => { place(b, this.gens[0][n]); set(b.e, { opacity: 0 }); });
      tl.to(this.pop.map((b) => b.e), { opacity: 1, duration: 0.3, stagger: 0.04 });
      for (let g = 1; g <= 3; g++) {
        tl.call(() => (this.gen.textContent = "génération " + g), null, "+=0.35");
        this.pop.forEach((b, n) => {
          const o = { x: this.gens[g - 1][n] };
          tl.to(o, { x: this.gens[g][n], duration: 0.9, ease: "power1.inOut", onUpdate: () => place(b, o.x) }, n ? "<" : ">");
        });
      }
      this.gen.textContent = "génération 0";
      this.tl = tl;
    }
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
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

/* ---------- PSO : l'algorithme ---------- */
const PSO_CLAIR = "#a99ff0";
ANIM.psoalgo = {
  init(s) {
    const svg = s.querySelector("#pa-svg");
    arrowDefs(svg, "pa-m", C.muted); arrowDefs(svg, "pa-l", PSO_CLAIR); arrowDefs(svg, "pa-p", C.pso); arrowDefs(svg, "pa-i", C.ink);
    const cx = 290, cy = 250;
    for (const r of [230, 175, 120, 65]) el("circle", { cx, cy, r, fill: "none", stroke: C.rule, "stroke-width": 1.5 }, svg);
    el("circle", { cx, cy, r: 5, fill: C.muted }, svg);
    txt(svg, cx - 10, cy + 26, "minimum", { "font-size": 20, fill: C.muted, "text-anchor": "end" });
    const fl = (x1, y1, x2, y2, col, mk, w = 2.5, extra = {}) => el("line", Object.assign({ x1, y1, x2, y2, stroke: col, "stroke-width": w, "marker-end": `url(#${mk})` }, extra), svg);
    // le reste de l'essaim
    [[120, 120, 26, 12], [480, 390, -22, -24], [100, 360, 30, -10], [200, 450, 12, -30], [530, 250, -30, 6], [160, 230, 26, 14], [370, 420, -16, -26], [230, 300, 10, 8]]
      .forEach(([x, y, dx, dy]) => { fl(x, y, x + dx, y + dy, C.muted, "pa-m", 2); el("circle", { cx: x, cy: y, r: 7, fill: C.cell, stroke: C.muted, "stroke-width": 1.5 }, svg); });
    // passe de la particule suivie : elle etait meilleure avant (pBest)
    this.trail = el("g", { opacity: 0 }, svg);
    el("polyline", { points: "420,200 442,158 450,120", fill: "none", stroke: C.pso, "stroke-width": 2, "stroke-dasharray": "5 5" }, this.trail);
    el("circle", { cx: 442, cy: 158, r: 4, fill: C.pso }, this.trail);
    this.pb = el("g", { opacity: 0 }, svg);
    el("circle", { cx: 0, cy: 0, r: 12, fill: C.paper, stroke: C.pso, "stroke-width": 3 }, this.pb);
    txt(this.pb, 18, 7, "pBest", { "font-size": 22, "font-weight": 700, fill: C.pso });
    set(this.pb, { x: 420, y: 200 });
    this.gb = el("g", { opacity: 0 }, svg);
    const star = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? 7 : 17, a = -Math.PI / 2 + (k * Math.PI) / 5; star.push((230 + r * Math.cos(a)).toFixed(1) + "," + (300 + r * Math.sin(a)).toFixed(1)); }
    el("polygon", { points: star.join(" "), fill: C.pso, stroke: C.paper, "stroke-width": 2 }, this.gb);
    txt(this.gb, 208, 306, "gBest", { "font-size": 22, "font-weight": 700, "text-anchor": "end", fill: C.pso });
    // la particule suivie et sa vitesse
    this.ghost = el("circle", { cx: 450, cy: 120, r: 9, fill: "none", stroke: C.muted, "stroke-width": 2, "stroke-dasharray": "3 3", opacity: 0 }, svg);
    this.v = fl(450, 120, 538, 81, C.ink, "pa-i", 3);
    this.vLbl = txt(svg, 546, 78, "v", { "font-size": 24, "font-weight": 700 });
    this.x = el("g", {}, svg);
    el("circle", { cx: 450, cy: 120, r: 10, fill: C.ink, stroke: C.paper, "stroke-width": 2 }, this.x);
    txt(this.x, 436, 108, "x", { "font-size": 24, "font-weight": 700, "text-anchor": "end" });
    // les trois fleches mises bout a bout, puis leur somme
    this.a = [
      [fl(450, 120, 495, 100, C.muted, "pa-m", 4, { opacity: 0 }), 495, 100, txt(svg, 462, 88, "w·v", { "font-size": 21, "font-weight": 700, opacity: 0 })],
      [fl(495, 100, 465, 180, PSO_CLAIR, "pa-l", 4, { opacity: 0 }), 465, 180, txt(svg, 492, 150, "vers pBest", { "font-size": 21, "font-weight": 700, opacity: 0 })],
      [fl(465, 180, 373, 256, C.pso, "pa-p", 4, { opacity: 0 }), 373, 256, txt(svg, 428, 246, "vers gBest", { "font-size": 21, "font-weight": 700, opacity: 0 })],
    ];
    this.res = fl(450, 120, 450, 120, C.ink, "pa-i", 4, { opacity: 0 });
    this.maj = txt(svg, 290, 492, "", { "font-size": 22, "font-weight": 700, "text-anchor": "middle" });
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    for (let k = 0; k <= 4; k++) to(document.getElementById("pa-t" + k), { opacity: k <= step ? 1 : 0, y: k <= step ? 0 : 8 }, inst);
    to([this.trail, this.pb], { opacity: step >= 1 ? 1 : 0 }, inst);
    to(this.gb, { opacity: step >= 2 ? 1 : 0 }, inst);
    if (step === 2 && !inst) gsap.fromTo(this.gb, { scale: 1.6, svgOrigin: "230 300" }, { scale: 1, duration: 0.6, ease: "back.out(2)" });
    const moved = step >= 4;
    // fleches : visibles a l'etape 3, attenuees a l'etape 4
    if (step === 3 && !inst) {
      const tl = gsap.timeline({ delay: 0.2 });
      this.a.forEach(([l, x2, y2, t]) => {
        const x1 = +l.getAttribute("x1"), y1 = +l.getAttribute("y1");
        tl.fromTo(l, { opacity: 1, attr: { x2: x1, y2: y1 } }, { attr: { x2, y2 }, duration: 0.6, ease: EASE }).to(t, { opacity: 1, duration: 0.3 }, "<0.3");
      });
      tl.fromTo(this.res, { opacity: 1, attr: { x2: 450, y2: 120 } }, { attr: { x2: 373, y2: 256 }, duration: 0.7, ease: EASE }, "+=0.3");
      this.tl = tl;
    } else {
      this.a.forEach(([l, x2, y2, t]) => { to(l, { opacity: step === 3 ? 1 : 0, attr: { x2, y2 } }, inst); to(t, { opacity: step === 3 ? 1 : 0 }, inst); });
      to(this.res, { opacity: step === 3 ? 1 : moved ? 0.3 : 0, attr: { x2: 373, y2: 256 } }, inst);
    }
    to([this.v, this.vLbl], { opacity: moved ? 0 : step === 3 ? 0.25 : 1 }, inst);
    to(this.ghost, { opacity: moved ? 1 : 0 }, inst);
    to(this.x, { x: moved ? -77 : 0, y: moved ? 136 : 0, duration: 0.9, ease: "power3.inOut" }, inst);
    to(this.pb, { x: moved ? 373 : 420, y: moved ? 256 : 200, duration: 0.6, delay: moved ? 0.9 : 0 }, inst);
    to(this.trail, { opacity: step >= 1 && !moved ? 1 : 0 }, inst);
    this.maj.textContent = moved ? "mieux que son pBest : pBest mis à jour" : "";
    to(this.maj, { opacity: moved ? 1 : 0, delay: moved ? 1.2 : 0 }, inst);
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- PSO fourni : CPU et GPU ---------- */
ANIM.pso = {
  init(s) {
    const svg = s.querySelector("#pso-svg");
    this.cap = s.querySelector("#pso-cap");
    const box = (x, y, w, h, title) => { el("rect", { x, y, width: w, height: h, rx: 10, fill: "none", stroke: C.ink, "stroke-width": 2 }, svg); txt(svg, x + 18, y + 34, title, { "font-size": 26, "font-weight": 700 }); };
    box(20, 6, 340, 384, "CPU"); box(776, 6, 340, 384, "GPU");
    el("rect", { x: 380, y: 175, width: 376, height: 50, rx: 25, fill: C["paper-2"] }, svg);
    txt(svg, 568, 252, "bus PCIe", { "font-size": 20, fill: C.muted, "text-anchor": "middle" });
    const grille = (ox, oy, lab) => {
      txt(svg, ox, oy - 12, lab, { "font-size": 20, fill: C.muted });
      const rows = [];
      for (let r = 0; r < 4; r++) { rows.push([]); for (let c = 0; c < 3; c++) rows[r].push(el("rect", { x: ox + c * 34, y: oy + r * 34, width: 30, height: 30, rx: 3, fill: C.cell }, svg)); }
      return rows;
    };
    this.xv = grille(800, 84, "x et v");
    this.pbG = grille(960, 84, "pBest");
    txt(svg, 946, 240, "4 particules × 3 coordonnées", { "font-size": 17, fill: C.muted, "text-anchor": "middle" });
    this.rowBox = [0, 1, 2, 3].map((r) => el("rect", { x: 956, y: 80 + r * 34, width: 108, height: 38, rx: 5, fill: "none", stroke: C.pso, "stroke-width": 2.5, opacity: 0 }, svg));
    const kern = (y, name) => { const r = el("rect", { x: 800, y, width: 296, height: 52, rx: 8, fill: C.cell }, svg); txt(svg, 816, y + 33, name, { class: "mono", "font-size": 20 }); return r; };
    this.k1 = kern(258, "kernelUpdateParticle");
    this.k2 = kern(320, "kernelUpdatePBest");
    // cote CPU
    this.cpuG = grille(44, 84, "copie des pBest");
    txt(svg, 210, 72, "gBest", { "font-size": 20, fill: C.muted });
    this.gbG = [0, 1, 2].map((c) => el("rect", { x: 210 + c * 34, y: 84, width: 30, height: 30, rx: 3, fill: C.cell }, svg));
    this.scan = el("rect", { x: 40, y: 80, width: 108, height: 38, rx: 5, fill: "none", stroke: C.ink, "stroke-width": 2.5, opacity: 0 }, svg);
    this.loop = el("rect", { x: 40, y: 290, width: 300, height: 82, rx: 8, fill: C.cell }, svg);
    txt(svg, 56, 324, "boucle sur les pBest", { "font-size": 22 });
    txt(svg, 56, 354, "garde le meilleur", { "font-size": 20, fill: C.muted });
    const pk = (lab) => { const g = el("g", { opacity: 0 }, svg); el("rect", { x: -62, y: -18, width: 124, height: 36, rx: 18, fill: C.pso }, g); txt(g, 0, 7, lab, { "font-size": 19, "font-weight": 700, fill: C.paper, "text-anchor": "middle" }); return g; };
    this.pk1 = pk("pBest"); this.pk2 = pk("gBest");
    this.cnt = txt(svg, 568, 130, "", { "font-size": 26, "font-weight": 700, "text-anchor": "middle" });
    this.caps = [
      "Positions, vitesses et pBest restent sur le GPU. Le gBest est calculé sur le CPU.",
      "<b>kernelUpdateParticle</b> : un thread par coordonnée calcule la nouvelle vitesse et la position.",
      "<b>kernelUpdatePBest</b> : un thread par particule compare sa position à son pBest.",
      "Tous les pBest sont copiés sur le CPU. Une boucle cherche le meilleur : c'est le gBest.",
      "Le gBest repart sur le GPU et on recommence. 2 copies et 1 boucle CPU à chaque itération : c'est ce qui le rend lent.",
    ];
  },
  etat(step) {
    // etat fixe atteint a la fin de chaque etape
    const A = "#e7e3fa", B = "#c9c1f3";
    set(this.k1, { attr: { fill: step === 1 ? A : C.cell } });
    set(this.k2, { attr: { fill: step === 2 ? A : C.cell } });
    set(this.loop, { attr: { fill: step === 3 ? A : C.cell } });
    set(this.xv.flat(), { attr: { fill: step >= 1 ? B : C.cell } });
    set(this.pbG.flat(), { attr: { fill: step >= 2 ? B : C.cell } });
    set(this.rowBox, { opacity: step === 2 ? 1 : 0 });
    set(this.cpuG.flat(), { attr: { fill: step >= 3 ? B : C.cell } });
    set(this.gbG, { attr: { fill: step >= 3 ? C.pso : C.cell } });
    set([this.scan, this.pk1, this.pk2], { opacity: 0 });
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    this.cap.innerHTML = this.caps[Math.min(step, 4)];
    if (!inst) gsap.fromTo(this.cap, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 });
    this.etat(step);
    this.cnt.textContent = step >= 1 && step < 4 ? "itération 1" : "";
    if (inst) { if (step >= 4) this.cnt.textContent = "itération 2000"; return; }
    const A = "#e7e3fa", B = "#c9c1f3", me = this;
    const kernel1 = (tl) => tl.to(this.k1, { attr: { fill: A }, duration: 0.15 }).fromTo(this.xv.flat(), { attr: { fill: C.cell } }, { attr: { fill: B }, duration: 0.3 }, "<");
    const kernel2 = (tl) => tl.to(this.k2, { attr: { fill: A }, duration: 0.15 }).set(this.rowBox, { opacity: 1 }, "<").fromTo(this.pbG.flat(), { attr: { fill: C.cell } }, { attr: { fill: B }, duration: 0.3 }, "<");
    const copie = (tl, pk, a, b, d) => tl.fromTo(pk, { x: a, y: 200, opacity: 1 }, { x: b, duration: d, ease: "power1.inOut" }).set(pk, { opacity: 0 });
    const boucle = (tl, d) => {
      tl.to(this.loop, { attr: { fill: A }, duration: 0.15 }).fromTo(this.cpuG.flat(), { attr: { fill: C.cell } }, { attr: { fill: B }, duration: 0.2 }, "<").set(this.scan, { opacity: 1, y: 0 });
      for (let r = 1; r < 4; r++) tl.to(this.scan, { y: r * 34, duration: d, ease: "steps(1)" });
      tl.set(this.scan, { opacity: 0 }).fromTo(this.gbG, { attr: { fill: C.cell } }, { attr: { fill: C.pso }, duration: 0.25 });
    };
    if (step === 1) { const tl = gsap.timeline({ delay: 0.3 }); kernel1(tl); this.tl = tl; }
    if (step === 2) { const tl = gsap.timeline({ delay: 0.3 }); kernel2(tl); this.tl = tl; }
    if (step === 3) { this.etat(2); set(this.k2, { attr: { fill: C.cell } }); set(this.rowBox, { opacity: 0 }); const tl = gsap.timeline({ delay: 0.3 }); copie(tl, this.pk1, 690, 446, 0.9); boucle(tl, 0.3); this.tl = tl; }
    if (step === 4) {
      const tl = gsap.timeline({ delay: 0.3 });
      copie(tl, this.pk2, 446, 690, 0.9);
      const cyc = gsap.timeline({ repeat: -1 }), o = { n: 1 };
      cyc.call(() => { o.n = o.n >= 2000 ? 2 : Math.min(2000, Math.round(o.n * 1.9 + 1)); me.cnt.textContent = "itération " + o.n; });
      cyc.set([this.k1, this.k2, this.loop], { attr: { fill: C.cell } }).set(this.rowBox, { opacity: 0 });
      kernel1(cyc); cyc.set(this.k1, { attr: { fill: C.cell } }, "+=0.15");
      kernel2(cyc); cyc.set(this.k2, { attr: { fill: C.cell } }, "+=0.15").set(this.rowBox, { opacity: 0 });
      copie(cyc, this.pk1, 690, 446, 0.35); boucle(cyc, 0.08); cyc.set(this.loop, { attr: { fill: C.cell } });
      copie(cyc, this.pk2, 446, 690, 0.35);
      tl.add(cyc);
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

/* ---------- v3 : les 5 kernels, puis la reduction de E ---------- */
ANIM.v3red = {
  init(s) {
    const pipe = s.querySelector("#pipe-svg");
    arrowDefs(pipe, "pipe-ar", C.ink);
    const K = [["P", "tirages", "1 thread / individu"], ["M", "mutation", "1 thread / coordonnée"], ["C", "croisement", "1 thread / coordonnée"], ["E", "évaluation", "1 thread / coordonnée"], ["S", "sélection", "1 thread / coordonnée"]];
    this.box = K.map(([n, nom, map], i) => {
      const x = i * 234;
      const r = el("rect", { x: x + 1, y: 2, width: 198, height: 62, rx: 8, fill: C.cell, stroke: C.ink, "stroke-width": 1.5 }, pipe);
      txt(pipe, x + 18, 42, "(" + n + ")", { "font-size": 24, "font-weight": 700 });
      txt(pipe, x + 66, 42, nom, { "font-size": 22 });
      txt(pipe, x + 100, 98, map, { "font-size": 19, fill: C.muted, "text-anchor": "middle" });
      if (i < 4) el("line", { x1: x + 202, y1: 33, x2: x + 230, y2: 33, stroke: C.ink, "stroke-width": 2, "marker-end": "url(#pipe-ar)" }, pipe);
      return r;
    });
    this.panels = [...s.querySelectorAll(".panel")];
    // P : un tirage par individu, relu par ses D threads
    const sp = s.querySelector("#vp-svg");
    arrowDefs(sp, "vp-ar", C.muted);
    el("rect", { x: 0, y: 60, width: 330, height: 64, rx: 8, fill: "#cdeee2", stroke: C.v3, "stroke-width": 2 }, sp);
    txt(sp, 18, 100, "idx[i] : r₁, r₂, r₃, jrand", { "font-size": 22, "font-weight": 700 });
    txt(sp, 0, 40, "écrit une fois par le thread de l'individu i", { "font-size": 19, fill: C.muted });
    for (let d = 0; d < 6; d++) {
      const x = 520 + d * 100;
      el("line", { x1: 330, y1: 92, x2: x, y2: 152, stroke: C.muted, "stroke-width": 1.6, "marker-end": "url(#vp-ar)" }, sp);
      el("rect", { x: x - 36, y: 156, width: 72, height: 44, rx: 5, fill: C.cell }, sp);
      txt(sp, x, 185, "d=" + d, { "font-size": 18, "text-anchor": "middle" });
    }
    txt(sp, 484, 40, "relu par les D threads de l'individu i", { "font-size": 19, fill: C.muted });
    // M et C : un thread = une colonne
    const sm = s.querySelector("#vm-svg");
    const L = ["x_r1", "x_r2", "x_r3", "v", "u"], lab = ["xᵣ₁", "xᵣ₂", "xᵣ₃", "v", "u"];
    L.forEach((n, r) => {
      txt(sm, 60, 30 + r * 40, lab[r], { "font-size": 20, "font-weight": 700, "text-anchor": "end" });
      for (let d = 0; d < 6; d++) el("rect", { x: 74 + d * 64, y: 10 + r * 40, width: 58, height: 32, rx: 4, fill: r < 3 ? C.cell : r === 3 ? "#fde3d4" : "#cdeee2" }, sm);
    });
    el("rect", { x: 74 + 2 * 64 - 5, y: 3, width: 68, height: 206, rx: 7, fill: "none", stroke: C.ink, "stroke-width": 3 }, sm);
    txt(sm, 74 + 2 * 64 + 29, 232, "thread d = 2", { "font-size": 19, "font-weight": 700, "text-anchor": "middle" });
    // reduction
    const svg = s.querySelector("#red-svg");
    this.vals0 = [1.2, 0.4, 2.1, 0.8, 0.3, 1.5, 0.9, 0.6, 1.1, 0.7, 0, 0, 0, 0, 0, 0];
    this.cells = []; this.tx = [];
    const w = 62, gp = 6;
    txt(svg, 0, 22, "une case = le terme d'une coordonnée de u, calculé par son thread (Rastrigin, D = 10)", { "font-size": 20, fill: C.muted });
    for (let k = 0; k < 16; k++) {
      const x = k * (w + gp);
      this.cells.push(el("rect", { x, y: 36, width: w, height: 58, rx: 5, fill: k < 10 ? "#cdeee2" : C.cell }, svg));
      this.tx.push(txt(svg, x + w / 2, 73, "", { "font-size": 22, "text-anchor": "middle", "font-weight": 700 }));
      txt(svg, x + w / 2, 116, "d=" + k, { "font-size": 16, fill: C.muted, "text-anchor": "middle" });
    }
    txt(svg, 10 * (w + gp) + 2, 142, "16 cases (puissance de 2) : les 6 en trop valent 0", { "font-size": 18, fill: C.muted });
    this.round = txt(svg, 0, 190, "", { "font-size": 25, "font-weight": 700 });
    this.res = txt(svg, 0, 234, "", { "font-size": 25 });
    this.sync = txt(svg, 1136, 190, "", { "font-size": 20, fill: C.muted, "text-anchor": "end" });
    this.reset();
  },
  reset() {
    this.vals = this.vals0.slice();
    this.tx.forEach((t, k) => { t.textContent = k < 10 ? this.vals[k].toFixed(1).replace(".", ",") : "0"; t.setAttribute("opacity", 1); });
    this.cells.forEach((c, k) => { c.setAttribute("fill", k < 10 ? "#cdeee2" : C.cell); c.setAttribute("opacity", 1); });
    this.round.textContent = "f(u) = somme des 10 termes − 330. Mais chaque thread ne connaît que son terme."; this.res.textContent = ""; this.sync.textContent = "";
  },
  final() {
    this.cells.forEach((c, k) => { c.setAttribute("opacity", k === 0 ? 1 : 0.15); c.setAttribute("fill", k === 0 ? C.v3 : C.cell); });
    this.tx.forEach((t, k) => t.setAttribute("opacity", k === 0 ? 1 : 0)); this.tx[0].textContent = "9,6";
    this.round.textContent = "La case 0 contient la somme : 9,6"; this.res.textContent = "f(u) = 9,6 − 330 = −320,4"; this.sync.textContent = "__syncthreads() entre deux tours";
  },
  go(step, inst) {
    if (this.tl) { this.tl.kill(); this.tl = null; }
    const actifs = [[1, 2, 3, 4], [0], [1, 2], [3], [4]][Math.min(step, 4)];
    this.box.forEach((b, i) => to(b, { attr: { fill: actifs.includes(i) ? "#cdeee2" : C.cell, stroke: actifs.includes(i) ? C.v3 : C.ink, "stroke-width": actifs.includes(i) ? 3 : 1.5 } }, inst));
    this.panels.forEach((p, i) => to(p, { opacity: i === Math.min(step, 4) ? 1 : 0, y: i === step ? 0 : 6, duration: 0.4 }, inst));
    if (step !== 3) { this.reset(); return; }
    if (inst) { this.final(); return; }
    this.reset();
    const tl = gsap.timeline({ delay: 1.6 });
    for (let half = 8; half >= 1; half /= 2) {
      const h = half;
      tl.call(() => { this.round.textContent = `Tour : les ${h} premiers threads ajoutent la case d + ${h}`; this.sync.textContent = "__syncthreads() entre deux tours"; });
      const tgt = [], src = [];
      for (let k = 0; k < h; k++) { tgt.push(this.cells[k]); src.push(this.cells[k + h]); }
      tl.to(src, { attr: { fill: C.v3 }, duration: 0.25 })
        .call(() => { for (let k = 0; k < h; k++) { this.vals[k] += this.vals[k + h]; this.tx[k].textContent = this.vals[k].toFixed(1).replace(".", ","); } })
        .to(src, { opacity: 0.15, duration: 0.3 }).to(src.map((c) => this.tx[this.cells.indexOf(c)]), { opacity: 0, duration: 0.3 }, "<")
        .to(tgt, { attr: { fill: "#9fdcc5" }, duration: 0.2 }, "<").to({}, { duration: 0.7 });
    }
    tl.call(() => this.final());
    this.tl = tl;
  },
  leave() { if (this.tl) { this.tl.kill(); this.tl = null; } },
};

/* ---------- protocole : 36 cas de 10 runs ---------- */
ANIM.protocole = {
  init(s) {
    const svg = s.querySelector("#proto-svg");
    const F = ["Sphere", "Rastrigin", "Rosenbrock", "Griewank"];
    const cols = [];
    [10, 50, 100].forEach((d) => [50, 100, 500].forEach((p) => cols.push([d, p])));
    const x0 = 150, sp = 49, cs = 44;
    cols.forEach(([d, p], j) => {
      const x = x0 + j * sp + (Math.floor(j / 3)) * 8;
      if (j % 3 === 0) txt(svg, x + sp + cs / 2, 20, "D = " + d, { "font-size": 18, "text-anchor": "middle", fill: C.ink, "font-weight": 700 });
      txt(svg, x + cs / 2, 292, String(p), { "font-size": 16, "text-anchor": "middle", fill: C.muted });
    });
    txt(svg, x0 - 14, 292, "Pop", { "font-size": 16, "text-anchor": "end", fill: C.muted });
    this.cells = []; this.dots = [];
    F.forEach((f, i) => {
      const y = 38 + i * 60;
      txt(svg, x0 - 14, y + cs / 2 + 7, f, { "font-size": 19, "text-anchor": "end" });
      cols.forEach((_, j) => {
        const x = x0 + j * sp + (Math.floor(j / 3)) * 8;
        this.cells.push(el("rect", { x, y, width: cs, height: cs, rx: 5, fill: C.cell, opacity: 0 }, svg));
        for (let r = 0; r < 10; r++) this.dots.push(el("circle", { cx: x + 7 + (r % 5) * 7.5, cy: y + 15 + Math.floor(r / 5) * 14, r: 2.8, fill: C.ink, opacity: 0 }, svg));
      });
    });
  },
  enter(s, inst) {
    if (inst) { set([...this.cells, ...this.dots], { opacity: 1 }); return; }
    set(this.dots, { opacity: 0 });
    gsap.fromTo(this.cells, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.025, delay: 0.3, ease: "back.out(2)" });
    gsap.to(this.dots, { opacity: 1, duration: 0.15, stagger: 0.004, delay: 1.4 });
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

/* ---------- qui a fait quoi : les etapes apparaissent dans l'ordre ---------- */
ANIM.equipe = {
  init(s) { this.bars = [...s.querySelectorAll(".eq-bar")]; },
  enter(s, inst) {
    if (inst) { set(this.bars, { opacity: 1, scale: 1 }); return; }
    gsap.fromTo(this.bars, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.18, delay: 0.3, ease: "back.out(1.6)" });
  },
  go() {},
};

/* ---------- moteur : etapes et entree/sortie de slide ---------- */
const inited = new Set();
function stepOf(slide) { return slide.querySelectorAll(".fragment.step.visible").length; }
function enterSlide(slide, inst) {
  const name = slide.dataset.anim; if (!name || !ANIM[name]) return;
  const a = ANIM[name];
  if (!inited.has(name)) { a.init && a.init(slide); inited.add(name); }
  a.enter && a.enter(slide, inst);
  a._step = PRINT ? 99 : stepOf(slide);
  a.go(a._step, true);
  if (!inst && !PRINT) a.go(a._step, false);
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
  setTimeout(onFrag, 60);
});
// les fragments peuvent etre mis a jour juste apres slidechanged (lien direct, rechargement) : on reverifie
const onFrag = () => { const s = Reveal.getCurrentSlide(); const a = ANIM[s.dataset.anim]; if (!a || !inited.has(s.dataset.anim)) return; const st = stepOf(s); if (st !== a._step) { a._step = st; a.go(st, false); } };
Reveal.on("slidechanged", (e) => { leaveSlide(e.previousSlide); enterSlide(e.currentSlide, false); setTimeout(onFrag, 60); });
Reveal.on("fragmentshown", onFrag);
Reveal.on("fragmenthidden", onFrag);
