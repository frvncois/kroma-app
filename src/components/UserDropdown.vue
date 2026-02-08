<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRole, type UserRole } from '@/composables/useRole'
import { useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'

const { currentRole, setRole } = useRole()
const router = useRouter()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const roles: { value: UserRole; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'printshop_manager', label: 'Printshop Manager' },
  { value: 'driver', label: 'Driver' },
]

const currentRoleLabel = computed(() => {
  return roles.find((r) => r.value === currentRole.value)?.label || 'Unknown'
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const handleRoleChange = (newRole: UserRole) => {
  setRole(newRole)
  isOpen.value = false

  // Redirect to appropriate default page for the role
  if (newRole === 'manager') {
    router.push('/manager/orders')
  } else if (newRole === 'printshop_manager') {
    router.push('/printshop')
  } else if (newRole === 'driver') {
    router.push('/driver')
  }
}

const handleSignOut = () => {
  console.log('Sign out clicked')
  isOpen.value = false
  // In real app: call auth.signOut() and redirect to login
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
      class="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {{ currentRoleLabel }}
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
      class="absolute right-0 mt-2 w-56 rounded-md border bg-popover shadow-lg"
    >
      <!-- Switch Role Section -->
      <div class="p-2">
        <div class="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Switch Role</div>
        <button
          v-for="role in roles"
          :key="role.value"
          @click="handleRoleChange(role.value)"
          class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          :class="{
            'bg-accent/50': role.value === currentRole,
          }"
        >
          <span>{{ role.label }}</span>
          <svg
            v-if="role.value === currentRole"
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
      </div>

      <!-- Divider -->
      <div class="my-1 h-px bg-border"></div>

      <!-- Sign Out -->
      <div class="p-2">
        <button
          @click="handleSignOut"
          class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-accent"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
</template>
