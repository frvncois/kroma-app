<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <h2 :class="['text-lg font-semibold', $props.class]">
    <slot />
  </h2>
</template>
