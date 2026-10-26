#include <cuda_runtime.h>
#include <cuda.h>
#include <curand_kernel.h>

#include "kernel.h"

/* =====================================================================
   Differential Evolution (DE/rand/1/bin) sur GPU - version 2
   "un kernel par etape"
   ---------------------------------------------------------------------
   Meme algorithme que gpu/kernel.cu, mais au lieu d'un seul gros kernel
   qui fait tout, chaque etape du DE a son propre kernel, comme sur la
   figure 1 de l'article (cudaDE "de base") :

     kernel (I) kernelInitRandom    : initialise le hasard
     kernel (E) kernelEvaluate      : evalue une population
     kernel (P) kernelPrepareIndices: tire r1, r2, r3 et jrand
     kernel (M) kernelMutation      : v = x_r1 + F * (x_r2 - x_r3)
     kernel (C) kernelCrossover     : construit l'essai u
     kernel (E) kernelEvaluate      : evalue les essais
     kernel (S) kernelSelection     : garde le meilleur entre x et u

   Toujours 1 thread = 1 individu.
   Les kernels se passent leurs resultats par la memoire globale
   (tableaux devIdx, devMutant, devTrial, devFitTrial).

   Plus besoin de double buffer : quand kernelSelection s'execute,
   kernelMutation est deja fini pour TOUS les individus (deux kernels
   lances l'un apres l'autre ne se chevauchent pas). On peut donc
   remplacer x_i directement dans la population.
   ===================================================================== */

// Parametres du DE
#define F_MUT  0.5f   // facteur de mutation
#ifndef CR
#define CR     0.9f   // taux de croisement
#endif

// Mesure du temps de chaque kernel (compiler avec -DPROFIL).
// Sans -DPROFIL, CHRONO(k, ...) lance juste le kernel.
#ifdef PROFIL
static float tempsKernel[5];   // P, M, C, E, S (en ms)
#define CHRONO(k, ...) do { cudaEvent_t a, b; cudaEventCreate(&a); cudaEventCreate(&b); \
    cudaEventRecord(a); __VA_ARGS__; cudaEventRecord(b); cudaEventSynchronize(b);       \
    float ms; cudaEventElapsedTime(&ms, a, b); tempsKernel[k] += ms;                    \
    cudaEventDestroy(a); cudaEventDestroy(b); } while (0)
#else
#define CHRONO(k, ...) __VA_ARGS__
#endif

/* ---------------------------------------------------------------------
   Fonction objectif, executee sur le GPU, appelee depuis le GPU.
   (identique a la version PSO, avec le produit de Griewank corrige :
    il doit demarrer a 1, pas a 0)
   --------------------------------------------------------------------- */
__device__ float fitness_function(float x[])
{
    float res = 0;
    float somme = 0;
    float produit = 1;

    switch (SELECTED_OBJ_FUNC)
    {
        case 0: {
            float y1 = 1 + (x[0] - 1) / 4;
            float yn = 1 + (x[NUM_OF_DIMENSIONS - 1] - 1) / 4;

            res += powf(sinf(phi * y1), 2);

            for (int i = 0; i < NUM_OF_DIMENSIONS - 1; i++) {
                float y  = 1 + (x[i] - 1) / 4;
                float yp = 1 + (x[i + 1] - 1) / 4;
                res += powf(y - 1, 2) * (1 + 10 * powf(sinf(phi * yp), 2))
                     + powf(yn - 1, 2);
            }
            break;
        }
        case 1: {   // Shifted Rastrigin
            for (int i = 0; i < NUM_OF_DIMENSIONS; i++) {
                float zi = x[i] - 0;
                res += powf(zi, 2) - 10 * cosf(2 * phi * zi) + 10;
            }
            res -= 330;
            break;
        }
        case 2: {   // Shifted Rosenbrock
            for (int i = 0; i < NUM_OF_DIMENSIONS - 1; i++) {
                float zi   = x[i] - 0 + 1;
                float zip1 = x[i + 1] - 0 + 1;
                res += 100 * powf(powf(zi, 2) - zip1, 2) + powf(zi - 1, 2);
            }
            res += 390;
            break;
        }
        case 3: {   // Shifted Griewank
            for (int i = 0; i < NUM_OF_DIMENSIONS; i++) {
                float zi = x[i] - 0;
                somme   += powf(zi, 2) / 4000;
                produit *= cosf(zi / sqrtf((float)(i + 1)));
            }
            res = somme - produit + 1 - 180;
            break;
        }
        case 4: {   // Shifted Sphere
            for (int i = 0; i < NUM_OF_DIMENSIONS; i++) {
                float zi = x[i] - 0;
                res += powf(zi, 2);
            }
            res -= 450;
            break;
        }
    }

    return res;
}

/* ---------------------------------------------------------------------
   Kernel (I) : initialisation du generateur aleatoire.
   Un etat curandState par individu.
   --------------------------------------------------------------------- */
__global__ void kernelInitRandom(curandState *states, unsigned long seed)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    curand_init(seed, i, 0, &states[i]);
}

/* ---------------------------------------------------------------------
   Kernel (E) : evaluation d'une population (1 thread = 1 individu).
   Utilise au depart (population initiale) puis a chaque generation
   (population des essais).
   --------------------------------------------------------------------- */
__global__ void kernelEvaluate(float *pop, float *fit)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    float x[NUM_OF_DIMENSIONS];
    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
        x[d] = pop[i * NUM_OF_DIMENSIONS + d];

    fit[i] = fitness_function(x);
}

/* ---------------------------------------------------------------------
   Kernel (P) : tirage de r1, r2, r3 (distincts et differents de i)
   et de jrand. Range dans idx[4*i .. 4*i+3].
   --------------------------------------------------------------------- */
__global__ void kernelPrepareIndices(int *idx, curandState *states)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    curandState st = states[i];

    int r1, r2, r3;
    do { r1 = (int)(curand_uniform(&st) * NUM_OF_PARTICLES) % NUM_OF_PARTICLES; }
    while (r1 == i);
    do { r2 = (int)(curand_uniform(&st) * NUM_OF_PARTICLES) % NUM_OF_PARTICLES; }
    while (r2 == i || r2 == r1);
    do { r3 = (int)(curand_uniform(&st) * NUM_OF_PARTICLES) % NUM_OF_PARTICLES; }
    while (r3 == i || r3 == r1 || r3 == r2);

    idx[4 * i]     = r1;
    idx[4 * i + 1] = r2;
    idx[4 * i + 2] = r3;
    idx[4 * i + 3] = (int)(curand_uniform(&st) * NUM_OF_DIMENSIONS) % NUM_OF_DIMENSIONS; // jrand

    states[i] = st;
}

/* ---------------------------------------------------------------------
   Kernel (M) : mutation  v_i = x_r1 + F * (x_r2 - x_r3)
   --------------------------------------------------------------------- */
__global__ void kernelMutation(float *pop, int *idx, float *mutant)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    int r1 = idx[4 * i], r2 = idx[4 * i + 1], r3 = idx[4 * i + 2];

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
        mutant[i * NUM_OF_DIMENSIONS + d] =
              pop[r1 * NUM_OF_DIMENSIONS + d]
            + F_MUT * (pop[r2 * NUM_OF_DIMENSIONS + d]
                     - pop[r3 * NUM_OF_DIMENSIONS + d]);
}

/* ---------------------------------------------------------------------
   Kernel (C) : croisement binomial entre x_i et v_i -> essai u_i,
   puis on ramene u_i dans les bornes.
   --------------------------------------------------------------------- */
__global__ void kernelCrossover(float *pop, float *mutant, int *idx,
                                float *trial, curandState *states)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    curandState st = states[i];
    int jrand = idx[4 * i + 3];

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
    {
        int k = i * NUM_OF_DIMENSIONS + d;
        float u = (curand_uniform(&st) < CR || d == jrand) ? mutant[k] : pop[k];

        if (u < START_RANGE_MIN) u = START_RANGE_MIN;
        if (u > START_RANGE_MAX) u = START_RANGE_MAX;
        trial[k] = u;
    }

    states[i] = st;
}

/* ---------------------------------------------------------------------
   Kernel (S) : selection. L'essai remplace x_i s'il est meilleur.
   On ecrit directement dans pop (voir l'explication en haut du fichier).
   --------------------------------------------------------------------- */
__global__ void kernelSelection(float *pop, float *fit,
                                float *trial, float *fitTrial)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    if (fitTrial[i] <= fit[i])
    {
        for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
            pop[i * NUM_OF_DIMENSIONS + d] = trial[i * NUM_OF_DIMENSIONS + d];
        fit[i] = fitTrial[i];
    }
}

/* =====================================================================
   Fonction appelee depuis le CPU (meme nom que le PSO pour main.cpp).
   ===================================================================== */
extern "C" void cuda_pso(float *positions, float *velocities,
                         float *pBests, float *gBest)
{
    (void)velocities;   // inutilise en DE
    (void)pBests;       // inutilise en DE

    int size = NUM_OF_PARTICLES * NUM_OF_DIMENSIONS;

    // Budget : 10^4 * Dim evaluations, une generation = NUM_OF_PARTICLES evaluations
    int maxGen = MAX_ITER / NUM_OF_PARTICLES;
    if (maxGen < 1) maxGen = 1;

    // --- allocation sur le GPU ---
    float *devPop, *devFit, *devMutant, *devTrial, *devFitTrial;
    int *devIdx;
    curandState *devStates;

    cudaMalloc((void**)&devPop,      sizeof(float) * size);
    cudaMalloc((void**)&devFit,      sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devMutant,   sizeof(float) * size);
    cudaMalloc((void**)&devTrial,    sizeof(float) * size);
    cudaMalloc((void**)&devFitTrial, sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devIdx,      sizeof(int) * 4 * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devStates,   sizeof(curandState) * NUM_OF_PARTICLES);

    // --- 1 thread par individu ---
    int threadsNum = 128;
    int blocksNum  = (NUM_OF_PARTICLES + threadsNum - 1) / threadsNum;

    cudaMemcpy(devPop, positions, sizeof(float) * size, cudaMemcpyHostToDevice);

    kernelInitRandom<<<blocksNum, threadsNum>>>(devStates, (unsigned long)rand());
    kernelEvaluate<<<blocksNum, threadsNum>>>(devPop, devFit);

    // --- boucle principale : 5 kernels par generation ---
    for (int gen = 0; gen < maxGen; gen++)
    {
        CHRONO(0, kernelPrepareIndices<<<blocksNum, threadsNum>>>(devIdx, devStates));
        CHRONO(1, kernelMutation<<<blocksNum, threadsNum>>>(devPop, devIdx, devMutant));
        CHRONO(2, kernelCrossover<<<blocksNum, threadsNum>>>(devPop, devMutant, devIdx, devTrial, devStates));
        CHRONO(3, kernelEvaluate<<<blocksNum, threadsNum>>>(devTrial, devFitTrial));
        CHRONO(4, kernelSelection<<<blocksNum, threadsNum>>>(devPop, devFit, devTrial, devFitTrial));
    }

    cudaDeviceSynchronize();

#ifdef PROFIL
    fprintf(stderr, "P %.3f M %.3f C %.3f E %.3f S %.3f (ms)\n",
            tempsKernel[0], tempsKernel[1], tempsKernel[2], tempsKernel[3], tempsKernel[4]);
    for (int k = 0; k < 5; k++) tempsKernel[k] = 0;
#endif

    // --- recuperation GPU -> CPU (une seule fois) ---
    float *hostFit = (float*)malloc(sizeof(float) * NUM_OF_PARTICLES);

    cudaMemcpy(positions, devPop, sizeof(float) * size, cudaMemcpyDeviceToHost);
    cudaMemcpy(hostFit, devFit, sizeof(float) * NUM_OF_PARTICLES, cudaMemcpyDeviceToHost);

    int best = 0;
    for (int i = 1; i < NUM_OF_PARTICLES; i++)
        if (hostFit[i] < hostFit[best]) best = i;

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
        gBest[d] = positions[best * NUM_OF_DIMENSIONS + d];

    // --- nettoyage ---
    free(hostFit);
    cudaFree(devPop);
    cudaFree(devFit);
    cudaFree(devMutant);
    cudaFree(devTrial);
    cudaFree(devFitTrial);
    cudaFree(devIdx);
    cudaFree(devStates);
}
