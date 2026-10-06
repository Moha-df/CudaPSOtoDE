#!/usr/bin/env python3
"""Compile et lance toutes les configurations -> results/raw.csv
   3 implementations (cpu = DE sequentiel, gpu = DE GPU, pso = PSO du prof)
   x 4 fonctions x Dim in {10,50,100} x Pop in {50,100,500}, 10 runs chacune.
   Usage : python3 bench/run_all.py [nb_runs]   (relancable : saute ce qui est deja fait)"""
import itertools, os, subprocess, sys, csv
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 10
CR = sys.argv[2] if len(sys.argv) > 2 else "0.9f"   # ex: 0.3f (article)
SUF = "" if CR == "0.9f" else "_cr" + CR.replace(".", "p")
IMPLS, FUNCS, DIMS, POPS = ["cpu", "gpu", "pso"] if CR == "0.9f" else ["cpu", "gpu"], [1, 2, 3, 4], [10, 50, 100], [50, 100, 500]
os.makedirs(f"{ROOT}/results", exist_ok=True)
RAW = f"{ROOT}/results/raw{SUF}.csv"   # anciens resultats (raw.csv) jamais ecrases

def build(c):
    impl, f, d, p = c
    r = subprocess.run(["make", "-s", impl, f"DIM={d}", f"POP={p}", f"OBJ_FUNC={f}", f"CR={CR}"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode: print("ECHEC compilation", c, r.stderr[-800:]); sys.exit(1)

cfgs = list(itertools.product(IMPLS, FUNCS, DIMS, POPS))
print(f"compilation de {len(cfgs)} executables...", flush=True)
with ThreadPoolExecutor(4) as ex: list(ex.map(build, cfgs))

done = set()
if os.path.exists(RAW):
    with open(RAW) as fh:
        for row in csv.DictReader(fh): done.add((row["impl"], int(row["func"]), int(row["dim"]), int(row["pop"])))
new = not os.path.exists(RAW)
with open(RAW, "a") as out:
    if new: out.write("impl,func,dim,pop,run,time,fitness,efv\n")
    # le GPU est lance un par un (sinon les temps seraient faux)
    for impl, f, d, p in cfgs:
        if (impl, f, d, p) in done: continue
        exe = f"{ROOT}/build/{impl}_f{f}_d{d}_p{p}{SUF}"
        r = subprocess.run([exe, str(RUNS), "12345"], capture_output=True, text=True)
        if r.returncode: print("ECHEC", exe, r.stderr); sys.exit(1)
        for line in r.stdout.strip().splitlines():
            out.write(f"{impl},{f},{d},{p},{line}\n")
        out.flush(); print("ok", impl, f, d, p, flush=True)
