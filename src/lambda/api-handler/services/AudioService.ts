/**
 * Audio Service
 * Handles audio file uploads to S3 with presigned URLs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'il-central-1' });

// S3 bucket for audio files
const AUDIO_BUCKET = process.env.AUDIO_BUCKET || process.env.S3_BUCKET || '';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

export interface PresignedUrlResponse {
  uploadUrl: string;
  audioUrl: string;
  audioId: string;
}

export class AudioService {
  /**
   * Generate a presigned URL for uploading audio to S3
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string
  ): Promise<PresignedUrlResponse> {
    if (!AUDIO_BUCKET) {
      throw new Error('AUDIO_BUCKET environment variable not set');
    }

    const audioId = randomUUID();
    const extension = this.getExtension(fileName, fileType);
    const key = `audio/${audioId}${extension}`;

    const command = new PutObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    // Generate presigned URL valid for 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // Generate the public URL for the audio file
    let audioUrl: string;
    if (CLOUDFRONT_DOMAIN) {
      audioUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;
    } else {
      audioUrl = `https://${AUDIO_BUCKET}.s3.${process.env.AWS_REGION || 'il-central-1'}.amazonaws.com/${key}`;
    }

    console.log('Generated presigned URL for audio upload:', {
      audioId,
      key,
      fileType,
      audioUrl,
    });

    return {
      uploadUrl,
      audioUrl,
      audioId,
    };
  }

  /**
   * Get file extension from filename or content type
   */
  private getExtension(fileName: string, fileType: string): string {
    // Try to get extension from filename
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    if (fileExt && ['mp3', 'wav', 'ogg', 'webm', 'm4a'].includes(fileExt)) {
      return `.${fileExt}`;
    }

    // Fall back to content type
    const typeMap: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'audio/x-m4a': '.m4a',
      'audio/mp4': '.m4a',
    };

    return typeMap[fileType] || '.audio';
  }
}
