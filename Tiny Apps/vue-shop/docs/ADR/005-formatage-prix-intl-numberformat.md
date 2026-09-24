# ADR 005 — Formatage de prix via `Intl.NumberFormat`

## Statut
🟢 Acceptée

## Contexte
Chaque produit possède un prix numérique brut (`Product.price: number`,
généré depuis le contrat OpenAPI). Ce nombre doit être affiché à
l'utilisateur sous une forme monétaire lisible (`$45.00`), avec les
règles de formatage propres à une devise : séparateur décimal, nombre de
décimales, symbole, position du symbole.

Ces règles varient selon la devise et la locale et sont facilement
sources de bugs si elles sont réimplémentées à la main (ex. concaténation
de chaînes du type `` `$${price.toFixed(2)}` ``), qui ne gère ni les
séparateurs de milliers, ni les devises sans décimales (JPY), ni
l'internationalisation.

## Décision
Le formatage des prix utilise l'API native du navigateur
`Intl.NumberFormat`, sans dépendance externe (pas de librairie du type
`accounting.js` ou `currency.js`). L'implémentation actuelle, dans
`ProductCard.vue`, est un `computed` dédié :

```ts
const formattedPrice = computed(() =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(props.product.price)
)
```

Le prix brut (`number`) ne doit **jamais** être affiché directement dans
un template ; il doit systématiquement transiter par un `computed`
formaté avec `Intl.NumberFormat` avant d'atteindre le DOM.

## Conséquences

**Positives**
- API native, disponible dans tous les environnements ciblés (navigateurs
  modernes + Node/Vitest/jsdom pour les tests) : aucun poids ajouté au
  bundle.
- Gestion correcte et éprouvée des règles de formatage monétaire
  (arrondis, décimales, séparateurs), sans code maison à maintenir ni à
  tester unitairement pour ses cas limites.
- Le résultat est déterministe et directement testable dans
  `ProductCard.spec.ts` (`expect(...).toBe('$45.00')`), sans dépendre
  d'un environnement système particulier tant que la locale et la devise
  sont fixées explicitement dans le code (et non déduites de
  l'environnement d'exécution).

**Négatives**
- La locale (`'en-US'`) et la devise (`'USD'`) sont actuellement codées
  en dur dans `ProductCard.vue`. Le jour où l'application doit gérer
  plusieurs devises ou plusieurs langues, ce formatage devra être
  extrait dans une fonction/composable partagé
  (`src/shared/lib/format-price.ts` par exemple) paramétré par la
  locale/devise courante, plutôt que dupliqué dans chaque composant qui
  affiche un prix.
- `Intl.NumberFormat` instancié dans un `computed` recrée l'objet à
  chaque changement de `product.price` ; c'est négligeable en pratique
  (composant simple, pas de liste de milliers d'instanciations par
  frame), mais à surveiller si le pattern est réutilisé dans une boucle
  de rendu très chaude.

## Exemple
```text
price (number) = 45
                 │
                 ▼
new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
                 │
                 ▼
        .format(45) = "$45.00"
                 │
                 ▼
   <div data-testid="product-card__price">$45.00</div>
```
