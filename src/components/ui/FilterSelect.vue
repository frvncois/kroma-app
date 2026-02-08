<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import Checkbox from './Checkbox.vue'

interface Option {
  value: string
  label: string
  color?: string
}

interface Props {
  modelValue: string | string[]
  options: Option[]
  placeholder?: string
  multiple?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string | string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select...',
  multiple: false,
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref({ top: 0, left: 0, width: 0, bottom: 'auto' as string | number })

// Display text for the trigger button
const displayText = computed(() => {
  if (props.multiple) {
    const selectedValues = props.modelValue as string[]

    // If "all" is selected, show the "All ***" label
    if (selectedValues.includes('all')) {
      const allOption = props.options.find((opt) => opt.value === 'all')
      return allOption?.label || props.placeholder
    }

    // Show count of selected items
    const count = selectedValues.length
    if (count === 0) {
      return props.placeholder
    }
    return `${count} selected`
  } else {
    // Single select mode
    const selectedOption = props.options.find((opt) => opt.value === props.modelValue)
    return selectedOption?.label || props.placeholder
  }
})

// Get color for selected option (single select only)
const selectedColor = computed(() => {
  if (!props.multiple) {
    const selectedOption = props.options.find((opt) => opt.value === props.modelValue)
    return selectedOption?.color
  }
  return undefined
})

const updateDropdownPosition = () => {
  if (triggerRef.value) {
    const rect = triggerRef.value.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top
    const dropdownHeight = 300 // Estimated max height of dropdown

    // If not enough space below but enough space above, open upward
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      dropdownPosition.value = {
        top: 'auto',
        bottom: viewportHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      }
    } else {
      // Default: open downward
      dropdownPosition.value = {
        top: rect.bottom + 4,
        bottom: 'auto',
        left: rect.left,
        width: rect.width,
      }
    }
  }
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      updateDropdownPosition()
    })
  }
}

watch(isOpen, (newVal) => {
  if (newVal) {
    updateDropdownPosition()
  }
})

// Single select handler
const selectOption = (value: string) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

// Multi select handler
const toggleOption = (value: string) => {
  const selectedValues = [...(props.modelValue as string[])]

  if (value === 'all') {
    // If clicking "All", clear all other selections and select only "all"
    emit('update:modelValue', ['all'])
  } else {
    // If clicking a non-"all" option
    const index = selectedValues.indexOf(value)

    if (index > -1) {
      // Deselect the option
      selectedValues.splice(index, 1)

      // If nothing is selected, default back to "all"
      if (selectedValues.length === 0) {
        emit('update:modelValue', ['all'])
      } else {
        // Remove "all" if it's present
        const allIndex = selectedValues.indexOf('all')
        if (allIndex > -1) {
          selectedValues.splice(allIndex, 1)
        }
        emit('update:modelValue', selectedValues)
      }
    } else {
      // Select the option
      // Remove "all" if it's present
      const allIndex = selectedValues.indexOf('all')
      if (allIndex > -1) {
        selectedValues.splice(allIndex, 1)
      }
      selectedValues.push(value)
      emit('update:modelValue', selectedValues)
    }
  }
}

const isSelected = (value: string): boolean => {
  if (props.multiple) {
    return (props.modelValue as string[]).includes(value)
  }
  return props.modelValue === value
}

const handleScroll = () => {
  if (isOpen.value) {
    updateDropdownPosition()
  }
}

// Add scroll listener
watch(isOpen, (newVal) => {
  if (newVal) {
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
  } else {
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', handleScroll)
  }
})

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', handleScroll)
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      @click="toggleDropdown"
      class="flex h-9 w-full items-center text-xs justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div class="flex items-center gap-2 truncate">
        <span
          v-if="selectedColor"
          class="h-2.5 w-2.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: selectedColor }"
        />
        <span class="truncate">
          {{ displayText }}
        </span>
      </div>
      <svg
        class="h-3 w-3 shrink-0 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="fixed z-50 max-h-60 overflow-auto rounded-xl border bg-popover shadow-lg"
      :style="{
        top: dropdownPosition.top === 'auto' ? 'auto' : `${dropdownPosition.top}px`,
        bottom: dropdownPosition.bottom === 'auto' ? 'auto' : `${dropdownPosition.bottom}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
      }"
    >
      <!-- Options -->
      <div class="p-1">
        <!-- Multi-select with checkboxes -->
        <template v-if="multiple">
          <button
            v-for="option in options"
            :key="option.value"
            @click="toggleOption(option.value)"
            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Checkbox :model-value="isSelected(option.value)" />
            <div class="flex items-center gap-2">
              <span
                v-if="option.color"
                class="h-2.5 w-2.5 rounded-full flex-shrink-0"
                :style="{ backgroundColor: option.color }"
              />
              <span>{{ option.label }}</span>
            </div>
          </button>
        </template>

        <!-- Single select -->
        <template v-else>
          <button
            v-for="option in options"
            :key="option.value"
            @click="selectOption(option.value)"
            class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="{
              'bg-accent/50': isSelected(option.value),
            }"
          >
            <div class="flex items-center gap-2">
              <span
                v-if="option.color"
                class="h-2.5 w-2.5 rounded-full flex-shrink-0"
                :style="{ backgroundColor: option.color }"
              />
              <span>{{ option.label }}</span>
            </div>
            <svg
              v-if="isSelected(option.value)"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
