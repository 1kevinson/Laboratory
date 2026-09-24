# ADR 004 — La définition des fonctions client TanStack Query à la main

## Statut
🟢 Acceptée

## Contexte
Orval propose un mode de génération `override.query` capable de produire
directement des hooks/composables TanStack Query (`useGetProducts`, etc.)
en plus des fonctions `fetch` brutes. C'est une option activable dans
`orval.config.ts`.

Dans la continuité de l'ADR 003 (on ne consomme jamais les fonctions
client générées), on doit décider explicitement de ne pas non plus
consommer une éventuelle génération de composables TanStack Query par
Orval, et de documenter comment ces composables sont réellement écrits
dans le projet.

Le projet suit actuellement un pattern à deux couches, illustré par les
produits :

```ts
// 1. Couche API — appel réseau typé, basé sur le client HTTP partagé
// src/features/products/api/products.api.ts
export function getProducts(): Promise<Product[]> {
  return httpClient<Product[]>('/products')
}

// 2. Couche composable — encapsule TanStack Query
// src/features/products/composable/useProducts.ts
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: getProducts
  })
}
```

## Décision
Les composables `useQuery`/`useMutation` sont écrits **à la main**, un
par cas d'usage, dans `src/features/<feature>/composable/`. Ils ne sont
ni générés par Orval, ni mutualisés dans un composable générique
"one-size-fits-all" qui prendrait l'URL en paramètre.

Chaque composable :
- appelle une fonction de la couche API (elle-même écrite à la main,
  cf. ADR 003) comme `queryFn` ;
- définit sa propre `queryKey`, structurée et propre à la feature
  (`['products']`, et plus tard `['products', productId]`,
  `['cart']`…) ;
- reste responsable des options spécifiques à son cas d'usage
  (`staleTime`, `enabled`, `select`, `retry`) plutôt que de hériter d'une
  configuration générique appliquée à toutes les requêtes.

## Conséquences

**Positives**
- Contrôle total sur la `queryKey` : condition indispensable pour une
  invalidation ciblée (`queryClient.invalidateQueries({ queryKey:
  ['products'] })`) au lieu d'une invalidation globale.
- Contrôle total sur le typage des erreurs métier (cf. ADR 001) : un
  composable généré ne connaîtrait pas la distinction entre échec
  générique et erreur métier typée du contrat.
- Le composable est le seul endroit où la logique "TanStack Query" vit ;
  les composants (`ProductGrid.vue`) et les tests ne dépendent que de son
  interface (`data`, `isPending`, `isError`), jamais de la génération
  Orval ni de details internes.
- Facilement mockable en test unitaire : `vi.mock('../composable/useProducts')`
  permet de simuler chaque état (`isPending`, `isError`, `data`) sans
  dépendre de MSW (cf. ADR 007).

**Négatives**
- Plus de code à écrire manuellement pour chaque nouvel endpoint (deux
  petits fichiers : API + composable) comparé à une génération
  automatique.
- Risque de divergence de convention entre développeurs si la structure
  "API function → composable dédié" n'est pas appliquée de façon
  systématique — nécessite une revue de code attentive et, à terme,
  un exemple de référence documenté (ce fichier).

## Exemple
```text
Feature "products"
├── api/products.api.ts          → getProducts(): Promise<Product[]>
└── composable/useProducts.ts    → useQuery({ queryKey: ['products'], queryFn: getProducts })

Le composant ne connaît que useProducts() :
  const { data, isPending, isError } = useProducts()
```
