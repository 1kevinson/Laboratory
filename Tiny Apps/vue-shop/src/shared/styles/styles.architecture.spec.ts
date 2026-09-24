// oxlint-disable vitest/valid-expect -- Vitest accepte un second argument
// `message` sur expect() ; oxlint ne connaît pas encore cette signature. Ces
// messages sont le cœur du fichier : ils expliquent au développeur quoi faire,
// pas seulement ce qui a cassé.

// @vitest-environment node
//
// Environnement `node` et non `jsdom` : ce test lit le système de fichiers et
// compile du Sass, il n'a aucun DOM à manipuler. Sous jsdom, `import.meta.url`
// vaut une URL http (voir environmentOptions dans vitest.config.ts) et
// `fileURLToPath` échoue.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass-embedded";
import { describe, expect, it } from "vitest";

/**
 * Test-garde de l'architecture CSS (voir ADR 008 et ADR 009).
 *
 * Ce fichier ne teste pas un rendu : il verrouille les règles d'architecture
 * qui, sans lui, ne tiennent que par la discipline. Chaque règle correspond à
 * une régression déjà rencontrée ou clairement anticipée, et le message
 * d'échec dit quoi faire — pas seulement ce qui a cassé.
 */

const STYLES_DIR = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SRC_DIR = join(PROJECT_ROOT, "src");

/** Couches injectées dans chaque SFC par `additionalData` (vite.config.ts). */
const INJECTED_LAYERS = ["1-settings", "2-tools"] as const;

/** Couches qui émettent du CSS : joignables uniquement via main.scss. */
const CSS_EMITTING_LAYERS = [
  "3-generic",
  "4-elements",
  "5-layouts",
  "6-themes",
  "7-utilities",
] as const;

function compile(scss: string): string {
  return sass.compileString(scss, { loadPaths: [PROJECT_ROOT], style: "compressed" }).css;
}

function layerDirs(): string[] {
  return readdirSync(STYLES_DIR)
    .filter((entry) => /^\d-/.test(entry))
    .filter((entry) => statSync(join(STYLES_DIR, entry)).isDirectory())
    .sort();
}

function partialsIn(layer: string): string[] {
  return readdirSync(join(STYLES_DIR, layer))
    .filter((file) => file.startsWith("_") && file.endsWith(".scss"))
    .filter((file) => file !== "_index.scss")
    .map((file) => file.slice(1, -".scss".length));
}

function walk(dir: string, match: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...walk(full, match));
    } else if (match(entry)) {
      out.push(full);
    }
  }
  return out;
}

const sfcFiles = walk(SRC_DIR, (file) => file.endsWith(".vue"));

// ─────────────────────────────────────────────────────────────────────────────

describe("invariant zéro-CSS des couches injectées", () => {
  // LA règle centrale. `additionalData` préfixe ces couches à chaque bloc
  // <style lang="scss">, et chaque bloc est une compilation Sass indépendante :
  // Sass ne peut donc pas dédupliquer entre eux. Tout CSS émis ici est recopié
  // une fois par composant stylé — silencieusement.
  it.each(INJECTED_LAYERS)("%s ne produit aucun octet de CSS", (layer) => {
    const css = compile(`@use "src/shared/styles/${layer}" as *;`);

    expect(
      css,
      `La couche ${layer} a émis du CSS alors qu'elle est injectée dans chaque ` +
        `bloc <style lang="scss"> par additionalData. Ce CSS sera dupliqué une ` +
        `fois par composant. Déplacer la règle vers 3-generic (reset, @font-face) ` +
        `ou vers la couche ITCSS correspondante. Voir ADR 008.`,
    ).toBe("");
  });
});

describe("étanchéité des couches", () => {
  it("aucun SFC n'importe une couche qui émet du CSS", () => {
    const offenders: string[] = [];

    for (const file of sfcFiles) {
      const source = readFileSync(file, "utf8");
      for (const layer of [...CSS_EMITTING_LAYERS, "main"]) {
        if (new RegExp(`@(use|import|forward)\\s+["'][^"']*${layer}["']`).test(source)) {
          offenders.push(`${relative(PROJECT_ROOT, file)} importe ${layer}`);
        }
      }
    }

    expect(
      offenders,
      `Ces composants importent une couche qui émet du CSS : son contenu sera ` +
        `dupliqué dans le bundle. Les tokens et mixins sont déjà disponibles ` +
        `partout via additionalData — aucun @use n'est nécessaire dans un SFC.`,
    ).toEqual([]);
  });

  it("aucun SFC ne réimporte manuellement une couche déjà injectée", () => {
    const offenders: string[] = [];

    for (const file of sfcFiles) {
      const source = readFileSync(file, "utf8");
      for (const layer of INJECTED_LAYERS) {
        if (new RegExp(`@use\\s+["'][^"']*${layer}["']`).test(source)) {
          offenders.push(`${relative(PROJECT_ROOT, file)} réimporte ${layer}`);
        }
      }
    }

    expect(
      offenders,
      `additionalData (vite.config.ts) injecte déjà ces couches en tête de ` +
        `chaque bloc <style lang="scss">. Un @use explicite est redondant.`,
    ).toEqual([]);
  });

  it("tout bloc <style> de SFC déclare lang=\"scss\"", () => {
    // Sans `lang="scss"`, additionalData ne s'applique pas : le bloc n'a accès
    // à aucun token, et un `$color-primary` y serait du CSS invalide silencieux.
    const offenders = sfcFiles
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /<style(?![^>]*lang=)/.test(source);
      })
      .map((file) => relative(PROJECT_ROOT, file));

    expect(
      offenders,
      `Un bloc <style> sans lang="scss" ne reçoit pas les tokens injectés par ` +
        `additionalData. Ajouter lang="scss", ou supprimer le bloc s'il est vide.`,
    ).toEqual([]);
  });
});

describe("complétude des couches", () => {
  it("chaque partiel est exposé par le _index.scss de sa couche", () => {
    const orphans: string[] = [];

    for (const layer of layerDirs()) {
      const index = readFileSync(join(STYLES_DIR, layer, "_index.scss"), "utf8");
      const body = readFileSync(join(STYLES_DIR, layer, "_index.scss"), "utf8");

      for (const partial of partialsIn(layer)) {
        const forwarded = new RegExp(`@forward\\s+["']${partial}["']`).test(index);
        // Un partiel non `@forward`é reste légitime s'il est consommé en interne
        // par un autre partiel de la même couche (ex. 6-themes/_emit.scss).
        const usedInternally = readdirSync(join(STYLES_DIR, layer))
          .filter((file) => file.endsWith(".scss") && file !== "_index.scss")
          .some((file) =>
            new RegExp(`@use\\s+["']${partial}["']`).test(
              readFileSync(join(STYLES_DIR, layer, file), "utf8"),
            ),
          );

        if (!forwarded && !usedInternally && body) {
          orphans.push(`${layer}/_${partial}.scss`);
        }
      }
    }

    expect(
      orphans,
      `Ces partiels ne sont ni @forward'és par le _index.scss de leur couche, ` +
        `ni @use'és par un autre partiel de la même couche : ils sont morts et ` +
        `ne produisent rien.`,
    ).toEqual([]);
  });

  it("main.scss expose toutes les couches, dans l'ordre ITCSS", () => {
    const main = readFileSync(join(STYLES_DIR, "main.scss"), "utf8");
    const forwarded = [...main.matchAll(/@forward\s+["']([^"']+)["']/g)].map((m) => m[1]);

    expect(
      forwarded,
      `L'ordre des @forward de main.scss EST l'ordre de la cascade. Une ` +
        `nouvelle couche s'insère à sa position ITCSS, jamais à la fin.`,
    ).toEqual(layerDirs());
  });
});

describe("theming", () => {
  it("les thèmes clair et sombre définissent exactement les mêmes tokens", () => {
    // Un token présent dans un seul thème produit une couleur `unset` sur
    // l'autre, qui retombe en `initial` — texte noir sur fond noir.
    const extract = (selectorCss: string) =>
      [...selectorCss.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]).sort();

    const css = compile(`@use "src/shared/styles/6-themes" as *;`);
    const blocks = css.split("}").filter((block) => block.includes("--color-"));

    expect(blocks.length).toBeGreaterThanOrEqual(3); // :root, @media, [data-theme]

    const [reference, ...others] = blocks.map(extract);
    for (const tokens of others) {
      expect(tokens).toEqual(reference);
    }
  });

  it("le thème sombre respecte un choix explicite de thème clair", () => {
    // Sans `:not([data-theme="light"])`, un utilisateur dont l'OS est en sombre
    // ne peut pas forcer le thème clair depuis l'application.
    const css = compile(`@use "src/shared/styles/6-themes" as *;`);

    expect(css).toMatch(/prefers-color-scheme:\s*dark/);
    expect(css).toMatch(/:root:not\(\[data-theme=["']?light["']?\]\)/);

    // Et le choix explicite « sombre » doit exister hors media query, sinon la
    // bascule ne fonctionne pas pour un utilisateur dont l'OS est en clair.
    expect(css).toMatch(/:root\[data-theme=["']?dark["']?\]/);
  });
});

describe("polices", () => {
  it("chaque @font-face n'est émis qu'une fois dans le CSS global", () => {
    const css = compile(`@use "src/shared/styles/main" as *;`);
    const faces = css.match(/@font-face/g) ?? [];

    // 2 graisses Wotfard + 2 graisses de la police de repli remétriquée.
    expect(faces).toHaveLength(4);
  });

  it("les chemins des fichiers de police pointent vers des fichiers existants", () => {
    // Un url() erroné est silencieux : la police ne charge pas, le repli prend
    // le relais, et personne ne s'en aperçoit avant la revue de design.
    const fonts = readFileSync(join(STYLES_DIR, "3-generic", "_fonts.scss"), "utf8");
    const urls = [...fonts.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!);

    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      const resolved = join(STYLES_DIR, "3-generic", url);
      expect(() => statSync(resolved), `Fichier de police introuvable : ${url}`).not.toThrow();
    }
  });
});
