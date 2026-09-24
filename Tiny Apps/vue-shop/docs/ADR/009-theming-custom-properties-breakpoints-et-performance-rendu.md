# ADR 009 — Theming par custom properties, stratégie de breakpoints et performance de rendu

## Statut
🟢 Acceptée

## Contexte

L'[ADR 008](./008-architecture-css-itcss-7-1-et-deduplication-additionaldata.md)
a posé les couches et l'invariant de déduplication, mais laissait quatre trous
explicitement documentés comme dette :

1. `6-themes/_light.scss` et `_dark.scss` étaient **vides** — aucune stratégie
   de theming tranchée.
2. `2-tools` était **inerte** : `_functions.scss` n'était pas exposé par
   `_index.scss`, et `_mixins.scss` ne contenait qu'un commentaire. L'injection
   `@use "…/2-tools"` n'apportait donc rien.
3. **Aucun système de points de rupture** — la moindre media query aurait été
   écrite à la main, avec ses valeurs en dur.
4. L'invariant zéro-CSS n'était **pas outillé** : rien n'empêchait de
   reproduire le bug des `@font-face` dupliqués.

S'y ajoutaient des défauts trouvés en traitant ces points : `<html lang="">`
(échec WCAG 3.1.1), aucune gestion de `prefers-reduced-motion`, aucun lien
d'évitement, et une chaîne de chargement des polices non optimisée.

Cet ADR tranche ces sujets d'un bloc, parce qu'ils sont liés : le theming
impose le choix custom properties, qui conditionne la forme des tokens, qui
conditionne ce que les mixins peuvent faire.

---

## Décision 1 — Theming par custom properties, tokens Sass en façade

### Le problème du theming en Sass pur

Les variables Sass sont résolues **à la compilation**. Un thème sombre écrit
avec des `$variables` impose donc de dupliquer chaque règle :

```scss
// ✗ Ce qu'on ne veut pas
.w-header { background: $color-white; }
[data-theme="dark"] .w-header { background: $color-black; }
// … puis la même chose pour CHAQUE règle colorée du projet
```

Le CSS double de volume, et chaque nouveau composant doit penser au thème.

### La solution retenue : deux niveaux, un seul point de définition

Les custom properties CSS, elles, sont résolues **à l'exécution** et héritent.
Une seule déclaration sur `:root` rebascule toute l'application.

```
1-settings/_colors.scss                      6-themes/_light.scss + _dark.scss
─────────────────────────                    ─────────────────────────────────

NIVEAU 1 — primitives                        :root {
  $color-dark-base: hsl(0,0%,16%)  ──┐         --color-text-primary: #292929;
  $color-light-light: hsl(0,0%,100%) │         --color-background:   #fff;
       (valeurs réelles,             │       }
        manipulables par Sass)       │
                                     │       @media (prefers-color-scheme:dark){
$theme-light: (                      │         :root:not([data-theme=light]) {
  "text-primary": $color-dark-base ──┤           --color-text-primary: #f5f5f5;
  "background": $color-light-light ──┘           --color-background:   #0a0a0a;
)                                              }
$theme-dark: ( … )                           }
       │
       └──── déroulé par @each ──────────────▶ (une ligne de map = un token)

NIVEAU 2 — tokens sémantiques                Le composant, lui, ne voit que ça
  $color-text-primary: var(--color-text-primary)
  $color-background:   var(--color-background)
```

**Le point clé : le composant n'a rien à changer.** Il écrit toujours
`color: $color-text-primary`, comme avant. Ce token n'est plus une couleur
mais un alias `var(--color-text-primary)`. Le thème bascule sans qu'une seule
ligne de SFC ne soit touchée.

### Les trois états, et pourquoi ce n'est pas deux

Un utilisateur peut être dans **trois** situations, pas deux :

```
  état                      marqueur sur <html>      règle qui l'emporte
  ───────────────────────────────────────────────────────────────────────
  « suivre le système »     (aucun attribut)         le bloc @media
    ← le défaut
  clair forcé               data-theme="light"       :root de _light.scss
  sombre forcé              data-theme="dark"        :root[data-theme=dark]
```

D'où la forme exacte du sélecteur dans `_dark.scss` :

```scss
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { … }   //  ← le :not() est indispensable
}

:root[data-theme="dark"] { … }
```

Sans le `:not([data-theme="light"])`, un utilisateur dont l'OS est en sombre et
qui choisit explicitement le thème clair dans l'application **resterait en
sombre**. La bascule ne marcherait que dans un sens. C'est le bug le plus
courant de ce pattern, et il ne se voit que sur une machine configurée en
sombre — donc rarement chez le développeur qui l'écrit.

Deux garde-fous complètent le dispositif :

- **`color-scheme: light | dark`** est posé en même temps que les tokens. Sans
  cette propriété, les barres de défilement, cases à cocher et menus déroulants
  natifs restent clairs sur une application sombre.
- **`<meta name="color-scheme" content="light dark">`** dans `index.html` : le
  navigateur connaît la teinte **avant** d'analyser le CSS, ce qui supprime
  l'éclair blanc au chargement d'une page en thème sombre.

### Conséquence à connaître

Un token sémantique n'est plus une couleur pour Sass, mais une chaîne opaque :

```scss
color.mix($color-text-primary, white, 50%)   // ✗ échoue : c'est "var(--…)"
color.mix(palette("dark"), white, 50%)       // ✓ passer par la primitive
```

C'est le compromis assumé : on perd les fonctions de couleur Sass sur les
tokens sémantiques, on gagne un theming à l'exécution sans duplication. Pour
les cas de calcul, `palette()` donne accès aux primitives — au prix de ne pas
suivre le thème. En pratique, `color-mix()` en CSS natif couvre le besoin et
fonctionne, lui, avec les custom properties.

---

## Décision 2 — Breakpoints : mobile first par défaut, web first par exception

Deux fichiers distincts, délibérément séparés, pour que le choix de stratégie
soit un acte conscient et visible dans le diff.

```
2-tools/_breakpoint-mobile-first.scss   →  @include from("md")      { … }
                                           @include between("sm","lg") { … }
2-tools/_breakpoint-web-first.scss      →  @include until("md")     { … }
```

**`from()` est le défaut du projet.** On écrit le style mobile hors media
query, puis on enrichit. Trois raisons : le style de base est le plus simple
donc le plus robuste ; un appareil bas de gamme n'évalue que le minimum ; et
en cas d'oubli, la dégradation se fait vers le mobile (utilisable) plutôt que
vers le desktop (cassé sur petit écran).

**`until()` est réservé à deux cas** : adapter un composant dont la maquette de
référence est desktop et dont la version mobile est une simplification (menu →
burger, tableau → liste), ou neutraliser un comportement purement desktop
(`position: sticky`, survol).

### Deux détails d'implémentation qui évitent des bugs réels

**Les media queries sont émises en `em`, pas en `px`.**

```scss
@include from("md")  →  @media (min-width: 48em)
```

Une media query en `px` ignore le réglage « taille de police » du navigateur :
un utilisateur qui agrandit le texte reste sur la mise en page mobile alors
que son viewport le mettrait en desktop. En `em`, les points de rupture
suivent ce réglage — critère WCAG 1.4.4. Les valeurs restent écrites en `px`
dans `1-settings/_breakpoints.scss` (c'est l'unité dans laquelle on raisonne) ;
la conversion est un détail des mixins.

**Le retrait de 0.02px sur les bornes hautes.**

```
from("md")   →  min-width: 48em
until("md")  →  max-width: 47.99875em      ← et non 48em
                              ▲
                        sans ce retrait, à exactement 768px les DEUX blocs
                        s'appliquent et c'est l'ordre de déclaration qui
                        tranche : bug invisible sur la plupart des écrans,
                        reproductible sur presque aucun
```

0.02px et non 1px : cela couvre les écrans à densité fractionnaire jusqu'à 5x
sans créer de bande morte entre les deux bornes.

Enfin, une clé de breakpoint inconnue **échoue à la compilation** avec la liste
des clés valides, au lieu de produire `min-width: null` — un `map.get` qui
renvoie `null` génère du CSS silencieusement cassé.

---

## Décision 3 — Performance de rendu : la chaîne des polices

Trois problèmes distincts se cumulaient sur le chargement de Wotfard.

### 3.1 — La police est découverte trop tard

Une police déclarée en `@font-face` n'est demandée qu'après téléchargement
**puis analyse** de la feuille de style :

```
  AVANT                                    APRÈS (preload)

  index.html                               index.html
      │                                        ├──────────────┐
      ▼                                        ▼              ▼
  index.css                                index.css     wotfard.woff2
      │                                                   (en parallèle)
      ▼
  wotfard.woff2
  └── 3 allers-retours avant le texte définitif ──┘
```

Le preload est injecté par un plugin Vite
([build/vite-plugin-preload-fonts.ts](../../build/vite-plugin-preload-fonts.ts))
et non écrit à la main, parce que Vite hache les noms de fichiers émis : un
chemin en dur pointerait vers un fichier inexistant dès le build suivant, et
**un preload qui échoue est silencieux**.

Deux choix dans ce plugin :

- **Une seule graisse préchargée** (la `400`, celle du corps du document). Une
  ressource préchargée mais non utilisée dans les premières secondes est une
  régression nette : elle entre en concurrence avec l'image LCP.
- **`crossorigin` obligatoire.** Les polices sont toujours récupérées en mode
  CORS ; sans cet attribut, le navigateur télécharge le fichier **deux fois**.

### 3.2 — Le swap fait sauter la mise en page

`font-display: swap` évite le texte invisible, mais crée un autre défaut : le
texte s'affiche d'abord en police système, puis bascule vers Wotfard. Les deux
n'ayant ni la même largeur de caractère ni les mêmes hauteurs de jambages, la
mise en page **saute** — du Cumulative Layout Shift, l'un des trois Core Web
Vitals.

La parade est une famille intermédiaire, `"Wotfard Fallback"`, qui pointe vers
une police **locale** (disponible à la première frame, aucun téléchargement) et
dont on force les métriques pour qu'elles correspondent exactement à Wotfard :

```
  font-family: "Wotfard", "Wotfard Fallback", system-ui, …
                  │             │
                  │             └── Arial remétriquée : occupe EXACTEMENT
                  │                 la même place que Wotfard
                  └── arrive ~200ms plus tard, le swap est invisible
```

Les valeurs ne sont pas devinées : elles sont calculées à partir des tables
`head`, `hhea` et `OS/2` des `.ttf` réels du projet.

```
  wotfard-regular.ttf   unitsPerEm 2048   hhea asc 2009 / desc -499 / gap 0
                        xAvgCharWidth 1129
                        fsSelection bit 7 = 0  → le navigateur lit hhea,
                                                 pas OS/2 sTypo
  arial                 unitsPerEm 2048   xAvgCharWidth 904

  size-adjust      = (1129/2048) / (904/2048)  = 124.89 %
  ascent-override  = (2009/2048) / 1.2489      =  78.55 %
  descent-override = ( 499/2048) / 1.2489      =  19.51 %
  line-gap-override= 0                          =   0.00 %
```

Wotfard est nettement plus large qu'Arial, d'où un `size-adjust` supérieur à
100 %. **Ces valeurs sont à recalculer si les fichiers de police changent** —
le script de mesure est reproductible :

```bash
node --input-type=module - <<'EOF'
import { readFileSync } from "node:fs";
const buf = readFileSync("src/shared/fonts/wotfard/regular/wotfard-regular-webfont.ttf");
const t = {};
for (let i = 0; i < buf.readUInt16BE(4); i++) {
  const o = 12 + i * 16;
  t[buf.toString("ascii", o, o + 4).trim()] = buf.readUInt32BE(o + 8);
}
const upm  = buf.readUInt16BE(t.head + 18);
const asc  = buf.readInt16BE(t.hhea + 4);
const desc = buf.readInt16BE(t.hhea + 6);
const avg  = buf.readInt16BE(t["OS/2"] + 2);
const sizeAdjust = (avg / upm) / (904 / 2048);          // 904/2048 = Arial
console.log("size-adjust     ", (sizeAdjust * 100).toFixed(2) + "%");
console.log("ascent-override ", ((asc / upm / sizeAdjust) * 100).toFixed(2) + "%");
console.log("descent-override", ((Math.abs(desc) / upm / sizeAdjust) * 100).toFixed(2) + "%");
EOF
```

### 3.3 — Les autres sources de décalage

- **`scrollbar-gutter: stable`** sur `html` : le contenu ne se décale plus
  latéralement entre une page courte et une page longue.
- **`img:not([width]):not([height])`** reçoit un `aspect-ratio` par défaut :
  une image sans dimension connue réserve une place nulle puis pousse tout le
  contenu vers le bas une fois chargée. C'est la première cause de CLS.
- **Tailles de titres fluides** en `clamp()` plutôt qu'en paliers de media
  queries : pas de saut de mise en page au redimensionnement, et une seule
  déclaration au lieu de trois. Le `1rem +` dans la partie centrale du
  `clamp()` est délibéré — un `clamp()` en `vw` pur bloque le zoom
  utilisateur (échec WCAG 1.4.4).

---

## Décision 4 — Accessibilité intégrée à la couche, pas ajoutée après

- **`<html lang="fr">`** — était `lang=""`, un échec WCAG 3.1.1 direct : les
  lecteurs d'écran ne savaient pas dans quelle langue prononcer le contenu.
- **Coupure globale de `prefers-reduced-motion`** dans le reset, doublée du
  mixin `motion-safe` pour les animations écrites à la main. La coupure globale
  utilise `0.01ms` et non `0s` : les évènements `transitionend` continuent
  ainsi de se déclencher, sinon un composant qui attend la fin d'une transition
  pour se démonter reste bloqué.
- **Lien d'évitement** dans le layout (WCAG 2.4.1), avec `tabindex="-1"` sur la
  cible — sans lui, le saut déplace le défilement mais pas le focus.
- **`focus-ring`** en mixin unique : `:focus-visible` (jamais au clic souris) et
  `outline` plutôt que `box-shadow`, qui seul survit au mode contraste élevé de
  Windows (`forced-colors`).
- **Échelle de `z-index` tokenisée** — un `z-index: 9999` écrit à la main est
  une dette immédiate : plus personne ne sait ensuite quelle valeur utiliser
  pour passer juste au-dessus.

---

## Décision 5 — L'architecture est testée, pas seulement documentée

[`styles.architecture.spec.ts`](../../src/shared/styles/styles.architecture.spec.ts)
transforme les règles de l'ADR 008 en assertions. **11 tests**, chacun
correspondant à une régression déjà rencontrée ou clairement anticipée :

| Ce qui est verrouillé | Ce que ça empêche |
|---|---|
| `1-settings` et `2-tools` compilent en 0 octet | le bug des `@font-face` dupliqués (ADR 008) |
| aucun SFC n'importe une couche 3→7 ni `main.scss` | duplication massive du CSS global |
| aucun SFC ne réimporte une couche déjà injectée | signal d'incompréhension du mécanisme |
| tout bloc `<style>` déclare `lang="scss"` | un SFC privé de tokens, silencieusement |
| chaque partiel est exposé ou consommé | un fichier mort qui ne produit rien |
| `main.scss` expose les couches dans l'ordre ITCSS | une cascade cassée par un ajout « à la fin » |
| clair et sombre définissent les **mêmes** tokens | un token `unset` → texte noir sur fond noir |
| le sombre respecte `data-theme="light"` | la bascule qui ne marche que dans un sens |
| exactement 4 `@font-face` dans le CSS global | le retour de la duplication |
| chaque `url()` de police existe sur le disque | une police qui ne charge pas, sans erreur |

Les messages d'échec disent **quoi faire**, pas seulement ce qui a cassé — un
test d'architecture est lu par quelqu'un qui, par définition, ne connaît pas la
règle qu'il vient de violer.

Le garde a été validé par injection de régression : une règle CSS ajoutée dans
`1-settings` fait bien échouer le test, avec le message attendu.

---

## Conséquences

**Positives**

- Le thème sombre est **complet et gratuit** pour les composants existants :
  aucun SFC n'a été modifié pour le supporter.
- Ajouter une couleur au design system coûte **deux lignes** (une par map de
  thème) et le test vérifie qu'on n'en a pas oublié une.
- `2-tools` est enfin utile : `rem()`, `em()`, les accesseurs de tokens à échec
  explicite, les mixins d'accessibilité et les deux stratégies de breakpoints
  sont disponibles dans tous les SFC sans import.
- La chaîne de chargement des polices est optimisée de bout en bout : preload
  parallèle, `swap` sans texte invisible, et métriques ajustées sans saut de
  mise en page.
- Les régressions d'architecture sont **bloquantes** et non plus silencieuses.

**Négatives**

- Les tokens sémantiques ne sont plus manipulables par les fonctions de couleur
  Sass (voir Décision 1). Contournement : `palette()` ou `color-mix()` CSS.
- Les métriques de la police de repli sont des **constantes calculées à la
  main** : elles ne sont pas revérifiées automatiquement si un fichier `.ttf`
  est remplacé. Le test vérifie que les fichiers existent, pas que les
  métriques correspondent encore.
- La couche 7 impose `!important` (voir ADR 008, Conséquences).
- Le nombre de tokens a nettement augmenté. Une partie (`$radius-*`,
  `$duration-*`, la moitié de l'échelle de `z-index`) n'est pas encore
  consommée : c'est un pari sur les besoins à venir, à réévaluer si ces tokens
  restent morts.

**Non traité**

- Pas de **sélecteur de thème** dans l'interface. L'infrastructure est prête —
  il suffit d'écrire `data-theme` sur `<html>` et de le persister — mais aucun
  composant ne le fait aujourd'hui. Seule la préférence système est suivie.
- Pas de vérification automatique des **ratios de contraste** des paires de
  couleurs (WCAG 1.4.3).
- Les graisses medium/bold de Wotfard restent absentes : le gras des titres est
  synthétisé par le navigateur.

---

## Références

- [1-settings/_colors.scss](../../src/shared/styles/1-settings/_colors.scss) — les deux niveaux de tokens
- [6-themes/](../../src/shared/styles/6-themes/) — la définition des custom properties
- [2-tools/_breakpoint-mobile-first.scss](../../src/shared/styles/2-tools/_breakpoint-mobile-first.scss) · [_breakpoint-web-first.scss](../../src/shared/styles/2-tools/_breakpoint-web-first.scss)
- [3-generic/_fonts.scss](../../src/shared/styles/3-generic/_fonts.scss) — métriques de la police de repli
- [build/vite-plugin-preload-fonts.ts](../../build/vite-plugin-preload-fonts.ts)
- [styles.architecture.spec.ts](../../src/shared/styles/styles.architecture.spec.ts)
- [ADR 008](./008-architecture-css-itcss-7-1-et-deduplication-additionaldata.md) — couches et invariant de déduplication
- [MDN — `size-adjust`, `ascent-override`, `descent-override`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)
- [web.dev — Cumulative Layout Shift](https://web.dev/articles/cls)
