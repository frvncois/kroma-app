<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import {
  Package,
  MessageSquare,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  FileText,
  User,
  Settings,
  Search,
  Check,
  RotateCcw
} from 'lucide-vue-next'

interface Activity {
  id: string
  type: 'status_change' | 'note_added' | 'delivery' | 'pickup' | 'assignment' | 'order_created'
  timestamp: string
  user: string
  seen: boolean
  item?: {
    id: string
    name: string
    orderId: string
  }
  order?: {
    id: string
    externalId?: string
    customer: string
  }
  details: {
    message: string
    from?: string
    to?: string
    note?: string
  }
}

interface Props {
  activities: Activity[]
}

interface Emits {
  (e: 'activity-click', orderId: string): void
  (e: 'toggle-seen', activityId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleToggleSeen = (activityId: string, event: Event) => {
  event.stopPropagation()
  emit('toggle-seen', activityId)
}

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'status_change':
      return Settings
    case 'note_added':
      return MessageSquare
    case 'delivery':
      return Truck
    case 'pickup':
      return CheckCircle2
    case 'assignment':
      return MapPin
    case 'order_created':
      return FileText
    default:
      return Package
  }
}

const getActivityColor = (type: Activity['type']) => {
  switch (type) {
    case 'status_change':
      return 'text-blue-600 bg-blue-50 dark:bg-blue-950'
    case 'note_added':
      return 'text-purple-600 bg-purple-50 dark:bg-purple-950'
    case 'delivery':
      return 'text-green-600 bg-green-50 dark:bg-green-950'
    case 'pickup':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
    case 'assignment':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950'
    case 'order_created':
      return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950'
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-950'
  }
}

const formatTimeAgo = (timestamp: string) => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}

const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' => {
  if (status.includes('ready')) return 'info'
  if (status.includes('production')) return 'warning'
  if (status.includes('delivered') || status.includes('picked_up')) return 'success'
  if (status.includes('canceled')) return 'destructive'
  return 'default'
}

const formatStatusText = (status: string): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getCurrentStatus = (activity: Activity): string | null => {
  // For status changes, use the 'to' status
  if (activity.type === 'status_change' && activity.details.to) {
    return activity.details.to
  }

  // For other activity types, infer status from activity type
  switch (activity.type) {
    case 'pickup':
      return 'picked_up'
    case 'delivery':
      return 'out_for_delivery'
    case 'assignment':
      return 'assigned'
    case 'order_created':
      return 'new'
    default:
      return null
  }
}

// Search functionality
const searchQuery = ref('')

const filteredActivities = computed(() => {
  let filtered = props.activities

  // Apply search filter if needed
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((activity) => {
      // Search in message
      if (activity.details.message.toLowerCase().includes(query)) return true

      // Search in user name
      if (activity.user.toLowerCase().includes(query)) return true

      // Search in item name
      if (activity.item?.name.toLowerCase().includes(query)) return true

      // Search in customer name
      if (activity.order?.customer.toLowerCase().includes(query)) return true

      // Search in order ID
      if (activity.order?.externalId?.toLowerCase().includes(query)) return true
      if (activity.order?.id.toLowerCase().includes(query)) return true

      // Search in note content
      if (activity.details.note?.toLowerCase().includes(query)) return true

      return false
    })
  }

  // Sort: unseen first, then by timestamp (newest first within each group)
  return [...filtered].sort((a, b) => {
    // First sort by seen status (unseen first)
    if (a.seen !== b.seen) {
      return a.seen ? 1 : -1
    }

    // Then sort by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="border-b bg-background p-4 space-y-3">
      <!-- Search Input -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="text"
          placeholder="Search activities..."
          class="pl-9 h-9 text-sm"
        />
      </div>
    </div>

    <!-- Activity List -->
    <div class="flex-1 overflow-auto p-4 space-y-3">
      <div
        v-for="activity in filteredActivities"
        :key="activity.id"
        @click="activity.order && emit('activity-click', activity.order.id)"
        :class="[
          'relative rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer',
          !activity.seen && 'border-green-500 shadow-lg shadow-green-500/20'
        ]"
      >
        <!-- Row 1: Icon, Title, Button -->
        <div class="flex gap-3 justify-between items-center mb-2">
          <div :class="['rounded-full p-2 flex-shrink-0', getActivityColor(activity.type)]">
            <component :is="getActivityIcon(activity.type)" class="h-4 w-4" />
          </div>

          <div class="text-sm font-medium flex-1 min-w-0">
            {{ activity.details.message }}
          </div>

          <!-- Toggle Seen Button -->
          <button
            @click="handleToggleSeen(activity.id, $event)"
            class="flex-shrink-0 rounded-md p-2 transition-colors hover:bg-accent"
            :title="activity.seen ? 'Mark as unseen' : 'Mark as seen'"
          >
            <Check v-if="!activity.seen" class="h-4 w-4 text-green-600" />
            <RotateCcw v-else class="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <!-- Row 2: Content -->
        <div class="space-y-1 p-2">
            <!-- Item/Order Info -->
            <div v-if="activity.item" class="text-xs text-muted-foreground">
              <span class="font-medium">{{ activity.item.name }}</span>
            </div>
            <div v-if="activity.order" class="text-xs text-muted-foreground pb-4">
              Order #{{ activity.order.externalId || activity.order.id.slice(0, 8) }} • {{ activity.order.customer }}
            </div>

            <!-- Status Display -->
            <div class="flex items-center gap-2">
              <template v-if="activity.type === 'status_change' && activity.details.from && activity.details.to">
                <Badge :variant="getStatusBadgeVariant(activity.details.from)" class="text-xs">
                  {{ formatStatusText(activity.details.from) }}
                </Badge>
                <span class="text-xs text-muted-foreground">→</span>
                <Badge :variant="getStatusBadgeVariant(activity.details.to)" class="text-xs">
                  {{ formatStatusText(activity.details.to) }}
                </Badge>
              </template>
              <template v-else-if="getCurrentStatus(activity)">
                <Badge :variant="getStatusBadgeVariant(getCurrentStatus(activity)!)" class="text-xs">
                  {{ formatStatusText(getCurrentStatus(activity)!) }}
                </Badge>
              </template>
            </div>

            <!-- Note Preview -->
            <div v-if="activity.type === 'note_added' && activity.details.note" class="text-xs bg-muted/50 rounded p-2 italic">
              "{{ activity.details.note }}"
            </div>

            <!-- Footer -->
            <div class="space-y-1 pt-4">
              <div class="flex items-center gap-2">
                <User class="h-3 w-3 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">{{ activity.user }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Clock class="h-3 w-3 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">{{ formatTimeAgo(activity.timestamp) }}</span>
              </div>
            </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredActivities.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
        <Package class="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p class="text-sm text-muted-foreground">
          {{ searchQuery ? 'No activities match your search' : 'No recent activity' }}
        </p>
      </div>
    </div>
  </div>
</template>
