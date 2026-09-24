# ADR 001 — Périmètre du typage des erreurs dans le contrat OpenAPI

## Statut
🟢 Acceptée

## Contexte
Au fil de la construction du contrat OpenAPI, feature par feature, on a besoin
d'une règle cohérente pour décider quand une réponse d'erreur doit figurer
dans le contrat, et quand elle doit être gérée de façon générique côté client.

Sans règle, les contrats ont tendance à accumuler des cas d'erreur
spéculatifs ("au cas où") qui ne correspondent à aucune règle métier réelle,
ce qui alourdit le contrat et le rend plus difficile à maintenir.

## Décision
Une erreur est typée dans le contrat OpenAPI **uniquement lorsqu'elle
correspond à une règle métier identifiable** pour l'endpoint concerné —
par exemple : limite de stock, contrôle de permission, existence d'une
ressource, ou contrainte de validation liée au payload de la requête.

Les échecs techniques génériques (erreurs réseau, 500, timeout) ne sont
**pas** typés par endpoint. Ils sont gérés de façon uniforme côté client,
au niveau des composables, via un pattern `try/catch` partagé entre tous
les appels API.

## Conséquences

**Positives**
- Le contrat reste minimal et ne grandit que lorsqu'un écran ou un
  parcours utilisateur réel le justifie.
- Les types d'erreur du contrat sont porteurs de sens — chacun correspond
  à une décision UI que le front doit réellement prendre (ex. afficher
  "il n'en reste que 2" plutôt qu'un toast d'erreur générique).
- Moins de changements de contrat — les endpoints ne sont pas
  rétroactivement enrichis de schémas d'erreur spéculatifs qu'on finit
  par retirer.

**Négatives**
- Le code client doit tout de même implémenter une gestion défensive
  pour les échecs non typés (réseau, 500) — cette logique est dupliquée
  entre composables tant qu'elle n'est pas factorisée dans un wrapper
  HTTP partagé.
- Les contributeurs doivent penser activement à ajouter un schéma
  d'erreur quand une nouvelle règle métier apparaît, plutôt que d'avoir
  un réflexe systématique de "toujours tout typer".

## Exemple
```text
GET /api/products
→ pas d'authentification requise, pas de paramètre, pas de validation
→ aucune règle métier d'erreur n'existe encore
→ le contrat ne définit aucun schéma d'erreur pour cet endpoint

GET /api/products/{id}
→ un produit peut ne pas exister
→ le 404 est une vraie règle métier
→ le contrat DOIT définir un schéma d'erreur NotFound

POST /api/cart/items
→ le stock peut être insuffisant
→ le 409 est une vraie règle métier
→ le contrat DOIT définir un schéma d'erreur InsufficientStock
```