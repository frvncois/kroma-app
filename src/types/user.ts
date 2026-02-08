export type UserRole = 'manager' | 'printshop_manager' | 'driver'

export interface User {
  id: string
  name: string
  email: string
  password: string // Phase 1 only - will be removed in Phase 2
  role: UserRole
  assigned_shops: string[]
  created_at: string
}
