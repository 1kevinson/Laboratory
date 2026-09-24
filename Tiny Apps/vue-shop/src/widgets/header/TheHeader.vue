<script setup lang="ts"></script>

<template>
  <header class="w-header">
    <div class="w-header__inner l-container">
      <RouterLink to="/products" class="w-header__brand">Vue Shop</RouterLink>

      <nav class="w-header__nav" aria-label="Navigation principale">
        <RouterLink to="/products">Produits</RouterLink>
      </nav>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.w-header {
  border-bottom: 1px solid $color-border;
  background-color: $color-background;

  &__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-6;
    padding-block: $space-4;
  }

  &__brand {
    color: $color-text-primary;
    font-size: $font-size-lg;
    font-weight: $font-weight-medium;
    text-decoration: none;
  }

  &__nav {
    display: flex;
    gap: $space-4;
  }
}
</style>
