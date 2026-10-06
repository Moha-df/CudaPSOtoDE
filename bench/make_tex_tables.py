#!/usr/bin/env python3
"""results/raw.csv -> rapport/resultats_tables.tex (tableaux inclus par rapport.tex)"""
import csv, os, numpy as np
from collections import defaultdict
from scipy import stats
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = defaultdict(lambda: {"efv": [], "time": []})
for r in csv.DictReader(open(f"{ROOT}/results/raw.csv")):
    R[(int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])]["efv"].append(float(r["efv"]))
    R[(int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])]["time"].append(float(r["time"]))
R3 = defaultdict(lambda: {"efv": [], "time": []})
if os.path.exists(f"{ROOT}/results/raw_cr0p3f.csv"):
    for r in csv.DictReader(open(f"{ROOT}/results/raw_cr0p3f.csv")):
        R3[(int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])]["efv"].append(float(r["efv"]))
        R3[(int(r["func"]), int(r["dim"]), int(r["pop"]), r["impl"])]["time"].append(float(r["time"]))
N = {4: "Sphere", 1: "Rastrigin", 2: "Rosenbrock", 3: "Griewank"}
def e(x):
    """notation courte 1.1e-5 (ou 3.55 / 421 pour les valeurs >= 0.01)"""
    if x == 0: return "0"
    if abs(x) >= 0.01: return f"{x:.3g}" if abs(x) < 1000 else f"{x:.2g}".replace("e+0", "e").replace("e+", "e")
    m, ex = f"{x:.1e}".split("e"); return f"{m}e{int(ex)}"
def ms(a): return e(np.mean(a))
HEAD = r"\begin{table}[!t]\centering\scriptsize\setlength{\tabcolsep}{2pt}"
out = []
# 1 tableau d'erreur par fonction (une colonne)
for f in N:
    out.append(HEAD + r"\caption{" + N[f] + r" : EFV moyenne (10 runs ; plus petit = meilleur ; $1.2\mathrm{e}{-5}=1{,}2\times10^{-5}$).}\label{tab:" + N[f].lower() + "}")
    out.append(r"\begin{tabular}{rr|ccc}\toprule Dim & Pop & DE CPU & DE GPU & PSO prof\\\midrule")
    for d in (10, 50, 100):
        for p in (50, 100, 500):
            out.append(f"{d} & {p} & " + " & ".join(ms(R[(f, d, p, i)]["efv"]) for i in ("cpu", "gpu", "pso")) + r"\\")
        if d != 100: out.append(r"\midrule")
    out.append(r"\bottomrule\end{tabular}\end{table}")
# temps moyen (toutes fonctions confondues)
out.append(HEAD + r"\caption{Temps moyen (s) sur les 4 fonctions (40 runs par case).}\label{tab:temps}")
out.append(r"\begin{tabular}{rr|ccc}\toprule Dim & Pop & DE CPU & DE GPU & PSO prof\\\midrule")
for d in (10, 50, 100):
    for p in (50, 100, 500):
        out.append(f"{d} & {p} & " + " & ".join(f"{np.mean([t for f in N for t in R[(f, d, p, i)]['time']]):.3f}" for i in ("cpu", "gpu", "pso")) + r"\\")
    if d != 100: out.append(r"\midrule")
out.append(r"\bottomrule\end{tabular}\end{table}")
# taux de succes : article / CR0.9 / CR0.3 dans chaque case
ART = {(4,10):(1,1,1),(4,50):(1,1,1),(4,100):(1,1,1),
       (2,10):(.44,.32,0),(2,50):(0,.04,0),(2,100):(0,0,0),
       (3,10):(1,1,1),(3,50):(.92,1,1),(3,100):(.84,.96,.96),
       (1,10):(1,1,1),(1,50):(0,.04,.04),(1,100):(0,0,0)}
out.append(HEAD + r"\caption{Taux de succ\`es, forme \emph{article / DE GPU $CR{=}0{,}9$ / DE GPU $CR{=}0{,}3$}. Article \cite{qin} : EFV $<10^{-8}$, 25 runs ; nos valeurs : EFV $<10^{-4}$, 10 runs.}\label{tab:sr}")
out.append(r"\begin{tabular}{lr|ccc}\toprule Fonction & Dim & Pop 50 & Pop 100 & Pop 500\\\midrule")
for f in N:
    for d in (10, 50, 100):
        cells = []
        for k, p in enumerate((50, 100, 500)):
            o9 = np.mean(np.array(R[(f, d, p, "gpu")]["efv"]) < 1e-4); o3 = np.mean(np.array(R3[(f, d, p, "gpu")]["efv"]) < 1e-4)
            cells.append(f"{ART[(f, d)][k]:.2f}/{o9:.2f}/{o3:.2f}")
        out.append(f"{N[f]} & {d} & " + " & ".join(cells) + r"\\")
out.append(r"\bottomrule\end{tabular}\end{table}")
# EFV moyenne CR 0.9 / 0.3
out.append(HEAD + r"\caption{DE GPU : EFV moyenne, forme \emph{$CR{=}0{,}9$ / $CR{=}0{,}3$} (10 runs).}\label{tab:cr}")
out.append(r"\begin{tabular}{lr|ccc}\toprule Fonction & Dim & Pop 50 & Pop 100 & Pop 500\\\midrule")
for f in N:
    for d in (10, 50, 100):
        cells = [f"{e(np.mean(R[(f, d, p, 'gpu')]['efv']))}/{e(np.mean(R3[(f, d, p, 'gpu')]['efv']))}" for p in (50, 100, 500)]
        out.append(f"{N[f]} & {d} & " + " & ".join(cells) + r"\\")
out.append(r"\bottomrule\end{tabular}\end{table}")
# acceleration
out.append(HEAD + r"\caption{Acc\'el\'eration $T_{\mathrm{CPU}}/T_{\mathrm{GPU}}$ du DE ($CR{=}0{,}9$).}\label{tab:speedup}")
out.append(r"\begin{tabular}{lr|ccc}\toprule Fonction & Dim & Pop 50 & Pop 100 & Pop 500\\\midrule")
for f in N:
    for d in (10, 50, 100):
        sp = [np.mean(R[(f, d, p, "cpu")]["time"]) / np.mean(R[(f, d, p, "gpu")]["time"]) for p in (50, 100, 500)]
        out.append(f"{N[f]} & {d} & " + " & ".join(f"{x:.1f}" for x in sp) + r"\\")
out.append(r"\bottomrule\end{tabular}\end{table}")
open(f"{ROOT}/rapport/resultats_tables.tex", "w").write("\n".join(out) + "\n")
# chiffres cites dans le texte
tot = 0; s1 = 0; s2 = 0; sp = []
for f in N:
    for d in (10, 50, 100):
        for p in (50, 100, 500):
            tot += 1
            s1 += stats.ranksums(R[(f,d,p,"cpu")]["efv"], R[(f,d,p,"gpu")]["efv"]).pvalue < 0.05
            s2 += stats.ranksums(R[(f,d,p,"gpu")]["efv"], R[(f,d,p,"pso")]["efv"]).pvalue < 0.05
            sp.append(np.mean(R[(f,d,p,"cpu")]["time"]) / np.mean(R[(f,d,p,"gpu")]["time"]))
print("configs", tot, "signif CPU/GPU", s1, "signif GPU/PSO", s2, "speedup min/max/med", min(sp), max(sp), np.median(sp))
print("DE GPU meilleur ou egal que PSO (moyenne):", sum(np.mean(R[(f,d,p,'gpu')]['efv']) < np.mean(R[(f,d,p,'pso')]['efv']) for f in N for d in (10,50,100) for p in (50,100,500)))
print("GPU plus lent que CPU:", [(N[f],d,p) for f in N for d in (10,50,100) for p in (50,100,500) if np.mean(R[(f,d,p,'gpu')]['time'])>np.mean(R[(f,d,p,'cpu')]['time'])])

better=worse=0; sig=0
for f in N:
    for d in (10,50,100):
        for p in (50,100,500):
            a=np.mean(R[(f,d,p,'gpu')]['efv']); b=np.mean(R3[(f,d,p,'gpu')]['efv'])
            better+= b<a; worse+= b>a
            sig += stats.ranksums(R3[(f,d,p,'cpu')]['efv'], R3[(f,d,p,'gpu')]['efv']).pvalue < 0.05
print("CR0.3 meilleur que 0.9:", better, "pire:", worse, "| CPU vs GPU signif a CR0.3:", sig)
sp=[np.mean(R3[(f,d,p,'cpu')]['time'])/np.mean(R3[(f,d,p,'gpu')]['time']) for f in N for d in (10,50,100) for p in (50,100,500)]
print("speedup CR0.3 min/med/max", min(sp), np.median(sp), max(sp))
