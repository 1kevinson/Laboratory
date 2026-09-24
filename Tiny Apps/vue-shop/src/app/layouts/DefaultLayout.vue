<script setup lang="ts"></script>

<template>
  <div class="l-page-grid">
    <!-- Lien d'évitement clavier conforme au critère WCAG 2.4.1. -->
    <a class="l-skip-link u-visually-hidden-focusable" href="#main-content">
      Aller au contenu principal
    </a>

    <the-header class="l-page-grid__header" />

    <!-- `tabindex="-1"` déplace aussi le focus vers la cible du saut. -->
    <main id="main-content" class="l-page-grid__content" tabindex="-1">
      <slot />
    </main>

    <the-footer class="l-page-grid__footer" />
  </div>
</template>

<style lang="scss" scoped>
// Positionnement propre au layout; l'utilitaire gère la visibilité au focus.
.l-skip-link {
  position: absolute;
  top: $space-2;
  left: $space-2;
  z-index: $z-skip-link;
  padding: $space-2 $space-4;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background-color: $color-background;
  color: $color-text-primary;
  text-decoration: none;

  @include focus-ring;
}

.l-page-grid__content:focus {
  // Masque l'anneau de la cible focalisée uniquement par le lien d'évitement.
  outline: none;
}
</style>
