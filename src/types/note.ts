/**
 * Note department visibility types
 */
export type NoteDepartment = 'printshop' | 'delivery' | 'billing' | 'everyone'

/**
 * Note entity type
 */
export type NoteEntityType = 'order' | 'order_item' | 'driver_task'

/**
 * Note interface
 */
export interface Note {
  id: string
  entity_type: NoteEntityType
  entity_id: string
  content: string
  departments: NoteDepartment[]
  created_at: string
  created_by: string
  users?: { name: string } | null
}

/**
 * Backward compatibility alias
 */
export type OrderNote = Note
