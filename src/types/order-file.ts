export type FileType = 'artwork' | 'proof' | 'reference' | 'delivery_photo' | 'issue_photo' | 'other'
export type FileEntityType = 'order_item' | 'driver_task'

export interface OrderFile {
  id: string
  entity_type: FileEntityType
  entity_id: string
  file_url: string
  file_name: string
  file_type: FileType
  uploaded_by: string
  created_at: string
}
