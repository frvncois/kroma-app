<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useRole } from '@/composables/useRole'
import { onClickOutside } from '@vueuse/core'
import UserDropdown from './UserDropdown.vue'
import KromaLogo from '@/assets/KromaLogo.vue'
import Toaster from './ui/Toaster.vue'

const { currentRole } = useRole()
const route = useRoute()
const router = useRouter()

const isMobileMenuOpen = ref(false)
const mobileMenuRef = ref<HTMLElement | null>(null)

interface NavItem {
  to: string
  label: string
  roles: string[]
}

const navItems: NavItem[] = [
  { to: '/manager/orders', label: 'Orders', roles: ['manager'] },
  { to: '/manager/customers', label: 'Customers', roles: ['manager'] },
]

const visibleNavItems = computed(() => {
  return navItems.filter((item) => item.roles.includes(currentRole.value))
})

const isActive = (path: string) => {
  return route.path.startsWith(path)
}

const homeRoute = computed(() => {
  return '/manager/orders'
})

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

onClickOutside(mobileMenuRef, () => {
  isMobileMenuOpen.value = false
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 w-full border-b bg-background px-10">
      <div class="mx-auto flex h-16 items-center justify-between">
        <!-- Left: Logo -->
        <div class="flex gap-4 items-center">
            
          <div class="w-6"><KromaLogo/></div> <span class="font-semibold tracking-wider">KROMA</span>
        </div>

        <!-- Right: User Dropdown (Desktop) -->
        <div class="hidden md:block">
          <UserDropdown />
        </div>

        <!-- Mobile: Hamburger Menu -->
        <button
          @click="toggleMobileMenu"
          class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
        >
          <svg
            v-if="!isMobileMenuOpen"
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <svg
            v-else
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Mobile Menu Panel -->
      <div
        v-if="isMobileMenuOpen"
        ref="mobileMenuRef"
        class="border-t bg-background md:hidden"
      >
        <!-- Navigation Links -->
        <nav class="space-y-1 p-4">
          <RouterLink
            v-for="item in visibleNavItems"
            :key="item.to"
            :to="item.to"
            @click="closeMobileMenu"
            class="block rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="{
              'bg-accent text-accent-foreground': isActive(item.to),
              'text-muted-foreground': !isActive(item.to),
            }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <!-- User Section -->
        <div class="border-t p-4">
          <UserDropdown />
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex flex-1">
        <RouterView />
    </main>

    <!-- Toast Notifications -->
    <Toaster />
  </div>
</template>
