<script setup lang="ts">
import { computed } from "vue";
import { useProducts } from "../composable/useProducts";

const { data, isPending, isError } = useProducts();

const hasProducts = computed(() => (data.value?.length ?? 0) > 0);
</script>

<template>
  <div class="c-product-grid">
    <div v-if="isPending" data-testid="loading-state">Loading...</div>
    <div v-else-if="isError" data-testid="error-state">Something went wrong</div>
    <div v-else-if="!hasProducts" data-testid="empty-state">No products found</div>
    <div v-else data-testid="product-grid">
      <ProductCard v-for="product in data" :key="product.id" :product="product" />
    </div>
  </div>
</template>
