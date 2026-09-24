<script setup lang="ts">
import { type Product } from '@/shared/api/generated/models'
import { computed } from 'vue'

const props = defineProps<{ product: Product }>()
const formattedPrice = computed(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(props.product.price))
</script>

<template>
  <div class="c-product-card" data-testid="product-card">
    <img
      class="c-product-card__image"
      data-testid="product-card__image"
      :src="product.imageUrl"
      :alt="product.name"
    />
    <div class="c-product-card__name" data-testid="product-card__name">{{ product.name }}</div>
    <div class="c-product-card__description" data-testid="product-card__description">
      {{ product.description }}
    </div>
    <div class="c-product-card__price" data-testid="product-card__price">{{ formattedPrice }}</div>
  </div>
</template>
