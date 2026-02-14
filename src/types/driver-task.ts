export type DriverTaskType = 'pickup' | 'dropoff' | 'errand' | 'other'
export type DriverTaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type DriverTaskStatus = 'pending' | 'in_progress' | 'completed' | 'canceled'

export interface DriverTask {
  id: string
  created_by: string
  assigned_to: string
  title: string
  type: DriverTaskType
  priority: DriverTaskPriority
  details: string
  address: string
  lat: number | null
  lng: number | null
  complete_by: string | null
  status: DriverTaskStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}
