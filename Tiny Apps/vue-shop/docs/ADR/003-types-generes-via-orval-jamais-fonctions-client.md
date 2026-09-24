# ADR 003 — Types générés via Orval, jamais les fonctions client générées

## Statut
🟢 Acceptée

## Contexte
Orval (`orval.config.ts`) génère, à partir du contrat OpenAPI
(`openapi/shop.openapi.json`), deux catégories de fichiers dans
`src/shared/api/generated/` :

1. **Les modèles/types** (`generated/models/*.ts`), par exemple
   `Product`, qui reflètent fidèlement les schémas du contrat.
2. **Les fonctions client par endpoint** (`generated/products/products.ts`),
   par exemple `getProducts()`, générées en mode `client: 'fetch'`.

Ces fonctions générées encapsulent un appel `fetch` brut et retournent une
enveloppe de réponse propre à Orval :

```ts
export type getProductsResponse200 = {
  data: Product[]
  status: 200
}
// ...
export const getProducts = async (options?: RequestInit): Promise<getProductsResponse> => { /* ... */ }
```

Cette forme de retour (`{ data, status, headers }`) fuit dans tout le
code appelant, ne passe pas par le client HTTP partagé de l'application
(`src/shared/lib/http.ts`, basé sur `ofetch` avec sa propre `baseURL`),
et ne peut pas être aisément enrichie (intercepteurs, auth, retry,
gestion d'erreur typée telle que définie dans l'ADR 001) sans modifier du
code marqué `Do not edit manually.` et régénéré à chaque `pnpm
generate:api`.

## Décision
Seuls les **types** générés par Orval (`Product` et les futurs schémas de
domaine/erreur) sont importés dans le code applicatif. Les **fonctions
client générées** (`getProducts`, et toute fonction future du dossier
`generated/**/*.ts` hors `models/`) ne sont **jamais** appelées ni
importées en dehors du dossier généré lui-même.

À la place, chaque appel réseau est défini à la main dans
`src/features/<feature>/api/<feature>.api.ts`, en s'appuyant sur le
client HTTP partagé (`httpClient`, wrapper `ofetch`) et en typant
l'entrée/sortie avec les types générés :

```ts
// src/features/products/api/products.api.ts
import type { Product } from '@/shared/api/generated/models'
import { httpClient } from '@/shared/lib/http'

export function getProducts(): Promise<Product[]> {
  return httpClient<Product[]>('/products')
}
```

## Conséquences

**Positives**
- Le contrat OpenAPI reste la **source de vérité pour la forme des
  données** (via les types), sans imposer sa manière de faire des
  requêtes réseau.
- Un seul client HTTP (`httpClient`) centralise `baseURL`, en-têtes,
  gestion d'erreurs et éventuels intercepteurs — cohérent avec la
  décision de l'ADR 001 sur la gestion des erreurs non typées.
- Régénérer le contrat (`pnpm generate:api`) ne casse jamais le code
  applicatif de façon silencieuse : si un type change, le compilateur
  TypeScript signale immédiatement les appels impactés, sans que la
  signature des fonctions générées (qui, elle, peut changer de forme
  d'enveloppe) n'entre en jeu.
- Le retour des fonctions API maison est une donnée "nue" (`Product[]`),
  directement consommable par les composables TanStack Query, sans étape
  de mapping `response.data` répétée partout.

**Négatives**
- Duplication apparente : chaque endpoint nécessite une petite fonction
  écrite à la main en plus du code généré (qui reste inutilisé à
  l'exécution, mais toujours généré pour les types).
- Nécessite une règle d'équipe explicite et une vigilance en revue de
  code, car rien n'empêche techniquement d'importer
  `generated/products/products.ts` par erreur — seule la convention (et
  éventuellement une règle de lint sur les chemins d'import) le garantit.

## Exemple
```text
❌ Interdit
import { getProducts } from '@/shared/api/generated/products/products'
const { data } = await getProducts() // fuite de l'enveloppe {data, status, headers}

✅ Autorisé
import type { Product } from '@/shared/api/generated/models'
import { httpClient } from '@/shared/lib/http'

export function getProducts(): Promise<Product[]> {
  return httpClient<Product[]>('/products')
}
```
