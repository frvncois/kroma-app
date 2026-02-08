<script setup lang="ts">
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        secondary:
          'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100',
        destructive:
          'border-red-500 bg-red-50 text-red-700 hover:bg-red-100',
        outline: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50',
        success: 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        warning: 'border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100',
        info: 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface Props {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const badgeClass = computed(() => cn(badgeVariants({ variant: props.variant }), props.class))
</script>

<template>
  <div :class="badgeClass">
    <slot />
  </div>
</template>
