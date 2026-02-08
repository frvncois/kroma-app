<script setup lang="ts">
interface Props {
  label: string
  count: number
  variant?: 'default' | 'warning' | 'destructive'
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
})
</script>

<template>
  <button
    class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-md cursor-pointer"
    :class="{
      'bg-muted/50 text-foreground hover:bg-muted': variant === 'default',
      'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50':
        variant === 'warning',
      'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50':
        variant === 'destructive',
    }"
  >
    <span class="text-muted-foreground">{{ label }}</span>
    <span class="font-bold text-lg">{{ count }}</span>
  </button>
</template>
