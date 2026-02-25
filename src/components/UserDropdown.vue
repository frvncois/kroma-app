<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import { User, LogOut } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const roleLabel = computed(() => {
  const role = authStore.userRole
  if (role === 'manager') return 'Manager'
  if (role === 'printshop_manager') return 'Printshop Manager'
  if (role === 'driver') return 'Driver'
  return 'Unknown'
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const handleLogout = async () => {
  await authStore.logout()
  isOpen.value = false
  router.push('/login')
}

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Dropdown Button -->
    <button
      @click="toggleDropdown"
      class="flex items-center gap-8 px-4 text-sm transition-colors w-80 justify-between flex-1"
    >
      <div class="flex items-center gap-3 ">
        <div class="rounded-full bg-muted p-1.5">
          <User class="h-4 w-4 text-primary" />
        </div>
        <div class="flex flex-col items-start">
          <div class="font-medium leading-none">{{ authStore.currentUser?.name }}</div>
          <div class="text-xs text-muted-foreground mt-0.5">{{ roleLabel }}</div>
        </div>
      </div>
      <svg
        class="h-4 w-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 mt-2 w-64 rounded-md border bg-popover z-50"
    >
      <!-- User Info -->
      <div class="p-4 border-b">
        <div class="flex items-center gap-3">
          <div class="rounded-full bg-muted p-2">
            <User class="h-5 w-5 text-primary" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">{{ authStore.currentUser?.name }}</div>
            <div class="text-sm text-muted-foreground truncate">{{ authStore.currentUser?.email }}</div>
          </div>
        </div>

      </div>

      <!-- Logout -->
      <div class="p-2">
        <button
          @click="handleLogout"
          class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive transition-colors hover:bg-accent"
        >
          <LogOut class="h-4 w-4" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  </div>
</template>
