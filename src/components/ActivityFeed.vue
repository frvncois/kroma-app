<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import { getStatusVariant, statusColorMap } from '@/lib/variants'
import { statusOptions } from '@/lib/constants'
import type { ItemStatus } from '@/types'
import { useAuthStore } from '@/stores/auth'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import {
  Package,
  MessageSquare,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  User,
  Settings,
  Search,
  Eye,
  EyeOff,
  Star,
  AlertTriangle
} from 'lucide-vue-next'

interface Activity {
  id: string
  type: 'status_change' | 'note_added' | 'delivery' | 'pickup' | 'assignment' | 'order_created' | 'alert'
  timestamp: string
  user: string
  seen: boolean
  important: boolean
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
  // Alert-specific fields
  alert?: {
    rule: string
    level: 'warning' | 'critical'
    daysSince?: number
  }
}

interface Props {
  activities: Activity[]
}

interface Emits {
  (e: 'activity-click', orderId: string): void
  (e: 'toggle-seen', activityId: string): void
  (e: 'toggle-important', activityId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const authStore = useAuthStore()

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
    case 'alert':
      return AlertTriangle
    default:
      return Package
  }
}

const getActivityColor = (activity: Activity) => {
  switch (activity.type) {
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
    case 'alert':
      return activity.alert?.level === 'critical'
        ? 'text-red-600 bg-red-50 dark:bg-red-950'
        : 'text-amber-600 bg-amber-50 dark:bg-amber-950'
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-950'
  }
}

const formatTimeAgo = (timestamp: string) => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
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

// Search and filter functionality
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const displayFilter = ref<'all' | 'new' | 'seen'>('all')
const showImportantOnly = ref(false)

// Filter options
const displayOptions = [
  { value: 'all', label: 'Display All' },
  { value: 'new', label: 'New' },
  { value: 'seen', label: 'Seen' }
]

// Combobox state
const statusComboboxOpen = ref(false)
const displayComboboxOpen = ref(false)
const statusComboboxRef = ref<HTMLElement>()
const displayComboboxRef = ref<HTMLElement>()

// Toggle handlers
const handleToggleSeen = (activityId: string, event: Event) => {
  event.stopPropagation()
  emit('toggle-seen', activityId)
}

const handleToggleImportant = (activityId: string, event: Event) => {
  event.stopPropagation()
  emit('toggle-important', activityId)
}

// Combobox handlers
const toggleStatusCombobox = (e: Event) => {
  e.stopPropagation()
  statusComboboxOpen.value = !statusComboboxOpen.value
  displayComboboxOpen.value = false
}

const toggleDisplayCombobox = (e: Event) => {
  e.stopPropagation()
  displayComboboxOpen.value = !displayComboboxOpen.value
  statusComboboxOpen.value = false
}

const handleStatusChange = (status: string, e: Event) => {
  e.stopPropagation()
  statusFilter.value = status
  statusComboboxOpen.value = false
}

const handleDisplayChange = (display: 'all' | 'new' | 'seen', e: Event) => {
  e.stopPropagation()
  displayFilter.value = display
  displayComboboxOpen.value = false
}

const handleClickOutside = (e: MouseEvent) => {
  if (statusComboboxRef.value && !statusComboboxRef.value.contains(e.target as Node)) {
    statusComboboxOpen.value = false
  }
  if (displayComboboxRef.value && !displayComboboxRef.value.contains(e.target as Node)) {
    displayComboboxOpen.value = false
  }
}

const mounted = () => {
  document.addEventListener('click', handleClickOutside)
}

const beforeUnmount = () => {
  document.removeEventListener('click', handleClickOutside)
}

// Helper to safely get status color
const getStatusColor = (status: string): string => {
  if (status === 'all') return ''
  return statusColorMap[status as ItemStatus] || ''
}

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

  // Apply status filter (filter by item status for status_change activities)
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(activity => {
      // For status_change activities, check the 'to' status
      if (activity.type === 'status_change' && activity.details.to) {
        return activity.details.to === statusFilter.value
      }
      // For other activity types, check inferred status
      const currentStatus = getCurrentStatus(activity)
      return currentStatus === statusFilter.value
    })
  }

  // Apply display filter
  if (displayFilter.value === 'new') {
    filtered = filtered.filter(activity => !activity.seen)
  } else if (displayFilter.value === 'seen') {
    filtered = filtered.filter(activity => activity.seen)
  }

  // Apply important filter
  if (showImportantOnly.value) {
    filtered = filtered.filter(activity => activity.important)
  }

  // Sort: important first, then unseen, then seen, then by timestamp
  return [...filtered].sort((a, b) => {
    // Important items always at the top
    if (a.important && !b.important) return -1
    if (!a.important && b.important) return 1

    // Then unseen before seen
    if (!a.seen && b.seen) return -1
    if (a.seen && !b.seen) return 1

    // Finally by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
})
</script>

<template>
  <div class="flex h-full flex-col" @vue:mounted="mounted" @vue:before-unmount="beforeUnmount">
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

      <!-- Filter Comboboxes -->
      <div class="flex gap-2">
        <!-- Status Filter Combobox -->
        <div ref="statusComboboxRef" class="relative flex-1">
          <button
            @click="toggleStatusCombobox"
            class="flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm ring-offset-background transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <div v-if="statusFilter !== 'all'" :class="`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getStatusColor(statusFilter)}`"></div>
              <span class="text-xs truncate">{{ statusOptions.find(opt => opt.value === statusFilter)?.label || 'All Statuses' }}</span>
            </div>
            <svg
              class="h-3 w-3 shrink-0 transition-transform"
              :class="{ 'rotate-180': statusComboboxOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Status Dropdown -->
          <div
            v-if="statusComboboxOpen"
            class="absolute z-50 mt-1 left-0 w-full min-w-max rounded-lg border bg-popover shadow-lg"
            @click.stop
          >
            <div class="p-1 max-h-60 overflow-auto">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                @click="(e) => handleStatusChange(option.value, e)"
                :class="[
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                  statusFilter === option.value ? 'bg-accent/50' : ''
                ]"
              >
                <div v-if="option.value !== 'all'" :class="`h-2.5 w-2.5 rounded-full ${getStatusColor(option.value)}`"></div>
                <span class="flex-1 text-left">{{ option.label }}</span>
                <svg
                  v-if="statusFilter === option.value"
                  class="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Display Filter Combobox -->
        <div ref="displayComboboxRef" class="relative flex-1">
          <button
            @click="toggleDisplayCombobox"
            class="flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm ring-offset-background transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <span class="text-xs truncate flex-1 text-left">{{ displayOptions.find(opt => opt.value === displayFilter)?.label || 'Display All' }}</span>
            <svg
              class="h-3 w-3 shrink-0 transition-transform"
              :class="{ 'rotate-180': displayComboboxOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Display Dropdown -->
          <div
            v-if="displayComboboxOpen"
            class="absolute z-50 mt-1 left-0 w-full min-w-max rounded-lg border bg-popover shadow-lg"
            @click.stop
          >
            <div class="p-1">
              <button
                v-for="option in displayOptions"
                :key="option.value"
                @click="(e) => handleDisplayChange(option.value as 'all' | 'new' | 'seen', e)"
                :class="[
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                  displayFilter === option.value ? 'bg-accent/50' : ''
                ]"
              >
                <span class="flex-1 text-left">{{ option.label }}</span>
                <svg
                  v-if="displayFilter === option.value"
                  class="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Star Button -->
        <Button
          variant="ghost"
          size="sm"
          @click="showImportantOnly = !showImportantOnly"
          :class="showImportantOnly ? 'bg-accent text-orange-600' : ''"
          class="h-8 text-xs px-2 hover:border-transparent"
        >
          <Star :class="showImportantOnly ? 'h-4 w-4 fill-orange-600' : 'h-4 w-4'" />
        </Button>
      </div>
    </div>

    <!-- Activity List -->
    <div class="flex-1 overflow-auto p-4 space-y-3">
      <div
        v-for="activity in filteredActivities"
        :key="activity.id"
        @click="activity.order && emit('activity-click', activity.order.id)"
        :class="[
          'relative rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
          activity.seen ? 'p-2' : 'p-3',
          activity.important ? 'border-orange-600 dark:border-orange-900 shadow-orange-100 shadow-sm outline outline-4 outline-orange-600/10' : '',
          !activity.seen && !activity.important && activity.user !== authStore.currentUser?.name ? 'outline outline-4 outline-green-600/10 border-green-600' : '',
          !activity.seen && activity.important ? 'outline outline-3 outline-orange-600/10' : ''
        ]"
      >
        <!-- Row 1: Icon, Title -->
        <div class="flex gap-3 items-center mb-2">
          <div :class="['rounded-full p-2 flex-shrink-0', getActivityColor(activity)]">
            <component :is="getActivityIcon(activity.type)" class="h-4 w-4" />
          </div>

          <div class="text-sm font-medium flex-1 min-w-0">
            {{ activity.details.message }}
          </div>
        </div>

        <!-- Row 2: Content (collapsed if seen) -->
        <div v-if="!activity.seen" class="space-y-1 p-2">
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
                <Badge :variant="getStatusVariant(activity.details.from as any)" class="text-xs">
                  {{ formatStatusText(activity.details.from) }}
                </Badge>
                <span class="text-xs text-muted-foreground">→</span>
                <Badge :variant="getStatusVariant(activity.details.to as any)" class="text-xs">
                  {{ formatStatusText(activity.details.to) }}
                </Badge>
              </template>
              <template v-else-if="getCurrentStatus(activity)">
                <Badge :variant="getStatusVariant(getCurrentStatus(activity)! as any)" class="text-xs">
                  {{ formatStatusText(getCurrentStatus(activity)!) }}
                </Badge>
              </template>
              <!-- Alert Level Display -->
              <template v-else-if="activity.type === 'alert' && activity.alert">
                <Badge :variant="activity.alert.level === 'critical' ? 'destructive' : 'warning'" class="text-xs">
                  {{ activity.alert.level === 'critical' ? 'Critical' : 'Warning' }}
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

        <!-- Collapsed view for seen activities -->
        <div v-else class="px-2 py-1 space-y-1">
          <!-- Item/Order Info -->
          <div v-if="activity.item" class="text-xs text-muted-foreground">
            <span class="font-medium">{{ activity.item.name }}</span>
          </div>
          <div v-if="activity.order" class="text-xs text-muted-foreground">
            Order #{{ activity.order.externalId || activity.order.id.slice(0, 8) }} • {{ activity.order.customer }}
          </div>

          <div class="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Clock class="h-3 w-3" />
            <span>{{ formatTimeAgo(activity.timestamp) }}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2 mt-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            @click="activity.order && emit('activity-click', activity.order.id)"
            class="flex-1 h-7 text-xs"
          >
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="handleToggleSeen(activity.id, $event)"
            class="h-7 text-xs px-2 flex items-center gap-1.5"
          >
            <component :is="activity.seen ? EyeOff : Eye" class="h-3 w-3" />
            <span>{{ activity.seen ? 'Mark as new' : 'Mark as seen' }}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="handleToggleImportant(activity.id, $event)"
            :class="activity.important ? 'h-7 w-7 p-0 text-orange-600 hover:text-orange-700 border-orange-600' : 'h-7 w-7 p-0'"
          >
            <Star :class="activity.important ? 'h-3 w-3 fill-orange-600' : 'h-3 w-3'" />
          </Button>
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
