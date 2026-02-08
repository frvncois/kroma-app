<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string | null
  disabled?: boolean
  min?: string
  max?: string
  class?: string
}

interface Emits {
  (e: 'update:modelValue', value: string | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value || null)
}
</script>

<template>
  <input
    type="date"
    :value="modelValue || ''"
    :disabled="disabled"
    :min="min"
    :max="max"
    @input="handleInput"
    :class="
      cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )
    "
  />
</template>
