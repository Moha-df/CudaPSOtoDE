# Compilation d'UN executable de test.
#   make cpu  DIM=10 POP=100 OBJ_FUNC=4     -> build/cpu_f4_d10_p100   (DE sequentiel)
#   make gpu  DIM=10 POP=100 OBJ_FUNC=4     -> build/gpu_f4_d10_p100   (DE GPU)
#   make pso  DIM=10 POP=100 OBJ_FUNC=4     -> build/pso_f4_d10_p100   (PSO du prof)
# OBJ_FUNC : 1 Rastrigin, 2 Rosenbrock, 3 Griewank, 4 Sphere
# Pour tout lancer : python3 bench/run_all.py
DIM      ?= 3
POP      ?= 512
OBJ_FUNC ?= 4
CUDA_HOME ?= /opt/cuda
NVCC     = $(CUDA_HOME)/bin/nvcc
CCBIN    ?= /usr/bin/g++-15
ARCH     ?= sm_75
# CR : taux de croisement du DE (0.9f par defaut ; 0.3f = valeur de l'article)
CR       ?= 0.9f
SUF       = $(if $(filter 0.9f,$(CR)),,_cr$(subst .,p,$(CR)))
TAG       = f$(OBJ_FUNC)_d$(DIM)_p$(POP)$(SUF)
DEFS      = -DDIM=$(DIM) -DPOP=$(POP) -DOBJ_FUNC=$(OBJ_FUNC) -DCR=$(CR)
# budget d'evaluations 10^4 x Dim : le PSO du prof compte des ITERATIONS,
# on lui donne donc 10^4*Dim/Pop iterations (meme nombre d'evaluations que le DE)
PSOIT     = $(shell echo $$((10000*$(DIM)/$(POP))))
NVFLAGS   = -O2 -arch=$(ARCH) -ccbin $(CCBIN)

cpu: build/cpu_$(TAG)
gpu: build/gpu_$(TAG)
pso: build/pso_$(TAG)

build/cpu_$(TAG): bench/bench_main.cpp sequentiel/kernel.cpp sequentiel/kernel.cu sequentiel/kernel.h
	@mkdir -p build
	g++-15 -O2 $(DEFS) -Isequentiel -x c++ -o $@ bench/bench_main.cpp sequentiel/kernel.cpp sequentiel/kernel.cu

build/gpu_$(TAG): bench/bench_main.cpp gpu/kernel.cpp gpu/kernel.cu gpu/kernel.h
	@mkdir -p build
	$(NVCC) $(NVFLAGS) $(DEFS) -Igpu -o $@ bench/bench_main.cpp gpu/kernel.cpp gpu/kernel.cu

build/pso_$(TAG): bench/bench_main.cpp baseline_pso/kernel.cpp baseline_pso/kernel.cu baseline_pso/kernel.h
	@mkdir -p build
	$(NVCC) $(NVFLAGS) $(DEFS) -DMAXIT=$(PSOIT) -Ibaseline_pso -o $@ bench/bench_main.cpp baseline_pso/kernel.cpp baseline_pso/kernel.cu

clean:
	rm -rf build
.PHONY: cpu gpu pso clean
