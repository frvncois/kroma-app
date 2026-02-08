<script setup lang="ts">
import { watch } from 'vue'

interface Props {
  open?: boolean
  title?: string
  side?: 'left' | 'right'
  zIndex?: number
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
  zIndex: 50
})
const emit = defineEmits<Emits>()

const close = () => {
  emit('update:open', false)
}

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    close()
  }
}

// Prevent body scroll when sheet is open
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="backdrop">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/50"
        :style="{ zIndex }"
        @click="handleBackdropClick"
      />
    </Transition>

    <!-- Sheet -->
    <Transition :name="side === 'left' ? 'sheet-left' : 'sheet'">
      <div
        v-if="open"
        :class="[
          'fixed top-0 flex h-full w-full flex-col bg-background shadow-xl md:w-3/5 lg:w-1/2',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l'
        ]"
        :style="{ zIndex }"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b p-6">
          <h2 v-if="title" class="text-xl">{{ title }}</h2>
          <button
            @click="close"
            class="rounded-md p-2 transition-colors hover:bg-accent"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto">
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s ease;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.3s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateX(100%);
}

.sheet-left-enter-active,
.sheet-left-leave-active {
  transition: transform 0.3s ease;
}

.sheet-left-enter-from,
.sheet-left-leave-to {
  transform: translateX(-100%);
}
</style>
