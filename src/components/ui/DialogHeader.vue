<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div :class="['p-6 pb-4', $props.class]">
    <slot />
  </div>
</template>
