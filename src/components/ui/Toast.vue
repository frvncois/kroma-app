<script setup lang="ts">
import { computed } from 'vue'
import { X, CheckCircle2, XCircle, Info } from 'lucide-vue-next'
import type { Toast } from '@/composables/useToast'

interface Props {
  toast: Toast
}

interface Emits {
  (e: 'dismiss'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const variantClasses = computed(() => {
  switch (props.toast.variant) {
    case 'success':
      return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
    case 'destructive':
      return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
    default:
      return 'bg-background border-border'
  }
})

const iconComponent = computed(() => {
  switch (props.toast.variant) {
    case 'success':
      return CheckCircle2
    case 'destructive':
      return XCircle
    default:
      return Info
  }
})

const iconColor = computed(() => {
  switch (props.toast.variant) {
    case 'success':
      return 'text-green-600 dark:text-green-400'
    case 'destructive':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-blue-600 dark:text-blue-400'
  }
})
</script>

<template>
  <div
    :class="[
      'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border p-4 shadow-lg transition-all',
      variantClasses
    ]"
  >
    <component :is="iconComponent" :class="['h-5 w-5 flex-shrink-0', iconColor]" />

    <div class="flex-1 space-y-1">
      <div class="text-sm font-semibold">{{ toast.title }}</div>
      <div v-if="toast.description" class="text-sm text-muted-foreground">
        {{ toast.description }}
      </div>
    </div>

    <button
      @click="emit('dismiss')"
      class="flex-shrink-0 rounded-md p-1 transition-colors hover:bg-accent"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
