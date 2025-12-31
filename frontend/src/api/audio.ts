import apiClient from './client';
import axios from 'axios';

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
    const response = await apiClient.post<AudioUploadResponse>('/audio/upload-url', {
      fileName,
      fileType,
    });
    return response.data;
  },

  /**
   * Upload audio file directly to S3 using presigned URL
   */
  uploadToS3: async (presignedUrl: string, file: File | Blob): Promise<void> => {
    console.log('Starting S3 upload...');
    console.log('Presigned URL:', presignedUrl);
    console.log('File type:', file.type);
    console.log('File size:', file.size);
    
    try {
      const response = await axios.put(presignedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        // Don't transform the request data
        transformRequest: [],
        // Handle any response type
        responseType: 'text',
        // Accept any 2xx status code
        validateStatus: (status) => status >= 200 && status < 300,
        // Add timeout
        timeout: 60000, // 60 seconds
      });
      
      console.log('S3 upload successful!');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
    } catch (error) {
      console.error('S3 upload failed:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('Error details:');
        console.error('- Status:', error.response?.status);
        console.error('- Status text:', error.response?.statusText);
        console.error('- Response data:', error.response?.data);
        console.error('- Response headers:', error.response?.headers);
        console.error('- Request config:', {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        });
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
