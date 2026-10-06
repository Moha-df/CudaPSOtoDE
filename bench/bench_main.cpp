// Banc d'essai (fichier ajoute, ne remplace PAS main.cpp du prof).
// Pourquoi : main.cpp n'affiche que la fitness en float, ce qui ne permet pas
// de mesurer l'erreur < 1e-8 (le biais -450 etc. noie la precision float), et
// il ne fait qu'un seul run. Ici : N runs, temps reel, erreur (EFV) en double.
//   usage : ./prog <nb_runs> <graine>
// sortie : une ligne CSV par run : run,temps_s,fitness,efv
#include "kernel.h"
#include <chrono>
#include <vector>

// Fonction objectif SANS biais, en double, meme formules que kernel.cpp
// (phi = 3.1415 comme dans le code). L'optimum vaut 0 en x = 0.
static double f_double(const float *x) {
    double r = 0, s = 0, p = 1;
    const int n = NUM_OF_DIMENSIONS;
    switch (SELECTED_OBJ_FUNC) {
    case 1: for (int i = 0; i < n; i++) r += (double)x[i]*x[i] - 10*cos(2*(double)phi*x[i]) + 10; break;
    case 2: for (int i = 0; i < n-1; i++) {
                double z = x[i] + 1.0, z1 = x[i+1] + 1.0;
                r += 100*(z*z - z1)*(z*z - z1) + (z-1)*(z-1); }
            break;
    case 3: for (int i = 0; i < n; i++) { s += (double)x[i]*x[i]/4000; p *= cos(x[i]/sqrt(i+1.0)); }
            r = s - p + 1; break;
    case 4: for (int i = 0; i < n; i++) r += (double)x[i]*x[i]; break;
    }
    return r;
}

int main(int argc, char **argv) {
    int runs = argc > 1 ? atoi(argv[1]) : 10;
    unsigned seed = argc > 2 ? (unsigned)atoi(argv[2]) : (unsigned)time(NULL);
    srand(seed);

    const int N = NUM_OF_PARTICLES * NUM_OF_DIMENSIONS;
    std::vector<float> pos(N), vel(N), pb(N), gb(NUM_OF_DIMENSIONS);

    for (int r = -1; r < runs; r++) {          // r = -1 : run de chauffe (init CUDA), non reporte
        for (int i = 0; i < N; i++) { pos[i] = getRandom(START_RANGE_MIN, START_RANGE_MAX); pb[i] = pos[i]; vel[i] = 0; }
        for (int k = 0; k < NUM_OF_DIMENSIONS; k++) gb[k] = pb[k];

        auto t0 = std::chrono::steady_clock::now();
        cuda_pso(pos.data(), vel.data(), pb.data(), gb.data());
        auto t1 = std::chrono::steady_clock::now();

        if (r >= 0)
            printf("%d,%.6f,%.6f,%.10e\n", r, std::chrono::duration<double>(t1 - t0).count(),
                   host_fitness_function(gb.data()), f_double(gb.data()));
    }
    return 0;
}
