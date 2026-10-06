#!/usr/bin/env python3
"""Courbes de temps au format colonne IEEE (3.45 in de large) -> rapport/figures/temps_d{10,100}.pdf"""
import csv, os, numpy as np
from collections import defaultdict
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = defaultdict(list)
for r in csv.DictReader(open(f"{ROOT}/results/raw.csv")):
    T[(int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])].append(float(r["time"]))
N = {4: "Sphere", 1: "Rastrigin", 2: "Rosenbrock", 3: "Griewank"}
L = {"cpu": "DE CPU", "gpu": "DE GPU", "pso": "PSO prof"}
plt.rcParams.update({"font.size": 6, "axes.titlesize": 6.5, "axes.labelsize": 6, "legend.fontsize": 5.5,
                     "xtick.labelsize": 5.5, "ytick.labelsize": 5.5, "lines.linewidth": 0.9, "lines.markersize": 2.5})
POPS = [50, 100, 500]
for d in (10, 100):
    fig, ax = plt.subplots(2, 2, figsize=(3.45, 2.7), sharex=True)
    for a, f in zip(ax.flat, N):
        for i, mk in zip(L, "osd"):
            m = [np.mean(T[(f, d, p, i)]) for p in POPS]; s = [np.std(T[(f, d, p, i)], ddof=1) for p in POPS]
            a.errorbar(POPS, m, yerr=s, marker=mk, label=L[i], capsize=1.5, elinewidth=0.5)
        a.set_yscale("log"); a.set_title(f"{N[f]}, $D$={d}"); a.grid(alpha=.3, lw=.4)
    for a in ax[1]: a.set_xlabel("Population"); a.set_xticks(POPS)
    for a in ax[:, 0]: a.set_ylabel("Temps (s)")
    ax[0, 0].legend(loc="best", handlelength=1.5)
    fig.tight_layout(pad=0.4); fig.savefig(f"{ROOT}/rapport/figures/temps_d{d}.pdf"); plt.close(fig)
print("ok")
