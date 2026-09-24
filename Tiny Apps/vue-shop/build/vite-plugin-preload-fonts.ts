import type { Plugin, ResolvedConfig } from "vite";

/**
 * Injecte un `<link rel="preload">` dans index.html pour les polices choisies.
 *
 * POURQUOI. Une police déclarée en `@font-face` n'est découverte par le
 * navigateur qu'après avoir téléchargé PUIS analysé la feuille de style, et
 * seulement si un élément la réclame. La chaîne critique est donc :
 *
 *     index.html ──▶ index.css ──▶ wotfard.woff2
 *     └──────── 3 allers-retours réseau avant le premier texte définitif ─────┘
 *
 * Le preload court-circuite l'étape du milieu : le navigateur lance le
 * téléchargement de la police dès l'analyse du HTML, en parallèle du CSS.
 *
 *     index.html ─┬─▶ index.css
 *                 └─▶ wotfard.woff2        (en parallèle)
 *
 * POURQUOI UN PLUGIN plutôt qu'une balise écrite à la main dans index.html.
 * Vite hache le nom des fichiers émis (`wotfard-regular-DgN0Dp6h.woff2`) pour
 * la mise en cache longue durée. Un chemin codé en dur pointerait vers un
 * fichier inexistant dès le build suivant — et un preload qui échoue est
 * silencieux, donc jamais détecté.
 *
 * POURQUOI PAS TOUTES LES POLICES. Une ressource préchargée mais non utilisée
 * dans les premières secondes est une régression nette : elle consomme de la
 * bande passante en concurrence de l'image LCP, et Chrome émet un
 * avertissement en console. On ne précharge donc que la graisse réellement
 * appliquée au corps du document (`400`), pas la variante light.
 */
export function preloadFonts(options: { include?: RegExp } = {}): Plugin {
  const include = options.include ?? /regular.*\.woff2$/;
  let config: ResolvedConfig;

  return {
    name: "vue-shop:preload-fonts",
    apply: "build",

    configResolved(resolved) {
      config = resolved;
    },

    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        // `ctx.bundle` n'existe qu'en build : en dev, les polices sont servies
        // directement et le preload n'apporte rien.
        if (!ctx.bundle) return;

        const base = config.base.endsWith("/") ? config.base : `${config.base}/`;

        return Object.keys(ctx.bundle)
          .filter((fileName) => include.test(fileName))
          .map((fileName) => ({
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              href: `${base}${fileName}`,
              // Obligatoire : les polices sont toujours récupérées en mode CORS.
              // Sans cet attribut, le navigateur télécharge le fichier DEUX
              // fois — une pour le preload, une pour le @font-face.
              crossorigin: "",
            },
            injectTo: "head-prepend" as const,
          }));
      },
    },
  };
}
