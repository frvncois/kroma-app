import { ref } from 'vue'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
  duration?: number
}

const toasts = ref<Toast[]>([])

let toastId = 0

export function useToast() {
  const toast = (options: Omit<Toast, 'id'>) => {
    const id = `toast-${toastId++}`
    const newToast: Toast = {
      id,
      duration: 3000,
      variant: 'default',
      ...options,
    }

    toasts.value.push(newToast)

    // Auto-dismiss after duration
    setTimeout(() => {
      dismiss(id)
    }, newToast.duration)

    return id
  }

  const dismiss = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    toast,
    dismiss,
  }
}
