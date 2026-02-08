/**
 * Note department visibility types
 */
export type NoteDepartment = 'printshop' | 'delivery' | 'billing' | 'everyone'

/**
 * Order note interface
 */
export interface OrderNote {
  id: string
  content: string
  departments: NoteDepartment[]
  created_at: string
  created_by: string
  item_reference: string | null
}
