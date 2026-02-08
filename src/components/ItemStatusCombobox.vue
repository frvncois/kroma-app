<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ItemStatus } from '@/types'
import { statusOptionsWithoutAll } from '@/lib/constants'
import { statusColorMap } from '@/lib/variants'

interface Props {
  modelValue: ItemStatus
  itemId: string
}

interface Emits {
  (e: 'update:modelValue', itemId: string, status: ItemStatus): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const statusOptions = statusOptionsWithoutAll

const isOpen = ref(false)
const containerRef = ref<HTMLElement>()
const currentLabel = computed(() => statusOptions.find(opt => opt.value === props.modelValue)?.label || '')

const toggleDropdown = (e: Event) => {
  e.stopPropagation()
  isOpen.value = !isOpen.value
}

const handleStatusChange = (newStatus: ItemStatus, e: Event) => {
  e.stopPropagation()
  emit('update:modelValue', props.itemId, newStatus)
  isOpen.value = false
}

const handleClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

const mounted = () => {
  document.addEventListener('click', handleClickOutside)
}

const beforeUnmount = () => {
  document.removeEventListener('click', handleClickOutside)
}
</script>

<template>
  <div ref="containerRef" class="relative" @vue:mounted="mounted" @vue:before-unmount="beforeUnmount">
    <!-- Trigger button with dot and label -->
    <button
      @click="toggleDropdown"
      class="flex h-9 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm ring-offset-background transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <div class="flex items-center gap-1.5 flex-1 min-w-0">
        <div :class="`h-3 w-3 rounded-full flex-shrink-0 ${statusColorMap[modelValue]}`"></div>
        <span class="text-xs truncate">{{ currentLabel }}</span>
      </div>
      <svg
        class="h-3 w-3 shrink-0 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown menu -->
    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 left-0 right-0 rounded-lg border bg-popover shadow-lg"
      @click.stop
    >
      <div class="p-1">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          @click="(e) => handleStatusChange(option.value, e)"
          :class="[
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
            modelValue === option.value ? 'bg-accent/50' : ''
          ]"
        >
          <div :class="`h-3 w-3 rounded-full ${statusColorMap[option.value]}`"></div>
          <span>{{ option.label }}</span>
          <svg
            v-if="modelValue === option.value"
            class="ml-auto h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
