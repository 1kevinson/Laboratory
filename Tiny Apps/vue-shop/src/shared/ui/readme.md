## Anatomie du dossier shared/ui

`/ui` represente le dossier des Atoms. La plus petite brique, indivisible.

Un bouton, un champ, une icône, un badge. Il ne contient aucun autre composant Vue. 
Tout son affichage vient de ses props. Il ne sait rien de votre application : pas d'appel API, pas de store, pas de logique métier. C'est pour ça qu'on peut le réutiliser partout.

- ✅ Reçoit tout par props, communique par emit
- ✅ Préfixe de nom Base* (BaseButton, BaseInput)
- ❌ Jamais de store Pinia ni de fetch
- ❌ Ne connaît aucune entité métier (User, Order...)


components/ui/BaseButton.vue

```ts
<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}>()
defineEmits<{ click: [e: MouseEvent] }>()
</script>

<template>
  <button
    :class="['c-btn', `c-btn--${variant}`]"
    :disabled="disabled"
    @click="$emit('click', $event)">
    <slot />
  </button>
</template>
```
