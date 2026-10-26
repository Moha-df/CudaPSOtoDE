#include <cuda_runtime.h>
#include <cuda.h>
#include <curand_kernel.h>

#include "kernel.h"

/* =====================================================================
   Differential Evolution (DE/rand/1/bin) sur GPU - version 3
   "un thread par coordonnee"
   ---------------------------------------------------------------------
   Meme decoupage en kernels que gpu_split/ (P, M, C, E, S), mais ici
   un thread ne s'occupe plus d'un individu entier : il s'occupe d'UNE
   coordonnee d'un individu. Avec Pop = 100 et Dim = 3 on a donc
   300 threads au lieu de 100. C'est l'idee de cudaDEi dans l'article,
   et c'est aussi ce que fait deja kernelUpdateParticle dans le PSO du prof.

   Numerotation : le thread k (k = 0 .. Pop*Dim-1) traite
       l'individu  i = k / Dim
       la coordonnee d = k % Dim
   et la case pop[k] (la population est deja rangee comme ca en memoire).

   Ce que ca a change par rapport a "1 thread = 1 individu" :
   1. r1, r2, r3 et jrand doivent etre LES MEMES pour toutes les
      coordonnees d'un individu -> ils sont tires une seule fois par
      individu dans kernel (P) et ranges en memoire globale.
   2. Chaque coordonnee tire son propre nombre aleatoire pour le
      croisement -> un etat curandState par coordonnee (Pop*Dim etats).
   3. L'evaluation est une SOMME sur les coordonnees (un PRODUIT en plus
      pour Griewank) : chaque thread calcule son terme, puis on additionne
      les termes dans la memoire partagee du bloc (reduction). Pour ca,
      tous les threads d'un meme individu doivent etre dans le meme bloc.
   4. Selection : on ne peut pas mettre a jour fit[i] pendant que les
      autres threads du meme individu le lisent encore -> on lit fitIn
      et on ecrit fitOut (deux tableaux, echanges a chaque generation).
   ===================================================================== */

// Parametres du DE
#define F_MUT  0.5f   // facteur de mutation
#ifndef CR
#define CR     0.9f   // taux de croisement
#endif

// Plus petite puissance de 2 >= n (pour la reduction en memoire partagee)
__host__ __device__ constexpr int puissance2(int n)
{
    return n <= 1 ? 1 : 2 * puissance2((n + 1) / 2);
}

// Kernel (E) : un bloc = IND_PAR_BLOC individus x DIM_P2 coordonnees.
// Dim = 10 -> 16 x 8 = 128 threads ; Dim = 50 -> 64 x 2 ; Dim = 100 -> 128 x 1.
const int DIM_P2      = puissance2(NUM_OF_DIMENSIONS);
const int IND_PAR_BLOC = DIM_P2 >= 128 ? 1 : 128 / DIM_P2;

// Mesure du temps de chaque kernel (compiler avec -DPROFIL).
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
   Terme de la fonction objectif pour UNE coordonnee d.
   x = la population (ou les essais), i = l'individu.
   La fitness de l'individu = somme des termes (+ biais), et pour
   Griewank : somme - produit des termes "prod" + 1 - 180.
   Memes formules que fitness_function() de gpu/kernel.cu.
   --------------------------------------------------------------------- */
__device__ void terme(const float *x, int i, int d, float *som, float *prod)
{
    const float *xi = x + i * NUM_OF_DIMENSIONS;   // debut de l'individu i
    float z = xi[d];
    *som  = 0;
    *prod = 1;

    switch (SELECTED_OBJ_FUNC)
    {
        case 0: {   // Levy (meme formule que le code d'origine)
            if (d < NUM_OF_DIMENSIONS - 1) {
                float y  = 1 + (z - 1) / 4;
                float yp = 1 + (xi[d + 1] - 1) / 4;
                float yn = 1 + (xi[NUM_OF_DIMENSIONS - 1] - 1) / 4;
                *som = powf(y - 1, 2) * (1 + 10 * powf(sinf(phi * yp), 2))
                     + powf(yn - 1, 2);
            }
            if (d == 0) *som += powf(sinf(phi * (1 + (z - 1) / 4)), 2);
            break;
        }
        case 1:     // Shifted Rastrigin
            *som = powf(z, 2) - 10 * cosf(2 * phi * z) + 10;
            break;
        case 2:     // Shifted Rosenbrock : a besoin de la coordonnee suivante
            if (d < NUM_OF_DIMENSIONS - 1) {
                float zi   = z + 1;
                float zip1 = xi[d + 1] + 1;
                *som = 100 * powf(powf(zi, 2) - zip1, 2) + powf(zi - 1, 2);
            }
            break;
        case 3:     // Shifted Griewank : une somme ET un produit
            *som  = powf(z, 2) / 4000;
            *prod = cosf(z / sqrtf((float)(d + 1)));
            break;
        case 4:     // Shifted Sphere
            *som = powf(z, 2);
            break;
    }
}

// Biais ajoute a la fin (meme valeurs que fitness_function)
__device__ float finFitness(float som, float prod)
{
    switch (SELECTED_OBJ_FUNC)
    {
        case 1: return som - 330;
        case 2: return som + 390;
        case 3: return som - prod + 1 - 180;
        case 4: return som - 450;
        default: return som;
    }
}

/* ---------------------------------------------------------------------
   Kernel (I) : un etat aleatoire par coordonnee.
   --------------------------------------------------------------------- */
__global__ void kernelInitRandom(curandState *states, unsigned long seed)
{
    int k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k >= NUM_OF_PARTICLES * NUM_OF_DIMENSIONS) return;

    curand_init(seed, k, 0, &states[k]);
}

/* ---------------------------------------------------------------------
   Kernel (E) : evaluation, un thread par coordonnee + reduction.
   threadIdx.x = coordonnee d, threadIdx.y = individu dans le bloc.
   --------------------------------------------------------------------- */
__global__ void kernelEvaluate(const float *pop, float *fit)
{
    __shared__ float sSom[IND_PAR_BLOC][DIM_P2];
    __shared__ float sProd[IND_PAR_BLOC][DIM_P2];

    int d = threadIdx.x;
    int b = threadIdx.y;
    int i = blockIdx.x * IND_PAR_BLOC + b;

    float som = 0, prod = 1;          // valeurs "neutres" pour les threads en trop
    if (i < NUM_OF_PARTICLES && d < NUM_OF_DIMENSIONS)
        terme(pop, i, d, &som, &prod);
    sSom[b][d]  = som;
    sProd[b][d] = prod;
    __syncthreads();

    // reduction : a chaque tour la moitie des threads additionne
    // la case de l'autre moitie (16 -> 8 -> 4 -> 2 -> 1)
    for (int s = DIM_P2 / 2; s > 0; s /= 2)
    {
        if (d < s) {
            sSom[b][d]  += sSom[b][d + s];
            sProd[b][d] *= sProd[b][d + s];
        }
        __syncthreads();
    }

    if (d == 0 && i < NUM_OF_PARTICLES)
        fit[i] = finFitness(sSom[b][0], sProd[b][0]);
}

/* ---------------------------------------------------------------------
   Kernel (P) : 1 thread par INDIVIDU (les indices sont communs a toutes
   ses coordonnees). Utilise l'etat aleatoire de la coordonnee 0.
   --------------------------------------------------------------------- */
__global__ void kernelPrepareIndices(int *idx, curandState *states)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    curandState st = states[i * NUM_OF_DIMENSIONS];

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

    states[i * NUM_OF_DIMENSIONS] = st;
}

/* ---------------------------------------------------------------------
   Kernel (M) : mutation d'une coordonnee.
   --------------------------------------------------------------------- */
__global__ void kernelMutation(const float *pop, const int *idx, float *mutant)
{
    int k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k >= NUM_OF_PARTICLES * NUM_OF_DIMENSIONS) return;

    int i = k / NUM_OF_DIMENSIONS;
    int d = k % NUM_OF_DIMENSIONS;
    int r1 = idx[4 * i], r2 = idx[4 * i + 1], r3 = idx[4 * i + 2];

    mutant[k] = pop[r1 * NUM_OF_DIMENSIONS + d]
              + F_MUT * (pop[r2 * NUM_OF_DIMENSIONS + d]
                       - pop[r3 * NUM_OF_DIMENSIONS + d]);
}

/* ---------------------------------------------------------------------
   Kernel (C) : croisement d'une coordonnee + bornes.
   --------------------------------------------------------------------- */
__global__ void kernelCrossover(const float *pop, const float *mutant, const int *idx,
                                float *trial, curandState *states)
{
    int k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k >= NUM_OF_PARTICLES * NUM_OF_DIMENSIONS) return;

    int i = k / NUM_OF_DIMENSIONS;
    int d = k % NUM_OF_DIMENSIONS;

    curandState st = states[k];
    float u = (curand_uniform(&st) < CR || d == idx[4 * i + 3]) ? mutant[k] : pop[k];
    states[k] = st;

    if (u < START_RANGE_MIN) u = START_RANGE_MIN;
    if (u > START_RANGE_MAX) u = START_RANGE_MAX;
    trial[k] = u;
}

/* ---------------------------------------------------------------------
   Kernel (S) : chaque thread recopie SA coordonnee si l'essai est
   meilleur. Le thread de la coordonnee 0 ecrit la nouvelle fitness
   dans fitOut (pas dans fitIn, que les autres threads lisent encore).
   --------------------------------------------------------------------- */
__global__ void kernelSelection(float *pop, const float *fitIn, float *fitOut,
                                const float *trial, const float *fitTrial)
{
    int k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k >= NUM_OF_PARTICLES * NUM_OF_DIMENSIONS) return;

    int i = k / NUM_OF_DIMENSIONS;
    int d = k % NUM_OF_DIMENSIONS;
    bool meilleur = fitTrial[i] <= fitIn[i];

    if (meilleur)
        pop[k] = trial[k];
    if (d == 0)
        fitOut[i] = meilleur ? fitTrial[i] : fitIn[i];
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
    float *devPop, *devFitA, *devFitB, *devMutant, *devTrial, *devFitTrial;
    int *devIdx;
    curandState *devStates;

    cudaMalloc((void**)&devPop,      sizeof(float) * size);
    cudaMalloc((void**)&devFitA,     sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devFitB,     sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devMutant,   sizeof(float) * size);
    cudaMalloc((void**)&devTrial,    sizeof(float) * size);
    cudaMalloc((void**)&devFitTrial, sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devIdx,      sizeof(int) * 4 * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devStates,   sizeof(curandState) * size);

    // --- 3 configurations de lancement ---
    int threadsNum = 128;
    int blocksInd  = (NUM_OF_PARTICLES + threadsNum - 1) / threadsNum;   // 1 thread / individu  (P)
    int blocksCoord = (size + threadsNum - 1) / threadsNum;              // 1 thread / coordonnee (I, M, C, S)
    dim3 threadsEval(DIM_P2, IND_PAR_BLOC);                              // (E) : coordonnees x individus
    int  blocksEval = (NUM_OF_PARTICLES + IND_PAR_BLOC - 1) / IND_PAR_BLOC;

    cudaMemcpy(devPop, positions, sizeof(float) * size, cudaMemcpyHostToDevice);

    kernelInitRandom<<<blocksCoord, threadsNum>>>(devStates, (unsigned long)rand());
    kernelEvaluate<<<blocksEval, threadsEval>>>(devPop, devFitA);

    float *fitIn = devFitA, *fitOut = devFitB;

    // --- boucle principale : 5 kernels par generation ---
    for (int gen = 0; gen < maxGen; gen++)
    {
        CHRONO(0, kernelPrepareIndices<<<blocksInd, threadsNum>>>(devIdx, devStates));
        CHRONO(1, kernelMutation<<<blocksCoord, threadsNum>>>(devPop, devIdx, devMutant));
        CHRONO(2, kernelCrossover<<<blocksCoord, threadsNum>>>(devPop, devMutant, devIdx, devTrial, devStates));
        CHRONO(3, kernelEvaluate<<<blocksEval, threadsEval>>>(devTrial, devFitTrial));
        CHRONO(4, kernelSelection<<<blocksCoord, threadsNum>>>(devPop, fitIn, fitOut, devTrial, devFitTrial));

        float *tmp = fitIn;  fitIn = fitOut;  fitOut = tmp;
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
    cudaMemcpy(hostFit, fitIn, sizeof(float) * NUM_OF_PARTICLES, cudaMemcpyDeviceToHost);

    int best = 0;
    for (int i = 1; i < NUM_OF_PARTICLES; i++)
        if (hostFit[i] < hostFit[best]) best = i;

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
        gBest[d] = positions[best * NUM_OF_DIMENSIONS + d];

    // --- nettoyage ---
    free(hostFit);
    cudaFree(devPop);
    cudaFree(devFitA);
    cudaFree(devFitB);
    cudaFree(devMutant);
    cudaFree(devTrial);
    cudaFree(devFitTrial);
    cudaFree(devIdx);
    cudaFree(devStates);
}
