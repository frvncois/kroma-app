import type { User } from '@/types'

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Manager',
    email: 'manager@kroma.com',
    password: '1234',
    role: 'manager',
    assigned_shops: [],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Victor',
    email: 'victor@kroma.com',
    password: '1234',
    role: 'printshop_manager',
    assigned_shops: ['victor'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Driver',
    email: 'driver@kroma.com',
    password: '1234',
    role: 'driver',
    assigned_shops: [],
    created_at: '2024-01-01T00:00:00Z',
  },
]
