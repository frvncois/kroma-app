<script setup lang="ts">
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-border text-foreground',
        secondary: 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
        destructive: 'border-red-600 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-500 dark:hover:bg-red-900',
        outline: 'border-zinc-500 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900',
        // Payment variants
        success: 'border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-500 dark:hover:bg-emerald-900',
        warning: 'border-amber-600 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-500 dark:hover:bg-amber-900',
        info: 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-500 dark:hover:bg-blue-900',
        // Per-status variants
        slate: 'border-slate-600 bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-500',
        blue: 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-500',
        amber: 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-500',
        orange: 'border-orange-600 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-500',
        cyan: 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-500',
        violet: 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-500',
        emerald: 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-500',
        teal: 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-500',
        red: 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 dark:border-red-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface Props {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'slate' | 'blue' | 'amber' | 'orange' | 'cyan' | 'violet' | 'emerald' | 'teal' | 'red'
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
