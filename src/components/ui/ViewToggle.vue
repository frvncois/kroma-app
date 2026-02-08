<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { List, Kanban } from 'lucide-vue-next'

interface Option {
  value: string
  label: string
  icon?: string
}

interface Props {
  options: Option[]
  modelValue: string
  storageKey: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const getIcon = (iconName?: string) => {
  switch (iconName) {
    case 'table':
      return List
    case 'kanban':
      return Kanban
    default:
      return null
  }
}

// Initialize from localStorage on mount
onMounted(() => {
  const stored = localStorage.getItem(props.storageKey)
  if (stored && props.options.some((opt) => opt.value === stored)) {
    emit('update:modelValue', stored)
  }
})

// Watch for changes and persist
watch(
  () => props.modelValue,
  (newValue) => {
    localStorage.setItem(props.storageKey, newValue)
  }
)

const handleSelect = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="inline-flex items-center rounded-lg bg-secondary p-1">
    <button
      v-for="option in options"
      :key="option.value"
      @click="handleSelect(option.value)"
      :class="[
        'inline-flex items-center justify-center gap-2 rounded-md px-3 h-7 text-xs transition-colors',
        modelValue === option.value
          ? 'bg-background text-accent-foreground shadow-sm'
          : 'text-muted-foreground bg-accent/50 hover:bg-accent/50 hover:text-foreground'
      ]"
    >
      <component v-if="getIcon(option.icon)" :is="getIcon(option.icon)" class="h-4 w-4" />
    </button>
  </div>
</template>
