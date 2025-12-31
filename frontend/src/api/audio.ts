import apiClient from './client';

export interface AudioUploadResponse {
  uploadUrl: string;
  audioUrl: string;
  audioId: string;
}

export interface AudioLibraryItem {
  id: string;
  name: string;
  description?: string;
  url: string;
  duration: number;
  size: number;
  createdAt: string;
  tags?: string[];
}

export const audioApi = {
  /**
   * Get a presigned URL for uploading audio to S3
   */
  getUploadUrl: async (fileName: string, fileType: string): Promise<AudioUploadResponse> => {
    console.log('Calling API for presigned URL:', { fileName, fileType });
    const response = await apiClient.post('/audio/upload-url', {
      fileName,
      fileType,
    });
    console.log('API response:', response);
    console.log('API response data:', response.data);
    console.log('API response status:', response.status);
    
    // The API returns { success: true, data: {...} }, so we need response.data.data
    if (response.data.success && response.data.data) {
      return response.data.data as AudioUploadResponse;
    } else {
      throw new Error('Invalid API response format');
    }
  },

  /**
   * Upload audio file directly to S3 using presigned URL
   */
  uploadToS3: async (presignedUrl: string, file: File | Blob): Promise<void> => {
    console.log('=== S3 UPLOAD DEBUG ===');
    console.log('Starting S3 upload...');
    console.log('Presigned URL:', presignedUrl);
    console.log('File type:', file.type);
    console.log('File size:', file.size);
    
    try {
      // Try using fetch instead of axios for better error handling
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      
      console.log('S3 response status:', response.status);
      console.log('S3 response ok:', response.ok);
      console.log('S3 response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('S3 response error text:', errorText);
        throw new Error(`S3 upload failed with status ${response.status}: ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('S3 response body:', responseText);
      console.log('✅ S3 upload successful!');
      
    } catch (error) {
      console.error('❌ S3 upload failed:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error - check CORS or connectivity');
      }
      
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Complete audio upload and save metadata
   */
  completeUpload: async (audioId: string, metadata: {
    name: string;
    description?: string;
    duration: number;
    size: number;
    tags?: string[];
  }): Promise<AudioLibraryItem> => {
    const response = await apiClient.post<AudioLibraryItem>(`/audio/${audioId}/complete`, metadata);
    return response.data;
  },

  /**
   * Get all audio files from library
   */
  getLibrary: async (): Promise<AudioLibraryItem[]> => {
    const response = await apiClient.get<AudioLibraryItem[]>('/audio/library');
    return response.data;
  },

  /**
   * Get a specific audio file by ID
   */
  getAudio: async (audioId: string): Promise<AudioLibraryItem> => {
    const response = await apiClient.get<AudioLibraryItem>(`/audio/${audioId}`);
    return response.data;
  },

  /**
   * Update audio metadata
   */
  updateAudio: async (audioId: string, updates: {
    name?: string;
    description?: string;
    tags?: string[];
  }): Promise<AudioLibraryItem> => {
    const response = await apiClient.patch<AudioLibraryItem>(`/audio/${audioId}`, updates);
    return response.data;
  },

  /**
   * Delete audio file
   */
  deleteAudio: async (audioId: string): Promise<void> => {
    await apiClient.delete(`/audio/${audioId}`);
  },

  /**
   * Upload audio file (combines getting presigned URL and uploading)
   */
  uploadAudio: async (file: File | Blob, metadata: {
    name: string;
    description?: string;
    tags?: string[];
  }): Promise<AudioLibraryItem> => {
    // Step 1: Get presigned URL
    const fileName = file instanceof File ? file.name : 'recording.webm';
    const { uploadUrl, audioId } = await audioApi.getUploadUrl(fileName, file.type);

    // Step 2: Upload to S3
    await audioApi.uploadToS3(uploadUrl, file);

    // Step 3: Complete upload with metadata
    const audioMetadata = {
      ...metadata,
      duration: 0, // Will be calculated on backend
      size: file.size,
    };

    return await audioApi.completeUpload(audioId, audioMetadata);
  },

  /**
   * Get phone recording status
   */
  getPhoneRecordingStatus: async (recordingId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    audioUrl?: string;
  }> => {
    const response = await apiClient.get(`/audio/phone-recording/${recordingId}/status`);
    return response.data;
  },
};
