<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <p :class="['text-sm text-muted-foreground mt-2', $props.class]">
    <slot />
  </p>
</template>
