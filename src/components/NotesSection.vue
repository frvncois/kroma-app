<script setup lang="ts">
import { ref } from 'vue'
import type { OrderNote, NoteDepartment } from '@/types'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Badge from '@/components/ui/Badge.vue'
import FilterSelect from '@/components/ui/FilterSelect.vue'
import { MessageSquare, Edit2, Trash2 } from 'lucide-vue-next'

interface Props {
  notes: OrderNote[]
  itemOptions: { value: string; label: string }[]
  departmentOptions: { value: string; label: string }[]
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  'add-note': [content: string, departments: NoteDepartment[], itemReference: string | null]
  'edit-note': [noteId: string, newContent: string]
  'delete-note': [noteId: string]
}>()

// Add note state
const newNoteContent = ref('')
const selectedDepartment = ref<string>('everyone')
const selectedItemReference = ref<string>('order')

// Edit note state
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')

const getDepartmentLabel = (dept: NoteDepartment): string => {
  switch (dept) {
    case 'printshop':
      return 'Printshop Manager'
    case 'delivery':
      return 'Delivery'
    case 'billing':
      return 'Billing Department'
    case 'everyone':
      return 'Everyone'
  }
}

const formatNoteDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

const addNote = () => {
  if (!newNoteContent.value.trim()) return

  const departments = selectedDepartment.value === 'everyone'
    ? ['everyone' as NoteDepartment]
    : [selectedDepartment.value as NoteDepartment]

  const itemReference = selectedItemReference.value === 'order' ? null : selectedItemReference.value

  emit('add-note', newNoteContent.value, departments, itemReference)

  // Reset form
  newNoteContent.value = ''
  selectedDepartment.value = 'everyone'
  selectedItemReference.value = 'order'
}

const startEditNote = (note: OrderNote) => {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

const saveEditNote = () => {
  if (!editingNoteId.value || !editingNoteContent.value.trim()) return

  emit('edit-note', editingNoteId.value, editingNoteContent.value)

  editingNoteId.value = null
  editingNoteContent.value = ''
}

const cancelEditNote = () => {
  editingNoteId.value = null
  editingNoteContent.value = ''
}

const deleteNote = (noteId: string) => {
  emit('delete-note', noteId)
}
</script>

<template>
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
                  <Badge v-if="note.item_reference" variant="outline" class="text-xs">
                    {{ note.item_reference }}
                  </Badge>
                </div>
                <div class="text-xs text-muted-foreground">{{ formatNoteDate(note.created_at) }}</div>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="dept in note.departments"
                    :key="dept"
                    variant="secondary"
                    class="text-xs"
                  >
                    {{ getDepartmentLabel(dept) }}
                  </Badge>
                </div>
                <div v-if="!readonly" class="flex gap-1">
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
        <div v-if="!readonly" class="border-t pt-4 space-y-3">
          <Textarea
            v-model="newNoteContent"
            :rows="3"
            placeholder="Write a note..."
          />
          <div class="flex items-center gap-2">
            <FilterSelect
              v-model="selectedItemReference"
              :options="itemOptions"
              class="w-48"
            />
            <FilterSelect
              v-model="selectedDepartment"
              :options="departmentOptions"
              class="w-40"
            />
            <Button
              @click="addNote"
              :disabled="!newNoteContent.trim()"
              size="sm"
              class="ml-auto"
            >
              Add Note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
