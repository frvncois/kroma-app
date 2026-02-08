<script setup lang="ts">
import { useRole, type UserRole } from '@/composables/useRole'
import { useRouter } from 'vue-router'

const { currentRole, setRole } = useRole()
const router = useRouter()

const roles: { value: UserRole; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'printshop_manager', label: 'Printshop Manager' },
  { value: 'driver', label: 'Driver' },
]

const handleRoleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const newRole = target.value as UserRole
  setRole(newRole)

  // Redirect to appropriate default page for the role
  if (newRole === 'manager') {
    router.push('/manager/orders')
  } else if (newRole === 'printshop_manager') {
    router.push('/printshop')
  } else if (newRole === 'driver') {
    router.push('/driver')
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label for="role-select" class="text-sm font-medium text-muted-foreground">
      Role:
    </label>
    <select
      id="role-select"
      :value="currentRole"
      @change="handleRoleChange"
      class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option v-for="role in roles" :key="role.value" :value="role.value">
        {{ role.label }}
      </option>
    </select>
  </div>
</template>
