#!/usr/bin/env python3
"""results/raw.csv (+ raw_cr0p3f.csv) -> rapport/resultats_tables.tex, rapport/figures/temps_d*.pdf
   et chiffres cites dans le texte du rapport.
   impl : cpu = DE sequentiel, gpu = DE GPU v1 (1 kernel), split = v2 (1 kernel par etape),
          dim = v3 (1 thread par coordonnee), pso = PSO du prof"""
import csv, os, numpy as np
from collections import defaultdict
from scipy import stats
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def charge(nom):
    R = defaultdict(lambda: {"efv": [], "time": []})
    if os.path.exists(nom):
        for r in csv.DictReader(open(nom)):
            k = (int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])
            R[k]["efv"].append(float(r["efv"])); R[k]["time"].append(float(r["time"]))
    return R
R = charge(f"{ROOT}/results/raw.csv"); R3 = charge(f"{ROOT}/results/raw_cr0p3f.csv")
N = {4: "Sphere", 1: "Rastrigin", 2: "Rosenbrock", 3: "Griewank"}
D, P = (10, 50, 100), (50, 100, 500)
IMPL = ("cpu", "gpu", "split", "dim", "pso")
COL = "DE CPU & GPU v1 & GPU v2 & GPU v3 & PSO"
CFG = [(f, d, p) for f in N for d in D for p in P]
def e(x):
    if x == 0: return "0"
    if abs(x) >= 0.01: return f"{x:.3g}" if abs(x) < 1000 else f"{x:.2g}".replace("e+0", "e").replace("e+", "e")
    m, ex = f"{x:.1e}".split("e"); return f"{m}e{int(ex)}"
def moy(R, k, c="efv"): return np.mean(R[k][c])
HEAD = r"\begin{table}[!t]\centering\scriptsize\setlength{\tabcolsep}{2pt}"
out = []
for f in N:
    out.append(HEAD + r"\caption{" + N[f] + r" : erreur moyenne (moyenne $\pm$ \'ecart-type sur 10 runs pour le DE CPU, moyenne seule pour les autres ; plus petit = meilleur).}\label{tab:" + N[f].lower() + "}")
    out.append(r"\begin{tabular}{rr|ccccc}\toprule $D$ & Pop & " + COL + r"\\\midrule")
    for d in D:
        for p in P:
            k = lambda i: (f, d, p, i)
            c0 = f"{e(moy(R, k('cpu')))}$\\pm${e(np.std(R[k('cpu')]['efv'], ddof=1))}"
            out.append(f"{d} & {p} & {c0} & " + " & ".join(e(moy(R, k(i))) for i in IMPL[1:]) + r"\\")
        if d != 100: out.append(r"\midrule")
    out.append(r"\bottomrule\end{tabular}\end{table}")
out.append(HEAD + r"\caption{Temps moyen d'un run (s), moyenne sur les 4 fonctions (40 runs par case).}\label{tab:temps}")
out.append(r"\begin{tabular}{rr|ccccc}\toprule $D$ & Pop & " + COL + r"\\\midrule")
for d in D:
    for p in P:
        out.append(f"{d} & {p} & " + " & ".join(f"{np.mean([t for f in N for t in R[(f, d, p, i)]['time']]):.3f}" for i in IMPL) + r"\\")
    if d != 100: out.append(r"\midrule")
out.append(r"\bottomrule\end{tabular}\end{table}")
out.append(HEAD + r"\caption{Acc\'el\'eration par rapport au DE s\'equentiel ($T_{\mathrm{CPU}}/T_{\mathrm{GPU}}$), moyenne sur les 4 fonctions. Forme \emph{v1 / v2 / v3}.}\label{tab:speedup}")
out.append(r"\begin{tabular}{r|ccc}\toprule $D$ & Pop 50 & Pop 100 & Pop 500\\\midrule")
def tps(d, p, i): return np.mean([t for f in N for t in R[(f, d, p, i)]["time"]])
for d in D:
    out.append(f"{d} & " + " & ".join("/".join(f"{tps(d, p, 'cpu') / tps(d, p, i):.1f}" for i in ("gpu", "split", "dim")) for p in P) + r"\\")
out.append(r"\bottomrule\end{tabular}\end{table}")
ART = {(4,10):(1,1,1),(4,50):(1,1,1),(4,100):(1,1,1),(2,10):(.44,.32,0),(2,50):(0,.04,0),(2,100):(0,0,0),
       (3,10):(1,1,1),(3,50):(.92,1,1),(3,100):(.84,.96,.96),(1,10):(1,1,1),(1,50):(0,.04,.04),(1,100):(0,0,0)}
out.append(HEAD + r"\caption{Taux de succ\`es, forme \emph{article / nous avec $CR{=}0{,}9$ / nous avec $CR{=}0{,}3$} (DE GPU v1). Article \cite{qin} : erreur $<10^{-8}$, 25 runs. Nous : erreur $<10^{-4}$, 10 runs.}\label{tab:sr}")
out.append(r"\begin{tabular}{lr|ccc}\toprule Fonction & $D$ & Pop 50 & Pop 100 & Pop 500\\\midrule")
for f in N:
    for d in D:
        cells = [f"{ART[(f, d)][j]:.2f}/{np.mean(np.array(R[(f, d, p, 'gpu')]['efv']) < 1e-4):.2f}/{np.mean(np.array(R3[(f, d, p, 'gpu')]['efv']) < 1e-4):.2f}" for j, p in enumerate(P)]
        out.append(f"{N[f]} & {d} & " + " & ".join(cells) + r"\\")
out.append(r"\bottomrule\end{tabular}\end{table}")
out.append(HEAD + r"\caption{DE GPU v1 : erreur moyenne, forme \emph{$CR{=}0{,}9$ / $CR{=}0{,}3$} (10 runs).}\label{tab:cr}")
out.append(r"\begin{tabular}{lr|ccc}\toprule Fonction & $D$ & Pop 50 & Pop 100 & Pop 500\\\midrule")
for f in N:
    for d in D:
        out.append(f"{N[f]} & {d} & " + " & ".join(f"{e(moy(R, (f, d, p, 'gpu')))}/{e(moy(R3, (f, d, p, 'gpu')))}" for p in P) + r"\\")
out.append(r"\bottomrule\end{tabular}\end{table}")
open(f"{ROOT}/rapport/resultats_tables.tex", "w").write("\n".join(out) + "\n")

# ---------- courbes de temps ----------
L = {"cpu": "DE CPU", "gpu": "GPU v1", "split": "GPU v2", "dim": "GPU v3", "pso": "PSO prof"}
plt.rcParams.update({"font.size": 6, "axes.titlesize": 6.5, "axes.labelsize": 6, "legend.fontsize": 5,
                     "xtick.labelsize": 5.5, "ytick.labelsize": 5.5, "lines.linewidth": 0.9, "lines.markersize": 2.5})
for d in D:
    fig, ax = plt.subplots(2, 2, figsize=(3.45, 2.8), sharex=True)
    for a, f in zip(ax.flat, N):
        for i, mk in zip(L, "os^vd"):
            a.errorbar(P, [np.mean(R[(f, d, p, i)]["time"]) for p in P], yerr=[np.std(R[(f, d, p, i)]["time"], ddof=1) for p in P],
                       marker=mk, label=L[i], capsize=1.5, elinewidth=0.5)
        a.set_yscale("log"); a.set_xscale("log"); a.set_title(f"{N[f]}, $D$={d}"); a.grid(alpha=.3, lw=.4)
    for a in ax[1]: a.set_xlabel("Population (\u00e9chelle log)")
    for a in ax.flat: a.set_xticks(P); a.set_xticklabels([str(p) for p in P]); a.minorticks_off()
    for a in ax[:, 0]: a.set_ylabel("Temps (s)")
    h, l = ax[0, 0].get_legend_handles_labels()
    fig.legend(h, l, loc="upper center", ncol=5, handlelength=1.5, columnspacing=0.8, frameon=False)
    fig.tight_layout(pad=0.4, rect=(0, 0, 1, 0.93)); fig.savefig(f"{ROOT}/rapport/figures/temps_d{d}.pdf"); plt.close(fig)

# ---------- chiffres cites dans le texte ----------
def sig(a, b, RR=R): return sum(stats.ranksums(RR[(*c, a)]["efv"], RR[(*c, b)]["efv"]).pvalue < 0.05 for c in CFG)
for v in ("gpu", "split", "dim"):
    sp = [moy(R, (*c, "cpu"), "time") / moy(R, (*c, v), "time") for c in CFG]
    print(f"{v}: Wilcoxon diff vs CPU {sig('cpu', v)}/36 | speedup min {min(sp):.2f} med {np.median(sp):.2f} max {max(sp):.1f}"
          f" | plus lent que CPU: {[(N[c[0]], c[1], c[2]) for c, s in zip(CFG, sp) if s < 1]}")
print("Wilcoxon v1 vs v3 signif:", sig("gpu", "dim"), "/36")
print("v2 resultats identiques a v1 :", all(R[(*c, 'gpu')]['efv'] == R[(*c, 'split')]['efv'] for c in CFG))
r21 = [moy(R, (*c, "split"), "time") / moy(R, (*c, "gpu"), "time") for c in CFG]
r31 = [moy(R, (*c, "gpu"), "time") / moy(R, (*c, "dim"), "time") for c in CFG]
r32 = [moy(R, (*c, "split"), "time") / moy(R, (*c, "dim"), "time") for c in CFG]
print(f"T_v2/T_v1 min {min(r21):.2f} med {np.median(r21):.2f} max {max(r21):.2f}")
print(f"T_v1/T_v3 min {min(r31):.2f} med {np.median(r31):.2f} max {max(r31):.1f} ; v3 plus lent que v1 : {[(N[c[0]],c[1],c[2]) for c,s in zip(CFG,r31) if s<1]}")
print(f"T_v2/T_v3 min {min(r32):.2f} med {np.median(r32):.2f} max {max(r32):.1f}")
kw = sum(stats.kruskal(*[R[(*c, i)]["efv"] for i in ("cpu", "gpu", "split", "dim")]).pvalue < 0.05 for c in CFG)
print("Kruskal-Wallis 4 versions DE signif:", kw, "/36")
print("v3 vs PSO signif", sig("dim", "pso"), "; v3 meilleur que PSO (moyenne):", sum(moy(R, (*c, 'dim')) < moy(R, (*c, 'pso')) for c in CFG))
print("v1 vs PSO signif", sig("gpu", "pso"), "; v1 meilleur que PSO (moyenne):", sum(moy(R, (*c, 'gpu')) < moy(R, (*c, 'pso')) for c in CFG))
better = sum(moy(R3, (*c, 'gpu')) < moy(R, (*c, 'gpu')) for c in CFG)
print("CR0.3 meilleur que 0.9:", better, "/36 ; CPU vs GPU signif a CR0.3:", sig("cpu", "gpu", R3))
sp = [moy(R3, (*c, 'cpu'), 'time') / moy(R3, (*c, 'gpu'), 'time') for c in CFG]
print(f"speedup v1 CR0.3 min {min(sp):.2f} med {np.median(sp):.2f} max {max(sp):.1f}")
for d in D:
    print("temps moyens D", d, {i: [round(tps(d, p, i), 4) for p in P] for i in IMPL})
