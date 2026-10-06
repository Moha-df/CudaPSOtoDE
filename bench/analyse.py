#!/usr/bin/env python3
"""results/raw.csv -> results/tables.md, results/*.png, results/stats.md
   moyenne/ecart-type de l'erreur (EFV), temps moyen, taux de succes (EFV<1e-8, critere de l'article),
   tests de Wilcoxon (rank-sum) et Kruskal-Wallis."""
import os, csv, numpy as np
from collections import defaultdict
from scipy import stats
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = defaultdict(lambda: {"efv": [], "time": []})
for r in csv.DictReader(open(f"{ROOT}/results/raw.csv")):
    k = (int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])
    R[k]["efv"].append(float(r["efv"])); R[k]["time"].append(float(r["time"]))
NAMES = {1: "Rastrigin", 2: "Rosenbrock", 3: "Griewank", 4: "Sphere"}
IMPL = {"cpu": "DE seq. (CPU)", "gpu": "DE GPU", "pso": "PSO prof (GPU)"}
DIMS = sorted({k[1] for k in R}); POPS = sorted({k[2] for k in R})
def S(f, d, p, i):
    e = np.array(R[(f, d, p, i)]["efv"]); t = np.array(R[(f, d, p, i)]["time"])
    return dict(em=e.mean(), es=e.std(ddof=1), tm=t.mean(), ts=t.std(ddof=1),
                sr=(e < 1e-8).mean(), sr4=(e < 1e-4).mean())
with open(f"{ROOT}/results/summary.csv", "w") as o:
    o.write("func,dim,pop,impl,efv_mean,efv_std,time_mean,time_std,sr_1e-8,sr_1e-4\n")
    for f in NAMES:
        for d in DIMS:
            for p in POPS:
                for i in IMPL:
                    s = S(f, d, p, i); o.write(f"{NAMES[f]},{d},{p},{i},{s['em']:.6e},{s['es']:.6e},{s['tm']:.5f},{s['ts']:.5f},{s['sr']:.2f},{s['sr4']:.2f}\n")
with open(f"{ROOT}/results/tables.md", "w") as o:
    for f in NAMES:
        for d in DIMS:
            o.write(f"\n### {NAMES[f]}, Dim={d}\n\n| Pop | Algo | EFV moyen | EFV ecart-type | Temps (s) | SR (EFV<1e-8) | SR (EFV<1e-4) |\n|---|---|---|---|---|---|---|\n")
            for p in POPS:
                for i in IMPL:
                    s = S(f, d, p, i)
                    o.write(f"| {p} | {IMPL[i]} | {s['em']:.3e} | {s['es']:.3e} | {s['tm']:.3f} | {s['sr']:.2f} | {s['sr4']:.2f} |\n")
with open(f"{ROOT}/results/stats.md", "w") as o:
    o.write("| Fonction | Dim | Pop | p Wilcoxon DE-CPU vs DE-GPU | p Wilcoxon DE-GPU vs PSO | p Kruskal-Wallis (3 algos) |\n|---|---|---|---|---|---|\n")
    for f in NAMES:
        for d in DIMS:
            for p in POPS:
                v = {i: R[(f, d, p, i)]["efv"] for i in IMPL}
                try: kw = stats.kruskal(v["cpu"], v["gpu"], v["pso"]).pvalue
                except ValueError: kw = float("nan")
                o.write(f"| {NAMES[f]} | {d} | {p} | {stats.ranksums(v['cpu'], v['gpu']).pvalue:.3g} | {stats.ranksums(v['gpu'], v['pso']).pvalue:.3g} | {kw:.3g} |\n")
# courbes de temps
for f in NAMES:
    fig, ax = plt.subplots(1, 3, figsize=(12, 3.2), sharey=False)
    for k, d in enumerate(DIMS):
        for i in IMPL:
            ss = [S(f, d, p, i) for p in POPS]
            ax[k].errorbar(POPS, [x["tm"] for x in ss], yerr=[x["ts"] for x in ss], marker="o", label=IMPL[i])
        ax[k].set_title(f"{NAMES[f]}, Dim={d}"); ax[k].set_xlabel("Population"); ax[k].set_ylabel("Temps (s)"); ax[k].set_yscale("log")
    ax[0].legend(); fig.tight_layout(); fig.savefig(f"{ROOT}/results/temps_{NAMES[f].lower()}.png", dpi=150); plt.close(fig)
print("ok")
