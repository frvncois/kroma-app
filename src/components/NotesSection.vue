<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { OrderNote, NoteDepartment } from '@/types'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Badge from '@/components/ui/Badge.vue'
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
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Mention autocomplete state
const showMentions = ref(false)
const mentionType = ref<'@' | '/' | null>(null)
const mentionSearch = ref('')
const mentionPosition = ref(0)
const selectedMentionIndex = ref(0)

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

// Mention suggestions
const mentionSuggestions = computed(() => {
  if (!showMentions.value) return []

  const search = mentionSearch.value.toLowerCase()

  if (mentionType.value === '@') {
    return props.departmentOptions
      .filter(opt => opt.label.toLowerCase().includes(search))
      .map(opt => ({ value: opt.value, label: opt.label, type: '@' as const }))
  } else if (mentionType.value === '/') {
    return props.itemOptions
      .filter(opt => opt.label.toLowerCase().includes(search))
      .map(opt => ({ value: opt.value, label: opt.label, type: '/' as const }))
  }

  return []
})

// Handle textarea input
const handleInput = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  const value = textarea.value
  const cursorPos = textarea.selectionStart

  newNoteContent.value = value

  // Check for mention triggers
  const textBeforeCursor = value.slice(0, cursorPos)
  const lastAtIndex = textBeforeCursor.lastIndexOf('@')
  const lastSlashIndex = textBeforeCursor.lastIndexOf('/')
  const lastSpaceIndex = Math.max(textBeforeCursor.lastIndexOf(' '), textBeforeCursor.lastIndexOf('\n'))

  // Check if @ or / is after the last space (meaning it's a potential mention)
  if (lastAtIndex > lastSpaceIndex && lastAtIndex >= 0) {
    mentionType.value = '@'
    mentionSearch.value = textBeforeCursor.slice(lastAtIndex + 1)
    mentionPosition.value = lastAtIndex
    showMentions.value = true
    selectedMentionIndex.value = 0
  } else if (lastSlashIndex > lastSpaceIndex && lastSlashIndex >= 0) {
    mentionType.value = '/'
    mentionSearch.value = textBeforeCursor.slice(lastSlashIndex + 1)
    mentionPosition.value = lastSlashIndex
    showMentions.value = true
    selectedMentionIndex.value = 0
  } else {
    showMentions.value = false
    mentionType.value = null
  }
}

// Handle mention selection
const selectMention = (mention: { value: string; label: string; type: '@' | '/' }) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const beforeMention = newNoteContent.value.slice(0, mentionPosition.value)
  const afterCursor = newNoteContent.value.slice(textarea.selectionStart)

  newNoteContent.value = `${beforeMention}${mention.type}${mention.label} ${afterCursor}`

  showMentions.value = false
  mentionType.value = null

  nextTick(() => {
    const newCursorPos = beforeMention.length + mention.type.length + mention.label.length + 1
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// Handle keyboard navigation in mentions
const handleKeyDown = (event: KeyboardEvent) => {
  if (!showMentions.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedMentionIndex.value = Math.min(selectedMentionIndex.value + 1, mentionSuggestions.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedMentionIndex.value = Math.max(selectedMentionIndex.value - 1, 0)
  } else if (event.key === 'Enter' && mentionSuggestions.value.length > 0) {
    event.preventDefault()
    const mention = mentionSuggestions.value[selectedMentionIndex.value]
    if (mention) {
      selectMention(mention)
    }
  } else if (event.key === 'Escape') {
    showMentions.value = false
    mentionType.value = null
  }
}

// Parse mentions from note content
const parseMentions = (content: string) => {
  const departments: NoteDepartment[] = []
  let itemReference: string | null = null

  // Extract @mentions (departments)
  const atMentions = content.match(/@([A-Za-z\s]+)/g) || []
  for (const mention of atMentions) {
    const label = mention.slice(1).trim()
    const dept = props.departmentOptions.find(opt => opt.label === label)
    if (dept && !departments.includes(dept.value as NoteDepartment)) {
      departments.push(dept.value as NoteDepartment)
    }
  }

  // Extract /mentions (items)
  const slashMentions = content.match(/\/([A-Za-z0-9\s\-]+)/g) || []
  if (slashMentions.length > 0 && slashMentions[0]) {
    const label = slashMentions[0].slice(1).trim()
    const item = props.itemOptions.find(opt => opt.label === label)
    if (item && item.value !== 'order') {
      itemReference = item.value
    }
  }

  // Default to everyone if no departments mentioned
  if (departments.length === 0) {
    departments.push('everyone')
  }

  return { departments, itemReference }
}

const addNote = () => {
  if (!newNoteContent.value.trim()) return

  const { departments, itemReference } = parseMentions(newNoteContent.value)

  emit('add-note', newNoteContent.value, departments, itemReference)

  // Reset form
  newNoteContent.value = ''
  showMentions.value = false
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

// Reset selected index when suggestions change
watch(() => mentionSuggestions.value.length, () => {
  selectedMentionIndex.value = 0
})
</script>

<template>
  <div>
    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <div class="p-2 bg-accent rounded-lg">
        <MessageSquare class="h-4 w-4" />
      </div>
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
          <div class="relative">
            <Textarea
              ref="textareaRef"
              :model-value="newNoteContent"
              @input="handleInput"
              @keydown="handleKeyDown"
              :rows="3"
              placeholder="Write a note... (Use @ to tag people, / to reference items)"
            />

            <!-- Mention Autocomplete Dropdown -->
            <div
              v-if="showMentions && mentionSuggestions.length > 0"
              class="absolute z-50 mt-1 w-64 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg"
              style="bottom: 100%"
            >
              <div
                v-for="(mention, index) in mentionSuggestions"
                :key="mention.value"
                @click="selectMention(mention)"
                :class="[
                  'cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors',
                  index === selectedMentionIndex ? 'bg-accent' : ''
                ]"
              >
                <span class="font-mono text-muted-foreground mr-2">{{ mention.type }}</span>
                {{ mention.label }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="text-xs text-muted-foreground">
              Tip: Type <span class="font-mono bg-muted px-1 rounded">@</span> to tag people or <span class="font-mono bg-muted px-1 rounded">/</span> to reference items
            </div>
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
