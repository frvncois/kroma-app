import { ref, watch } from 'vue'

export type UserRole = 'manager' | 'printshop_manager' | 'driver'

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
