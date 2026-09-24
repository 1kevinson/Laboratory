# ADR 008 — Architecture CSS (7-1 + ITCSS) et déduplication via `additionalData`

## Statut
🟢 Acceptée

## Contexte

Le projet mélange trois mécanismes qui, pris isolément, sont simples, mais dont
la combinaison produit un piège non évident :

1. **Une arborescence SCSS en couches** (7-1 revisité, ordonné selon ITCSS)
   dans `src/shared/styles/`.
2. **Les `<style lang="scss" scoped>` des composants Vue (SFC)**, colocalisés
   avec les composants dans les slices `app/`, `features/`, `widgets/`.
3. **`css.preprocessorOptions.scss.additionalData`** dans
   [vite.config.ts](../../vite.config.ts), qui injecte automatiquement les
   variables et mixins en tête de **chaque** bloc `<style lang="scss">`.

Le piège : Sass ne déduplique **pas** entre ces deux mondes. Le mécanisme de
déduplication de `@use` fonctionne à l'échelle d'une compilation, or chaque
bloc `<style>` de SFC est une compilation séparée. Toute règle CSS placée
dans une couche injectée par `additionalData` est donc **recopiée dans le
bundle autant de fois qu'il y a de blocs `<style lang="scss">` non vides**.

C'est exactement le bug qui a été découvert avec les `@font-face` de Wotfard :
placés dans `1-settings/_typography.scss`, ils étaient émis **4 fois** dans
le CSS de production.

Cet ADR fixe l'architecture et, surtout, **l'invariant qui rend
`additionalData` sûr**.

---

## Décision

### 1. La cartographie des couches

Le dossier `src/shared/styles/` suit la **nomenclature 7-1** (un dossier par
responsabilité, un point d'entrée `main.scss`) mais l'**ordre est celui
d'ITCSS** : spécificité et portée croissantes, du plus générique au plus
spécifique. Les dossiers sont préfixés d'un numéro pour que l'ordre soit
lisible dans l'IDE et impossible à intervertir par erreur.

```
src/shared/
├── fonts/                          ← binaires (woff2/ttf), hors pipeline SCSS
│   └── wotfard/{light,regular}/
│
└── styles/
    │
    │   ┌─────────────── N'ÉMET AUCUN CSS ─── injectable partout ───┐
    │
    ├── 1-settings/     ITCSS: Settings   Tokens : variables + maps
    │   ├── _breakpoints.scss       $breakpoints (map), $breakpoint-base
    │   ├── _colors.scss            primitives + $theme-light/$theme-dark
    │   │                           + tokens sémantiques var(--color-*)
    │   ├── _motion.scss            $duration-*, $easing-*
    │   ├── _radius.scss            $radius-*
    │   ├── _spacing.scss           $space-4, $spacing (map)
    │   ├── _typography.scss        familles, graisses, échelle, clamp() fluide
    │   └── _z-index.scss           $z-sticky, $z-modal… échelle de plans
    │
    ├── 2-tools/        ITCSS: Tools      Mixins et fonctions
    │   ├── _functions.scss         rem(), em(), token(), space(), z()…
    │   ├── _mixins.scss            visually-hidden, focus-ring, motion-safe,
    │   │                           truncate, line-clamp, aspect-ratio…
    │   ├── _breakpoint-mobile-first.scss   from(), between()   ← défaut
    │   └── _breakpoint-web-first.scss      until()
    │
    │   └───────────────────────────────────────────────────────────┘
    │
    │   ┌────────────── ÉMET DU CSS ─── UNE SEULE entrée : main.scss ─┐
    │
    ├── 3-generic/      ITCSS: Generic    Reset + @font-face
    │   ├── _fonts.scss             @font-face Wotfard 300/400
    │   │                           + « Wotfard Fallback » remétriquée (CLS)
    │   └── _reset.scss             box-sizing, body, prefers-reduced-motion
    │
    ├── 4-elements/     ITCSS: Elements   Sélecteurs de balises nues
    │   ├── _headings.scss          h1…h6
    │   ├── _links.scss             a
    │   ├── _forms.scss             button, input, select, textarea
    │   ├── _media.scss             img, svg, video
    │   └── _typography.scss        p, ul, ol, blockquote, code, hr
    │
    ├── 5-layouts/      ITCSS: Objects    Structure, zéro couleur
    │   └── _grid.scss              .l-page-grid, .l-container
    │
    ├── 6-themes/       ITCSS: Themes     DÉFINIT les --color-*
    │   ├── _emit.scss              mixin interne : map -> custom properties
    │   ├── _light.scss             :root                       (socle)
    │   └── _dark.scss              @media + [data-theme="dark"]
    │
    └── 7-utilities/    ITCSS: Trumps     Dernier mot dans la cascade
        └── _accessibility.scss     .u-visually-hidden, .u-skip-link
    │
    │   └───────────────────────────────────────────────────────────┘
```

**La couche `components/` du 7-1 n'existe pas en tant que dossier.** Elle est
remplacée par les `<style scoped>` des SFC, colocalisés avec leurs composants
selon le découpage FSD (`app/`, `features/`, `widgets/`, `shared/ui/`). C'est
précisément ce choix qui rend `additionalData` nécessaire : les styles de
composants vivent hors de `main.scss` et n'ont donc aucun moyen « naturel »
d'accéder aux tokens.

Dans la cascade, ces styles de composants s'intercalent **entre `6-themes` et
`7-utilities`** : plus spécifiques que les objets et les thèmes (sélecteur de
classe + attribut `[data-v-hash]`), mais toujours surchargeables par une
utilitaire — ce qui est le rôle même de la couche Trumps.

Le triangle ITCSS, appliqué au projet :

```
              spécificité / portée
        ▲
        │      ┌───────────────────────────────────────┐
     la │      │ 1-settings   (aucun sélecteur)        │ ┐ zéro CSS
  base  │      ├───────────────────────────────────────┤ │ injectées dans
   est  │      │ 2-tools      (aucun sélecteur)        │ ┘ chaque SFC
 large  │      ├───────────────────────────────────────┤
   et   │    ┌─┤ 3-generic    *, html, body            │
générique    │ ├───────────────────────────────────────┤
        │    │ │ 4-elements   h1, a, p, button         │
        │    └─┤───────────────────────────────────────┤
        │      │ 5-layouts    .l-page-grid             │
        │      ├───────────────────────────────────────┤
        │      │ 6-themes     :root, [data-theme]      │
        │      ├───────────────────────────────────────┤
        │      │ SFC scoped   .w-header[data-v-…]      │ ← hors main.scss
        │      ├───────────────────────────────────────┤
        │      │ 7-utilities  .u-visually-hidden       │ ← le dernier mot
        ▼      └───────────────────────────────────────┘
             le sommet est étroit et spécifique
```

L'ordre des `@forward` dans [main.scss](../../src/shared/styles/main.scss)
**est** l'ordre de la cascade. Le renuméroter revient à changer le CSS produit.

---

### 2. Les deux pipelines de compilation

Il existe **deux chemins distincts** qui mènent du SCSS au CSS du navigateur.
Comprendre qu'ils sont indépendants est la clé de tout le reste.

```
 PIPELINE A — le CSS global                    PIPELINE B — le CSS de composant
 (une seule fois par build)                    (une fois PAR bloc <style>)

 src/main.ts                                   TheHeader.vue
   │                                             │
   │ import "@/shared/styles/main.scss"          │ <style lang="scss" scoped>
   ▼                                             ▼
 main.scss                                     ┌───────────────────────────────┐
   @forward "1-settings"   ← 0 CSS             │ vite.config.ts                │
   @forward "2-tools"      ← 0 CSS             │ additionalData PRÉFIXE :      │
   @forward "3-generic"    ← CSS               │   @use "…/1-settings" as *;   │
   @forward "4-elements"   ← CSS               │   @use "…/2-tools"    as *;   │
   @forward "5-layouts"    ← CSS               └──────────────┬────────────────┘
   @forward "6-themes"     ← CSS                              │
   │                                                          ▼
   ▼                                              compilation Sass ISOLÉE
 1 compilation Sass                               (n° 2, 3, 4… une par bloc)
   │                                                          │
   ▼                                                          ▼
 dist/assets/index-*.css                        selecteurs réécrits [data-v-hash]
                                                              │
                                                              ▼
                                                dist/assets/*.css (chunk du composant)
```

Point critique : **le pipeline B ne connaît pas le pipeline A.** Il ne sait
pas que `main.scss` a déjà chargé `1-settings`. Il repart de zéro.

---

### 3. L'invariant central

> **Une couche injectée par `additionalData` doit produire zéro octet de CSS.**
> Concrètement : `1-settings` et `2-tools` ne contiennent que des `$variables`,
> des `@function`, des `@mixin` et des `@forward`. Jamais de sélecteur, jamais
> de `@font-face`, jamais de `@keyframes`, jamais de `:root { --x: … }`.

Pourquoi cet invariant suffit : `@use` en Sass est idempotent **au sein d'une
compilation**. Un module chargé deux fois dans la même compilation n'émet son
CSS qu'une fois. Mais `additionalData` crée *n* compilations indépendantes ;
l'idempotence ne franchit pas cette frontière. Si le module n'émet rien, le
nombre de compilations n'a plus aucune importance — d'où l'invariant.

Le corollaire : **les couches 3 à 6 ne doivent jamais être atteintes depuis un
SFC.** Leur unique porte d'entrée est `main.scss`, importé une seule fois dans
`main.ts`.

```
   AUTORISÉ                                 INTERDIT

   SFC ──@use──▶ 1-settings  (0 CSS)        SFC ──@use──▶ 3-generic  ✗
   SFC ──@use──▶ 2-tools     (0 CSS)        SFC ──@use──▶ 4-elements ✗
                                            SFC ──@use──▶ 5-layouts  ✗
   main.scss ──@forward──▶ 1 … 6            SFC ──@use──▶ 6-themes   ✗
                                            SFC ──@use──▶ main.scss  ✗✗✗
```

---

### 4. Démonstration mesurée

L'invariant n'est pas théorique. Une sonde a été ajoutée temporairement dans
chaque couche, puis `vite build` a été lancé et les occurrences comptées dans
`dist/assets/*.css`.

**Sonde placée dans `1-settings/_typography.scss`** (couche injectée) :

```scss
.__probe_settings { color: red; }
@font-face { font-family: "__Probe"; src: local("Arial"); }
```

Résultat dans le bundle :

```
dist/assets/index-*.css              .__probe_settings{color:red}
dist/assets/index-*.css              .__probe_settings[data-v-78ecf5bb]{color:red}   ← TheHeader
dist/assets/index-*.css              .__probe_settings[data-v-2adbaf60]{color:red}   ← TheFooter
dist/assets/ProductCatalogPage-*.css .__probe_settings[data-v-0982c6d6]{color:red}   ← la page

                                                          TOTAL : 4 copies
@font-face "__Probe"                                      TOTAL : 4 copies
```

**Sonde placée dans `3-generic/_reset.scss`** (couche non injectée) :

```
                                                          TOTAL : 1 copie
```

Le compte de 4 se dérive exactement :

```
  1  main.scss (importé par main.ts)
+ 3  blocs <style lang="scss"> NON VIDES :
       widgets/header/TheHeader.vue
       widgets/footer/TheFooter.vue
       features/products/pages/ProductCatalogPage.vue
─────
  4  compilations Sass → 4 copies du CSS de 1-settings
```

Six SFC déclarent `<style lang="scss">`, mais trois sont vides
(`DefaultLayout`, `ProductGrid`, `ProductCard`) : Vue ne lance pas le
préprocesseur sur un bloc vide, `additionalData` n'est donc pas appliqué.
**Ce compte grandit avec le projet** : chaque nouveau composant stylé ajoute
une copie. C'est un coût qui croît linéairement et silencieusement.

Noter aussi que les copies issues des SFC sont **scopées** —
`.__probe_settings[data-v-78ecf5bb]`. Une règle globale échappée dans
`1-settings` n'est donc pas seulement dupliquée, elle est aussi *mutilée* :
elle ne s'applique plus qu'à un composant. Un `@font-face`, en revanche, est
une at-rule : le scoping ne l'altère pas, il la recopie telle quelle — la
duplication est alors totalement invisible à l'œil nu, seul le poids du
bundle augmente.

---

### 5. Le cas `@font-face` (la décision qui a motivé cet ADR)

État initial — les deux `@font-face` Wotfard étaient déclarés dans
`1-settings/_typography.scss`, à côté de `$font-family-base`. Regroupement
intuitif (« tout ce qui concerne la typo au même endroit ») mais qui viole
l'invariant, avec trois symptômes :

1. **4 copies** des `@font-face` dans le CSS de production.
2. **Chemins `url()` cassés** : `../fonts/…` depuis `1-settings/` pointe vers
   `styles/fonts/`, qui n'existe pas ; les fontes réelles sont dans
   `shared/fonts/`. La variante *light* avait même perdu son `../`.
3. **Aucune règle globale** `font-family` : seuls `p`, `h1…h6` et les champs
   de formulaire recevaient la police. Le reste du DOM (`div`, `span`, `td`,
   `a`, `li`, `button`…) retombait sur la police par défaut du navigateur.

Décision retenue :

```
  AVANT                                   APRÈS

  1-settings/_typography.scss             1-settings/_typography.scss
    @font-face wotfardregular  ✗            $font-family-base   ← tokens seuls
    @font-face wotfardlight    ✗            $font-weight-light: 300
    $font-family-base                       $font-weight-regular: 400
                                            …
                                          3-generic/_fonts.scss   (nouveau)
                                            @font-face Wotfard 300
                                            @font-face Wotfard 400
                                            url("../../fonts/…")  ← corrigé

                                          3-generic/_reset.scss
                                            body { font-family: $font-family-base }
```

Deux choix secondaires actés au passage :

- **Une seule famille `"Wotfard"`, deux graisses** (`300` / `400`), plutôt que
  deux familles `wotfardlight` / `wotfardregular`. On écrit
  `font-weight: $font-weight-light` et le navigateur choisit le bon fichier ;
  la graisse redevient un axe typographique et non un nom de famille.
- **Abandon des `.eot`** (Internet Explorer). `woff2` couvre tous les
  navigateurs cibles, `ttf` sert de repli.

Vérification post-changement sur `vite build` : les `@font-face` sont dans
`index-*.css` et **0** dans le CSS des composants, avec les 4 fichiers de
fonte (2 woff2 + 2 ttf) correctement émis et hashés dans `dist/assets/`.

> **Mise à jour.** `3-generic/_fonts.scss` compte désormais **4**
> `@font-face` : les 2 graisses de Wotfard, plus 2 graisses d'une police
> système remétriquée (« Wotfard Fallback ») qui supprime le décalage de mise
> en page au moment du swap. Le détail du calcul des métriques est dans
> l'ADR 009. Le compte exact est verrouillé par le test-garde.

---

### 6. Règles opérationnelles

**Où placer une nouvelle déclaration ?**

```
     Est-ce que ça produit du CSS ?
                  │
        ┌─────────┴──────────┐
       NON                  OUI
        │                    │
        ▼                    ▼
  1-settings          Quel niveau de spécificité / portée ?
  ou 2-tools                 │
        ┌──────────┬─────────┼──────────┬───────────┬──────────┐
        ▼          ▼         ▼          ▼           ▼          ▼
    reset,      balise    classe    couleur     propre à   override
  @font-face     nue    structurelle de thème  UN composant  absolu
        │          │         │          │           │          │
        ▼          ▼         ▼          ▼           ▼          ▼
   3-generic  4-elements 5-layouts  6-themes   <style scoped> 7-utilities
                                                  du SFC
```

**Checklist de revue** — la plupart de ces points sont désormais vérifiés
automatiquement par
[styles.architecture.spec.ts](../../src/shared/styles/styles.architecture.spec.ts) ;
ils restent listés ici parce qu'un test dit *qu'*une règle est violée, pas
*pourquoi* elle existe.

- [ ] Rien dans `1-settings` / `2-tools` ne génère de sélecteur ni d'at-rule. ✅ *testé*
- [ ] Aucun SFC ne fait `@use` d'une couche 3 à 7, ni de `main.scss`. ✅ *testé*
- [ ] Aucun SFC ne redéclare `@use "…/1-settings"` : `additionalData` le fait
      déjà, et un doublon explicite signale une incompréhension du mécanisme. ✅ *testé*
- [ ] Tout bloc `<style>` de SFC déclare `lang="scss"`. ✅ *testé*
- [ ] Un nouveau partiel est ajouté au `_index.scss` de sa couche. ✅ *testé*
- [ ] Une nouvelle couche est ajoutée à `main.scss` **à sa position ITCSS**. ✅ *testé*
- [ ] Aucune valeur brute là où un token existe (`1.25rem` au lieu de
      `$font-size-lg`, `#eee` au lieu de `$color-border`, `z-index: 9999`).
      ⚠️ *non testé — c'est le travail de la revue humaine*
- [ ] Une animation ajoutée est enveloppée dans `@include motion-safe`.
      ⚠️ *non testé*

**Comment vérifier soi-même en cas de doute** — la sonde reste le moyen le
plus direct de se convaincre du mécanisme :

```bash
echo '.__probe { color: red; }' >> src/shared/styles/<couche>/_<fichier>.scss
npx vite build
cat dist/assets/*.css | grep -o '__probe' | wc -l   # doit valoir 1
# puis retirer la sonde
```

Le raccourci en une commande, qui n'écrit rien sur le disque :

```bash
npx vitest run src/shared/styles/styles.architecture.spec.ts
```

---

## Conséquences

**Positives**

- Les tokens sont accessibles dans tous les SFC sans une seule ligne
  d'`@use` manuelle — aucun import répétitif à maintenir, et renommer un
  chemin de couche ne touche qu'un fichier, `vite.config.ts`.
- La cascade est déterministe et lisible : l'ordre des `@forward` de
  `main.scss` est l'ordre de la feuille de style finale.
- Le CSS global est émis exactement une fois. Le coût de `additionalData`
  est nul en sortie tant que l'invariant tient.
- La distinction 7-1/ITCSS est matérialisée dans le nom des dossiers : un
  contributeur qui hésite entre deux emplacements a la réponse dans
  l'arborescence.

- **L'invariant est vérifié automatiquement**, plus seulement documenté :
  `styles.architecture.spec.ts` compile chaque couche injectée et échoue si
  elle émet un seul octet de CSS, avec un message qui indique où déplacer la
  règle. La régression, auparavant silencieuse, est désormais bloquante.

**Négatives**

- `additionalData` reste de la **magie invisible** : un SFC utilise
  `$color-primary` sans aucun import visible. Un nouveau contributeur ne peut
  pas déduire d'où vient le symbole en lisant le fichier — seule la lecture
  de `vite.config.ts` le révèle. C'est le prix assumé de la suppression des
  imports répétitifs ; le test-garde et cet ADR sont la contrepartie.
- Le préfixe est réévalué à chaque bloc `<style>`, donc **le coût est au
  temps de compilation**, pas au runtime. Négligeable aujourd'hui (~180 ms de
  build), mais il croît linéairement avec le nombre de composants stylés.
- **La couche 7 impose `!important`.** Un `<style scoped>` Vue compile en
  `.c-badge[data-v-8f]`, de spécificité (0,2,0), qui bat une utilitaire
  `.u-visually-hidden` (0,1,0) quel que soit l'ordre des feuilles. Les
  utilitaires portent donc `!important` — convention ITCSS pour la couche
  Trumps, mais qui les rend non surchargeables. D'où la règle d'admission
  stricte de cette couche.
- **Les tokens sémantiques ne sont plus manipulables par Sass.**
  `$color-text-primary` vaut `var(--color-text-primary)`, une chaîne opaque
  pour `mix()` ou `scale-color()`. Pour un calcul de couleur, il faut passer
  par la primitive (`palette("dark")`), qui elle ne suit pas le thème. Voir
  ADR 009.

**Dette connue, non traitée par cet ADR**

- Seules les graisses *light* (300) et *regular* (400) de Wotfard sont
  présentes dans `src/shared/fonts/`. `$font-weight-heading` vaut `700` :
  le gras des titres est donc **synthétisé** par le navigateur à partir du
  regular — rendu correct mais moins net qu'un vrai fichier gras. Le jour où
  les fichiers medium/bold arrivent, il n'y a qu'à ajouter deux `@font-face`
  dans `3-generic/_fonts.scss`, aucune autre ligne à toucher.
- Aucune vérification automatique du **contraste** des paires de couleurs des
  thèmes (WCAG 1.4.3). Les valeurs du thème sombre ont été choisies à vue.
- Le lint CSS s'arrête à l'architecture : rien n'empêche encore une valeur
  brute (`#eee`, `1.25rem`) là où un token existe. Un Stylelint avec
  `declaration-property-value-allowed-list` comblerait ce trou, au prix d'une
  dépendance supplémentaire.

---

## Références

- [main.scss](../../src/shared/styles/main.scss) — l'ordre de la cascade
- [vite.config.ts](../../vite.config.ts) — la configuration `additionalData`
- [styles.architecture.spec.ts](../../src/shared/styles/styles.architecture.spec.ts) — le test-garde
- [3-generic/_fonts.scss](../../src/shared/styles/3-generic/_fonts.scss) — les `@font-face`
- ADR 009 — theming par custom properties, breakpoints et performance de rendu
- ITCSS, Harry Roberts — *Managing CSS Projects with ITCSS*
- [Sass — `@use` et la déduplication de modules](https://sass-lang.com/documentation/at-rules/use/)
