<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  class?: string
}

defineProps<Props>()

const isOpen = ref(false)
</script>

<template>
  <div class="relative inline-block">
    <div
      @mouseenter="isOpen = true"
      @mouseleave="isOpen = false"
      class="cursor-pointer"
    >
      <slot name="trigger" />
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 w-64 rounded-lg border bg-popover p-3 text-sm shadow-lg"
        :class="class"
      >
        <slot name="content" />
      </div>
    </Transition>
  </div>
</template>
