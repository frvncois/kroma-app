<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div class="h-full flex items-center justify-center p-10">
    <div class="text-center space-y-4">
      <h1 class="text-4xl font-bold text-muted-foreground">Driver Deliveries</h1>
      <p class="text-xl text-muted-foreground">Coming Soon</p>
      <div class="pt-6">
        <p class="text-sm text-muted-foreground">
          Logged in as: <span class="font-semibold">{{ authStore.currentUser?.name }}</span>
        </p>
        <p class="text-sm text-muted-foreground">
          Role: <span class="font-semibold capitalize">{{ authStore.userRole?.split('_').join(' ') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
