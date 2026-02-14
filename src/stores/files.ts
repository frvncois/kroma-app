import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OrderFile, FileEntityType, FileType } from '@/types'
import { supabase } from '@/lib/supabase'
import { uploadFile as uploadFileService, deleteFile as deleteFileService } from '@/lib/file-service'

export const useFileStore = defineStore('files', () => {
  // State - Map-based caching by entity
  const filesByEntity = ref<Map<string, OrderFile[]>>(new Map())
  const activeSubscriptions = ref<Set<string>>(new Set())
  const realtimeChannels = ref<Map<string, any>>(new Map())

  // Helper to build cache key
  function getCacheKey(entityType: FileEntityType, entityId: string): string {
    return `${entityType}:${entityId}`
  }

  // Actions
  async function fetchFiles(
    entityType: FileEntityType,
    entityId: string
  ): Promise<OrderFile[]> {
    try {
      const { data, error } = await supabase
        .from('order_files')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching files:', error)
        return []
      }

      if (data) {
        const files = data as OrderFile[]
        const cacheKey = getCacheKey(entityType, entityId)
        filesByEntity.value.set(cacheKey, files)
        console.log(`Files loaded for ${cacheKey}:`, files.length)
        return files
      }

      return []
    } catch (error) {
      console.error('Failed to fetch files:', error)
      return []
    }
  }

  async function subscribeToFiles(entityType: FileEntityType, entityId: string) {
    const cacheKey = getCacheKey(entityType, entityId)

    // Skip if already subscribed
    if (activeSubscriptions.value.has(cacheKey)) {
      console.log(`Already subscribed to ${cacheKey}`)
      return
    }

    // Fetch initial files
    await fetchFiles(entityType, entityId)

    // Set up realtime subscription
    const channel = supabase
      .channel(`files:${cacheKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_files',
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          const currentFiles = filesByEntity.value.get(cacheKey) || []

          if (payload.eventType === 'INSERT') {
            const newFile = payload.new as OrderFile
            // Only add if it matches our entity type (filter doesn't catch this)
            if (newFile.entity_type === entityType) {
              filesByEntity.value.set(cacheKey, [newFile, ...currentFiles])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedFile = payload.new as OrderFile
            if (updatedFile.entity_type === entityType) {
              const updated = currentFiles.map((file) =>
                file.id === updatedFile.id ? updatedFile : file
              )
              filesByEntity.value.set(cacheKey, updated)
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            const filtered = currentFiles.filter((file) => file.id !== deletedId)
            filesByEntity.value.set(cacheKey, filtered)
          }
        }
      )
      .subscribe()

    // Track subscription
    activeSubscriptions.value.add(cacheKey)
    realtimeChannels.value.set(cacheKey, channel)
    console.log(`Subscribed to files for ${cacheKey}`)
  }

  function unsubscribeFromFiles(entityType: FileEntityType, entityId: string) {
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
    console.log(`Unsubscribed from files for ${cacheKey}`)
  }

  async function uploadFile(
    entityType: FileEntityType,
    entityId: string,
    file: File,
    fileType: FileType,
    userId: string
  ): Promise<OrderFile | null> {
    const newFile = await uploadFileService(entityType, entityId, file, fileType, userId)

    if (newFile) {
      // Update local cache
      const cacheKey = getCacheKey(entityType, entityId)
      const currentFiles = filesByEntity.value.get(cacheKey) || []
      filesByEntity.value.set(cacheKey, [newFile, ...currentFiles])
    }

    return newFile
  }

  async function deleteFile(fileId: string, filePath: string): Promise<boolean> {
    const success = await deleteFileService(fileId, filePath)

    if (success) {
      // Update local cache - remove from all cached entities
      filesByEntity.value.forEach((files, cacheKey) => {
        const filtered = files.filter((file) => file.id !== fileId)
        if (filtered.length !== files.length) {
          filesByEntity.value.set(cacheKey, filtered)
        }
      })
    }

    return success
  }

  function getFilesForEntity(entityType: FileEntityType, entityId: string): OrderFile[] {
    const cacheKey = getCacheKey(entityType, entityId)
    return filesByEntity.value.get(cacheKey) || []
  }

  function cleanup() {
    // Clean up all subscriptions
    realtimeChannels.value.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    realtimeChannels.value.clear()
    activeSubscriptions.value.clear()
    filesByEntity.value.clear()
  }

  return {
    // State
    filesByEntity,
    activeSubscriptions,
    // Actions
    fetchFiles,
    subscribeToFiles,
    unsubscribeFromFiles,
    uploadFile,
    deleteFile,
    getFilesForEntity,
    cleanup,
  }
})
