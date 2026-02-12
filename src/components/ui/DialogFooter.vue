<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div :class="['flex justify-end gap-3 p-6 pt-4 border-t', $props.class]">
    <slot />
  </div>
</template>
