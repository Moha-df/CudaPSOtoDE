Q#include <cuda_runtime.h>
#include <cuda.h>
#include <curand_kernel.h>

#include "kernel.h"

/* =====================================================================
   Differential Evolution (DE/rand/1/bin) sur GPU - version naive
   ---------------------------------------------------------------------
   On garde volontairement la meme signature que le PSO d'origine
   (cuda_pso) pour ne rien changer dans main.cpp ni dans kernel.h.

     - positions  : sert de population initiale, et contient la
                    population finale en sortie
     - velocities : INUTILISE en DE (garde pour la compatibilite)
     - pBests     : INUTILISE en DE (garde pour la compatibilite)
     - gBest      : recoit le meilleur individu trouve

   Organisation :
     1 thread = 1 individu.
     Chaque generation, un thread construit un "essai" (mutation +
     croisement), l'evalue, et garde le meilleur entre l'essai et son
     individu courant (selection).

   Double buffer : on lit dans popIn et on ecrit dans popOut, puis on
   echange les deux pointeurs. Ca evite qu'un thread modifie un
   individu pendant qu'un autre le lit.
   ===================================================================== */

// Parametres du DE
#define F_MUT  0.5f   // facteur de mutation
#ifndef CR
#define CR     0.9f   // taux de croisement
#endif   // [MODIF] surchargeable : -DCR=0.3f (valeur de l'article, voir MODIFICATIONS.md)

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
   Kernel 1 : initialisation du generateur aleatoire.
   Chaque thread a son propre etat curandState, sinon tous les individus
   recevraient exactement le meme hasard.
   --------------------------------------------------------------------- */
__global__ void kernelInitRandom(curandState *states, unsigned long seed)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    curand_init(seed, i, 0, &states[i]);
}

/* ---------------------------------------------------------------------
   Kernel 2 : evaluation de toute la population.
   Sert une seule fois, au depart, pour remplir le tableau des fitness.
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
   Kernel 3 : une generation complete de DE pour un individu.
   mutation -> croisement -> evaluation -> selection
   --------------------------------------------------------------------- */
__global__ void kernelDEGeneration(float *popIn,  float *fitIn,
                                   float *popOut, float *fitOut,
                                   curandState *states)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= NUM_OF_PARTICLES) return;

    curandState st = states[i];

    // --- tirage de 3 individus distincts, tous differents de i ---
    int r1, r2, r3;
    do { r1 = (int)(curand_uniform(&st) * NUM_OF_PARTICLES) % NUM_OF_PARTICLES; }
    while (r1 == i);
    do { r2 = (int)(curand_uniform(&st) * NUM_OF_PARTICLES) % NUM_OF_PARTICLES; }
    while (r2 == i || r2 == r1);
    do { r3 = (int)(curand_uniform(&st) * NUM_OF_PARTICLES) % NUM_OF_PARTICLES; }
    while (r3 == i || r3 == r1 || r3 == r2);

    // au moins une dimension vient forcement du mutant
    int jrand = (int)(curand_uniform(&st) * NUM_OF_DIMENSIONS) % NUM_OF_DIMENSIONS;

    float trial[NUM_OF_DIMENSIONS];

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
    {
        // --- mutation : v = x_r1 + F * (x_r2 - x_r3) ---
        float v = popIn[r1 * NUM_OF_DIMENSIONS + d]
                + F_MUT * (popIn[r2 * NUM_OF_DIMENSIONS + d]
                         - popIn[r3 * NUM_OF_DIMENSIONS + d]);

        // --- croisement binomial ---
        if (curand_uniform(&st) < CR || d == jrand)
            trial[d] = v;
        else
            trial[d] = popIn[i * NUM_OF_DIMENSIONS + d];

        // --- on reste dans les bornes ---
        if (trial[d] < START_RANGE_MIN) trial[d] = START_RANGE_MIN;
        if (trial[d] > START_RANGE_MAX) trial[d] = START_RANGE_MAX;
    }

    // --- evaluation de l'essai ---
    float trialFit = fitness_function(trial);

    // --- selection : l'essai ne remplace la cible que s'il est meilleur ---
    if (trialFit <= fitIn[i])
    {
        for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
            popOut[i * NUM_OF_DIMENSIONS + d] = trial[d];
        fitOut[i] = trialFit;
    }
    else
    {
        for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
            popOut[i * NUM_OF_DIMENSIONS + d] = popIn[i * NUM_OF_DIMENSIONS + d];
        fitOut[i] = fitIn[i];
    }

    states[i] = st;   // on sauvegarde l'etat du generateur
}

/* =====================================================================
   Fonction appelee depuis le CPU.
   Nom conserve (cuda_pso) pour rester compatible avec main.cpp.
   ===================================================================== */
extern "C" void cuda_pso(float *positions, float *velocities,
                         float *pBests, float *gBest)
{
    (void)velocities;   // inutilise en DE
    (void)pBests;       // inutilise en DE

    int size = NUM_OF_PARTICLES * NUM_OF_DIMENSIONS;

    // Budget d'evaluations impose par le sujet : 10^4 * Dim.
    // Une generation = NUM_OF_PARTICLES evaluations.
    int maxGen = MAX_ITER / NUM_OF_PARTICLES;
    if (maxGen < 1) maxGen = 1;

    // --- allocation sur le GPU ---
    float *devPopA, *devPopB, *devFitA, *devFitB;
    curandState *devStates;

    cudaMalloc((void**)&devPopA, sizeof(float) * size);
    cudaMalloc((void**)&devPopB, sizeof(float) * size);
    cudaMalloc((void**)&devFitA, sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devFitB, sizeof(float) * NUM_OF_PARTICLES);
    cudaMalloc((void**)&devStates, sizeof(curandState) * NUM_OF_PARTICLES);

    // --- 1 thread par individu ---
    int threadsNum = 128;
    int blocksNum  = (NUM_OF_PARTICLES + threadsNum - 1) / threadsNum;

    // --- copie de la population initiale CPU -> GPU ---
    cudaMemcpy(devPopA, positions, sizeof(float) * size,
               cudaMemcpyHostToDevice);

    kernelInitRandom<<<blocksNum, threadsNum>>>(devStates,
                                                (unsigned long)rand());   // graine derivee du rand() de main (et non time(NULL) : identique si 2 runs dans la meme seconde)
    kernelEvaluate<<<blocksNum, threadsNum>>>(devPopA, devFitA);

    // --- boucle principale : tout reste sur le GPU ---
    float *popIn  = devPopA, *fitIn  = devFitA;
    float *popOut = devPopB, *fitOut = devFitB;

    for (int gen = 0; gen < maxGen; gen++)
    {
        kernelDEGeneration<<<blocksNum, threadsNum>>>(popIn, fitIn,
                                                      popOut, fitOut,
                                                      devStates);

        // echange des buffers : la sortie devient l'entree du tour suivant
        float *tmpPop = popIn;  popIn  = popOut;  popOut = tmpPop;
        float *tmpFit = fitIn;  fitIn  = fitOut;  fitOut = tmpFit;
    }

    cudaDeviceSynchronize();

    // --- recuperation des resultats GPU -> CPU (une seule fois) ---
    float *hostFit = (float*)malloc(sizeof(float) * NUM_OF_PARTICLES);

    cudaMemcpy(positions, popIn, sizeof(float) * size,
               cudaMemcpyDeviceToHost);
    cudaMemcpy(hostFit, fitIn, sizeof(float) * NUM_OF_PARTICLES,
               cudaMemcpyDeviceToHost);

    // --- recherche du meilleur individu (sur CPU, une seule fois) ---
    int best = 0;
    for (int i = 1; i < NUM_OF_PARTICLES; i++)
        if (hostFit[i] < hostFit[best]) best = i;

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
        gBest[d] = positions[best * NUM_OF_DIMENSIONS + d];

    // --- nettoyage ---
    free(hostFit);
    cudaFree(devPopA);
    cudaFree(devPopB);
    cudaFree(devFitA);
    cudaFree(devFitB);
    cudaFree(devStates);
}
