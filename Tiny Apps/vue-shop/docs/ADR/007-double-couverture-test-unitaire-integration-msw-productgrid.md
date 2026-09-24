# ADR 007 — Double couverture de test : unitaire mocké + intégration MSW réelle pour `ProductGrid`

## Statut
🟢 Acceptée

## Contexte
`ProductGrid.vue` orchestre l'affichage de quatre états dérivés de
`useProducts()` (`isPending`, `isError`, liste vide, liste de produits).
Deux besoins de test distincts et complémentaires existent :

1. Vérifier que **le template couvre bien toutes les branches d'état**
   (loading / erreur / vide / rempli), y compris leur exclusivité
   mutuelle (ex. ne jamais afficher `loading-state` et `error-state` en
   même temps), de façon rapide et déterministe.
2. Vérifier que **le câblage réel** entre le composant, le composable
   `useProducts`, le client HTTP et le réseau fonctionne bout en bout —
   ce qu'un test purement unitaire, en mockant `useProducts`, ne peut pas
   garantir (une régression dans `products.api.ts`, dans la `queryKey`,
   ou dans la forme de la réponse HTTP ne serait pas détectée).

Un seul type de test ne peut pas couvrir ces deux préoccupations à la
fois sans sacrifier soit la rapidité/déterminisme, soit la couverture
d'intégration réelle.

## Décision
`ProductGrid` est couvert par **deux suites de tests distinctes et
complémentaires**, non redondantes :

### 1. `ProductGrid.spec.ts` — unitaire, composable mocké
```ts
vi.mock('../composable/useProducts', () => ({
  useProducts: vi.fn<(...args: unknown[]) => unknown>()
}))
```
- `useProducts` est entièrement mocké via `vi.mocked(useProducts).mockReturnValue(...)`,
  ce qui permet de simuler chaque état (`isPending`, `isError`, `data`)
  indépendamment et sans latence réseau.
- `ProductCard` est **stubbé** (`stubs: { ProductCard: true }`) : ce test
  ne vérifie pas le rendu détaillé d'une carte produit (déjà couvert par
  `ProductCard.spec.ts`, cf. ADR 006), seulement que le bon nombre de
  cartes est instancié.
- Une fonction utilitaire `renderedStates()` vérifie explicitement
  qu'un seul état `data-testid` est rendu à la fois, garantissant
  l'exclusivité du `v-if`/`v-else-if`.
- Rapide, 100% déterministe, aucune dépendance réseau : c'est le test
  qui couvre exhaustivement la logique de branchement du template.

### 2. `ProductGrid.integration.spec.ts` — intégration, réseau mocké au niveau HTTP (MSW)
```ts
// useProducts n'est PAS mocké ici : seul le réseau l'est (MSW)
function mountProductGrid() {
  return mount(ProductGrid, {
    global: { plugins: [[VueQueryPlugin, { queryClient: createTestQueryClient() }]] }
  })
}
```
- `useProducts`, `getProducts`, `httpClient` et `ProductCard` sont tous
  **réels** : seule la couche réseau est interceptée par MSW
  (`src/tests/mocks/server.ts`), au plus bas niveau possible.
- Un vrai `QueryClient` de test est injecté (`createTestQueryClient()`,
  `retry: false`, `gcTime: 0`) pour rendre le test rapide et isolé
  d'un test à l'autre.
- Ce test valide la chaîne complète : composant → composable → fonction
  API → client HTTP → requête réseau interceptée → réponse → rendu final
  (jusqu'aux vraies `ProductCard`, avec assertions sur le contenu réel
  retourné par les fixtures MSW).
- Un scénario d'erreur réseau (`server.use(http.get('/api/products', ...
  500))`) vérifie que l'état d'erreur se propage correctement à travers
  toute la chaîne réelle, pas seulement via un mock manuel de
  `isError: true`.

## Conséquences

**Positives**
- Les deux suites ont des responsabilités non chevauchantes : le test
  unitaire couvre exhaustivement toutes les combinaisons d'état du
  template à moindre coût, le test d'intégration couvre le câblage réel
  une seule fois pour le cas nominal et le cas d'erreur — pas besoin de
  dupliquer tous les cas d'état dans les deux suites.
- Une régression dans la `queryKey`, dans `products.api.ts`, dans
  `httpClient` (mauvaise `baseURL`, mauvais verbe HTTP) ou dans la forme
  du contrat OpenAPI est détectée par le test d'intégration, même si le
  test unitaire mocké resterait vert.
- Le test d'intégration reste rapide et fiable malgré l'appel réseau
  simulé car MSW intercepte au niveau du réseau (pas de vrai serveur), et
  `gcTime: 0` + `retry: false` évitent toute fuite d'état entre tests.

**Négatives**
- Deux fichiers de test à maintenir par composant "orchestrateur" de
  données, avec un risque de confusion sur "où ajouter quel test" si la
  convention n'est pas documentée (d'où cet ADR).
- Le test d'intégration est plus lent et plus fragile aux changements de
  contrat (si `openapi/shop.openapi.json` change, les mocks MSW dans
  `products.mocks.ts` doivent être maintenus à jour en cohérence).

## Schéma

```text
┌──────────────────────────────┐        ┌───────────────────────────────────┐
│   ProductGrid.spec.ts         │        │  ProductGrid.integration.spec.ts    │
│   (unitaire)                  │        │  (intégration)                      │
│                                │        │                                     │
│  useProducts()  ── mocké ──▶ │        │  useProducts()  ── réel ──▶         │
│  ProductCard    ── stubbé ──▶│        │  getProducts()  ── réel ──▶         │
│                                │        │  httpClient()   ── réel ──▶         │
│                                │        │  ProductCard    ── réel ──▶         │
│                                │        │  réseau         ── intercepté MSW ─▶│
│                                │        │                                     │
│  Vérifie : toutes les          │        │  Vérifie : le câblage bout-en-bout, │
│  branches du template          │        │  cas nominal + cas d'erreur réels    │
│  (loading/error/empty/filled)  │        │                                     │
│  rapide, déterministe           │        │  plus lent, plus proche du réel     │
└──────────────────────────────┘        └───────────────────────────────────┘
              ▲                                          ▲
              └──────────────── se complètent, ne se recouvrent pas ──┘
```
