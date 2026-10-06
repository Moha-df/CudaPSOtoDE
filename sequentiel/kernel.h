#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <math.h>
#include <iostream>
#include <string>


// Constantes
/* Objective function
0: Levy 3-dimensional
1: Shifted Rastigrin's Function
2: Shifted Rosenbrock's Function
3: Shifted Griewank's Function
4: Shifted Sphere's Function
*/
// [MODIF] Valeurs par defaut inchangees, mais surchargeables a la compilation
// (-DOBJ_FUNC=4 -DDIM=10 -DPOP=100) pour lancer les tests sans editer ce fichier.
#ifndef OBJ_FUNC
#define OBJ_FUNC 0
#endif
#ifndef DIM
#define DIM 3
#endif
#ifndef POP
#define POP 512
#endif
const int SELECTED_OBJ_FUNC = OBJ_FUNC;
const int NUM_OF_PARTICLES = POP;
const int NUM_OF_DIMENSIONS = DIM;
#ifdef MAXIT
const int MAX_ITER = MAXIT;   // [MODIF] budget impose depuis la ligne de commande
#else
const int MAX_ITER = NUM_OF_DIMENSIONS * pow(10, 4);
#endif
const float START_RANGE_MIN = -5.12f;
const float START_RANGE_MAX = 5.12f;
const float OMEGA = 0.5;
const float c1 = 1.5;
const float c2 = 1.5;
const float phi = 3.1415;

// Les 3 fonctions très utiles
float getRandom(float low, float high);
float getRandomClamped();
float host_fitness_function(float x[]);

// Fonction externe qui va tourner sur le GPU
extern "C" void cuda_pso(float *positions, float *velocities, float *pBests, float *gBest);

