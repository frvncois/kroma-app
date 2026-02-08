<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import KromaLogo from '@/assets/KromaLogo.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  error.value = ''
  isLoading.value = true

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))

  const result = authStore.login(email.value, password.value)

  if (result.success) {
    // Redirect based on role
    const role = authStore.userRole
    if (role === 'manager') {
      router.push('/manager/orders')
    } else if (role === 'printshop_manager') {
      router.push('/printshop/queue')
    } else if (role === 'driver') {
      router.push('/driver/deliveries')
    }
  } else {
    error.value = result.message || 'Login failed'
  }

  isLoading.value = false
}

const testAccounts = [
  { email: 'manager@kroma.com', password: '1234', role: 'Manager' },
  { email: 'victor@kroma.com', password: '1234', role: 'Printshop Manager' },
  { email: 'driver@kroma.com', password: '1234', role: 'Driver' },
]

const fillCredentials = (testEmail: string, testPassword: string) => {
  email.value = testEmail
  password.value = testPassword
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
    <div class="w-full max-w-md space-y-8">
      <!-- Logo -->
      <div class="flex justify-center">
        <div class="w-32 h-32">
          <KromaLogo />
        </div>
      </div>

      <!-- Login Card -->
      <Card class="border-2">
        <CardHeader class="space-y-1 text-center">
          <CardTitle class="text-2xl font-bold">Welcome to Kroma</CardTitle>
          <p class="text-sm text-muted-foreground">Sign in to your account to continue</p>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Login Form -->
          <form @submit.prevent="handleLogin" class="space-y-4">
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="name@example.com"
                required
                autocomplete="email"
              />
            </div>

            <div class="space-y-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="Enter your password"
                required
                autocomplete="current-password"
              />
            </div>

            <!-- Error Message -->
            <div v-if="error" class="text-sm text-destructive text-center p-2 rounded-md bg-destructive/10">
              {{ error }}
            </div>

            <!-- Submit Button -->
            <Button
              type="submit"
              class="w-full"
              :disabled="isLoading || !email || !password"
            >
              {{ isLoading ? 'Signing in...' : 'Sign in' }}
            </Button>
          </form>

          <!-- Development Hint -->
          <div class="pt-4 border-t">
            <p class="text-xs text-muted-foreground text-center mb-3">
              Development Test Accounts
            </p>
            <div class="space-y-2">
              <button
                v-for="account in testAccounts"
                :key="account.email"
                @click="fillCredentials(account.email, account.password)"
                class="w-full text-left px-3 py-2 rounded-md border bg-muted/30 hover:bg-muted transition-colors"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-xs font-medium">{{ account.role }}</div>
                    <div class="text-xs text-muted-foreground">{{ account.email }}</div>
                  </div>
                  <div class="text-xs text-muted-foreground">{{ account.password }}</div>
                </div>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Footer -->
      <p class="text-center text-xs text-muted-foreground">
        Kroma Print Management System v1.0
      </p>
    </div>
  </div>
</template>
