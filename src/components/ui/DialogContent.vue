<script setup lang="ts">
interface Props {
  class?: string
}

defineProps<Props>()
</script>

<template>
  <div :class="['relative max-h-[90vh] w-full overflow-auto rounded-lg border bg-background shadow-lg', $props.class]">
    <slot />
  </div>
</template>
