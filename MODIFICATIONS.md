# Modifications faites hors des deux kernel.cu (et pourquoi)

Fichiers du prof NON modifies : `cudapso/` (intact), `main.cpp` (gpu/ et sequentiel/).

| Fichier | Modification | Pourquoi |
|---|---|---|
| `gpu/kernel.h`, `sequentiel/kernel.h` | `SELECTED_OBJ_FUNC`, `NUM_OF_PARTICLES`, `NUM_OF_DIMENSIONS` (et optionnellement `MAX_ITER`) prennent leur valeur de `-DOBJ_FUNC`, `-DPOP`, `-DDIM`, `-DMAXIT`. Valeurs par defaut = celles d'origine (0, 512, 3). | Dim/Pop/fonction etaient des constantes `const int` : impossible de les faire varier sans editer le fichier a chaque test (consigne 7 du sujet). |
| `gpu/kernel.cpp`, `sequentiel/kernel.cpp` | Griewank : `float produit = 0;` -> `1`. | Le produit des cosinus partait de 0 : il restait 0, la fonction testee n'etait pas Griewank (elle ressemblait a une sphere). Resultats faux pour la fonction 3. |
| `gpu/kernel.cu` (le notre) | graine de `curand_init` = `rand()` au lieu de `time(NULL)`. | Avec `time(NULL)`, deux runs dans la meme seconde ont la meme graine -> runs non independants. |
| `gpu/kernel.cu`, `sequentiel/kernel.cu` | `#define CR 0.9f` entoure de `#ifndef CR` : surchargeable par `-DCR=0.3f`. Defaut inchange (0.9). | Etape 8 : reproduire le parametre de l'article (CR=0.3, F=0.5). Resultats dans `results/raw_cr0p3f.csv` ; les anciens (`results/raw.csv`) sont intacts. Lancer : `python3 bench/run_all.py 10 0.3f`. |
| `baseline_pso/` (NOUVEAU) | Copie de `cudapso/` + meme `kernel.h` que ci-dessus + `produit = 1` dans son `kernel.cu`. | Faire tourner le PSO du prof comme reference sans toucher a l'original. Meme bug Griewank corrige. |
| `bench/bench_main.cpp` (NOUVEAU) | Remplace `main.cpp` pour les tests : N runs, temps reel (chrono), erreur calculee en double. | `main.cpp` n'affiche que la fitness float : avec le biais (-450, ...) on ne peut pas mesurer une erreur < 1e-8, et il ne fait qu'un run. |
| `Makefile`, `bench/run_all.py`, `bench/analyse.py` (NOUVEAUX) | Compilation et lancement de toutes les configurations, tableaux/courbes/tests statistiques. | Remplir la section resultats. |

## Constats NON corriges (volontairement, sans impact sur les tests)
- `getRandom` : le `+1` fait depasser les bornes a l'initialisation (jusqu'a 6.12). Les DE ramenent dans [-5.12, 5.12] ensuite.
- Levy (fonction 0) : terme `(yn-1)^2` place dans la boucle. Hors benchmarks demandes.
- PSO du prof : `blocksNum = ceil(size/threadsNum)` est une division entiere (arrondi bas), et `tempParticle1/2` sont des tableaux
  `__device__` globaux partages entre threads (course critique). Garde tel quel, il sert de reference.
- Precision : fitness en `float` avec biais (-450 pour Sphere) => resolution ~3e-5 : les DE ne peuvent pas descendre sous ~1e-5 d'erreur
  sur Sphere, donc le taux de succes (EFV < 1e-8, critere de l'article) est mecaniquement 0 sur cette fonction. A mentionner dans le rapport.
