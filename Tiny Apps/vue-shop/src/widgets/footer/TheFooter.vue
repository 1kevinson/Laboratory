<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer class="w-footer">
    <div class="w-footer__inner l-container">
      <p class="w-footer__copy">&copy; {{ year }} Vue Shop</p>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.w-footer {
  border-top: 1px solid $color-border;
  background-color: $color-background-alt;

  &__inner {
    padding-block: $space-6;
  }

  &__copy {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
}
</style>
