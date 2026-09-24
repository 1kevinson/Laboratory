# ADR 006 — Anatomie du test de composant `ProductCard` niveau Senior

## Statut
🟢 Acceptée

## Contexte
`ProductCard.vue` est un composant de présentation pur : il reçoit un
`product` en prop et affiche son nom, sa description, son image et son
prix formaté (cf. ADR 005). Un test "junior" de ce type de composant a
tendance à :
- tester les détails d'implémentation (classes CSS, structure du DOM,
  texte exact non lié à la donnée testée) ;
- construire un objet `Product` complet à la main dans chaque `it`,
  dupliquant des champs qui n'ont aucun rapport avec le comportement
  vérifié ;
- regrouper plusieurs assertions non liées dans un seul test, rendant
  l'échec difficile à diagnostiquer.

Le test réellement en place dans `ProductCard.spec.ts` évite ces pièges.

## Décision
Le test de `ProductCard` suit une anatomie à quatre couches, chacune avec
une responsabilité unique :

1. **Fixture** (`createProductFixture` dans `fixtures/product.fixture.ts`) :
   fournit un `Product` complet et valide par défaut, avec la
   possibilité de surcharger uniquement les champs pertinents pour le
   test (`Partial<Product>`). Aucun test ne construit un objet `Product`
   à la main.
2. **Helper de montage** (`mountProductCard`) : centralise l'appel à
   `mount(ProductCard, { props: { product } })`. Si la signature du
   composant change, un seul endroit est à corriger.
3. **Sélecteurs stables** (`data-testid`) : chaque assertion interroge le
   DOM via `[data-testid="product-card__xxx"]`, jamais via une classe CSS
   (`.c-product-card__name`) ni une structure DOM (`div > span:nth-child(2)`).
   Les `data-testid` forment un contrat explicite entre le template et le
   test, découplé du styling et du balisage.
4. **Un comportement par test** : chaque `it` vérifie une seule chose
   (le nom, le prix formaté, la description, l'image + son `alt`), en ne
   surchargeant que le champ nécessaire à ce comportement précis. Le nom
   du test décrit le comportement observable ("should display the
   formatted price"), pas l'implémentation.

```ts
function mountProductCard(productOverrides: Partial<Product> = {}) {
  return mount(ProductCard, {
    props: { product: createProductFixture(productOverrides) }
  })
}

it('should display the formatted price', () => {
  const wrapper = mountProductCard({ price: 45 })
  expect(wrapper.get('[data-testid="product-card__price"]').text()).toBe('$45.00')
})
```

## Conséquences

**Positives**
- Les tests sont robustes aux changements de style/markup (renommage de
  classes, changement de balise), et ne cassent que si le comportement
  observable par l'utilisateur change réellement.
- La fixture élimine le bruit : un test qui vérifie le prix n'a besoin de
  connaître que `price`, jamais `name`/`description`/`imageUrl`.
- Un test qui échoue pointe précisément vers un seul comportement cassé,
  sans nécessiter de désambiguïser plusieurs assertions groupées.
- Le pattern est réplicable tel quel pour tout futur composant de
  présentation (fixture dédiée + helper de montage + `data-testid` +
  un test par comportement).

**Négatives**
- Nécessite de maintenir une fixture à jour à chaque évolution du type
  `Product` (nouveau champ obligatoire → la fixture doit fournir une
  valeur par défaut sensée).
- Ajoute une convention (`data-testid`) à respecter systématiquement
  dans le template, y compris pour des éléments qui n'auraient pas
  forcément besoin d'un identifiant en dehors du contexte de test.

## Schéma ASCII

```text
┌───────────────────────────────────────────────────────────────────┐
│                        ProductCard.spec.ts                         │
│                                                                      │
│  ┌───────────────────────┐                                         │
│  │ createProductFixture() │  ← données par défaut + override ciblé │
│  └───────────┬────────────┘                                         │
│              │ Partial<Product>                                    │
│              ▼                                                     │
│  ┌───────────────────────┐                                         │
│  │  mountProductCard()    │  ← un seul point de montage             │
│  └───────────┬────────────┘                                         │
│              │ mount(ProductCard, { props: { product } })          │
│              ▼                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                     ProductCard.vue (DOM)                   │    │
│  │  [data-testid="product-card__name"]        → nom            │    │
│  │  [data-testid="product-card__description"] → description    │    │
│  │  [data-testid="product-card__price"]       → prix formaté    │    │
│  │  [data-testid="product-card__image"]       → src + alt       │    │
│  └───────────────────────────┬────────────────────────────────┘    │
│                              │ wrapper.get('[data-testid="..."]')  │
│                              ▼                                     │
│                  1 assertion == 1 comportement observable          │
└───────────────────────────────────────────────────────────────────┘
```
