export type FileType = 'artwork' | 'proof' | 'reference' | 'other'

export interface OrderFile {
  id: string
  order_item_id: string
  file_url: string
  file_name: string
  file_type: FileType
  uploaded_by: string | null
  created_at: string
}
