import type { User } from '@/types'

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Manager',
    email: 'manager@kroma.com',
    password: '1234',
    role: 'manager',
    assigned_shops: [],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Victor',
    email: 'victor@kroma.com',
    password: '1234',
    role: 'printshop_manager',
    assigned_shops: ['victor'],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Alex Tremblay',
    email: 'alex@kroma.com',
    password: '1234',
    role: 'driver',
    assigned_shops: [],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-4',
    name: 'Sam Bouchard',
    email: 'sam@kroma.com',
    password: '1234',
    role: 'driver',
    assigned_shops: [],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-5',
    name: 'Jordan Lavoie',
    email: 'jordan@kroma.com',
    password: '1234',
    role: 'driver',
    assigned_shops: [],
    created_at: '2026-01-01T00:00:00Z',
  },
]
