import { supabase } from './supabase'
import type { OrderFile, FileType, FileEntityType } from '@/types'

/**
 * Upload a file to Supabase Storage and create a record in order_files table
 *
 * @param entityType - The type of entity ('order_item' or 'driver_task')
 * @param entityId - The UUID of the entity
 * @param file - The File object to upload
 * @param fileType - The type of file (artwork, proof, reference, etc.)
 * @param userId - The ID of the user uploading the file
 * @returns The created file record or null if upload failed
 */
export async function uploadFile(
  entityType: FileEntityType,
  entityId: string,
  file: File,
  fileType: FileType,
  userId: string
): Promise<OrderFile | null> {
  try {
    // Generate storage path: {entity_type}/{entity_id}/{timestamp}-{filename}
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${entityType}/${entityId}/${timestamp}-${sanitizedFilename}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError)
      return null
    }

    // Insert record into order_files table
    const { data: fileRecord, error: insertError } = await supabase
      .from('order_files')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_url: uploadData.path,
        file_name: file.name,
        file_type: fileType,
        uploaded_by: userId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating file record:', insertError)
      // Try to clean up the uploaded file
      await supabase.storage.from('files').remove([storagePath])
      return null
    }

    console.log('File uploaded successfully:', fileRecord.id)
    return fileRecord as OrderFile
  } catch (error) {
    console.error('Failed to upload file:', error)
    return null
  }
}

/**
 * Get all files for a specific entity
 *
 * @param entityType - The type of entity
 * @param entityId - The UUID of the entity
 * @returns Array of file records
 */
export async function getFilesForEntity(
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
      console.error('Error fetching files for entity:', error)
      return []
    }

    return (data as OrderFile[]) || []
  } catch (error) {
    console.error('Failed to fetch files for entity:', error)
    return []
  }
}

/**
 * Delete a file from both storage and database
 *
 * @param fileId - The UUID of the file record
 * @param filePath - The storage path of the file
 * @returns True if deletion succeeded, false otherwise
 */
export async function deleteFile(fileId: string, filePath: string): Promise<boolean> {
  try {
    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([filePath])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Continue with DB deletion even if storage deletion fails
    }

    // Delete record from database
    const { error: dbError } = await supabase
      .from('order_files')
      .delete()
      .eq('id', fileId)

    if (dbError) {
      console.error('Error deleting file record:', dbError)
      return false
    }

    console.log('File deleted successfully:', fileId)
    return true
  } catch (error) {
    console.error('Failed to delete file:', error)
    return false
  }
}

/**
 * Get a signed URL for downloading a file (1 hour expiry)
 * Files are stored in a private bucket, so we need signed URLs
 *
 * @param filePath - The storage path of the file
 * @returns The signed URL or null if generation failed
 */
export async function getFileUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('files')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Failed to create signed URL:', error)
    return null
  }
}

/**
 * Get multiple signed URLs for a list of file paths
 * More efficient than calling getFileUrl multiple times
 *
 * @param filePaths - Array of storage paths
 * @returns Map of filePath -> signedUrl
 */
export async function getFileUrls(filePaths: string[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>()

  try {
    // Create signed URLs in parallel
    const results = await Promise.all(
      filePaths.map(async (path) => {
        const url = await getFileUrl(path)
        return { path, url }
      })
    )

    // Build map
    results.forEach(({ path, url }) => {
      if (url) {
        urlMap.set(path, url)
      }
    })

    return urlMap
  } catch (error) {
    console.error('Failed to create signed URLs:', error)
    return urlMap
  }
}

/**
 * Download a file by triggering browser download
 *
 * @param filePath - The storage path of the file
 * @param fileName - The filename to use for download
 */
export async function downloadFile(filePath: string, fileName: string): Promise<void> {
  try {
    const url = await getFileUrl(filePath)
    if (!url) {
      throw new Error('Failed to generate download URL')
    }

    // Create temporary link and trigger download
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Failed to download file:', error)
    throw error
  }
}

/**
 * Get file count for an order (sum of production files across all items)
 * Production files = artwork, proof, reference (not delivery/issue photos)
 *
 * @param orderItemIds - Array of order item UUIDs
 * @returns Total count of production files
 */
export async function getOrderFileCount(orderItemIds: string[]): Promise<number> {
  if (orderItemIds.length === 0) return 0

  try {
    const { count, error } = await supabase
      .from('order_files')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type', 'order_item')
      .in('entity_id', orderItemIds)
      .in('file_type', ['artwork', 'proof', 'reference'])

    if (error) {
      console.error('Error getting file count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Failed to get file count:', error)
    return 0
  }
}
