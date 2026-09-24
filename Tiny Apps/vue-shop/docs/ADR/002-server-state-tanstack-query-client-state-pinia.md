# ADR 002 — Server state → TanStack Query, Client state → Pinia

## Statut
🟢 Acceptée

## Contexte
Une application front-end manipule deux natures d'état très différentes,
souvent mélangées à tort dans le même store :

- **Le server state** : des données qui *appartiennent* au serveur (liste
  des produits, contenu du panier persisté, profil utilisateur…). Le
  client n'en est qu'une copie temporaire, potentiellement obsolète, qui
  doit être resynchronisée (fetch, cache, invalidation, refetch en
  arrière-plan, déduplication de requêtes concurrentes).
- **Le client state** : des données qui n'existent que dans le
  navigateur et n'ont pas de source de vérité serveur (état d'ouverture
  d'un modal, filtre de tri sélectionné, étape courante d'un wizard,
  onglet actif…).

Historiquement, ce genre d'état est souvent centralisé dans un seul store
(Vuex/Pinia) qui finit par réimplémenter — mal — un cache HTTP : gestion
manuelle de `isLoading`/`isError`, absence de déduplication, absence
d'invalidation, re-fetch oublié après une mutation, etc.

## Décision
On sépare strictement les deux responsabilités :

- **Server state → TanStack Query** (`@tanstack/vue-query`). Toute donnée
  qui provient d'un appel API passe par un composable `useQuery` /
  `useMutation` (voir `src/features/products/composable/useProducts.ts`).
  TanStack Query devient la seule source de vérité pour le cache, le
  statut de chargement (`isPending`), le statut d'erreur (`isError`), la
  revalidation et l'invalidation.
- **Client state → Pinia**. Toute donnée purement UI, ou qui doit être
  partagée entre composants sans transiter par une API (ex. contenu du
  panier avant validation, préférences d'affichage), vit dans un store
  Pinia dédié à la feature concernée.

Un store Pinia ne doit **jamais** dupliquer un état déjà géré par
TanStack Query (pas de `products: ref([])` alimenté manuellement à côté
d'un `useProducts()`). Si une donnée serveur doit être combinée à de
l'état client (ex. "produits du catalogue" + "quantités sélectionnées
dans le panier"), chaque store reste responsable de sa moitié, et un
composable de composition lit les deux en lecture seule.

## Conséquences

**Positives**
- Aucune duplication de logique de cache : `staleTime`, `gcTime`,
  déduplication de requêtes, retry, et invalidation sont fournis par
  TanStack Query et ne sont pas réimplémentés à la main dans un store.
- Les stores Pinia restent petits et lisibles : ils ne contiennent que
  de l'état qui a réellement une raison d'être "client-only".
- Les tests sont plus simples : le server state se mocke au niveau du
  composable ou du réseau (MSW), le client state se teste comme un
  store Pinia classique, sans jamais mélanger les deux stratégies de
  mock dans un même test.

**Négatives**
- Nécessite une discipline d'équipe : à chaque nouvel état, il faut se
  poser la question "est-ce que ça vient du serveur ?" avant de choisir
  où le placer. Une mauvaise classification initiale coûte cher à
  corriger une fois des composants branchés dessus.
- Deux mécanismes de réactivité cohabitent dans l'application (le cache
  réactif de TanStack Query et les stores réactifs Pinia), ce qui
  demande une montée en compétence sur les deux outils.

## Schéma

```text
┌─────────────────────────────────────────────────────────────────────┐
│                              Composant Vue                          │
│                                                                       │
│   ┌────────────────────────┐        ┌────────────────────────────┐  │
│   │   useProducts()        │        │   useCartStore() (Pinia)    │  │
│   │   (TanStack Query)     │        │   (client state)            │  │
│   └───────────┬────────────┘        └──────────────┬─────────────┘  │
│               │                                     │                │
└───────────────┼─────────────────────────────────────┼────────────────┘
                │                                     │
                ▼                                     ▼
   ┌─────────────────────────┐          ┌────────────────────────────┐
   │   QueryClient (cache)   │          │   Pinia store (mémoire)    │
   │  - staleTime / gcTime   │          │  - selectedProductIds      │
   │  - retry / dedupe       │          │  - isCartDrawerOpen        │
   │  - invalidation         │          │  - sortOrder, filters...   │
   └───────────┬─────────────┘          └────────────────────────────┘
                │
                ▼
   ┌─────────────────────────┐
   │   API (fetch/ofetch)    │
   │   GET /api/products     │
   └─────────────────────────┘
                │
                ▼
   ┌─────────────────────────┐
   │        Serveur          │
   │  source de vérité des   │
   │  produits / panier      │
   └─────────────────────────┘

Règle de lecture :
- Une flèche qui descend vers "Serveur" ⇒ c'est du server state ⇒ TanStack Query.
- Une donnée qui s'arrête dans la boîte Pinia sans jamais toucher le
  réseau ⇒ c'est du client state ⇒ Pinia.
```
