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

  try {
    const result = await authStore.login(email.value, password.value)

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
  } catch (err) {
    console.error('Login error:', err)
    error.value = 'An unexpected error occurred. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
    <div class="w-full max-w-md space-y-8">
      <!-- Logo -->
      <div class="flex justify-center">
        <div class="w-8 h-8">
          <KromaLogo />
        </div>
      </div>

      <!-- Login Card -->
      <Card>
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
        </CardContent>
      </Card>
    </div>
  </div>
</template>
