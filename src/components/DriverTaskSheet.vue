<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePrintshops } from '@/composables/usePrintshops'
import Sheet from '@/components/ui/Sheet.vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import DateInput from '@/components/ui/DateInput.vue'
import { Truck, Paperclip, MessageSquare, Edit2, Trash2 } from 'lucide-vue-next'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'taskCreated', taskId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { getPrintshops } = usePrintshops()

// Task details
type TaskType = 'pickup' | 'dropoff' | 'other'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

const taskTitle = ref('')
const taskType = ref<TaskType>('pickup')
const taskPriority = ref<TaskPriority>('medium')
const taskDetails = ref('')
const taskLocation = ref<string>('')
const customAddress = ref('')
const completeBy = ref<string | null>(null)

// Task type options
const taskTypeOptions = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'dropoff', label: 'Drop Off' },
  { value: 'other', label: 'Other' },
]

// Task priority options with colors
const taskPriorityOptions = [
  { value: 'low', label: 'Low', color: '#94a3b8' },        // slate-400
  { value: 'medium', label: 'Medium', color: '#3b82f6' },  // blue-500
  { value: 'high', label: 'High', color: '#f59e0b' },      // amber-500
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },  // red-500
]

// Location options
const locationOptions = computed(() => [
  ...getPrintshops().map((shop) => ({
    value: shop.id,
    label: shop.name,
  })),
  { value: 'other', label: 'Other' },
])

// Show custom address input when "Other" is selected
const showCustomAddress = computed(() => taskLocation.value === 'other')

const handleTaskTypeChange = (type: string | string[]) => {
  const value = Array.isArray(type) ? type[0] : type
  taskType.value = value as TaskType
}

const handleTaskPriorityChange = (priority: string | string[]) => {
  const value = Array.isArray(priority) ? priority[0] : priority
  taskPriority.value = value as TaskPriority
}

const handleLocationChange = (location: string | string[]) => {
  const value = Array.isArray(location) ? location[0] : location
  taskLocation.value = value || ''
}

// Notes management
interface TaskNote {
  id: string
  content: string
  created_at: string
  created_by: string
}

const notes = ref<TaskNote[]>([])
const newNoteContent = ref('')

// Edit note state
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')

const addNote = () => {
  if (!newNoteContent.value.trim()) return

  const note: TaskNote = {
    id: `note-${Date.now()}`,
    content: newNoteContent.value,
    created_at: new Date().toISOString(),
    created_by: 'Current User',
  }

  notes.value.unshift(note)
  newNoteContent.value = ''

  console.log('Added note:', note)
}

const startEditNote = (note: TaskNote) => {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

const saveEditNote = () => {
  if (!editingNoteId.value || !editingNoteContent.value.trim()) return

  const note = notes.value.find(n => n.id === editingNoteId.value)
  if (note) {
    note.content = editingNoteContent.value
  }

  editingNoteId.value = null
  editingNoteContent.value = ''
}

const cancelEditNote = () => {
  editingNoteId.value = null
  editingNoteContent.value = ''
}

const deleteNote = (noteId: string) => {
  const index = notes.value.findIndex(n => n.id === noteId)
  if (index !== -1) {
    notes.value.splice(index, 1)
  }
}

const formatNoteDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Get priority badge variant
const getPriorityVariant = (priority: TaskPriority): 'default' | 'secondary' | 'warning' | 'destructive' => {
  switch (priority) {
    case 'low':
      return 'secondary'
    case 'medium':
      return 'default'
    case 'high':
      return 'warning'
    case 'urgent':
      return 'destructive'
  }
}

const getPriorityLabel = (priority: TaskPriority): string => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

// Validation
const validationErrors = ref<string[]>([])

const validateForm = (): boolean => {
  validationErrors.value = []

  if (!taskTitle.value.trim()) {
    validationErrors.value.push('Task title is required')
  }

  if (!taskLocation.value) {
    validationErrors.value.push('Task location is required')
  }

  if (showCustomAddress.value && !customAddress.value.trim()) {
    validationErrors.value.push('Custom address is required when "Other" location is selected')
  }

  if (!completeBy.value) {
    validationErrors.value.push('Completion date is required')
  }

  return validationErrors.value.length === 0
}

const createTask = () => {
  if (!validateForm()) {
    return
  }

  const taskData = {
    title: taskTitle.value,
    type: taskType.value,
    priority: taskPriority.value,
    details: taskDetails.value,
    location: taskLocation.value === 'other' ? customAddress.value : taskLocation.value,
    completeBy: completeBy.value,
    notes: notes.value,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }

  console.log('Creating driver task:', taskData)

  const mockTaskId = `task-${Date.now()}`
  alert('Driver task created successfully!')

  emit('taskCreated', mockTaskId)
  emit('update:open', false)

  resetForm()
}

const resetForm = () => {
  taskTitle.value = ''
  taskType.value = 'pickup'
  taskPriority.value = 'medium'
  taskDetails.value = ''
  taskLocation.value = ''
  customAddress.value = ''
  completeBy.value = null
  notes.value = []
  newNoteContent.value = ''
  editingNoteId.value = null
  editingNoteContent.value = ''
  validationErrors.value = []
}

const cancel = () => {
  if (confirm('Are you sure you want to cancel? All entered information will be lost.')) {
    emit('update:open', false)
    resetForm()
  }
}

// Reset form when sheet is opened
watch(() => props.open, (newVal) => {
  if (!newVal) {
    resetForm()
  }
})
</script>

<template>
  <Sheet
    :open="open"
    @update:open="emit('update:open', $event)"
    title="Create Driver Task"
    side="right"
    :z-index="60"
  >
    <div class="space-y-6 p-6">
      <!-- Validation Errors -->
      <div v-if="validationErrors.length > 0" class="rounded-lg border border-destructive bg-destructive/10 p-4">
        <div class="mb-2 font-semibold text-destructive">Please fix the following errors:</div>
        <ul class="list-inside list-disc space-y-1 text-sm text-destructive">
          <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
        </ul>
      </div>

      <!-- Task Information -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Truck class="h-5 w-5" />
            Task Information
          </h3>
          <Badge :variant="getPriorityVariant(taskPriority)">
            {{ getPriorityLabel(taskPriority) }} Priority
          </Badge>
        </div>

        <Card>
          <CardContent class="p-4">
            <div class="space-y-4">
              <!-- Task Title -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Task Title *</Label>
                <Input
                  v-model="taskTitle"
                  placeholder="e.g., Pick up order from Shop A, Deliver to customer"
                  required
                />
              </div>

              <!-- Task Type and Priority -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Task Type *</Label>
                  <FilterSelect
                    :model-value="taskType"
                    @update:model-value="handleTaskTypeChange"
                    :options="taskTypeOptions"
                  />
                </div>

                <div>
                  <Label class="text-xs text-muted-foreground mb-1 block">Priority *</Label>
                  <FilterSelect
                    :model-value="taskPriority"
                    @update:model-value="handleTaskPriorityChange"
                    :options="taskPriorityOptions"
                  />
                </div>
              </div>

              <!-- Task Details -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Task Details</Label>
                <Textarea
                  v-model="taskDetails"
                  placeholder="Add any additional details or instructions..."
                  :rows="3"
                />
              </div>

              <!-- Task Location -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">Location *</Label>
                <FilterSelect
                  :model-value="taskLocation"
                  @update:model-value="handleLocationChange"
                  :options="locationOptions"
                  placeholder="Select location..."
                />
              </div>

              <!-- Custom Address (shown when "Other" is selected) -->
              <div v-if="showCustomAddress">
                <Label class="text-xs text-muted-foreground mb-1 block">Custom Address *</Label>
                <Input
                  v-model="customAddress"
                  placeholder="123 Main St, Toronto, ON M5V 2T6"
                  required
                />
              </div>

              <!-- To Be Completed By -->
              <div>
                <Label class="text-xs text-muted-foreground mb-1 block">To Be Completed By *</Label>
                <DateInput v-model="completeBy" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Files -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Paperclip class="h-5 w-5" />
          Files
        </h3>
        <Card>
          <CardContent class="p-8">
            <div class="flex items-center justify-center text-sm text-muted-foreground">
              File upload coming soon
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Notes Section -->
      <div>
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare class="h-5 w-5" />
          Notes ({{ notes.length }})
        </h3>

        <Card>
          <CardContent class="p-4">
            <!-- Existing Notes -->
            <div v-if="notes.length === 0" class="text-sm text-muted-foreground text-center py-8">
              No notes yet
            </div>
            <div v-else class="space-y-3 mb-4">
              <div
                v-for="note in notes"
                :key="note.id"
                class="border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="text-sm font-semibold">{{ note.created_by }}</div>
                    </div>
                    <div class="text-xs text-muted-foreground">{{ formatNoteDate(note.created_at) }}</div>
                  </div>
                  <div class="flex gap-1">
                    <button
                      @click="startEditNote(note)"
                      class="rounded-md p-1 transition-colors hover:bg-accent"
                      title="Edit note"
                    >
                      <Edit2 class="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      @click="deleteNote(note.id)"
                      class="rounded-md p-1 transition-colors hover:bg-destructive/10"
                      title="Delete note"
                    >
                      <Trash2 class="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>

                <!-- Edit mode -->
                <div v-if="editingNoteId === note.id" class="space-y-2">
                  <Textarea
                    v-model="editingNoteContent"
                    :rows="3"
                  />
                  <div class="flex gap-2 justify-end">
                    <Button
                      @click="cancelEditNote"
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      @click="saveEditNote"
                      size="sm"
                      :disabled="!editingNoteContent.trim()"
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <!-- View mode -->
                <div v-else class="text-sm whitespace-pre-wrap">{{ note.content }}</div>
              </div>
            </div>

            <!-- Add Note Form -->
            <div class="border-t pt-4 space-y-3">
              <Textarea
                v-model="newNoteContent"
                :rows="3"
                placeholder="Write a note..."
              />
              <div class="flex justify-end">
                <Button
                  @click="addNote"
                  :disabled="!newNoteContent.trim()"
                  size="sm"
                >
                  Add Note
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Footer Actions -->
      <div class="flex gap-3 sticky bottom-0 bg-background pt-4 border-t">
        <Button size="lg" class="flex-1" @click="createTask">Create Task</Button>
        <Button variant="outline" size="lg" @click="cancel">Cancel</Button>
      </div>
    </div>
  </Sheet>
</template>
