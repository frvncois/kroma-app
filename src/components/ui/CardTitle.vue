<script setup lang="ts">
import { cn } from '@/lib/utils'
import { type Component } from 'vue'

interface Props {
  class?: string
  icon?: Component
}

const props = defineProps<Props>()
</script>

<template>
  <h3 :class="cn('text-lg leading-none tracking-tight flex items-center gap-2', props.class)">
    <component v-if="icon" :is="icon" class="h-5 w-5" />
    <slot />
  </h3>
</template>
