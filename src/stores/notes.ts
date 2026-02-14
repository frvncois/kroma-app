import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Note, NoteEntityType, NoteDepartment } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'

export const useNoteStore = defineStore('notes', () => {
  // State
  const notesByEntity = ref<Map<string, Note[]>>(new Map())
  const activeSubscriptions = ref<Set<string>>(new Set())
  const realtimeChannels = ref<Map<string, any>>(new Map())

  // Helper to build cache key
  function getCacheKey(entityType: NoteEntityType, entityId: string): string {
    return `${entityType}:${entityId}`
  }

  // Actions
  async function fetchNotes(
    entityType: NoteEntityType,
    entityId: string
  ): Promise<Note[]> {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*, users:created_by(name)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching notes:', error)
        return []
      }

      if (data) {
        const notes = data as Note[]
        const cacheKey = getCacheKey(entityType, entityId)
        notesByEntity.value.set(cacheKey, notes)
        console.log(`Notes loaded for ${cacheKey}:`, notes.length)
        return notes
      }

      return []
    } catch (error) {
      console.error('Failed to fetch notes:', error)
      return []
    }
  }

  async function subscribeToNotes(
    entityType: NoteEntityType,
    entityId: string
  ) {
    const cacheKey = getCacheKey(entityType, entityId)

    // Skip if already subscribed
    if (activeSubscriptions.value.has(cacheKey)) {
      console.log(`Already subscribed to ${cacheKey}`)
      return
    }

    // Fetch initial notes
    await fetchNotes(entityType, entityId)

    // Set up realtime subscription
    const channel = supabase
      .channel(`notes:${cacheKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          const currentNotes = notesByEntity.value.get(cacheKey) || []

          if (payload.eventType === 'INSERT') {
            const newNote = payload.new as Note
            // Only add if it matches our entity type (filter doesn't catch this)
            if (newNote.entity_type === entityType) {
              notesByEntity.value.set(cacheKey, [newNote, ...currentNotes])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedNote = payload.new as Note
            if (updatedNote.entity_type === entityType) {
              const updated = currentNotes.map((note) =>
                note.id === updatedNote.id ? updatedNote : note
              )
              notesByEntity.value.set(cacheKey, updated)
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            const filtered = currentNotes.filter((note) => note.id !== deletedId)
            notesByEntity.value.set(cacheKey, filtered)
          }
        }
      )
      .subscribe()

    // Track subscription
    activeSubscriptions.value.add(cacheKey)
    realtimeChannels.value.set(cacheKey, channel)
    console.log(`Subscribed to notes for ${cacheKey}`)
  }

  function unsubscribeFromNotes(
    entityType: NoteEntityType,
    entityId: string
  ) {
    const cacheKey = getCacheKey(entityType, entityId)

    if (!activeSubscriptions.value.has(cacheKey)) {
      return
    }

    // Remove realtime channel
    const channel = realtimeChannels.value.get(cacheKey)
    if (channel) {
      supabase.removeChannel(channel)
      realtimeChannels.value.delete(cacheKey)
    }

    // Remove from subscriptions
    activeSubscriptions.value.delete(cacheKey)
    console.log(`Unsubscribed from notes for ${cacheKey}`)
  }

  async function addNote(
    entityType: NoteEntityType,
    entityId: string,
    content: string,
    departments: NoteDepartment[]
  ): Promise<Note | null> {
    try {
      const authStore = useAuthStore()

      const { data, error } = await supabase
        .from('notes')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          content,
          departments,
          created_by: authStore.currentUser?.id || 'system',
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding note:', error)
        return null
      }

      if (data) {
        const newNote = data as Note
        // Realtime subscription will update local state automatically
        console.log('Note added:', newNote.id)

        // TODO: Write activity to activities table when that store is migrated
        // For now, activities are handled by the component/order store

        return newNote
      }

      return null
    } catch (error) {
      console.error('Failed to add note:', error)
      return null
    }
  }

  async function updateNote(
    noteId: string,
    newContent: string,
    entityType: NoteEntityType,
    entityId: string
  ): Promise<Note | null> {
    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ content: newContent })
        .eq('id', noteId)
        .select()
        .single()

      if (error) {
        console.error('Error updating note:', error)
        return null
      }

      if (data) {
        const updatedNote = data as Note
        // Realtime subscription will update local state automatically
        console.log('Note updated:', noteId)
        return updatedNote
      }

      return null
    } catch (error) {
      console.error('Failed to update note:', error)
      return null
    }
  }

  async function deleteNote(
    noteId: string,
    entityType: NoteEntityType,
    entityId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

      if (error) {
        console.error('Error deleting note:', error)
        return false
      }

      // Realtime subscription will update local state automatically
      console.log('Note deleted:', noteId)
      return true
    } catch (error) {
      console.error('Failed to delete note:', error)
      return false
    }
  }

  function getNotesForEntity(
    entityType: NoteEntityType,
    entityId: string
  ): Note[] {
    const cacheKey = getCacheKey(entityType, entityId)
    return notesByEntity.value.get(cacheKey) || []
  }

  function cleanup() {
    // Clean up all subscriptions
    realtimeChannels.value.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    realtimeChannels.value.clear()
    activeSubscriptions.value.clear()
    notesByEntity.value.clear()
  }

  return {
    // State
    notesByEntity,
    activeSubscriptions,
    // Actions
    fetchNotes,
    subscribeToNotes,
    unsubscribeFromNotes,
    addNote,
    updateNote,
    deleteNote,
    getNotesForEntity,
    cleanup,
  }
})
