#include "kernel.h"

/* =====================================================================
   Differential Evolution (DE/rand/1/bin) - version sequentielle CPU
   ---------------------------------------------------------------------
   Meme algorithme et memes parametres que la version GPU, mais les
   individus sont traites les uns apres les autres.

   Cette version est la REFERENCE : si le GPU ne donne pas des
   resultats du meme ordre, c'est le GPU qui a un bug.

   On garde EXACTEMENT la meme signature que le kernel.cu d'origine,
   donc main.cpp et kernel.h n'ont pas a etre modifies :

     - positions  : population initiale en entree,
                    population finale en sortie
     - velocities : INUTILISE en DE (garde pour la compatibilite)
     - pBests     : INUTILISE en DE (garde pour la compatibilite)
     - gBest      : recoit le meilleur individu trouve

   Ce fichier REMPLACE kernel.cu : on compile soit l'un (version GPU),
   soit l'autre (version CPU), jamais les deux ensemble.

   Pour que la comparaison soit honnete, on garde exactement :
     - le meme budget d'evaluations (10^4 * Dim)
     - les memes F et CR
     - le meme double buffer
   ===================================================================== */

#define F_MUT  0.5f   // facteur de mutation (identique au GPU)
#ifndef CR
#define CR     0.9f   // taux de croisement  (identique au GPU)
#endif   // [MODIF] surchargeable : -DCR=0.3f (valeur de l'article, voir MODIFICATIONS.md)

/* ---------------------------------------------------------------------
   Un essai pour un individu : mutation -> croisement -> bornes
   --------------------------------------------------------------------- */
static void makeTrial(const float *popIn, int i, float *trial)
{
    int r1, r2, r3;

    // --- tirage de 3 individus distincts, tous differents de i ---
    do { r1 = rand() % NUM_OF_PARTICLES; } while (r1 == i);
    do { r2 = rand() % NUM_OF_PARTICLES; } while (r2 == i || r2 == r1);
    do { r3 = rand() % NUM_OF_PARTICLES; } while (r3 == i || r3 == r1 || r3 == r2);

    // au moins une dimension vient forcement du mutant
    int jrand = rand() % NUM_OF_DIMENSIONS;

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
    {
        // --- mutation : v = x_r1 + F * (x_r2 - x_r3) ---
        float v = popIn[r1 * NUM_OF_DIMENSIONS + d]
                + F_MUT * (popIn[r2 * NUM_OF_DIMENSIONS + d]
                         - popIn[r3 * NUM_OF_DIMENSIONS + d]);

        // --- croisement binomial ---
        if (getRandomClamped() < CR || d == jrand)
            trial[d] = v;
        else
            trial[d] = popIn[i * NUM_OF_DIMENSIONS + d];

        // --- on reste dans les bornes ---
        if (trial[d] < START_RANGE_MIN) trial[d] = START_RANGE_MIN;
        if (trial[d] > START_RANGE_MAX) trial[d] = START_RANGE_MAX;
    }
}

/* =====================================================================
   DE sequentiel complet
   ===================================================================== */
extern "C" void cuda_pso(float *positions, float *velocities,
                         float *pBests, float *gBest)
{
    (void)velocities;   // inutilise en DE
    (void)pBests;       // inutilise en DE

    int size = NUM_OF_PARTICLES * NUM_OF_DIMENSIONS;

    // Meme budget que la version GPU : 10^4 * Dim evaluations.
    // Une generation = NUM_OF_PARTICLES evaluations.
    int maxGen = MAX_ITER / NUM_OF_PARTICLES;
    if (maxGen < 1) maxGen = 1;

    // --- allocation (double buffer, comme sur GPU) ---
    float *popA = (float*)malloc(sizeof(float) * size);
    float *popB = (float*)malloc(sizeof(float) * size);
    float *fitA = (float*)malloc(sizeof(float) * NUM_OF_PARTICLES);
    float *fitB = (float*)malloc(sizeof(float) * NUM_OF_PARTICLES);

    float trial[NUM_OF_DIMENSIONS];
    float x[NUM_OF_DIMENSIONS];

    // --- population de depart ---
    for (int k = 0; k < size; k++)
        popA[k] = positions[k];

    // --- evaluation initiale ---
    for (int i = 0; i < NUM_OF_PARTICLES; i++)
    {
        for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
            x[d] = popA[i * NUM_OF_DIMENSIONS + d];

        fitA[i] = host_fitness_function(x);
    }

    // --- boucle principale ---
    float *popIn  = popA, *fitIn  = fitA;
    float *popOut = popB, *fitOut = fitB;

    for (int gen = 0; gen < maxGen; gen++)
    {
        // ICI est la seule vraie difference avec le GPU :
        // cette boucle est sequentielle, alors que sur GPU les
        // NUM_OF_PARTICLES individus sont traites en parallele.
        for (int i = 0; i < NUM_OF_PARTICLES; i++)
        {
            makeTrial(popIn, i, trial);

            float trialFit = host_fitness_function(trial);

            // --- selection ---
            if (trialFit <= fitIn[i])
            {
                for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
                    popOut[i * NUM_OF_DIMENSIONS + d] = trial[d];
                fitOut[i] = trialFit;
            }
            else
            {
                for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
                    popOut[i * NUM_OF_DIMENSIONS + d] =
                        popIn[i * NUM_OF_DIMENSIONS + d];
                fitOut[i] = fitIn[i];
            }
        }

        // echange des buffers
        float *tmpPop = popIn;  popIn  = popOut;  popOut = tmpPop;
        float *tmpFit = fitIn;  fitIn  = fitOut;  fitOut = tmpFit;
    }

    // --- resultats ---
    for (int k = 0; k < size; k++)
        positions[k] = popIn[k];

    int best = 0;
    for (int i = 1; i < NUM_OF_PARTICLES; i++)
        if (fitIn[i] < fitIn[best]) best = i;

    for (int d = 0; d < NUM_OF_DIMENSIONS; d++)
        gBest[d] = positions[best * NUM_OF_DIMENSIONS + d];

    // --- nettoyage ---
    free(popA);
    free(popB);
    free(fitA);
    free(fitB);
}
