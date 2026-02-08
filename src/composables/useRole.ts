import { ref, watch } from 'vue'
import type { UserRole } from '@/types'

// Re-export UserRole for components that need it
export type { UserRole }

const ROLE_STORAGE_KEY = 'kroma_user_role'

// Initialize from localStorage or default to manager
const currentRole = ref<UserRole>(
  (localStorage.getItem(ROLE_STORAGE_KEY) as UserRole) || 'manager'
)

// Watch for changes and persist to localStorage
watch(currentRole, (newRole) => {
  localStorage.setItem(ROLE_STORAGE_KEY, newRole)
})

export function useRole() {
  const setRole = (role: UserRole) => {
    currentRole.value = role
  }

  return {
    currentRole,
    setRole,
  }
}
