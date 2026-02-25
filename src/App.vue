<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePrintshopStore } from '@/stores/printshops'
import { useCustomerStore } from '@/stores/customers'
import { useOrderStore } from '@/stores/orders'
import { useActivityStore } from '@/stores/activities'
import { useDriverTaskStore } from '@/stores/driver-tasks'
import { useFileStore } from '@/stores/files'

const authStore = useAuthStore()
const printshopStore = usePrintshopStore()
const customerStore = useCustomerStore()
const orderStore = useOrderStore()
const activityStore = useActivityStore()
const driverTaskStore = useDriverTaskStore()
const fileStore = useFileStore()

async function initData() {
  await printshopStore.init()
  await customerStore.init()
  await orderStore.init()
  await activityStore.init()
  await driverTaskStore.init()
}

onMounted(async () => {
  await authStore.init()
  if (authStore.isAuthenticated) {
    await initData()
  }
})

watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      await initData()
    }
  }
)
</script>

<template>
  <div v-if="authStore.isLoading" class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p class="text-muted-foreground">Loading...</p>
    </div>
  </div>
  <RouterView v-else />
</template>
