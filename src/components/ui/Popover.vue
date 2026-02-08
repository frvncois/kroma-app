<script setup lang="ts">
import { PopoverRoot, type PopoverRootEmits, type PopoverRootProps } from 'radix-vue'

defineProps<PopoverRootProps>()

const emit = defineEmits<PopoverRootEmits>()
</script>

<template>
  <PopoverRoot v-bind="$props" @update:open="emit('update:open', $event)">
    <slot />
  </PopoverRoot>
</template>
